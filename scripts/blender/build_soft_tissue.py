"""Build the soft-tissue layer files from the Z-Anatomy source (M6, plan step 5).

Usage (bpy as a Python module, see scripts/setup-blender.sh):
    .cache/venv/bin/python -I scripts/blender/build_soft_tissue.py <Startup.blend> <out_dir> \
        [--layer muscles|ligaments|cartilage|attachments ...] [--ao cycles|raycast] \
        [--manifest-dir assets/build]

For each layer (all four by default), the same steps as the bone build
(build_skeleton.py, shared code in pipeline_lib.py):
 1. Per ID: the viewport-evaluated mesh of every source object in
    assets/mapping/soft-to-id.json (`map` for the three layers, `attachments`
    for the insertion patches), in world space, winding flipped where the
    world matrix mirrors, parts joined (only the discs, which take in their
    nucleus pulposus). The source file is read only and never saved.
 2. Clean up (merge by distance, loose geometry, duplicate faces, small holes,
    outward normals). Non-manifold leftovers are logged.
 3. Origin to the bounds centre (origin only), then the bounds check against
    assets/audit/soft-tissue.json within 1e-4 m, failing loudly.
 4. AO per structure (Cycles bake, each structure alone) into COLOR_0.
 5. Two LODs by Decimate (collapse) to the budgets in plan decision 8.
 6. Export <layer>-{high,low}.glb (+Y up, one node per ID, no materials).
 7. Write assets/build/manifest-<layer>.json (same shape as manifest.json).

The bone files and assets/build/manifest.json are never touched.
"""
import json
import os
import sys
import time

import bpy  # must be imported before bmesh/mathutils
import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline_lib import (  # noqa: E402
    AO_DISTANCE, AO_SAMPLES, BBOX_TOL, ao_values, bake_ao_cycles, bake_ao_raycast, build_objects, check_ao,
    check_bounds, describe, export_glb, extract, lod_budget, log, make_lod, raw_bounds,
    set_origin_to_bounds_centre,
)

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MAPPING = os.path.join(REPO, "assets", "mapping", "soft-to-id.json")
AUDIT = os.path.join(REPO, "assets", "audit", "soft-tissue.json")
SOFT_IDS = os.path.join(REPO, "content", "soft-ids.json")

LAYERS = ["muscles", "ligaments", "cartilage", "attachments"]
# Plan decision 8. If a layer's source total is below the high target, the
# high file keeps the source geometry and the target becomes the source count.
LOD_TARGETS = {
    "muscles": {"high": 800_000, "low": 230_000},
    "ligaments": {"high": 120_000, "low": 40_000},
    "cartilage": {"high": 80_000, "low": 30_000},
    "attachments": {"high": 150_000, "low": 50_000},
}
# Same exponents as the bones: big meshes give up proportionally more.
LOD_ALPHA = {"high": 0.85, "low": 0.6}
# Per-object floor (triangles, or the source count if lower). 300 as for the
# bones; patches 64 (decision 8). Ligaments 100: 300 ligaments at a floor of
# 300 would already be 46k, over the 40k low target on their own.
MIN_TRIS = {"muscles": 300, "ligaments": 100, "cartilage": 300, "attachments": 64}
# Smallest AO spread (p95 - p5) that counts as a real bake. The patches are
# thin sheets lying flat, so almost nothing occludes them.
AO_MIN_SPREAD = {"muscles": 0.05, "ligaments": 0.05, "cartilage": 0.05, "attachments": 0.01}
# Orientation check by AO. Many ligaments and patches are thin sheets
# thickened by Solidify (0.1-2 mm). Their signed volume is unreliable (the
# shells overlap), so the bone rule "reverse if the volume is negative" can
# turn a correctly wound sheet inside out; its faces then look into the slab
# and bake black. A structure whose mean AO is below this is reversed and
# baked again, and the orientation with the higher mean AO is kept (logged).
AO_FLIP_BELOW = 0.3


def idmap_for(layer, mapping, soft):
    if layer == "attachments":
        return {aid: [a["source"]] for aid, a in mapping["attachments"].items()}
    return {sid: names for sid, names in mapping["map"].items() if soft[sid]["layer"] == layer}


