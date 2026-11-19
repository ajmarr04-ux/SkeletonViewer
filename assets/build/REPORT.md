# Build report: Blender pipeline and compression (Milestone 1, steps 3 and 4)

| | |
| --- | --- |
| Rebuild | `bash scripts/setup-blender.sh`, then `npm run build-models` (about 45 s: Blender build, gltfpack, `check-models`) |
| Pipeline | `scripts/blender/build_skeleton.py` (bpy 5.3.0) → `.cache/build/skeleton-{high,low}.glb` (uncompressed, git-ignored) |
| Compression | `scripts/compress-models.sh` → `public/models/skeleton-{high,low}.glb` (`gltfpack -cc -kn -kv -vp 14`) |
| Checks | `npm run check-models` (`scripts/check-models.ts`, logic in `scripts/lib/model-checks.ts`, tested in `tests/model-checks.test.ts`) |
| Manifest | `assets/build/manifest.json`: per ID and LOD, the triangles, world bbox, vertex centroid and origin in glTF Y-up metres, plus the AO settings and the cleanup log |

## Result

| LOD | Triangles | Target | Uncompressed | Compressed | Budget | Max bounds drift vs manifest |
| --- | --- | --- | --- | --- | --- | --- |
| high | 499,981 | ~500k | 11.2 MB | **2.59 MB** | < 15 MB | 0.014 mm |
| low | 149,913 | ~150k | 3.5 MB | **0.91 MB** | < 6 MB | 0.014 mm |

- **234 nodes in each file**, named by stable ID, with nothing extra or missing. The four third-molar IDs (`tooth_18`, `tooth_28`, `tooth_38`, `tooth_48`) have no mesh, as agreed.
- The source has 580,201 triangles after cleanup.
- Node layout after gltfpack: each named node (the bone, translated to its origin) has one **unnamed child** that holds the mesh and the dequantisation transform (positions quantised to 14 bits on one shared grid, about 0.03 mm). The viewer should resolve picks to the nearest named ancestor.
- Extensions used: `KHR_mesh_quantization` and `EXT_meshopt_compression`, so three.js needs `setMeshoptDecoder`.
- Attributes: `POSITION`, `NORMAL` and `COLOR_0`. There are no materials, UVs, cameras or lights.

## Coordinates and "nothing moved"
- Each source object's evaluated mesh (modifiers applied: Boolean ×6 on the ethmoid, Subdivision on the lunate and pisiform, Mirror on the xiphoid) is multiplied once by its world matrix, which takes care of the scale-10 vertebrae, ribs and sternum and the 119 negatively scaled left-side duplicates. The winding is reversed wherever the determinant is negative. The glTF exporter's +Y-up conversion, (x, y, z) → (x, z, −y), gives Y up, facing +Z, with the patient's right at −X.
- Origins are then moved to each object's bounding-box centre. Only the origin moves; the vertices keep their world positions.
- **Bounds check (fails loudly):** (a) the extracted geometry, loose vertices included, matches the audit's world bbox within 1e-4 m for all 234 objects; (b) the final objects match the face-connected source geometry within 1e-4 m. After gltfpack, `check-models` confirms every node's world bbox matches the manifest within 1 mm (actual drift 0.014 mm).
- **One expected difference:** the source `Body of sternum` has a stray loose vertex 18.6 mm in front of the bone (y = −0.1308 against a surface at −0.1122). Cleanup deletes it, so `sternum`'s bbox is 18.6 mm shallower than the audit's raw bbox. No face moved. This is recorded in `manifest.boundsCheck`.

