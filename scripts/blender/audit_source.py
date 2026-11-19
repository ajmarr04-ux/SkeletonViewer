"""Audit the Z-Anatomy source .blend for the Skeleton Viewer (Milestone 1, step 1).

Usage (bpy as a Python module, see scripts/setup-blender.sh):
    python -I scripts/blender/audit_source.py <Startup.blend> <out.json>

Lists every mesh object under the "1: Skeletal system" collection with
geometry stats taken from the *evaluated* mesh (modifiers applied), so the
numbers match what the build pipeline will export. Read-only: the source
file is never saved.
"""
import json
import sys

import bpy  # must be imported before bmesh/mathutils
import bmesh
from mathutils import Vector

SKELETAL_ROOT = "1: Skeletal system"


def collection_paths(root):
    """Map object name -> collection path list (first path wins)."""
    paths = {}

    def walk(col, path):
        for obj in col.objects:
            paths.setdefault(obj.name, path + [col.name])
        for child in col.children:
            walk(child, path + [col.name])

    walk(root, [])
    return paths


def mesh_stats(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(obj.matrix_world)
    if obj.matrix_world.determinant() < 0:
        # A mirroring transform reverses winding; Blender (and the glTF
        # exporter) compensate for this, so flip to measure true orientation.
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    non_manifold_edges = sum(1 for e in bm.edges if not e.is_manifold)
    boundary_edges = sum(1 for e in bm.edges if e.is_boundary)
    loose_verts = sum(1 for v in bm.verts if not v.link_edges)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    coords = [v.co.copy() for v in bm.verts]
    # duplicate vertices (exact position, 1e-6 m grid)
    seen, dupes = set(), 0
    for c in coords:
        k = (round(c.x, 6), round(c.y, 6), round(c.z, 6))
        if k in seen:
            dupes += 1
        seen.add(k)
    # signed volume: negative => normals predominantly point inward
    vol = 0.0
    for f in bm.faces:
        vs = [v.co for v in f.verts]
        for i in range(1, len(vs) - 1):
            vol += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
    lo = [min(c[i] for c in coords) for i in range(3)] if coords else [0, 0, 0]
    hi = [max(c[i] for c in coords) for i in range(3)] if coords else [0, 0, 0]
    centroid = (sum(coords, Vector()) / len(coords)) if coords else Vector()
    bm.free()
    ev.to_mesh_clear()
    return {
        "verts": len(coords),
        "tris": tris,
        "nonManifoldEdges": non_manifold_edges,
        "boundaryEdges": boundary_edges,
        "looseVerts": loose_verts,
        "duplicateVerts": dupes,
        "signedVolumeM3": round(vol, 9),
        "normalsOutward": vol > 0,
        "bboxMin": [round(v, 5) for v in lo],
        "bboxMax": [round(v, 5) for v in hi],
        "centroid": [round(v, 5) for v in centroid],
    }


def main():
    src, out = sys.argv[-2], sys.argv[-1]
    bpy.ops.wm.open_mainfile(filepath=src)
    root = bpy.data.collections[SKELETAL_ROOT]
    paths = collection_paths(root)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    objects = []
    for name, path in sorted(paths.items()):
        obj = bpy.data.objects[name]
        if obj.type != "MESH" or len(obj.data.polygons) == 0:
            continue  # labels (FONT) and empty helper meshes
        entry = {
            "name": name,
            "collectionPath": path[1:],
            "parent": obj.parent.name if obj.parent else None,
            "hideRender": obj.hide_render,
            "modifiers": [m.type for m in obj.modifiers],
            "meshData": obj.data.name,
            "meshDataUsers": obj.data.users,
            "worldScale": [round(s, 4) for s in obj.matrix_world.to_scale()],
            "negativeScale": obj.matrix_world.determinant() < 0,
        }
        entry.update(mesh_stats(obj, depsgraph))
        objects.append(entry)
    report = {
        "source": "Z-Anatomy Startup.blend (github.com/Z-Anatomy/Models-of-human-anatomy)",
        "blenderVersion": bpy.app.version_string,
        "collection": SKELETAL_ROOT,
        "units": {"scale_length": bpy.context.scene.unit_settings.scale_length,
                  "system": bpy.context.scene.unit_settings.system},
        "meshObjectCount": len(objects),
        "objects": objects,
    }
    with open(out, "w") as fh:
        json.dump(report, fh, indent=1)
    print(f"wrote {len(objects)} mesh objects to {out}")


main()
