# Milestone 1 Plan: Model Ready (Spec Phase 1)

Source of truth: `SPEC (2).md`, sections 4, 5 and 11 (Phase 1).

## Goal

Get one clean skeleton model into the repo: 238 separate objects (206 bones and 32 teeth), each named by its stable ID, in one shared coordinate space. Export it at two levels of detail, both within their size budgets. Add a bare viewer that loads both, and publish it at a hosted link so it can be checked in a browser.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| A | 1 (audit) and 2 (ID list and mapping) | **Done.** See `assets/audit/REPORT.md`, the decisions are recorded there |
| B | 3 (Blender pipeline) and 4 (compression and checks) | **Done.** See `assets/build/REPORT.md`. Rebuild with `npm run build-models` |
| C | 5 (bare viewer) and 6 (Pages deploy) | Not started. Start with "begin session C" (see `CLAUDE.md`) |

To resume in a fresh session, run `bash scripts/setup-blender.sh`, then read this file and `assets/audit/REPORT.md`.

## Exit criteria (from spec §11, Phase 1)

- [x] Source chosen. Teeth are confirmed as separate meshes, or the problem has been reported back. (Z-Anatomy: 28 of 32 teeth are separate; the third molars are missing and reported.)
- [x] 238 objects, named by stable ID, in one shared coordinate space. (234 meshes plus the 4 known-missing third molars; `check-models` asserts the names and that no bone moved.)
- [x] Both LODs exported and compressed, and each is under its size budget (high: ~500k tris, < 15 MB; low: ~150k tris, < 6 MB). (high 499,981 tris, 2.59 MB; low 149,913 tris, 0.91 MB.)
- [ ] A bare viewer loads both LODs.
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 1: Choose the source and audit the teeth (decision gate)

Preferred source: **Z-Anatomy** (CC BY-SA 4.0). I checked the repo: it ships the atlas as one Blender file, `Z-Anatomy.zip` (~87 MB), plus `TA2.csv` (a real Terminologia Anatomica 2 table, which can later fill the `ta2` fields without inventing IDs).

1. Install headless Blender 4.x in the build environment. It isn't installed yet.
2. Write `scripts/blender/audit_source.py`. It opens the `.blend` and lists every object in the skeletal and dental collections: name, vertex and triangle count, bounding box, and whether it is mirrored or merged. The output goes to `assets/audit/z-anatomy.json`.
3. Check the audit for:
   - **Teeth:** 32 separate tooth meshes? If not, check BodyParts3D for separate teeth (FMA IDs). If neither has them, **stop and report back**. Teeth are not to be split by hand.
   - **Merged bones:** for example, a hip bone split into ilium, ischium and pubis, the skull as one mesh, or hand and foot phalanges joined together. Some splits can be merged by script, such as joining the three hip-bone parts into `hip_bone_left`. Anything that would need cutting a mesh gets reported.
   - **Left/right:** all paired bones are separate objects, not mirror modifiers.
   - **Sesamoids:** the 206 count includes only the two patellae, which matches the standard adult count. Extra sesamoids in the source are excluded and the exclusions are logged.
   - **Ossicles and hyoid:** all present (malleus, incus and stapes on each side, plus the hyoid).
4. Fallback order if Z-Anatomy fails the audit: Open 3D Model (anatomytool.org), then BodyParts3D.

**Output:** `assets/audit/REPORT.md`, giving the source decision and listing any problems. If this step finds a blocker, I pause here and check with you.

## Step 2: Write the canonical ID list (data, before geometry)

- `content/ids.json`: the full list of 238 stable IDs, grouped by hierarchy, with `kind` and `side`. Teeth use FDI numbering, `tooth_11` to `tooth_48`.
- `assets/mapping/source-to-id.json`: maps each source object name (one or more) to a stable ID. This is where merges such as the three hip-bone parts are recorded.
- A Vitest test checks that the list has 238 unique entries (206 bones and 32 teeth), every paired ID has its partner on the other side, and the teeth cover quadrants 1 to 4 and positions 1 to 8.

## Step 3: Blender pipeline (`scripts/blender/build_skeleton.py`, headless and repeatable)

Runs with `blender -b --python scripts/blender/build_skeleton.py -- <source.blend> <out_dir>`. In order:

