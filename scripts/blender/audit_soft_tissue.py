"""Audit the soft tissue in the Z-Anatomy source (Milestone 6, session P, step 1-2).

Usage (bpy as a Python module, see scripts/setup-blender.sh):
    python -I scripts/blender/audit_soft_tissue.py <Startup.blend> <out.json>

Records raw facts for every mesh with faces under "2: Muscular insertions",
"3: Joints", "4: Muscular system", and the meshes under "1: Skeletal system"
that the bone build does not use (cartilage and the rest). Stats come from
the evaluated mesh (modifiers applied) in world space, exactly as for bones
(`mesh_stats` in audit_source.py).

For each muscular-insertion patch it also measures how far the patch's
vertices lie from the surface of the bone it is parented to (BVH nearest
point), which decides whether the patches can be drawn on the bones (plan
decision 12).

Classification is NOT done here; `scripts/mapping/classify_soft_tissue.py`
adds it from this file, so rules can change without reopening the source.
The source file is never saved.
"""
import json
import os
import re
import sys

import bpy  # must be imported before bmesh/mathutils
import bmesh
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit_source import collection_paths, mesh_stats  # noqa: E402

ROOTS = ["1: Skeletal system", "2: Muscular insertions", "3: Joints", "4: Muscular system"]
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MIDLINE_TOL = 0.005  # m: |centroid x| below this counts as midline


def side_from_name(name):
    if name.endswith(".l"):
        return "left"
    if name.endswith(".r"):
        return "right"
    return None


def side_from_x(x):
    # Source: patient's right is -X.
    if x > MIDLINE_TOL:
        return "left"
    if x < -MIDLINE_TOL:
        return "right"
    return "midline"


def parent_chain(obj):
    out = []
    p = obj.parent
    while p is not None:
        out.append(p.name)
        p = p.parent
    return out


def modifier_settings(obj):
    out = []
    for m in obj.modifiers:
        e = {"type": m.type, "show_viewport": m.show_viewport, "show_render": m.show_render}
        if m.type == "SUBSURF":
            e.update(levels=m.levels, render_levels=m.render_levels)
        elif m.type == "SOLIDIFY":
            e.update(thickness=round(m.thickness, 6), offset=m.offset)
        out.append(e)
    return out


