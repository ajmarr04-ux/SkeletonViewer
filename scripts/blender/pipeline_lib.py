"""Shared Blender helpers for the model builds (M1 bones, M6 soft tissue).

Used by scripts/blender/build_skeleton.py (bones and teeth) and
scripts/blender/build_soft_tissue.py (muscles, ligaments, cartilage and the
insertion patches). Factored out of build_skeleton.py in M6 session R with no
change in behaviour (plan decision 9): extract, clean up, origins and the
bounds check, AO bake, LOD budgets and decimation, export and manifest rows.

Nothing here translates, rotates or re-poses geometry: the world transform is
baked into the vertices exactly once (extract), and only origins move.
"""
import math

import bpy  # must be imported before bmesh/mathutils
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

MERGE_DIST = 1e-6          # m
BBOX_TOL = 1e-4            # m, world bbox vs audit
HOLE_MAX_EDGES = 100       # holes with more boundary edges than this stay open
MIN_TRIS = 300             # default per-object floor for decimation
AO_SAMPLES = 32            # rays per vertex (raycast) / Cycles samples
AO_DISTANCE = 0.02         # m, occlusion search distance (per-object crevices)


def log(*a):
    print("[build]", *a, flush=True)


# --------------------------------------------------------------------------
# 1. Extract
# --------------------------------------------------------------------------

def extract(src, idmap):
    """Open the source and return extract_open(idmap)."""
    bpy.ops.wm.open_mainfile(filepath=src)
    return extract_open(idmap)