1. **Select and rename:** keep only the objects in the mapping, join any merges, and rename each object to its stable ID.
2. **Clean up:** merge vertices by distance, recalculate normals to point outward, remove loose geometry and duplicate faces, and log any object that is still non-manifold.
3. **Coordinate space:** convert to metres, Y up and facing +Z (the glTF exporter's +Y-up option handles the axis change). Set each object's origin to its centroid by moving the origin, *not* the geometry. Before and after, record each object's world-space bounding box and assert that nothing moved by more than 1e-5 m.
4. **Baked AO:** bake ambient occlusion with Cycles into a `COLOR_0` vertex colour attribute.
5. **Make two LODs:** decimate with the Decimate (collapse) modifier. Each object's ratio is weighted so small objects (ossicles, teeth, distal phalanges) keep enough detail. Targets: about 500k triangles for high and about 150k for low.
6. **Export:** two `.glb` files, with one node per object and the node name set to the stable ID.
7. **Report:** `assets/build/manifest.json`, giving each object's triangle count, bounds and centroid for each LOD. The validator and the later phases use this file.

## Step 4: Compress (`scripts/compress-models.sh`)

- `gltfpack -i high.glb -o public/models/skeleton-high.glb -cc -kn` (`-kn` keeps the node names. Without it, gltfpack could merge nodes and lose the IDs.)
- Do the same for the low LOD.
- `scripts/check-models.ts`, run with Node and `@gltf-transform/core`, then checks:
  - The node names match `content/ids.json` exactly, with 238 nodes and no extras or missing ones.
  - The file sizes fit the budgets (< 15 MB and < 6 MB) and the triangle counts are near the targets.
  - The world-space bounds match the Blender manifest within tolerance, which proves nothing was re-posed.
  - The script exits with a non-zero code on any failure.

## Step 5: Project scaffold and bare viewer

- Set up Vite with React 18 and strict TypeScript, following the folder layout in spec §3. Add `three`, `@react-three/fiber`, `@react-three/drei` and `meshoptimizer` (the Meshopt decoder).
- `src/scene/BareViewer.tsx`:
  - Loads `skeleton-low.glb` first, then streams in `skeleton-high.glb` and swaps it in once it has loaded.
  - Uses a simple drei `OrbitControls`, a placeholder that `camera-controls` replaces in Phase 2.
  - Has a debug overlay: the current LOD, number of objects, triangle count, draw calls, load times for each LOD, and a `?lod=low|high` override for checking each file on its own.
  - Shows the WebGL 2 fallback message when WebGL 2 isn't available.
- `public/ATTRIBUTION.md`, containing the Z-Anatomy, BodyParts3D and CC BY-SA 4.0 credits, linked from the viewer footer.
- Tests:
  - Vitest: the ID list test and a test of the model-checker logic.
  - One Playwright smoke test: the page loads, both LODs report as loaded, and the object count is 238.
- `npm run check` runs `tsc --noEmit`, `vitest` and `check-models`.

## Step 6: Hosted copy (repeated at the end of every milestone)

- **Host:** GitHub Pages, deployed by GitHub Actions (`.github/workflows/deploy.yml`). The workflow runs on pushes to `main` and can also be run by hand. It runs `npm ci`, `npm run check` and `npm run build`, then publishes `dist/`.
- Vite `base` is set to `/SkeletonViewer/` so the asset paths work on Pages.
- `.glb` files are committed directly, since each is well under GitHub's 100 MB limit. Git LFS isn't used because Pages doesn't serve LFS objects.
- **Expected URL:** https://ajmarr04-ux.github.io/SkeletonViewer/
  - One setting has to be changed by hand once: **Settings → Pages → Source → GitHub Actions**. I can't change it from here.
- **Per-milestone snapshots:** each milestone also deploys to `/SkeletonViewer/m1/`, `/m2/` and so on, so earlier milestones stay viewable after later ones ship.
- The finished milestone's link goes in `README.md` under "Milestones", and is shared back here.

**Hosted copy, Milestone 1:** _link to be added when the milestone is complete_. Planned: https://ajmarr04-ux.github.io/SkeletonViewer/m1/

---

## Risks and open points

| Risk | Mitigation |
| --- | --- |
| Z-Anatomy teeth are merged into the jaws | Fall back to BodyParts3D teeth. If neither works, stop and report (the spec's rule). |
| Source parts don't line up with the 206 bones (split hip bones, extra sesamoids, sacral or coccygeal segments) | Join by script through the mapping file and record each decision in `REPORT.md`. Anything ambiguous goes in `content/QUESTIONS.md`. |
| Decimation destroys tiny bones | Weight the decimation ratio by object size and set a minimum triangle count for each object. |
| gltfpack merges or renames nodes | Use `-kn`, and have `check-models.ts` assert all 238 names. |
| The 87 MB source and Blender bake time on CI | Run the Blender pipeline locally or in this container, and commit only the compressed `.glb` files. CI only checks and deploys them. |
| CC BY-SA share-alike | The attribution file and the in-app link are in place from Milestone 1. |

## Commit plan (branch `claude/keen-clarke-32a10a`)

1. `docs: milestone 1 plan` (this file)
2. `assets: source audit and teeth report`, then a **pause for review if anything blocks**
3. `content: canonical 238-ID list and source mapping`
4. `scripts: Blender build pipeline and model checks`
5. `models: compressed high and low LOD glb files`
6. `app: Vite scaffold and bare dual-LOD viewer`
7. `ci: GitHub Pages deploy with per-milestone snapshot`, then add the hosted link and tick the Phase 1 checklist