## Cleanup (full log in `manifest.json` → `cleanup`)
- Merge by distance (1e-6 m) merged 98 vertices across the skeleton. 4 duplicate faces were rejected (mandible).
- Loose vertices deleted: occipital 4, vomer 1, C1 13, C2 5, C4 6, T8 1, L3 20, sacrum 13, coccyx 4, sternum 5, sixth ribs 10 each, clavicles 2 each, scapulae 25 each, fibulae 19 each.
- **Holes filled** (boundary loops of up to 100 edges, triangulated): frontal bone 2 × 16 edges and sphenoid 2 × 16 edges (where the excluded sinus volumes attached), and ethmoid 6 + 7 edges.
- **Normals:** the source winding was already outward (the audit agrees), so normals are recalculated only where the winding is inconsistent or the volume is negative. That applies to T8 only (2 inconsistent edges). This deliberately avoids `recalc_face_normals` flipping nested shells such as the tooth pulp and the inner-ear labyrinth.
- **Still non-manifold** (left as is; the boundaries can't be closed by simple fill because they meet at non-manifold vertices or edges with 3 faces):

  | Object | Non-manifold edges | Of which boundary |
  | --- | --- | --- |
  | vertebra_t8 | 85 | 55 |
  | mandible | 58 | 6 |
  | occipital_bone | 45 | 22 |
  | ethmoid_bone | 42 | 8 |
  | sternum | 33 | 17 (mostly the xiphoid's Mirror seam) |
  | sacrum | 16 | 13 |
  | humerus_left / humerus_right | 6 each | 4 each |

  No artefacts from these showed up in front-view test renders of either LOD (full body and skull).

## Ambient occlusion
- **Method: Cycles CPU bake** (`bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")`) into a point-domain byte colour attribute, exported as `COLOR_0` (greyscale, 1 = unoccluded). 32 samples, 2 cm distance, about 22 s. Cycles works in the `bpy` module, so the scripted ray-cast fallback (`--ao raycast`, BVHTree hemisphere rays) wasn't needed. It's kept in the script.
- **Scope: per bone** (`--ao-scope object`, the default). Each bone is baked with every other bone hidden, so it only occludes itself. The viewer isolates bones (spec §4). With whole-skeleton AO (`--ao-scope skeleton`), enclosed bones such as the ossicles (mean AO 0.00) and the ethmoid (0.02) came out black when shown on their own. Per-bone AO loses the contact shading between neighbouring bones.
- Mean AO is 0.87 in the build, 0.88 in the high LOD and 0.92 in the low LOD. A build-time check fails if any object lacks AO or the values are flat.
- **Dark but correct:** internal surfaces that can't be seen from outside get AO ≈ 0. These are the pulp chambers of the molars, the inner-ear labyrinth inside the temporal bones, the ethmoid air cells, and the dental alveoli and mandibular canal (about half the mandible's vertices). **Note for the viewer:** an isolated mandible shows black sockets. Consider remapping, e.g. `mix(0.4, 1.0, ao)`.
- gltfpack's `-kv` is required: without it, gltfpack dropped `COLOR_0` from `pisiform_right`, whose AO is pure white, and a mesh without vertex colours renders black when `vertexColors` is on. `check-models` now requires `COLOR_0` on every mesh.

## LODs
Decimate (collapse) modifier, with a ratio per object from a budget of `t = clamp(k · w · n^α, min(n, 300), n)`, where `n` is the source triangle count and `k` is solved by bisection to hit the LOD target. α is 0.85 for high and 0.6 for low. The class weight `w` is 2.5 for teeth, ossicles and phalanges, 0.6 for the scapula, ribs and cranial and facial bones, and 1 otherwise. Objects under 300 triangles keep their source count.

| Object | Source | High | Low |
| --- | --- | --- | --- |
| scapula_left | 25,320 | 16,508 (65%) | 1,616 (6%) |
| mandible | 18,834 | 12,836 (68%) | 1,354 (7%) |
| rib_6_left | 10,132 | 7,578 (75%) | 932 (9%) |
| frontal_bone | 7,804 | 6,070 (78%) | 798 (10%) |
| femur_left | 3,794 | 3,794 (100%) | 862 (23%) |
| tooth_36 | 4,508 | 4,508 (100%) | 2,392 (53%) |
| stapes_left | 4,342 | 4,342 (100%) | 2,338 (54%) |
| tooth_11 | 1,368 | 1,368 (100%) | 1,170 (86%) |
| proximal_phalanx_hand_3_left | 440 | 440 (100%) | 440 (100%) |
| distal_phalanx_hand_4_left | 134 | 134 (100%) | 134 (100%) |

Both files sit far under their byte budgets, so there's room to raise the triangle targets later if the spec's budgets change.
