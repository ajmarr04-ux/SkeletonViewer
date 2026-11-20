# Milestone 6 Plan: Soft-tissue audit, mapping and assets (Musculoskeletal spec, M6)

Source of truth: `SPEC-musculoskeletal.md` §1 (scope), §2 (source and pipeline), §3 (object model: kinds and IDs), §9 (triangle budgets) and §11 (M6). Where that spec is silent, `SPEC (2).md` and `STATUS.md` still apply. Ground rules throughout: no mesh is moved, re-posed or re-scaled; no anatomy, landmark coordinates or IDs are invented; anything uncertain goes in `content/QUESTIONS.md`; if an asset problem blocks the work, stop and describe it instead of working around it.

## Goal

Turn the soft tissue in the pinned Z-Anatomy `Startup.blend` (`71919ee`) into assets the viewer can use later, without changing anything the user sees today. That means: an audit of collections `2: Muscular insertions`, `3: Joints`, `4: Muscular system` and the cartilage meshes in `1: Skeletal system`; a mapping from every source mesh to a stable ID (or a recorded merge or exclusion); a decision on the muscular-insertion patches; six compressed layer files (muscles, ligaments, cartilage, each at two LODs) that pass an extended `check-models`; and a debug view (`?debug&layers=all`) that shows every layer in place over the bones. The milestone ends by **reporting real counts per kind back to the user**, before any content is written (spec §13), and with a hosted copy at `/m6/`.

