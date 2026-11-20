"""Build the Skeleton Viewer model from the Z-Anatomy source (Milestone 1, step 3).

Usage (bpy as a Python module, see scripts/setup-blender.sh):
    .cache/venv/bin/python -I scripts/blender/build_skeleton.py <Startup.blend> <out_dir> \
        [--ao cycles|raycast] [--ao-scope object|skeleton] [--manifest assets/build/manifest.json]

Steps (see CLAUDE.md, "Session B"):
 1. For every ID in assets/mapping/source-to-id.json, take the evaluated mesh
    (modifiers applied) of each source object, transform it to world space,
    flip the winding if the world matrix mirrors, and join the parts. The
    source file is read only and never saved; the result is built in a fresh,
    empty Blender file.
 2. Clean up: merge by distance, delete loose geometry and duplicate faces,
    fill small holes, make normals point outward. Non-manifold leftovers are
    logged.
 3. Move each object's origin to its bounding-box centre (vertices stay put in
    world space) and assert the world bbox still matches the audit.
 4. Bake ambient occlusion into a per-vertex colour attribute (COLOR_0).
 5. Make two LODs with the Decimate (collapse) modifier.
 6. Export each LOD as .glb (+Y up, one node per object named by stable ID).
 7. Write the manifest (triangles, bounds, centroid per ID per LOD, in glTF
    Y-up coordinates) plus the AO method and the cleanup log.

The shared steps live in scripts/blender/pipeline_lib.py (also used by
build_soft_tissue.py). Nothing is ever translated, rotated or re-posed: the world transform is baked
into the vertices exactly once, and only origins move afterwards.
"""
import json
import os
import sys
import time

import bpy  # must be imported before bmesh/mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline_lib import (  # noqa: E402
    AO_DISTANCE, AO_SAMPLES, BBOX_TOL, MIN_TRIS, bake_ao_cycles, bake_ao_raycast, build_objects,
    check_ao, check_bounds, describe, export_glb, extract, lod_budget, log, make_lod, raw_bounds,
    set_origin_to_bounds_centre,
)

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MAPPING = os.path.join(REPO, "assets", "mapping", "source-to-id.json")
AUDIT = os.path.join(REPO, "assets", "audit", "z-anatomy.json")
IDS = os.path.join(REPO, "content", "ids.json")

LOD_TARGETS = {"high": 500_000, "low": 150_000}
# Exponent for the per-object triangle budget t = k * n^alpha: below 1 means
# big meshes give up proportionally more than small ones.
LOD_ALPHA = {"high": 0.85, "low": 0.6}
# Per-class multipliers on the decimation budget: small, detailed parts keep
# more, large flat bones give up more (first matching rule wins).
LOD_WEIGHTS = [
    (lambda e: e["kind"] == "tooth", 2.5),
    (lambda e: "ossicles" in e["group"], 2.5),
    (lambda e: "phalanges" in e["group"], 2.5),
    (lambda e: e["id"].startswith("scapula"), 0.6),
    (lambda e: "ribs" in e["group"], 0.6),
    (lambda e: "cranial" in e["group"] or "facial" in e["group"], 0.6),
]