def extract_open(idmap):
    """{id: [source object names]} -> {id: (verts Nx3 float64 world, faces)}.

    Reads the file that is already open; each name's viewport-evaluated mesh
    is taken in world space and the parts of one ID are concatenated.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for sid, parts in idmap.items():
        all_v, all_f, off = [], [], 0
        for name in parts:
            obj = bpy.data.objects[name]
            ev = obj.evaluated_get(dg)
            me = ev.to_mesh()
            n = len(me.vertices)
            co = np.empty(n * 3, dtype=np.float64)
            me.vertices.foreach_get("co", co)
            co = co.reshape(n, 3)
            m = np.array(obj.matrix_world, dtype=np.float64)
            co = co @ m[:3, :3].T + m[:3, 3]
            flip = obj.matrix_world.determinant() < 0
            lv = np.empty(len(me.loops), dtype=np.int64)
            me.loops.foreach_get("vertex_index", lv)
            faces = []
            for p in me.polygons:
                f = lv[p.loop_start:p.loop_start + p.loop_total] + off
                faces.append(f[::-1].tolist() if flip else f.tolist())
            ev.to_mesh_clear()
            all_v.append(co)
            all_f.extend(faces)
            off += n
        out[sid] = (np.concatenate(all_v), all_f)
    return out


# --------------------------------------------------------------------------
# 2. Clean up
# --------------------------------------------------------------------------

def signed_volume(bm):
    vol = 0.0
    for f in bm.faces:
        vs = [v.co for v in f.verts]
        for i in range(1, len(vs) - 1):
            vol += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
    return vol


def inconsistent_edges(bm):
    """Manifold edges whose two faces traverse them in the same direction."""
    bad = 0
    for e in bm.edges:
        if len(e.link_loops) == 2:
            a, b = e.link_loops
            if a.vert == b.vert:
                bad += 1
    return bad


def boundary_loops(bm):
    """Group boundary edges into connected loops (lists of edges)."""
    edges = {e for e in bm.edges if e.is_boundary}
    loops = []
    while edges:
        seed = edges.pop()
        comp, stack = [seed], [seed]
        while stack:
            e = stack.pop()
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in edges:
                        edges.discard(e2)
                        comp.append(e2)
                        stack.append(e2)
        loops.append(comp)
    return loops


def cleanup(bm, entry):
    bm.verts.ensure_lookup_table()
    v0, f0 = len(bm.verts), len(bm.faces)
    # merge by distance
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=MERGE_DIST)
    entry["mergedVerts"] = v0 - len(bm.verts)
    # duplicate faces (same vertex set) and degenerate faces
    bm.verts.index_update()
    seen, dup = set(), []
    for f in bm.faces:
        key = frozenset(v.index for v in f.verts)
        if len(key) < 3:
            dup.append(f)
        elif key in seen:
            dup.append(f)
        else:
            seen.add(key)
    if dup:
        bmesh.ops.delete(bm, geom=dup, context="FACES_ONLY")
    entry["duplicateOrDegenerateFaces"] = len(dup)
    # loose geometry
    loose_e = [e for e in bm.edges if not e.link_faces]
    if loose_e:
        bmesh.ops.delete(bm, geom=loose_e, context="EDGES")
    loose_v = [v for v in bm.verts if not v.link_faces]
    if loose_v:
        bmesh.ops.delete(bm, geom=loose_v, context="VERTS")
    entry["looseEdges"] = len(loose_e)
    entry["looseVerts"] = len(loose_v)
    # fill small holes, one loop at a time so the size cap is per hole
    filled, skipped = [], []
    for lp in boundary_loops(bm):
        if len(lp) <= HOLE_MAX_EDGES:
            res = bmesh.ops.holes_fill(bm, edges=lp, sides=len(lp))
            if res["faces"]:
                bmesh.ops.triangulate(bm, faces=res["faces"], quad_method="BEAUTY",
                                      ngon_method="BEAUTY")
                filled.append(len(lp))
            else:
                skipped.append(len(lp))
        else:
            skipped.append(len(lp))
    entry["holesFilled"] = filled            # boundary edges per filled hole
    entry["holesLeftOpen"] = skipped
    # normals outward. The audit found every source object outward-facing
    # once mirroring is allowed for, and recalc_face_normals can flip nested
    # shells (e.g. a pulp cavity) the wrong way. So only recalculate when the
    # winding is inconsistent across an edge or the volume is negative.
    vol_before = signed_volume(bm)
    bad_edges = inconsistent_edges(bm)
    recalc = bad_edges > 0 or vol_before < 0
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    vol = signed_volume(bm)
    if vol < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        vol = -vol
    entry["inconsistentWindingEdges"] = bad_edges
    entry["normalsRecalculated"] = recalc
    entry["signedVolumeBefore"] = round(vol_before, 9)
    entry["signedVolumeAfter"] = round(vol, 9)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    nm = [e for e in bm.edges if not e.is_manifold]
    entry["nonManifoldEdges"] = len(nm)
    entry["boundaryEdges"] = sum(1 for e in bm.edges if e.is_boundary)
    entry["tris"] = len(bm.faces)
    entry["verts"] = len(bm.verts)
    return entry


def build_objects(geo, coll):
    """Make one cleaned object per ID in `coll`. Returns {id: obj}, cleanup log."""
    objs, clog = {}, {}
    for sid, (co, faces) in geo.items():
        bm = bmesh.new()
        verts = [bm.verts.new(c) for c in co.tolist()]
        bad = 0
        for f in faces:
            try:
                bm.faces.new([verts[i] for i in f])
            except ValueError:  # face already exists / repeated vertex
                bad += 1
        entry = {"sourceTris": sum(len(f) - 2 for f in faces), "rejectedFaces": bad}
        cleanup(bm, entry)
        for f in bm.faces:
            f.smooth = True
        me = bpy.data.meshes.new(sid)
        bm.to_mesh(me)
        bm.free()
        obj = bpy.data.objects.new(sid, me)
        coll.objects.link(obj)
        objs[sid] = obj
        clog[sid] = entry
    return objs, clog


# --------------------------------------------------------------------------
# 3. Origins and bounds
# --------------------------------------------------------------------------

def world_coords(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    m = np.array(obj.matrix_world, dtype=np.float64)
    return co @ m[:3, :3].T + m[:3, 3]


def set_origin_to_bounds_centre(obj):
    co = world_coords(obj)
    centre = (co.min(0) + co.max(0)) / 2.0
    obj.data.transform(Matrix.Translation(Vector((-centre).tolist())))
    obj.location = Vector(centre.tolist())
    bpy.context.view_layer.update()


def raw_bounds(co, faces):
    """bbox of all extracted vertices, and of the ones used by a face."""
    used = np.zeros(len(co), dtype=bool)
    for f in faces:
        used[f] = True
    return {"all": (co.min(0), co.max(0)), "faces": (co[used].min(0), co[used].max(0))}


def check_bounds(objs, raw, idmap, by_name, what="bone"):
    """Fail loudly if any bone moved.

    (a) The raw extraction (every vertex, loose ones included) must match the
        audit's bbox: the world transform was applied correctly.
    (b) The final object (after cleanup and the origin move) must match the
        raw bbox of face-connected vertices: cleanup and origins moved nothing.
    Loose stray vertices can sit outside the bone (one does in the body of
    the sternum), so (a) and (b) can legitimately differ; that is logged.
    """
    problems, shrunk = [], {}
    for sid, obj in objs.items():
        parts = [by_name[n] for n in idmap[sid]]
        lo = np.min([p["bboxMin"] for p in parts], axis=0)
        hi = np.max([p["bboxMax"] for p in parts], axis=0)
        (alo, ahi), (flo, fhi) = raw[sid]["all"], raw[sid]["faces"]
        da = max(np.abs(alo - lo).max(), np.abs(ahi - hi).max())
        if da > BBOX_TOL:
            problems.append(f"{sid}: extracted bbox differs from audit by {da:.6f} m")
        co = world_coords(obj)
        db = max(np.abs(co.min(0) - flo).max(), np.abs(co.max(0) - fhi).max())
        if db > BBOX_TOL:
            problems.append(f"{sid}: final bbox differs from source geometry by {db:.6f} m")
        dl = max(np.abs(alo - flo).max(), np.abs(ahi - fhi).max())
        if dl > BBOX_TOL:
            shrunk[sid] = round(float(dl), 6)
    if problems:
        raise SystemExit(f"BOUNDS CHECK FAILED (a {what} moved?):\n  " + "\n  ".join(problems))
    log(f"bounds check passed for {len(objs)} objects (tol {BBOX_TOL} m); "
        f"bbox reduced only by deleting stray loose vertices: {shrunk}")
    return shrunk


# --------------------------------------------------------------------------
# 4. Ambient occlusion
# --------------------------------------------------------------------------

def ensure_color_attr(obj):
    me = obj.data
    attr = me.color_attributes.get("AO") or me.color_attributes.new("AO", "BYTE_COLOR", "POINT")
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find("AO")
    return attr


def bake_ao_cycles(objs, scope):
    """Cycles CPU AO bake into the per-vertex "AO" colour attribute.

    scope "object": each bone is baked with every other bone hidden from
    render, so it only occludes itself. The viewer isolates bones (spec §4),
    and with whole-skeleton AO enclosed bones such as the ossicles and the
    ethmoid would be black when shown on their own.
    scope "skeleton": one bake with every bone visible (contact shading).
    The same holds for any layer: "object" means per structure.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = AO_SAMPLES
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.light_settings.distance = AO_DISTANCE
    mat = bpy.data.materials.get("bone") or bpy.data.materials.new("bone")
    for o in objs.values():
        ensure_color_attr(o)
        if not o.data.materials:
            o.data.materials.append(mat)
    allo = list(objs.values())
    if scope == "skeleton":
        for o in allo:
            o.hide_render = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = allo[0]
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
    else:
        # one object visible and selected at a time; toggling only the
        # current one keeps this linear in the object count
        for o in allo:
            o.hide_render = True
            o.select_set(False)
        for o in allo:
            o.hide_render = False
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
            o.hide_render = True
            o.select_set(False)
    for o in objs.values():
        o.hide_render = False
        o.data.materials.clear()  # export without materials


