# Build report: soft-tissue layers (Milestone 6, steps 5 to 7)

| | |
| --- | --- |
| Rebuild | `bash scripts/setup-blender.sh`, then `npm run build-soft` (about 8 minutes: Blender build of all four layers, gltfpack, `check-models`). One layer: `npm run build-soft -- --layer ligaments` |
| Pipeline | `scripts/blender/build_soft_tissue.py` (bpy 5.3.0), with the shared steps in `scripts/blender/pipeline_lib.py` → `.cache/build-soft/<layer>-{high,low}.glb` (uncompressed, git-ignored) |
| Compression | `scripts/compress-models.sh .cache/build-soft muscles ligaments cartilage attachments` → `public/models/<layer>-{high,low}.glb` (`gltfpack -cc -kn -kv -vp 14`, as for the bones) |
| Checks | `npm run check-models` now checks all ten files (two bone, eight layer). Logic in `scripts/lib/model-checks.ts`, tested in `tests/model-checks.test.ts` |
| Manifests | `assets/build/manifest-<layer>.json`: the same shape as `manifest.json` (per ID and LOD, the triangles, world bbox, vertex centroid and origin in glTF Y-up metres), plus the AO settings, the cleanup log, `orientationFixedByAo` and `sourceTris` |

The bone files (`public/models/skeleton-*.glb`) and `assets/build/manifest.json` were not rebuilt and are byte-identical to M5.

## Result

| File | Nodes | Triangles | Target | Uncompressed | Compressed | Budget | Max bounds drift |
| --- | --- | --- | --- | --- | --- | --- | --- |
| muscles-high | 476 | 799,742 | ~800k | 18.1 MB | **4.62 MB** | < 10 MiB | 0.020 mm |
| muscles-low | 476 | 229,816 | ~230k | 5.5 MB | **1.61 MB** | < 4 MiB | 0.285 mm |
| ligaments-high | 300 | 119,938 | ~120k | 3.0 MB | **0.85 MB** | < 2.5 MiB | 0.019 mm |
| ligaments-low | 300 | 39,934 | ~40k | 1.2 MB | **0.44 MB** | < 1 MiB | 0.019 mm |
| cartilage-high | 61 | 79,965 | ~80k | 1.8 MB | **0.44 MB** | < 2 MiB | 0.004 mm |
| cartilage-low | 61 | 29,976 | ~30k | 0.7 MB | **0.20 MB** | < 1 MiB | 0.004 mm |
| attachments-high | 697 | 149,676 | ~150k | 4.0 MB | **1.29 MB** | < 3 MiB | 0.010 mm |
| attachments-low | 697 | 49,772 | ~50k | 1.8 MB | **0.79 MB** | < 1 MiB | 0.010 mm |

- Node names match exactly: the `meshAvailable: true` IDs of each layer in `content/soft-ids.json`, and the 697 keys of `attachments` in `assets/mapping/soft-to-id.json`. Nothing is missing or extra. Every mesh has `COLOR_0`.
- Source triangles after cleanup: muscles 1,978,774, ligaments 170,792, cartilage 175,464, patches 926,388. Every layer is above its high target, so all are decimated (as session P predicted).
- The largest drift, 0.285 mm in `muscles-low`, is well inside the 1 mm tolerance. Neither `-vp` change was needed.
- Build time: muscles 179 s, patches 241 s, ligaments 38 s, cartilage 17 s (about 8 minutes in all, with compression and checks).

## Coordinates and "nothing moved"
As for the bones: each source object's viewport-evaluated mesh (Subdivision and Solidify applied) is multiplied once by its world matrix, with the winding reversed where the determinant is negative (739 of the 1,557 source meshes are mirrored left-side duplicates). The only joins are the 23 intervertebral discs with their nucleus pulposus. Origins then move to each object's bounds centre (origin only).

**Bounds check (fails loudly):** (a) the extracted geometry, loose vertices included, matches the audit's (`assets/audit/soft-tissue.json`) world bbox within 1e-4 m for all 1,534 objects; (b) the final objects match their face-connected source geometry within 1e-4 m. Where cleanup deleted stray loose vertices, the bbox shrinks without any face moving. Each case is recorded in the manifest's `boundsCheck`:

| Object | Bbox reduced by |
| --- | --- |
| external_abdominal_oblique_{left,right}__origin_4 | 84.9 mm (a stray vertex far from the patch) |
| transverse_ligament_knee_{left,right} | 16.3 mm |
| adductor_longus, erector_spinae, transversus_thoracis patches (both sides) | 0.24–0.31 mm |

## Cleanup (full log in each manifest → `cleanup`)
The settings are the same as for the bones: merge by distance 1e-6 m, delete loose and duplicate geometry, fill holes of up to 100 boundary edges, and recalculate normals only where the winding is inconsistent or the volume is negative.

- Vertices merged: muscles 2,319, ligaments 889. Loose vertices deleted: muscles 10, ligaments 12, cartilage 1, patches 52. Faces rejected while building (a repeated vertex): 24, all in muscles (2 at most per object).
- **Holes filled:** extensor digitorum longus tendon (8 × 12 edges per side: the open ends of its four tendon slips), the belly of extensor digitorum longus (24), the palmar aponeurosis (32), internal abdominal oblique (5) and the ligament of the head of the femur (64 + 8 + 8, its open ends).
- **Still non-manifold** (left as is), the worst per layer (each one has a right-side twin with the same count):

  | Object | Non-manifold edges | Of which boundary |
  | --- | --- | --- |
  | palmar_aponeurosis | 182 | 182 (an open sheet; its 182-edge rim stays open) |
  | posterior_sacro_iliac_ligament | 94 | 3 |
  | internal_intercostal | 37 | 22 |
  | ligament_head_femur | 34 | 18 |
  | radiate_ligament_head_rib | 24 | 0 |
  | intervertebral_disc_l1_l2 | 12 | 5 |
  | scalenus_anterior | 12 | 12 |
  | temporalis__origin_3, masseter__origin_2 (patches) | 12 | 4 |

  Beyond these, 26 muscle objects, 13 ligaments, 1 cartilage (`costal_cartilage_8_right`) and 2 patches (`flexor_hallucis_longus__origin`) have between 1 and 10 such edges each.