def reverse_faces(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def fix_orientation_by_ao(objs, bake, clog):
    """Reverse structures that bake (almost) black if that makes them lighter."""
    def bake_alone(sub):
        # the bake leaves every object render-visible; hide the rest of the
        # layer so each structure still only occludes itself
        for sid, o in objs.items():
            o.hide_render = sid not in sub
        bake(sub)
        for o in objs.values():
            o.hide_render = False

    dark = {sid: float(ao_values(o).mean()) for sid, o in objs.items()}
    dark = {sid: v for sid, v in dark.items() if v < AO_FLIP_BELOW}
    if not dark:
        return {}
    sub = {sid: objs[sid] for sid in dark}
    for o in sub.values():
        reverse_faces(o)
    bake_alone(sub)
    fixed = {}
    for sid, o in sub.items():
        after = float(ao_values(o).mean())
        if after > dark[sid]:
            fixed[sid] = {"meanAoBefore": round(dark[sid], 3), "meanAoAfter": round(after, 3)}
            clog[sid]["reversedByAoCheck"] = True
        else:  # reversing didn't help: put it back as it was
            reverse_faces(o)
            bake_alone({sid: o})
            clog[sid]["reversedByAoCheck"] = False
    log(f"orientation fixed by AO check: {fixed}; still dark: "
        f"{sorted(set(dark) - set(fixed))}")
    return fixed


def build_layer(layer, src, out_dir, manifest_dir, mapping, soft, by_name, ao_method):
    idmap = idmap_for(layer, mapping, soft)
    t_layer = time.time()
    t0 = time.time()
    geo = extract(src, idmap)
    log(f"[{layer}] extracted {len(geo)} IDs in {time.time() - t0:.1f}s")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    base_coll = bpy.data.collections.new("base")
    scene.collection.children.link(base_coll)

    t0 = time.time()
    raw = {sid: raw_bounds(co, faces) for sid, (co, faces) in geo.items()}
    objs, clog = build_objects(geo, base_coll)
    del geo
    log(f"[{layer}] built and cleaned {len(objs)} objects in {time.time() - t0:.1f}s")

    for o in objs.values():
        set_origin_to_bounds_centre(o)
    shrunk = check_bounds(objs, raw, idmap, by_name, what=f"{layer} structure")

    t0 = time.time()
    ao_used = ao_method
    if ao_method == "cycles":
        try:
            bake_ao_cycles(objs, "object")
        except Exception as exc:  # noqa: BLE001
            log(f"[{layer}] Cycles AO bake failed ({exc}); falling back to ray-cast AO")
            ao_used = "raycast"
    if ao_used == "raycast":
        bake_ao_raycast(objs, "object")
    bake = (lambda sub: bake_ao_cycles(sub, "object")) if ao_used == "cycles" else \
        (lambda sub: bake_ao_raycast(sub, "object"))
    flipped = fix_orientation_by_ao(objs, bake, clog)
    ao_secs = time.time() - t0
    log(f"[{layer}] AO ({ao_used}) in {ao_secs:.1f}s")
    ao_stats = check_ao(objs, f"{layer} after bake", AO_MIN_SPREAD[layer])

    counts = {sid: len(o.data.polygons) for sid, o in objs.items()}
    source_tris = sum(counts.values())
    weights = {sid: 1.0 for sid in objs}
    for sid, o in objs.items():
        o.name = o.data.name = f"{sid}__base"
    manifest = {
        "generator": "scripts/blender/build_soft_tissue.py",
        "layer": layer,
        "blenderVersion": bpy.app.version_string,
        "coordinateSystem": "glTF: metres, +Y up, facing +Z, patient's right is -X",
        "ao": {
            "method": ao_used,
            "engine": "Cycles CPU bake (bpy.ops.object.bake type=AO, target=VERTEX_COLORS)"
            if ao_used == "cycles" else "scripted BVHTree hemisphere ray-cast",
            "scope": "object",
            "attribute": "COLOR_0 (greyscale, 1 = unoccluded)",
            "samples": AO_SAMPLES,
            "distanceM": AO_DISTANCE,
            "seconds": round(ao_secs, 1),
            "stats": ao_stats,
        },
        "lods": {},
        "objects": {sid: {"lods": {}} for sid in sorted(objs)},
        "orientationFixedByAo": flipped,
        "boundsCheck": {"toleranceM": BBOX_TOL, "bboxShrunkByLooseVertexRemovalM": shrunk},
        "sourceTris": source_tris,
        "cleanup": clog,
    }
    for lod, target in LOD_TARGETS[layer].items():
        eff = min(target, source_tris)
        budget = lod_budget(counts, weights, eff, LOD_ALPHA[lod], MIN_TRIS[layer])
        coll = bpy.data.collections.new(lod)
        scene.collection.children.link(coll)
        lobjs = make_lod(objs, budget, coll)
        check_ao(lobjs, f"{layer} {lod} LOD", AO_MIN_SPREAD[layer])
        path = os.path.join(out_dir, f"{layer}-{lod}.glb")
        export_glb(lobjs, path)
        tris = 0
        for sid, o in lobjs.items():
            d = describe(o)
            tris += d["tris"]
            manifest["objects"][sid]["lods"][lod] = d
        manifest["lods"][lod] = {"file": os.path.basename(path), "targetTris": eff,
                                 "plannedTargetTris": target, "tris": tris,
                                 "alpha": LOD_ALPHA[lod], "minTrisPerObject": MIN_TRIS[layer],
                                 "classWeights": {"all": 1.0},
                                 "bytesUncompressed": os.path.getsize(path)}
        log(f"[{layer}] {lod}: {tris} tris (target {eff}) -> {path} "
            f"({os.path.getsize(path) / 1e6:.1f} MB)")
        for o in list(lobjs.values()):
            me = o.data
            bpy.data.objects.remove(o)
            bpy.data.meshes.remove(me)
        bpy.data.collections.remove(coll)
    manifest["seconds"] = round(time.time() - t_layer, 1)
    path = os.path.join(manifest_dir, f"manifest-{layer}.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=1)
    log(f"[{layer}] wrote {path} ({manifest['seconds']} s)")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    layers, ao_method = [], "cycles"
    manifest_dir = os.path.join(REPO, "assets", "build")
    pos = []
    i = 0
    while i < len(argv):
        if argv[i] == "--layer":
            layers.append(argv[i + 1]); i += 2
        elif argv[i] == "--ao":
            ao_method = argv[i + 1]; i += 2
        elif argv[i] == "--manifest-dir":
            manifest_dir = argv[i + 1]; i += 2
        else:
            pos.append(argv[i]); i += 1
    src, out_dir = pos
    layers = layers or LAYERS
    bad = [l for l in layers if l not in LAYERS]
    if bad:
        raise SystemExit(f"unknown layer(s): {bad}; expected {LAYERS}")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(manifest_dir, exist_ok=True)
    mapping = json.load(open(MAPPING))
    soft = {e["id"]: e for e in json.load(open(SOFT_IDS))}
    by_name = {o["name"]: o for o in json.load(open(AUDIT))["objects"]}
    for layer in layers:
        build_layer(layer, src, out_dir, manifest_dir, mapping, soft, by_name, ao_method)


if __name__ == "__main__":
    main()