def bake_ao_raycast(objs, scope, samples=AO_SAMPLES, dist=AO_DISTANCE):
    """Fallback: cosine-weighted hemisphere ray-cast AO with BVHTree.

    Rays hit the whole skeleton (scope "skeleton") or only the bone itself
    (scope "object"). Slow (pure Python), so only used if Cycles fails.
    """
    # one BVH over every object in world space
    all_v, all_f, off = [], [], 0
    per = {}
    for sid, o in objs.items():
        co = world_coords(o)
        me = o.data
        tri = np.empty(len(me.polygons) * 3, dtype=np.int64)
        me.polygons.foreach_get("vertices", tri)
        all_v.append(co)
        all_f.append(tri.reshape(-1, 3) + off)
        off += len(co)
        per[sid] = co
    if scope == "skeleton":
        V = np.concatenate(all_v)
        F = np.concatenate(all_f)
        whole = BVHTree.FromPolygons(V.tolist(), F.tolist(), all_triangles=True, epsilon=0.0)
    local_f = dict(zip(objs, all_f))
    local_off = dict(zip(objs, np.cumsum([0] + [len(v) for v in all_v])[:-1]))
    # fixed cosine-weighted directions around +Z, rotated per vertex
    rng = np.random.default_rng(1234)
    golden = (1 + 5 ** 0.5) / 2
    k = np.arange(samples)
    u1 = (k + 0.5) / samples
    u2 = (k / golden) % 1.0
    r, phi = np.sqrt(u1), 2 * math.pi * u2
    local = np.stack([r * np.cos(phi), r * np.sin(phi), np.sqrt(1 - u1)], 1)
    for sid, o in objs.items():
        me = o.data
        n = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("normal", n)
        n = n.reshape(-1, 3)
        co = per[sid]
        bvh = whole if scope == "skeleton" else BVHTree.FromPolygons(
            co.tolist(), (local_f[sid] - local_off[sid]).tolist(), all_triangles=True, epsilon=0.0)
        ao = np.ones(len(co))
        twist = rng.uniform(0, 2 * math.pi, len(co))
        for i in range(len(co)):
            nz = n[i]
            a = np.array([1.0, 0, 0]) if abs(nz[0]) < 0.9 else np.array([0, 1.0, 0])
            tx = np.cross(nz, a); tx /= np.linalg.norm(tx)
            ty = np.cross(nz, tx)
            c, s = math.cos(twist[i]), math.sin(twist[i])
            tx, ty = c * tx + s * ty, -s * tx + c * ty
            dirs = local[:, :1] * tx + local[:, 1:2] * ty + local[:, 2:3] * nz
            origin = Vector((co[i] + nz * 1e-5).tolist())
            hit = 0
            for d in dirs.tolist():
                if bvh.ray_cast(origin, Vector(d), dist)[0] is not None:
                    hit += 1
            ao[i] = 1.0 - hit / samples
        attr = ensure_color_attr(o)
        rgba = np.repeat(ao[:, None], 4, 1)
        rgba[:, 3] = 1.0
        attr.data.foreach_set("color", rgba.ravel())