def world_bvh(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(obj.matrix_world)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    ev.to_mesh_clear()
    return tree


def world_verts(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    mw = obj.matrix_world
    co = [mw @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return co


def pct(sorted_vals, q):
    if not sorted_vals:
        return None
    i = min(len(sorted_vals) - 1, int(round(q * (len(sorted_vals) - 1))))
    return sorted_vals[i]


def bbox_gap(a_min, a_max, b_min, b_max):
    return max(max(a_min[i] - b_max[i], b_min[i] - a_max[i], 0.0) for i in range(3))


def nearest_surface(obj, entry, surfaces, bvh_cache, bone_of_source, depsgraph, reach=0.02):
    """The bone or skeletal mesh whose surface is closest to the patch (by the
    median vertex distance), among those whose bounds come within `reach`."""
    co = world_verts(obj, depsgraph)
    best = None
    for name, (lo, hi) in surfaces.items():
        if bbox_gap(entry["bboxMin"], entry["bboxMax"], lo, hi) > reach:
            continue
        if name not in bvh_cache:
            bvh_cache[name] = world_bvh(bpy.data.objects[name], depsgraph)
        d = sorted(bvh_cache[name].find_nearest(c)[3] for c in co)
        med = pct(d, 0.5)
        if best is None or med < best["median"]:
            best = {"source": name, "id": bone_of_source.get(name),
                    "median": med, "p95": pct(d, 0.95)}
    if best:
        best["median"] = round(best["median"], 6)
        best["p95"] = round(best["p95"], 6)
    return best


INSERTION_RE = re.compile(r"^(?P<base>.+)\.(?P<kind>[oe])(?P<n>\d*)(?P<side>[lr]?)$")


def main():
    src, out = sys.argv[-2], sys.argv[-1]
    bpy.ops.wm.open_mainfile(filepath=src)
    depsgraph = bpy.context.evaluated_depsgraph_get()

    with open(os.path.join(REPO, "assets/mapping/source-to-id.json")) as fh:
        bone_map = json.load(fh)["map"]
    bone_of_source = {n: bid for bid, names in bone_map.items() for n in names}

    bvh_cache = {}
    # Candidate surfaces for the insertion patches: every bone source object
    # and every other skeletal mesh (costal cartilage etc.), with world bounds.
    with open(os.path.join(REPO, "assets/audit/z-anatomy.json")) as fh:
        surfaces = {o["name"]: (o["bboxMin"], o["bboxMax"])
                    for o in json.load(fh)["objects"] if o["name"] in bone_of_source}
    objects = []
    for root in ROOTS:
        paths = collection_paths(bpy.data.collections[root])
        for name, path in sorted(paths.items()):
            obj = bpy.data.objects[name]
            if obj.type != "MESH" or len(obj.data.polygons) == 0:
                continue
            if root == ROOTS[0] and name in bone_of_source:
                continue  # already a bone (assets/audit/z-anatomy.json)
            entry = {
                "name": name,
                "root": root,
                "collectionPath": path[1:],
                "parentChain": parent_chain(obj),
                "hideRender": obj.hide_render,
                "modifiers": [m.type for m in obj.modifiers],
                "modifierSettings": modifier_settings(obj),
                "baseTris": sum(len(p.vertices) - 2 for p in obj.data.polygons),
                "meshData": obj.data.name,
                "meshDataUsers": obj.data.users,
                "worldScale": [round(s, 4) for s in obj.matrix_world.to_scale()],
                "negativeScale": obj.matrix_world.determinant() < 0,
            }
            entry.update(mesh_stats(obj, depsgraph))
            entry["sideFromName"] = side_from_name(name)
            entry["sideFromCentroid"] = side_from_x(entry["centroid"][0])
            entry["crossesMidline"] = (entry["bboxMin"][0] < -MIDLINE_TOL
                                       and entry["bboxMax"][0] > MIDLINE_TOL)

            if root == "2: Muscular insertions":
                m = INSERTION_RE.match(name)
                att = {"parsed": bool(m)}
                if m:
                    att.update({
                        "muscleName": m["base"],
                        "end": "origin" if m["kind"] == "o" else "insertion",
                        "index": int(m["n"]) if m["n"] else 0,
                        "side": {"l": "left", "r": "right"}.get(m["side"]),
                    })
                    entry["sideFromName"] = att["side"]
                bone = obj.parent
                att["boneSource"] = bone.name if bone else None
                att["boneId"] = bone_of_source.get(bone.name) if bone else None
                if bone is not None and bone.type == "MESH" and len(bone.data.polygons):
                    if bone.name not in bvh_cache:
                        bvh_cache[bone.name] = world_bvh(bone, depsgraph)
                    tree = bvh_cache[bone.name]
                    d = sorted(tree.find_nearest(c)[3] for c in world_verts(obj, depsgraph))
                    att["distanceToBoneM"] = {
                        "median": round(pct(d, 0.5), 6),
                        "p95": round(pct(d, 0.95), 6),
                        "max": round(d[-1], 6),
                    }
                entry["attachment"] = att
            if root == ROOTS[0]:
                surfaces[name] = (entry["bboxMin"], entry["bboxMax"])
            if root == "2: Muscular insertions":
                entry["attachment"]["nearest"] = nearest_surface(
                    obj, entry, surfaces, bvh_cache, bone_of_source, depsgraph)
            objects.append(entry)
        print(f"[audit] {root}: {sum(o['root'] == root for o in objects)} meshes")

    report = {
        "source": "Z-Anatomy Startup.blend (github.com/Z-Anatomy/Models-of-human-anatomy), commit 71919ee",
        "blenderVersion": bpy.app.version_string,
        "roots": ROOTS,
        "note": "1: Skeletal system lists only meshes not used by the bone build.",
        "midlineTolM": MIDLINE_TOL,
        "meshObjectCount": len(objects),
        "objects": objects,
    }
    with open(out, "w") as fh:
        json.dump(report, fh, indent=1)
    print(f"[audit] wrote {len(objects)} mesh objects to {out}")


if __name__ == "__main__":
    main()