Out of scope here (later milestones): the Layers panel, per-layer batches, ghosting and picking of the new layers (M7); content files, schemas, `movements.json`, depth data and the `muscleAttachments` migration (M8); selection and tiers for the new kinds (M9); labels, legend and performance polish (M10). The bones layer, its files, its content and every existing behaviour stay exactly as in M5.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| (planning) | 0 (Milestone 5 handover, this plan) | **Done.** See step 0 |
| P | 1 (soft-tissue audit), 2 (decision on `2: Muscular insertions`) | **Done.** See "Session P notes" and `assets/audit/REPORT-soft-tissue.md`. Checkpoint answered (go on without articular cartilage) |
| Q | 3 (soft-tissue ID list and mapping), 4 (mapping checks and questions) | **Done.** See "Session Q notes" |
| R | 5 (Blender pipeline for the new layers), 6 (compression and `check-models`), 7 (build report) | **Done.** See "Session R notes" and `assets/build/REPORT-soft-tissue.md` |
| S | 8 (debug layer view), 9 (alignment and no-regression tests), 10 (report back with counts), 11 (hosted copy) | **Done.** See "Session S notes". Merged in [#13](https://github.com/ajmarr04-ux/SkeletonViewer/pull/13) (`e9da664`); `/m6/` confirmed live and the counts accepted by the user |

Triggers: "begin session P", "begin session Q", "begin session R" and "begin session S". Each session starts with `bash scripts/setup-blender.sh` (sessions P, Q and R need Blender; S only if it rebuilds) and by reading this file, then works through its steps without waiting for confirmation unless something blocks it or a **user checkpoint** below says to stop. Each ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models` and `npm run validate-content` passing (session S adds `npm run e2e`), then a commit, a push to the session branch and a PR to `main`.

**User checkpoints**
- **After session P**, if any of the spec's stop conditions hold (muscles not separated left/right, a major muscle missing, parts unmatchable for a large share of muscles), or if articular cartilage turns out to be mostly absent from the source (see risk 1): stop, write it up in `assets/audit/REPORT-soft-tissue.md` and ask the user before session Q.
- **After session S**: the counts per kind go to the user (spec §11, "Report back"). M7 can start straight away (it needs no content), but **M8 content waits for the user's reply.**

## Exit criteria (from the musculoskeletal spec §11, M6)

- [x] Soft-tissue audit report and JSON for collections 2, 3, 4 and the cartilage in 1. (`assets/audit/REPORT-soft-tissue.md`, `assets/audit/soft-tissue.json`; session P.)
- [x] `soft-to-id.json` with every mesh mapped, merged or excluded (with reasons). (Session Q; `tests/soft-ids.test.ts` checks that every audited mesh is used exactly once.)
- [x] Decision recorded on `2: Muscular insertions` (patches usable or not). (**Usable**: 689 of 705 patches within 1 mm of a bone or cartilage surface; side from geometry. See the report.)
- [x] Six layer files exported, compressed, under budget, passing `check-models`. (Eight with the patches; session R. Muscles 4.62 / 1.61 MB, ligaments 0.85 / 0.44, cartilage 0.44 / 0.20, patches 1.29 / 0.79.)
- [x] A debug view (`?debug&layers=all`) shows every layer in place with no visible misalignment against the bones. (Session S: every node of all four layers within 0.02 mm of its manifest at both LODs; screenshots in `docs/m6/`.)
- [x] **Report back** with counts per kind (muscles, parts, tendons, ligaments, cartilage, discs, menisci) before writing content. (Session S, "Final counts" below; sent to the user 2026-11-20. **Accepted by the user the same day**, so M8 content can go ahead.)
- [x] No regression: the bone files in `public/models/` are byte-identical to M5, and with no `layers` parameter the app loads exactly what M5 loaded (same requests, same main chunk within 1 KB gzipped). (Session S: `git diff 71f04d0` on the bone files is empty; main chunk 457.84 → 458.20 kB gzipped; `layers-debug.spec.ts` checks no layer file or chunk is requested.)
- [x] **Hosted copy is live and linked below** (extra requirement for every milestone). (Confirmed by the user on 2026-11-20 with `?debug&layers=all`: all four layers in place, 60 fps on a phone and 75 on a PC, some loading latency judged acceptable.)

---

## Step 0: Milestone 5 handover (done in the planning session)

- `deploy/pages.json`: `m1`–`m5` already frozen (M5 at `71f04d0`, done when M5 closed). `current` set from `null` to **6**, so the next deploy builds `/m6/` from `main`.
- `/m5/` was confirmed live by the user on 2026-11-19 (`docs/PLAN-milestone-5.md`). `README.md`: Milestone 6 row added as "In progress"; the README now names both specs.
- `SPEC-musculoskeletal.md` (uploaded to `main` in `4509e2e`) is the spec for M6–M10. `CLAUDE.md` updated: status, the spec, the reopened cartilage decision (bones unchanged; cartilage now comes in as its own layer), and the M6 session triggers.
- `docs/BACKLOG.md` has no open entries.
- **Still open, carried over (needs the user, any time):** the per-browser `?bench` table in `docs/PLAN-milestone-5.md` step 12; the 36 content questions in `content/QUESTIONS.md`.

## Decisions made in this plan (say if any should change)

These fill gaps the spec leaves open. Each is the smallest choice that fits the spec; the sessions build them as written unless the user says otherwise.

1. **A separate ID list for soft tissue.** `content/ids.json` (the 238 bones and teeth) stays as it is, so nothing bone-side changes. The new structures go in a generated `content/soft-ids.json`, one entry per ID: `id`, `name` (English), `latin` (source name where it is Latin), `kind` (`muscle | muscle_part | ligament | cartilage | disc | meniscus`), `layer` (`muscles | ligaments | cartilage`), `side`, `parent` and `partType` (parts only), `parts` (muscles with parts), and `meshAvailable`. Written by `scripts/mapping/generate_soft_ids.py` (`npm run soft-ids`), the counterpart of `generate_ids.py`. IDs never collide with bone IDs (checked).
2. **Parent muscles have no node.** `meshAvailable` means "this ID has its own node in a layer file". A muscle with parts has `meshAvailable: false` and a non-empty `parts` list whose members all have meshes; a muscle with no parts is a leaf with `meshAvailable: true`. A structure the anatomy has but the source lacks is listed in `missing` with `meshAvailable: false` (as for the wisdom teeth), never modelled.
3. **Parts come only from source splits that match anatomy.** Meshes are never cut. If the source models triceps as one mesh, triceps is a leaf with no parts, even though it has three heads; that is recorded in the mapping (`notes`) so M8's content can still describe the heads in text. A source split that is anatomical (a named head, belly, portion, tendon or aponeurosis) becomes a part; a modelling-only split is `merged` into one node (joined like `sternum`). Doubtful cases stay separate and get a `QUESTIONS.md` entry (spec §2.3). The generator holds a curated table of known divisions (for example triceps and biceps heads, deltoid and pectoralis major portions, gastrocnemius heads, trapezius parts, adductor magnus parts, the digastric bellies) and matches source names against it; anything unmatched is listed for a decision rather than guessed.
4. **Side from name, checked against geometry.** The side comes from the source name's suffix and is checked against the centroid's x (patient's right is −X in the source). A disagreement fails the generator. A structure whose mesh crosses the midline and is not anatomically midline (a paired muscle joined left and right) is a spec stop condition: report it, don't split it.
5. **Tendons go with muscles.** Tendons and aponeuroses are `muscle_part`s (`partType: tendon | aponeurosis`) in the muscles layer. A shared tendon has one `parent` and lists the other muscle(s) in `alsoServes` (spec §3). Default for the calcaneal tendon: parent `gastrocnemius_<side>`, `alsoServes: [soleus_<side>]`, with a `QUESTIONS.md` entry. The linea alba, if present as a mesh, is an aponeurosis part of rectus abdominis only if the source models it that way; otherwise it is `excluded` as fascia-like and recorded.
6. **Exclusions** (spec §1, §12), each with its reason in `excluded`: joint capsules, synovial membranes, bursae, fascia and retinacula; nasal, laryngeal and auricular cartilage; anything not skeletal muscle (smooth muscle, organ walls, if the collection has any). Muscles of the larynx, pharynx, soft palate, tongue, middle ear and eye are **included** where the source has them (spec §12 default).
7. **Cartilage layer contents.** Costal cartilages (from `1: Skeletal system`), intervertebral discs, menisci and articular discs (knee, TMJ, sternoclavicular, acromioclavicular, wrist), the pubic symphysis disc, and whatever articular cartilage the source has. Articular cartilage the source lacks goes in `missing` (risk 1). Kinds: `cartilage` (costal, articular), `disc` (intervertebral, pubic symphysis), `meniscus` (menisci and articular discs, spec §3).
8. **Triangle and file budgets per file** (spec §9 gives layer totals; the audit may move them, and any change is recorded here):

   | File | High (tris) | Low (tris) | High size | Low size |
   | --- | --- | --- | --- | --- |
   | `muscles` | ~800k | ~230k | < 10 MB | < 4 MB |
   | `ligaments` | ~120k | ~40k | < 2.5 MB | < 1 MB |
   | `cartilage` | ~80k | ~30k | < 2 MB | < 1 MB |

   | `attachments` (decision 12, added in session P) | ~150k | ~50k | < 3 MB | < 1 MB |

   **Session P measured** (viewport-evaluated source, as the bone build evaluates): muscles 1.88M triangles, ligaments 172k, cartilage 171k, patches 931k (64k before their Subdivision and Solidify). So **every layer is over its high target** and is decimated; none keeps its source geometry. The targets stand. The per-object floor for patches is 64 triangles (a solidified sheet shows each face twice).

   **Session R:** the per-object floor for ligaments is **100** (300 ligaments at 300 would already be 46k, over the 40k low target). All four layers landed within 0.5% of their targets.

   Triangle counts must land within ±15% of the target (as for bones). If a layer's source total is below its high target, the high file keeps the source geometry and the target becomes the source count. The per-object floor is 300 triangles or the source count if lower, and LOD weights favour small structures (as for bones). Sizes extrapolate from the bones (500k tris = 2.6 MB) with headroom.
9. **The bone pipeline is not re-run.** The shared Blender helpers (extract, clean, origins, AO, LOD, export) move into `scripts/blender/pipeline_lib.py`, imported by both `build_skeleton.py` and a new `build_soft_tissue.py`. The bone `.glb` files and `assets/build/manifest.json` are not rebuilt in M6, and `git diff --stat public/models/skeleton-*` must be empty at the end of every session. (Session R runs `build_skeleton.py --dry-run` or a single-bone build once after the refactor to prove it still works, writing outside the repo.)
10. **AO per structure**, as for bones (spec §2.6): Cycles bake with only that structure visible; if that is too slow for about 1,000 structures (bones took about 45 s for the whole build), fall back to the scripted ray-cast AO already in `build_skeleton.py`, and record which was used per layer.
11. **Manifests per layer**: `assets/build/manifest-<layer>.json` (same shape as the bone manifest: per ID, per LOD, triangle count, world bounds and centroid in glTF Y-up). `check-models` checks all eight files (two bone, six layer): node names exactly match the `meshAvailable: true` IDs of that layer in `soft-ids.json`, budgets, and bounds within 1 mm of the manifest.
12. **Muscular-insertion patches (step 2).** Usable means: (a) most patches are thin surface meshes lying on a bone (median vertex distance to the nearest bone surface under 1 mm, measured with a `BVHTree` over the bones), (b) their names identify a muscle and say whether it is an origin or an insertion (or that can be read reliably), and (c) they are split left and right. If usable, session R exports them as a seventh pair of files, `attachments-{high,low}.glb` (one node per patch, ID `<muscle_or_part_id>__origin` / `__insertion`, with a running number when there are several), mapped in `soft-to-id.json` under `attachments`, so M9 can draw them; if not, they are ignored and M9 uses the whole-bone tint fallback (spec §5.3). The decision and the measurements go in `REPORT-soft-tissue.md`.
13. **Debug view.** `?debug&layers=all` (also `layers=m,l,c` for a subset) lazily loads the layer files after the bones, as plain glTF scenes with flat layer colours (muted red, pale grey-white, pale blue-grey; spec §6.3), and the debug overlay gains a per-layer line: nodes loaded, triangles, and the largest bounds error against the manifest. It is a debug tool only: nothing is pickable, no batching, no draw-call budget, no UI. The real `layers=` URL format (`b:on,c:off,…`) and the loader for users are M7's; `layers=all` stays as a debug alias. The code is a lazy chunk imported only when the parameter is present, so the default load is unchanged.
14. **Attribution.** `public/ATTRIBUTION.md` gains one line naming the collections now used (spec §2), in session S, when the files first ship.

## Risks found while planning

1. **Articular cartilage is probably thin in the source.** `STATUS.md` §2 counts only 2 meshes named cartilage in `3: Joints` and 31 cartilage meshes in `1: Skeletal system` (costal, nasal, laryngeal). The spec lists articular cartilage in scope. If the audit confirms it's mostly absent, it's recorded as `missing` per joint and raised at the session P checkpoint; it is not modelled.
2. **Naming.** Many muscle names are Latin only, some may be fragments with numbered suffixes, and some may be one mesh for both sides. The generator fails on anything it can't place, and those go in the plan's notes and `QUESTIONS.md` for a decision.
3. **Volume of mapping.** About 670 muscle meshes and 410 joint meshes. Session Q may run long; if it does, it finishes the muscles first and records where it stopped (the joints and cartilage mapping are simpler).
4. **Draw cost of the debug view.** About a thousand separate meshes is fine for a debug view on desktop; it isn't a performance measure (that is M7, with batches).

## Session P notes (steps 1 and 2, done)

What was done, and where it differs from the plan (say if any should change):

- **Scripts.** `scripts/blender/audit_soft_tissue.py` records raw facts from the source in about a minute: stats per mesh from the viewport-evaluated mesh in world space (reusing `mesh_stats` from `audit_source.py`, which now only runs `main()` as a script), base and evaluated triangle counts, modifier settings, the object parent chain, side from name and from the centroid, midline crossing, and for every insertion patch the median and 95th-percentile distance of its vertices to its parent bone and to the nearest bone or skeletal mesh. `scripts/mapping/classify_soft_tissue.py` (`npm run audit-soft`, plain Python, no Blender) adds the first-pass classes and writes the report, so the rules can change without reopening the source. The JSON has one object per line (1.9 MB).
- **Counts.** 1,827 meshes with faces: 670 in `4: Muscular system`, 410 in `3: Joints`, 705 patches in `2: Muscular insertions`, and 42 skeletal meshes the bone build doesn't use. First-pass classes: 708 whole, 139 part, 31 doubtful (18 names), 244 excluded, 705 patches. Proposed layers: muscles 468 meshes, ligaments 300, cartilage 79 (both sides).
- **Better than expected:** the muscle names are **English TA**, not Latin; every paired muscle is split left/right; no modelling fragments exist; the source already splits 24 muscles into anatomical heads, parts or bellies, and has 4 separate tendon or aponeurosis meshes (calcaneal tendon, the digastric intermediate tendon, the tendon of extensor digitorum longus, the epicranial aponeurosis); and its object parent tree gives region → compartment → muscle. All 57 major muscles checked are present.
- **Worse than expected:** no articular cartilage on any joint surface (labra, menisci and articular discs only); no patellar ligament or quadriceps tendon; no craniovertebral ligaments; some small muscles missing (ear, auricular, most of the soft palate and perineum, subcostales, psoas minor). Listed in the report's "Structures absent from the source".
- **Naming defects:** `Lateral temporomandibular ligament` has its sides swapped; `Iliocostalis colli muscle`, `Intra-articular ligament of head of rib` and `Ulnopisiform ligament` each lack the suffix on one of their two meshes (corrected in session Q: the first version said two of them were one-sided). Patches: 50 have the wrong side suffix and 7 left twins are missing, so patch sides come from geometry.
- **Step 2 decision: the patches are usable** (decision 12). 98% lie within 1 mm of a bone or cartilage surface. The exceptions are mostly real patches that span two bones and a membrane; `Rectus abdominis muscle.e*` is misplaced and its origin and insertion labels look swapped. Since patch names can be wrong, M8's origins and insertions come from references, and patches are only geometry. Session R exports them as `attachments-{high,low}.glb`, with the budget added to decision 8.
- **Modifiers.** About 1,070 Subdivision and 1,060 Solidify modifiers, mostly on ligaments and patches (thin sheets thickened by 0.1–2 mm). The audit and the build both use the viewport evaluation; render levels would quadruple those meshes.
- **Found in passing:** about 622 landmark helper objects in `1: Skeletal system` (for example `Apex of dens axis.j`) may give real positions for bone landmarks. Not in M6's scope; noted for M8.

**Checkpoint (needs the user before session Q).** Stop conditions 1 to 3 don't hold. The plan's own checkpoint does: **articular cartilage is absent**. Proposed: go on without it, recording it per joint in `missing`, so the cartilage layer is the 20 costal cartilages, 23 intervertebral discs (plus nucleus pulposus), the interpubic disc, the 4 menisci and 8 articular discs, and, if session Q keeps them, the labra and the symphyses. The 18 doubtful names in the report (labra, iliotibial tract, linea alba, palmar and plantar aponeuroses, the laryngeal ligaments and others) are session Q's to decide, each with a `QUESTIONS.md` entry, unless the user wants to settle any now.

**Answered by the user (2026-11-20):** go on without articular cartilage ("it's just gonna cap the bones at the joints"). Session Q records it in `missing` and builds the cartilage layer from what the source has.

## Session Q notes (steps 3 and 4, done)

What was done, and where it differs from the plan (say if any should change):

- **Generator.** `scripts/mapping/generate_soft_ids.py` (`npm run soft-ids`, plain Python) writes `content/soft-ids.json` and `assets/mapping/soft-to-id.json` from the classified audit. It fails on anything unaccounted for, a duplicate or bone-colliding ID, a broken part/parent link, or left and right sets that don't mirror. Every judgement call is a table at the top of the script and a numbered entry in `content/QUESTIONS.md` (items 37 to 62, "Soft tissue: mapping").
- **soft-ids.json** follows decision 1, plus `group`: the source's own grouping (region, compartment, joint) as snake_case keys, for the M8 hierarchy. IDs are ordered by layer, group and then anatomically (vertebral levels C → T → L → S, numbers numerically, left before right). `latin` is `null` throughout: the source names are English, so Latin comes with the M8 content.
- **Doubtful meshes** were resolved with the defaults the user accepted, except the **linea alba**, which is left out: the source has it as one midline mesh, and a part needs one parent of its own side (QUESTIONS 40).
- **Parent muscles with a mesh.** Where the source has a whole muscle *and* a separate tendon, aponeurosis or part (tensor fasciae latae with the iliotibial tract, palmaris longus with the palmar aponeurosis, superior rectus with the common tendinous ring, extensor digitorum longus with its tendon, adductor magnus with adductor minimus, and frontalis and occipitalis under occipitofrontalis), the muscle's own mesh became a part ("Belly of …", "Main part of adductor magnus"), because a parent has no mesh of its own (spec §2.7, §3).
- **Ligament parts** (tibial collateral and iliofemoral) are separate ligaments, since the spec has parts for muscles only (QUESTIONS 51).
- **Patches.** 697 of the 705 are kept under `attachments` (`<structure id>__origin|insertion[_side][_n]`), each with the muscles or parts it serves, its side from geometry, and the bone or costal cartilage it lies on. 8 are dropped (on excluded structures, or misplaced). Patches named for a group (quadriceps, triceps surae, iliopsoas, erector spinae, levator ani, the common extensor and flexor tendons) list their members; "Trochanteric insertion" has none (QUESTIONS 58 and 59). 23 patches with no twin on the other side are listed in `attachmentsMissing`.
- **Absent structures.** The patellar ligament and articularis genus get IDs without a mesh (`meshAvailable: false`), because patches refer to them. The other absent structures from the audit are listed in `missingNoId`, with no ID.
- **Fix to session P.** The classifier excluded **tensor fasciae latae** as "fascia" (its name contains "fasciae"); fixed, and it's now in the major-muscle checklist. The report's side section is corrected too.
- **Tests:** `tests/soft-ids.test.ts` (12 tests): unique snake_case IDs, no collision with bones, side suffixes, exact left/right mirroring, layers per kind, parts and parents both ways, the calcaneal tendon rule, every audited mesh used exactly once, only nucleus pulposus merged, patches pointing at real structures on real bones or cartilage and on their own side.

### Preliminary counts (final after session R)

| Kind | IDs (both sides) | With a mesh |
| --- | --- | --- |
| Muscles, single mesh | 348 | 348 |
| Muscles with parts (parents, no mesh of their own) | 58 | 0 |
| Muscle parts: heads 58, portions 40, bellies 16, tendons 10, aponeuroses 4 | 128 | 128 |
| Muscles absent from the source (articularis genus) | 2 | 0 |
| Ligaments | 300 | 300 |
| Ligaments absent from the source (patellar ligament) | 2 | 0 |
| Cartilage (20 costal cartilages, 4 labra) | 24 | 24 |
| Discs (23 intervertebral, interpubic, sacrococcygeal) | 25 | 25 |
| Menisci and articular discs (4 menisci, 8 articular discs) | 12 | 12 |
| **Total** | **899** | **837** |

Meshes per layer file: **muscles 476, ligaments 300, cartilage 61**, plus **697 attachment patches**. Source meshes: 860 joined into those 837 nodes (the 23 nucleus pulposus meshes go into their discs), 262 excluded.

## Session R notes (steps 5 to 7, done)

What was done, and where it differs from the plan (say if any should change):

- **Refactor.** The shared Blender code moved from `build_skeleton.py` into `scripts/blender/pipeline_lib.py`. A scratch rebuild of the bones matches the committed `manifest.json` for every object, LOD, triangle count and bound. The bone files and manifest were not rebuilt, and `git diff public/models/skeleton-*` is empty. An existing nondeterminism was found along the way (the order in which `boundary_loops` walks a set of edges) and left alone; see the report.
- **Build.** `scripts/blender/build_soft_tissue.py` with `npm run build-soft` (`scripts/build-soft-tissue.sh`, `--layer` to rebuild one) builds all four layers in about 8 minutes. `compress-models.sh` takes file stems, and `check-models` checks all ten files: names per layer, budgets (`LAYER_BUDGETS`, with the triangle target capped at the source total), `COLOR_0` and bounds. There are 5 new Vitest cases.
- **Results.** All within 0.5% of their triangle targets and far under their byte budgets; max bounds drift 0.285 mm (muscles low), with `-vp 14` unchanged. AO is a per-structure Cycles bake.
- **Different from the plan: normals of thin sheets.** For Solidify sheets the signed volume is unreliable, and the bone rule turned 6 correct sheets inside out (they baked black): the posterior sacro-iliac and radial collateral wrist ligaments, and the temporalis origin patch 3. The soft-tissue build now reverses any structure whose mean AO is under 0.3, re-bakes it, keeps the brighter orientation and logs it (`orientationFixedByAo`). The bone build is unchanged.
- **Stray vertices.** Cleanup deleted loose vertices far from two structures, so their bbox shrinks without any face moving: `external_abdominal_oblique_*__origin_4` by 85 mm and `transverse_ligament_knee_*` by 16 mm (recorded in each manifest's `boundsCheck`).
- **Counts:** final, the same as session Q's preliminary table (the report repeats it). M6's exit table for the report back is ready for session S.

## Session S notes (steps 8 to 10 done; 11 after the merge)

What was done, and where it differs from the plan (say if any should change):

- **Debug view.** `src/scene/debugLayers.ts` (pure: the `layers` parameter, colours, the bounds report; `tests/debugLayers.test.ts`) and `src/scene/DebugLayers.tsx` (lazy: loads `<layer>-<lod>.glb` with the Meshopt decoder once the bones show that LOD, swaps low for high, flat layer colours times the baked AO, attachment patches in amber with a polygon offset so they sit on the bone, nothing pickable). The overlay gets one line per layer: LOD, nodes, triangles and the largest bounds error against `manifest-<layer>.json`, loaded as its own chunk. `layers=all` is every layer; `layers=m,l,c,a` (or full names) a subset. Without both `debug` and `layers`, nothing of it is requested.
- **Patches are a fourth layer in the view** (`a`), since session R shipped them as `attachments-*.glb`.
- **Results.** Both LODs: muscles 476 nodes (477 with the linea alba, below), ligaments 300, cartilage 61, patches 697, each equal to the `meshAvailable` IDs (or the `attachments` map); every node's bounds within **0.02 mm** of its manifest (the 1 mm rule); triangle counts on target. The bones still pass their own bounds check with the layers loaded.
- **Screenshots** (`docs/m6/`, high LOD, `deviceScaleFactor: 1`): `layers-all-{anterior,left}.png` and `layers-no-muscles-{anterior,left}.png` (ligaments, cartilage and patches on the bones). No misalignment is visible: the costal cartilages meet the ribs and sternum, the discs sit between the vertebrae, the patches lie on the bones.
- **Seen in passing, for M7:** the debug ligament colour (pale grey-white) is close to the bone ivory, so ligaments are hard to pick out on the bones; spec §6.3 asks for "distinct from bone", which M7's real colours should check (ΔE). The draw count in the debug view is about 1,500 (one per node), as risk 4 expected.
- **No regression.** Bone files byte-identical to M5 (`71f04d0`); main chunk +0.36 kB gzipped; the full e2e suite passes (112 tests; the high-LOD layer test needed a 240 s timeout under two workers); `npm run perf-load` passes: desktop 2.02 s to the skeleton and 6.42 s to full detail, phone profile 1.97 s and 6.47 s (M5: 1.90 / 5.96 and 1.91 / 6.08). The low file arrives at about 1.72 s in both, and the requests are the same, so the difference is run-to-run noise from the software GPU's shader compilation (one run blocked 2.9 s).
- **Attribution.** `public/ATTRIBUTION.md` names the collections used and the new files (decision 14). README lists `?debug&layers=all`.

**User's reply (2026-11-20):** "looking good, counts seem fine to me. still hitting 60fps on phone, 75 on pc. some loading latency but thats acceptable." The counts stand; M8 content is unblocked. `m6` is frozen at the start of M7 (handover step 1, at `e9da664` unless more lands on `main` first).

**Linea alba added (2026-11-20, after the merge).** The user saw the gap it left between the recti in `/m6/` and chose (QUESTIONS 40) to include it in the muscles layer as `linea_alba`: a midline aponeurosis part with **no parent**, listing the six flat abdominal muscles it joins (external and internal oblique and transversus abdominis, both sides) under `alsoServes`. `SPEC-musculoskeletal.md` §3 records the extension; the generator checks that a parentless part is midline and serves both sides. Only the muscles layer was rebuilt (`npm run build-soft -- --layer muscles`): 477 nodes, 799,750 / 229,800 triangles, 4.62 / 1.61 MB, max bounds drift 0.285 mm (low), as before. The bone files and the other layers are unchanged. The counts below include it.

### Final counts (step 10, the report back)

| Kind | IDs (both sides) | With a mesh |
| --- | --- | --- |
| Muscles, single mesh (leaves) | 348 | 348 |
| Muscles with parts (parents, no mesh of their own) | 58 | 0 |
| Muscle parts: heads | 58 | 58 |
| Muscle parts: portions | 40 | 40 |
| Muscle parts: bellies | 16 | 16 |
| Tendons (parts) | 10 | 10 |
| Aponeuroses (parts, incl. the linea alba) | 5 | 5 |
| Muscles absent from the source (articularis genus) | 2 | 0 |
| Ligaments | 300 | 300 |
| Ligaments absent from the source (patellar ligament) | 2 | 0 |
| Cartilage (20 costal cartilages, 4 labra) | 24 | 24 |
| Discs (23 intervertebral, interpubic, sacrococcygeal) | 25 | 25 |
| Menisci and articular discs (4 menisci, 8 articular discs) | 12 | 12 |
| **Total** | **900** | **838** |

Plus **697 attachment patches** (origins and insertions; 12 more listed in `attachmentsMissing` have no twin). Source meshes: **46 merged into 23 discs** (each disc with its nucleus pulposus; the only merge), **269 excluded** with reasons (bursae 78, fascia 38 and septa 14, joint capsules 34, tendon sheaths 26, retinacula 18, laryngeal and nasal cartilage and their ligaments, sinus volumes, label meshes and others), **4 `missing` IDs** (patellar ligament, articularis genus) and **15 absent structures without an ID** (`missingNoId`: articular cartilage everywhere, the quadriceps tendon, the craniovertebral ligaments, the anterior tibiotalar ligament, ear and auricular muscles, most soft-palate and perineal muscles, styloglossus, palatoglossus, subcostales, psoas minor).

Surprises from the audit, for the reply: names are English TA (no Latin yet); every paired muscle is already split left and right; no articular cartilage; no patellar ligament or quadriceps tendon; some source sides are wrong (`Lateral temporomandibular ligament`, 50 patches), corrected from geometry; the patch names can be wrong, so M8's origins and insertions come from references.

## Session P: audit (steps 1 and 2)

## Step 1: Soft-tissue audit (spec §2.1)

- Extend `scripts/blender/audit_source.py` (or add `audit_soft_tissue.py` that reuses its `mesh_stats`) to cover `2: Muscular insertions`, `3: Joints`, `4: Muscular system` and the meshes in `1: Skeletal system` whose names say cartilage. Per mesh with faces: name, collection path, triangle count, world bounds and centroid, side from the name and side from the centroid x, holes and non-manifold edges, loose vertices, modifiers, negative scale, linked-duplicate data, and a first classification: **whole structure**, **part** (name matches an anatomical division), **fragment** (numbered or unnamed split of one structure), **excluded type** (capsule, membrane, bursa, fascia, retinaculum, nasal/laryngeal/auricular cartilage).
- Output `assets/audit/soft-tissue.json` and `assets/audit/REPORT-soft-tissue.md`: totals per collection and per class; triangle totals per proposed layer against decision 8; left/right pairing (every left mesh has a right twin, and where not); the side disagreements; which major muscles are present (a fixed checklist: deltoid, pectoralis major, latissimus dorsi, trapezius, biceps, triceps, gluteus maximus, quadriceps, hamstrings, gastrocnemius, soleus, rectus abdominis, diaphragm, …); the articular cartilage found per major joint; and the spec's stop conditions, each answered yes or no with the evidence.
- Vitest is not needed for the Blender script; the JSON is checked by step 4's tests.

## Step 2: Decision on `2: Muscular insertions` (decision 12)

- In the same audit run: measure each patch's distance to the bones (median and 95th percentile per patch), read what its name says (muscle, origin or insertion), and its side.
- Record the decision with the numbers in `REPORT-soft-tissue.md` and tick the exit criterion. If the answer is "usable", list how the patch names map to muscles, for session Q.
- **Checkpoint:** stop here and ask the user if a stop condition holds or articular cartilage is largely missing (see "User checkpoints"). Otherwise continue to session Q next time.

## Session Q: mapping (steps 3 and 4)

## Step 3: Soft-tissue ID list and mapping (spec §2.2–2.3, §3; decisions 1–7)

- `scripts/mapping/generate_soft_ids.py` (`npm run soft-ids`) reads the audit JSON and writes:
  - `content/soft-ids.json` (decision 1), ordered by layer, then region, then anatomical order (so later tree and Tab order follow it).
  - `assets/mapping/soft-to-id.json`: `map` (ID → source object names to join), `merged` (ID → the fragment names joined, with the reason), `missing` (anatomical structures the source lacks, with the joint or region), `excluded` (source name → reason), `attachments` (if step 2 said usable) and `notes` (ID → free text, for example "single mesh; heads not separated in the source").
- The generator's curated tables: Latin → English names; known anatomical divisions (decision 3); excluded types; midline structures. It fails if any audited mesh is unaccounted for, if an ID repeats or collides with a bone ID, if a side disagrees with the geometry, or if a part's parent is missing.
- English names and Latin are from standard terminology (TA); where a translation is uncertain, keep the Latin as the name and add a question.

## Step 4: Mapping checks and questions

- `tests/soft-ids.test.ts` (Vitest, like `tests/ids.test.ts`): every audited mesh is mapped, merged or excluded exactly once; IDs are snake_case with the side suffix last; left and right sets mirror each other (except listed midline structures); every part's parent is a muscle and is listed in that muscle's `parts`; muscles with parts have `meshAvailable: false`; no ID collides with `content/ids.json`; the calcaneal tendon follows decision 5.
- `content/QUESTIONS.md`: new headings **Muscles**, **Ligaments**, **Cartilage** and **Mapping**, one entry per doubtful merge, part or name.
- At the end of the session, put a **preliminary count table** per kind in this plan (it is final after session R).

## Session R: pipeline and compression (steps 5 to 7)

## Step 5: Blender pipeline for the new layers (spec §2.4–2.7; decisions 8–11)

- Refactor the shared code of `build_skeleton.py` into `scripts/blender/pipeline_lib.py` with no change in behaviour (decision 9).
- `scripts/blender/build_soft_tissue.py <Startup.blend> <out_dir> [--layer muscles|ligaments|cartilage|attachments]`: for each layer, per ID: evaluated mesh of every source object (modifiers applied), world transform applied, winding flipped for negative determinants, parts joined (merged fragments only), named by ID. Clean-up as for bones (merge by distance, loose geometry, duplicate faces, outward normals, small holes capped and logged; leftover non-manifold logged). Origin to the bounds centre (origin only), then the **bounds assertion against the audit within 1e-4 m**, failing loudly. AO per structure (decision 10). LODs by Decimate (collapse) to the budgets in decision 8. Export `<layer>-{high,low}.glb` (+Y up, one node per ID, `COLOR_0`, no materials, cameras or lights) and `assets/build/manifest-<layer>.json`.
- `scripts/build-models.sh` gains a `--soft` option (or a new `build-soft-tissue.sh`, `npm run build-soft`) that runs the build, compression and checks for the layers only, never touching the bone files.

## Step 6: Compression and `check-models` (spec §2.7–2.8)

- `scripts/compress-models.sh` handles the layer files with the same `gltfpack -cc -kn` settings (and `-vp 14` or higher if bounds drift).
- `scripts/check-models.ts` checks all files (decision 11). The pure parts (name sets per layer, budget check, bounds comparison) get Vitest cases next to the existing ones.
- Commit the compressed `.glb` files directly (no LFS).

## Step 7: Build report

- `assets/build/REPORT-soft-tissue.md`: per layer and LOD, triangles and file size against budget; the AO method; objects still non-manifold; holes filled; anything the bounds check needed (`-vp`); build time. Final count table per kind (it goes into this plan too).

## Session S: debug view, checks and hosted copy (steps 8 to 11)

## Step 8: Debug layer view (decision 13)

- `src/scene/debugLayers.ts` (+ a small component in the Canvas), imported dynamically only when `?debug` and `layers` are both present. Loads the requested layer files after the bones (low LOD, then high as for bones), adds them as plain meshes with flat layer colours, and extends the debug overlay with per-layer counts and the largest bounds error against `manifest-<layer>.json`.
- `README.md`'s URL options list `?debug&layers=all`.

## Step 9: Alignment and no-regression tests

- `tests/e2e/layers-debug.spec.ts`: with `?debug&layers=all`, every layer loads, node counts equal the `meshAvailable` counts in `soft-ids.json`, and every node's world bounds match its manifest within 1 mm (as `smoke.spec.ts` does for bones). A screenshot pair (front and side, `deviceScaleFactor: 1`) is attached to the test report and saved for the user to look at for misalignment.
- No regression: `smoke.spec.ts` and the rest of the suite pass unchanged; without `layers`, the page requests no layer file (checked in the test); `git diff` on the bone `.glb` files is empty; `npm run perf-load` stays within the M5 figures (first skeleton about 1.9 s in the container); the main chunk stays within 1 KB gzipped of M5.
- `public/ATTRIBUTION.md`: the line on the collections used (decision 14).

## Step 10: Report back (spec §11, §13)

- A count table per kind in this plan and in the final message to the user: muscles (leaves and parents), parts (by `partType`, tendons and aponeuroses separately), ligaments, cartilage, discs, menisci, plus `missing`, `merged` and `excluded` totals and the audit's surprises. Also the screenshots from step 9.
- **Stop for the user's reply before M8 content.** M7 (layers and rendering) can be planned meanwhile, since it depends only on the assets.

## Step 11: Hosted copy

- After the PR merges, the deploy builds `/m6/` from `main` (`current` is 6). Ask the user to open `https://ajmarr04-ux.github.io/SkeletonViewer/m6/?debug&layers=all` and confirm. Then tick the exit criterion and update `README.md`'s row. Freezing `m6` happens at the start of M7 (Milestone handover in `CLAUDE.md`).

## Hosted copy

- Milestone 6: https://ajmarr04-ux.github.io/SkeletonViewer/m6/ (live, confirmed 2026-11-20). The new layers are only visible with `?debug&layers=all`: https://ajmarr04-ux.github.io/SkeletonViewer/m6/?debug&layers=all