def ao_values(obj):
    attr = obj.data.color_attributes.get("AO")
    if attr is None:
        return np.zeros(0)
    v = np.empty(len(attr.data) * 4)
    attr.data.foreach_get("color", v)
    return v.reshape(-1, 4)[:, 0]


def check_ao(objs, stage, min_spread=0.05):
    """Fail loudly if the AO is missing or flat (a silent bake failure).

    min_spread is the smallest allowed p95 - p5; thin sheets (insertion
    patches) are almost unoccluded, so their layer passes a lower value.
    """
    vals = np.concatenate([ao_values(o) for o in objs.values()])
    missing = [sid for sid, o in objs.items() if o.data.color_attributes.get("AO") is None]
    stats = {"mean": round(float(vals.mean()), 3) if len(vals) else None,
             "p5": round(float(np.percentile(vals, 5)), 3) if len(vals) else None,
             "p95": round(float(np.percentile(vals, 95)), 3) if len(vals) else None}
    log(f"AO {stage}: {stats}, objects without AO: {len(missing)}")
    if missing or not len(vals) or stats["p95"] - stats["p5"] < min_spread or stats["mean"] < 0.2:
        raise SystemExit(f"AO CHECK FAILED at {stage}: {stats}, missing {missing[:5]}")
    return stats


# --------------------------------------------------------------------------
# 5. LODs
# --------------------------------------------------------------------------

def lod_budget(counts, weights, target, alpha, min_tris=MIN_TRIS):
    """Per-object triangle targets summing to ~target.

    t_i = clamp(k * w_i * n_i^alpha, min(n_i, min_tris), n_i), with k found by
    bisection so sum(t_i) == target. alpha < 1 shifts the cut towards big
    meshes; w_i is a per-object class weight.
    """
    def t(sid, n, k):
        return min(n, max(min(n, min_tris), k * weights[sid] * n ** alpha))

    def total(k):
        return sum(t(sid, n, k) for sid, n in counts.items())
    lo, hi = 0.0, 1e6
    for _ in range(200):
        mid = (lo + hi) / 2
        if total(mid) < target:
            lo = mid
        else:
            hi = mid
    k = (lo + hi) / 2
    return {sid: int(round(t(sid, n, k))) for sid, n in counts.items()}


def make_lod(objs, budget, coll):
    out = {}
    dg = bpy.context.evaluated_depsgraph_get()
    for sid, src in objs.items():
        n = len(src.data.polygons)
        tmp = src.copy()
        tmp.data = src.data
        bpy.context.scene.collection.objects.link(tmp)
        ratio = budget[sid] / n
        if ratio < 0.999:
            mod = tmp.modifiers.new("dec", "DECIMATE")
            mod.decimate_type = "COLLAPSE"
            mod.ratio = ratio
            mod.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg), preserve_all_data_layers=True,
                                             depsgraph=dg)
        bpy.data.objects.remove(tmp)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
        me.name = sid
        o = bpy.data.objects.new(sid, me)
        assert o.name == sid, f"name clash: {o.name}"
        o.matrix_world = src.matrix_world.copy()
        coll.objects.link(o)
        out[sid] = o
    return out


# --------------------------------------------------------------------------
# 6/7. Export and manifest
# --------------------------------------------------------------------------

def to_gltf(p):
    return [p[0], p[2], -p[1]]


def describe(obj):
    co = world_coords(obj)
    lo, hi = co.min(0), co.max(0)
    g_lo = [lo[0], lo[2], -hi[1]]
    g_hi = [hi[0], hi[2], -lo[1]]
    return {
        "tris": len(obj.data.polygons),
        "bboxMin": [round(float(v), 6) for v in g_lo],
        "bboxMax": [round(float(v), 6) for v in g_hi],
        "centroid": [round(float(v), 6) for v in to_gltf(co.mean(0))],
        "origin": [round(float(v), 6) for v in to_gltf(list(obj.location))],
    }


def export_glb(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs.values():
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="NONE",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