def lod_weight(entry):
    for rule, w in LOD_WEIGHTS:
        if rule(entry):
            return w
    return 1.0


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ao_method = "cycles"
    ao_scope = "object"
    manifest_path = os.path.join(REPO, "assets", "build", "manifest.json")
    pos = []
    i = 0
    while i < len(argv):
        if argv[i] == "--ao":
            ao_method = argv[i + 1]; i += 2
        elif argv[i] == "--ao-scope":
            ao_scope = argv[i + 1]; i += 2
        elif argv[i] == "--manifest":
            manifest_path = argv[i + 1]; i += 2
        else:
            pos.append(argv[i]); i += 1
    src, out_dir = pos
    os.makedirs(out_dir, exist_ok=True)
    mapping = json.load(open(MAPPING))
    audit = json.load(open(AUDIT))

    t0 = time.time()
    geo = extract(src, mapping["map"])
    log(f"extracted {len(geo)} IDs in {time.time() - t0:.1f}s")

    # fresh, empty file: the source is gone from memory and never saved
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
    log(f"built and cleaned {len(objs)} objects in {time.time() - t0:.1f}s")

    for o in objs.values():
        set_origin_to_bounds_centre(o)
    shrunk = check_bounds(objs, raw, mapping["map"], {o["name"]: o for o in audit["objects"]})

    t0 = time.time()
    ao_used = ao_method
    if ao_method == "cycles":
        try:
            bake_ao_cycles(objs, ao_scope)
        except Exception as exc:  # noqa: BLE001
            log(f"Cycles AO bake failed ({exc}); falling back to ray-cast AO")
            ao_used = "raycast"
    if ao_used == "raycast":
        bake_ao_raycast(objs, ao_scope)
    ao_secs = time.time() - t0
    log(f"AO ({ao_used}) in {ao_secs:.1f}s")
    ao_stats = check_ao(objs, "after bake")

    counts = {sid: len(o.data.polygons) for sid, o in objs.items()}
    entries = {e["id"]: e for e in json.load(open(IDS))}
    weights = {sid: lod_weight(entries[sid]) for sid in objs}
    # free the stable IDs for the exported LOD objects (Blender names are unique)
    for sid, o in objs.items():
        o.name = o.data.name = f"{sid}__base"
    manifest = {
        "generator": "scripts/blender/build_skeleton.py",
        "blenderVersion": bpy.app.version_string,
        "coordinateSystem": "glTF: metres, +Y up, facing +Z, patient's right is -X",
        "ao": {
            "method": ao_used,
            "engine": "Cycles CPU bake (bpy.ops.object.bake type=AO, target=VERTEX_COLORS)"
            if ao_used == "cycles" else "scripted BVHTree hemisphere ray-cast",
            "scope": ao_scope,
            "attribute": "COLOR_0 (greyscale, 1 = unoccluded)",
            "samples": AO_SAMPLES,
            "distanceM": AO_DISTANCE,
            "seconds": round(ao_secs, 1),
            "stats": ao_stats,
        },
        "lods": {},
        "objects": {sid: {"lods": {}} for sid in sorted(objs)},
        "boundsCheck": {
            "toleranceM": BBOX_TOL,
            "bboxShrunkByLooseVertexRemovalM": shrunk,
        },
        "cleanup": clog,
    }
    for lod, target in LOD_TARGETS.items():
        budget = lod_budget(counts, weights, target, LOD_ALPHA[lod])
        coll = bpy.data.collections.new(lod)
        scene.collection.children.link(coll)
        base_coll.hide_viewport = False
        lobjs = make_lod(objs, budget, coll)
        check_ao(lobjs, f"{lod} LOD")
        path = os.path.join(out_dir, f"skeleton-{lod}.glb")
        base_coll.hide_select = False
        export_glb(lobjs, path)
        tris = 0
        for sid, o in lobjs.items():
            d = describe(o)
            tris += d["tris"]
            manifest["objects"][sid]["lods"][lod] = d
        manifest["lods"][lod] = {"file": os.path.basename(path), "targetTris": target,
                                 "tris": tris, "alpha": LOD_ALPHA[lod],
                                 "minTrisPerObject": MIN_TRIS,
                                 "classWeights": {"teeth/ossicles/phalanges": 2.5,
                                                  "scapula/ribs/cranial/facial": 0.6,
                                                  "other": 1.0},
                                 "bytesUncompressed": os.path.getsize(path)}
        log(f"{lod}: {tris} tris -> {path} ({os.path.getsize(path) / 1e6:.1f} MB)")
        for o in list(lobjs.values()):
            me = o.data
            bpy.data.objects.remove(o)
            bpy.data.meshes.remove(me)
        bpy.data.collections.remove(coll)

    manifest["sourceTris"] = sum(counts.values())
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, "w") as fh:
        json.dump(manifest, fh, indent=1)
    log(f"wrote {manifest_path}")


if __name__ == "__main__":
    main()