## Normals: an extra check for thin sheets
Many ligaments and patches are open sheets thickened by Solidify (0.1 to 2 mm), and their two shells overlap, so **the signed volume isn't a reliable test of which way they face**. The bone rule ("reverse if the volume is negative") turned six correctly wound sheets inside out. Their faces looked into the 0.5 mm slab, and they baked solid black (mean AO 0.00). Confirmed by baking each one both ways.

Fix (soft-tissue build only, so the bones are unchanged): after the bake, any structure with mean AO below 0.3 is reversed and baked again, and the brighter orientation is kept. It's logged in `orientationFixedByAo`:

| Object (both sides) | Mean AO before → after |
| --- | --- |
| posterior_sacro_iliac_ligament | 0.00 → 0.66 |
| radial_collateral_ligament_wrist_joint | 0.00 → 0.89 |
| temporalis__origin_3 | 0.02 → 0.91 |

After this no structure is left dark. The lowest means are now about 0.62 to 0.68 (the cervical discs, whose nucleus pulposus sits enclosed inside and is black, as the bone pulp cavities are).

## Ambient occlusion
- **Method: Cycles CPU bake, per structure** (each structure baked alone, so it only occludes itself, as for the bones and spec §2.6). 32 samples, 2 cm distance. AO time: muscles 97 s, patches 99 s, ligaments 17 s, cartilage 6 s. The ray-cast fallback wasn't needed.
- `pipeline_lib.bake_ao_cycles` now hides every object once and then shows them one at a time, instead of setting every object's visibility before each bake. That's linear rather than quadratic in the object count, and the result for the bones is the same.
- Mean AO: muscles 0.94, ligaments 0.94, cartilage 0.86 (the enclosed nuclei pull it down), patches 0.95. The build fails if an object has no AO or a layer's values are flat. For patches, "flat" means a p95−p5 spread under 0.01 rather than 0.05, since thin sheets lying on a bone are barely occluded.

## LODs
Decimate (collapse), budget per object `t = clamp(k · n^α, min(n, floor), n)`, with α 0.85 (high) and 0.6 (low) as for the bones and no class weights. The per-object floor is 300 triangles for muscles and cartilage, and 64 for patches (decision 8). For ligaments it's **100** (new, recorded in the plan): 300 ligaments at a floor of 300 would already total 46k, over the 40k low target on their own.

| Object | Source | High | Low |
| --- | --- | --- | --- |
| iliotibial_tract_left | 48,612 | 14,896 (31%) | 2,308 (5%) |
| dorsal_interossei_foot_right | 1,946 | 966 (50%) | 334 (17%) |
| mentalis_right | 166 | 166 | 166 |
| interosseous_membrane_leg_left | 12,642 | 6,742 (53%) | 1,154 (9%) |
| ulnocapitate_ligament_left | 128 | 128 | 100 |
| costal_cartilage_7_left | 13,764 | 5,184 (38%) | 1,330 (10%) |
| intervertebral_disc_t2_t3 | 2,284 | 1,126 (49%) | 452 (20%) |
| subscapularis_left__origin | 17,020 | 2,018 (12%) | 250 (1.5%) |
| mentalis_right__origin | 88 | 64 | 64 |

The patches lose the most: they arrive at 931k triangles, mostly from Subdivision on thin sheets. Session S's debug view is the place to judge whether the low patches look acceptable.

## Refactor check (plan decision 9)
After moving the shared code into `pipeline_lib.py`, `build_skeleton.py` was run once into a scratch directory, never `public/models/` or `assets/build/`. Its manifest matches the committed `manifest.json` exactly for every object, LOD, triangle count, bound and the bounds check. The only differences are the order of the `holesLeftOpen` lists and a few vertices of one filled ethmoid hole. Two runs of the *original* script differ in the same way: `boundary_loops` walks a Python set of BMesh edges, whose order varies between runs. That nondeterminism predates M6 and is left alone, so the bone build stays the same code.

## Final counts per kind
Unchanged from session Q's preliminary table (`docs/PLAN-milestone-6.md`). Every mapped ID built, nothing was dropped.

| Kind | IDs (both sides) | With a mesh (nodes) |
| --- | --- | --- |
| Muscles, single mesh | 348 | 348 |
| Muscles with parts (parents, no node) | 58 | 0 |
| Muscle parts: heads 58, portions 40, bellies 16, tendons 10, aponeuroses 4 | 128 | 128 |
| Muscles absent from the source (articularis genus) | 2 | 0 |
| Ligaments | 300 | 300 |
| Ligaments absent from the source (patellar ligament) | 2 | 0 |
| Cartilage (20 costal cartilages, 4 labra) | 24 | 24 |
| Discs (23 intervertebral, interpubic, sacrococcygeal) | 25 | 25 |
| Menisci and articular discs | 12 | 12 |
| **Total** | **899** | **837** (muscles 476, ligaments 300, cartilage 61) |
| Insertion patches (`attachments` file) | 697 | 697 |
