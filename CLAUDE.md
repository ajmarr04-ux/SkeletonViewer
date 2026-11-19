# Skeleton Viewer: notes for Claude Code

A static browser app: a 3D atlas of the adult human skeleton (bones and teeth only). The full spec is `SPEC (2).md` and is the source of truth. The Milestone 1 plan and its progress table are in `docs/PLAN-milestone-1.md`.

## Ground rules (from the spec, §12)
- Never translate, rotate or re-pose a bone. Every object keeps its world position exactly. Moving an object's *origin* is fine; moving its geometry in world space is not.
- Never invent landmark coordinates, TA2 IDs or articulations. Anything uncertain goes in `content/QUESTIONS.md`.
- If an asset problem blocks you, stop and describe it rather than working around it silently.
- Before calling any step done, run `npx tsc --noEmit` and `npx vitest run`, plus `npm run validate-content`.
- Commit at the end of each session and push to the session's assigned branch. Mark progress in `docs/PLAN-milestone-1.md`.
- Every milestone ends with a hosted copy on GitHub Pages, linked in `README.md`. The URL pattern is `https://ajmarr04-ux.github.io/SkeletonViewer/m<N>/`.

## Decisions already made (don't reopen these)
- **Source:** Z-Anatomy `Startup.blend`, pinned to commit `71919ee`, collection `1: Skeletal system`. The audit is in `assets/audit/REPORT.md`.
- **Wisdom teeth:** there are none. `tooth_18`, `tooth_28`, `tooth_38` and `tooth_48` stay in `content/ids.json` with `meshAvailable: false`. Milestone 1 ships **234 meshes** (206 bones and 28 teeth). The app must cope with these 4 IDs having no mesh.
- **Sternum:** the source's manubrium, body and xiphoid are joined into one object, `sternum`.
- **Cartilage:** all cartilage is excluded, including the costal cartilages. It may be revisited if the project later grows beyond the skeleton.
- **Hallux sesamoids** are excluded, since they aren't part of the 206.
- **Hosting:** the repo is public, and the site deploys to GitHub Pages through GitHub Actions.

## Key files
| Path | What it is |
| --- | --- |
| `content/ids.json` | The 238 canonical IDs: `id`, `name`, `kind`, `side`, `group`, `meshAvailable`. Generated, so don't edit by hand. |
| `assets/mapping/source-to-id.json` | `map` (ID → source object names to join), `missing`, `excluded`. Generated. |
| `scripts/mapping/generate_ids.py` | Writes the two files above and checks them against the audit. Run with `npm run ids`. |
| `assets/audit/z-anatomy.json` | Audit data for each object: triangles, bounding box, centroid, holes, loose vertices, modifiers, negative scale. |
| `scripts/blender/audit_source.py` | Produces the audit. |
| `scripts/setup-blender.sh` | Installs `bpy==5.3.0` into `.cache/venv` and fetches the pinned source into `.cache/z-anatomy/` (git-ignored). |
| `tests/ids.test.ts` | Vitest tests of the ID list and the mapping. |
| `scripts/blender/build_skeleton.py` | Blender pipeline: extract, clean, origins, AO bake, LODs, glTF export, `assets/build/manifest.json`. |
| `scripts/compress-models.sh`, `scripts/check-models.ts` | gltfpack into `public/models/`, then the name, budget and bounds checks (`npm run check-models`). |
| `scripts/build-models.sh` | All of the above in one go: `npm run build-models` (about 45 s, after setup). |
| `assets/build/REPORT.md` | Build results: triangle counts, sizes, AO method, leftover non-manifold geometry. |
| `public/models/skeleton-{high,low}.glb` | The committed, compressed models. Named nodes = bones; each has an unnamed child holding the quantised mesh. |
| `src/scene/Viewer.tsx`, `src/scene/lod.ts` | The viewer (replaced M1's `BareViewer.tsx`): low then high LOD, automatic LOD choice, `?lod=low|high|both` override, live re-plan when Settings changes, debug overlay only with `?debug`. Pure helpers in `lod.ts`. |
| `src/ui/Toolbar.tsx`, `Popover.tsx`, `Settings.tsx` | Bottom-centre toolbar: Home, Views menu (presets), Settings (model detail in `localStorage`). Framing leaves a 100 px bottom inset for it (`setViewOffset`). |
| `src/scene/bench.ts`, `src/ui/BenchPanel.tsx` | `?bench`: 360° orbit over 10 s, median and 5th-percentile FPS, frame times, draw calls. |
| `src/scene/batchSkeleton.ts` | Packs the 234 bones into one `BatchedMesh` (instance matrix = the glTF mesh's world matrix, vertices untouched), ID ↔ instance tables, three-mesh-bvh raycasting. |
| `src/scene/material.ts`, `src/scene/Lighting.tsx` | Shared bone material with the AO remap (`AO_FLOOR`), key light and `RoomEnvironment`. |
| `src/state/store.ts`, `src/state/url.ts` | zustand store (camera, LOD, reduced motion, `cameraRequest` commands, `sel`/`tier`/ghost/hover); pure URL parse/serialise helpers (`sel`, `tier`, `ghost`, `cam=` with optional offset). |
| `src/state/isolation.ts`, `src/state/selection.ts` | Pure isolation reducer (spec §6 state diagram, history step per action); applying it to the store and browser history (push / replace / back, `skvDepth` marker, popstate). |
| `src/scene/isolation.ts`, `src/scene/Isolation.tsx`, `src/scene/outline.ts` | Isolation view (solid / ghost / focus) applied to the solid and ghost batches; inverted-hull outlines sharing the batch's buffers. |
| `src/ui/Tooltip.tsx`, `src/content/names.ts` | Hover name tooltip; display names ("Femur (left)"). |
| `src/ui/InfoPanel.tsx`, `Breadcrumb.tsx`, `Announcer.tsx` | Info panel (desktop right panel, phone bottom sheet), breadcrumb, `aria-live` announcements. The panel reports the area it covers (`panelInset`) so framing (`frameBeside`) keeps the bone beside it. |
| `src/content/placeholder.ts`, `src/content/labels.ts` | Placeholder panel content from `ids.json` ("Not written yet"), opposite side, group labels and breadcrumb trail. |
| `content/bones/<id>.md` | Content files (spec §5). Write the left and midline files only, then `npm run content:mirror` writes the right side; `validate-content` fails if they drift. |
| `src/content/compile.ts`, `scripts/lib/content-plugin.ts`, `src/content/loader.ts`, `src/content/panel.ts` | Content compiler (front matter + `marked`), served as the virtual module `virtual:skeleton-content` (its own lazy chunk; `npm run content` prints its size); loader hook; the panel model (falls back to the placeholder for unwritten files). |
| `tests/e2e/panel.spec.ts`, `tests/e2e/all-objects.spec.ts` | Panel, sheet, contrast and 200% reflow; every one of the 234 objects tapped on a 390 px phone (about 3 minutes). |
| `src/scene/pick.ts` | Tiny objects (radius < 2 cm, 100 of them) and `pickWithProxies` (screen-space hit areas: 22 px touch, 6 px mouse). |
| `src/camera/CameraRig.tsx` | camera-controls rig with a **fixed orbit pivot**: camera-controls only rotates; pan, zoom-to-surface and two-finger touch are the rig's own (focal offset). Clicks/taps select, double-tap centres, hover, `Esc`, `cam=` URL sync, `window.__viewer` debug hooks. |
| `src/camera/math.ts`, `src/camera/input.ts` | Pure camera maths (presets, box framing, limits, fixed-pivot `panPose`/`dollyPose`/`repivot`/`centreOn`/`clampOffset`) and input helpers (`classifyWheel`, key map, taps and double taps). |
| `tests/e2e/viewer.spec.ts`, `tests/e2e/select.spec.ts` | Playwright camera tests (keyboard, URL round trip, presets, re-centre, touch); selection and fixed-pivot tests. |
| `content/articulations.json`, `regions.json`, `hierarchy.json`, `QUESTIONS.md` | Relationship data (spec §5): one entry per articulation pair; tier-2 sets on top of tier 1; the tree. `QUESTIONS.md` lists every uncertain choice. |
| `src/content/schema.ts`, `validate.ts`, `frontmatter.ts`, `relations.ts` | zod schemas; pure validation rules; front matter and left → right mirroring; tier sets (`tier1`, `regionOf`, `visibleAt`). |
| `scripts/validate-content.ts`, `scripts/content/mirror.ts`, `build-hierarchy.ts` | `npm run validate-content` (in `check` and `prebuild`), `content:mirror`, `content:hierarchy`. |
| `tests/e2e/related.spec.ts` | Tiers 1 and 2, history, side toggle at a tier, teeth. |
| `src/scene/explode.ts`, `src/scene/Explode.tsx`, `src/ui/ExplodeSlider.tsx` | Explode (plan step 8): offsets, saved and restored instance matrices, the toolbar slider. Store `explode` (0 to 1). |
| `tests/e2e/joints.spec.ts` | Joint highlighting (hover, focus, press-and-hold; store `joint`, `withJoint` in `src/scene/isolation.ts`) and Explode. |
| `tests/e2e/smoke.spec.ts` | Playwright smoke test (`npm run e2e`): both LODs load, 234 batched bones + 4 known-missing, < 20 draw calls, every bone's bounds match the manifest (`?debug`). |
| `content/synonyms.json`, `src/content/search.ts`, `src/content/searchLoader.ts`, `scripts/lib/search-data.ts` | Search (M5 step 1): extra terms per left/midline ID (checked by `validate-content`); minisearch documents, options, side filter; the prebuilt index as `virtual:skeleton-search` (lazy chunk; `npm run search-index` prints its size). |
| `src/ui/Sidebar.tsx`, `src/content/tree.ts`, `src/content/groups.ts` | Sidebar (search combobox and ARIA tree; `/` opens it; desktop width reported as `sidebarLeft`); pure tree rows and keys; groups (hierarchy nodes plus `dentition.type.*`), names, counts, announcements, breadcrumb links. Group isolation is `grp` in the store, URL and reducer. |
| `src/scene/labels.ts`, `src/ui/Labels.tsx` | Floating labels (M5 step 5): pure greedy no-overlap layout by priority; `LabelProbe` (in the Canvas, re-lays out at rest and every 100 ms while moving) and the `aria-hidden` overlay. Store `labelsOn` (localStorage) and `labelLayout`. |
| `src/scene/regionColours.ts`, `src/ui/Legend.tsx` | Colour-by-region (step 6): regions, Okabe–Ito colours, CVD simulation and ΔE2000 (tested); legend buttons isolate a region as a group. Store `colourMode`, URL `color=region`, localStorage. Instance colours via `applyBaseColours` / `baseTintFor` (`src/scene/isolation.ts`, `Isolation.tsx`). |
| `src/scene/screenshot.ts`, `src/ui/capture.ts`, `src/scene/ScreenshotService.tsx` | Screenshot (step 7): file name and strip layout; render one frame on demand and composite labels, legend and the attribution strip; share sheet on phones, else a download. |
| `src/ui/share.ts`, `src/ui/Toast.tsx` | Share link (step 8): share sheet on phones, else clipboard + "Link copied" toast (announced), else a read-only field. |
| `src/ui/Footer.tsx` | Attribution page (step 9): `public/ATTRIBUTION.md` compiled at build time (`virtual:skeleton-attribution` in `content-plugin.ts`); `#attribution` opens it. |
| `src/ui/toolbarFit.ts` | Toolbar fit (step 10): labels, icons only, or icons plus "More" (always on phones). `Toolbar.tsx` lists the tools and which overflow. |
| `tests/e2e/polish.spec.ts` | Labels, colour-by-region, screenshot, share, attribution, toolbar fit and the phone "More" menu. |
| `tests/e2e/a11y.spec.ts`, `tests/e2e/keyboard.spec.ts` | axe-core (WCAG 2.2 A/AA, no rules disabled) on every UI state; sidebar and legend contrast and 200% reflow; the scripted keyboard-only pass (Tab round the page with focus rings, a whole session by keys). |
| `scripts/perf-load.ts` | `npm run perf-load` (after `npx vite build`): load budgets under Fast 4G and 4× CPU, serving `dist/` gzipped like Pages. `index.html` preloads the low model; `prefetchModel` (`src/scene/loadSkeleton.ts`) fetches the next LOD early. `?bench` also reports label layout times. |
| `tests/e2e/sidebar.spec.ts` | Search, tree, group isolation and the Tab cursor (`tabCursor` in `src/camera/input.ts`, store `keyCursor`). |
| `scripts/build-pages.sh`, `deploy/pages.json` | Pages build: live site plus `/m<N>/` milestone snapshots. Deployed by `.github/workflows/deploy.yml` on push to `main`. |

## Milestone handover (do this at the start of every new milestone)
The site deploys from `main` through `.github/workflows/deploy.yml` only. Don't add a second Pages workflow (for example the Jekyll one that GitHub's Pages settings screen offers): both deploy on push to `main`, and whichever finishes last overwrites the site.

When milestone N is merged and milestone N+1 begins:
1. **Freeze milestone N's snapshot** in `deploy/pages.json`. Add `"m<N>": "<full commit SHA>"` under `frozen` (use the merge commit of the milestone's last PR, from `git log origin/main`, never a placeholder) and set `current` to N+1. Without this, the next deploy rebuilds `/m<N>/` from newer code. `scripts/build-pages.sh` fails if a frozen entry isn't a real commit.
2. **Confirm that milestone N's hosted copy is live** at `https://ajmarr04-ux.github.io/SkeletonViewer/m<N>/`. The container can't reach `github.io`, so ask the user (or check the latest Deploy run with the GitHub tools). Then tick "Hosted copy is live" in that milestone's plan and update its row in `README.md`.
3. Write the new milestone's plan as `docs/PLAN-milestone-<N+1>.md`, following the spec's §11 phase.

Status: **all five milestones are done; the spec's phases are complete.** Milestones 1 to 5 are frozen at `b1392fa`, `eb3e8ff`, `d377478`, `db07f62` and `71f04d0`, and `/m1/` to `/m5/` are live (confirmed by the user). `deploy/pages.json` has `"current": null`: no milestone is in progress, so a deploy builds the live site from `main` plus the frozen snapshots. New work goes through `docs/BACKLOG.md`; if it becomes a new milestone, set `current` to 6 and write `docs/PLAN-milestone-6.md`. Still open, any time: the per-browser `?bench` table in `docs/PLAN-milestone-5.md` step 12, and the content questions in `content/QUESTIONS.md` (spec §13 review). Milestone 5's "Decisions made in this plan" list fills gaps in the spec; open content choices are in `content/QUESTIONS.md`.

## Environment notes
- The cloud container is temporary, so **run `bash scripts/setup-blender.sh` first in every session**. It takes about a minute and is safe to re-run.
- Blender runs as a Python module: `.cache/venv/bin/python -I scripts/blender/<script>.py <args>`. `bpy` 5.x needs Python 3.13. There's no `blender` binary, and download.blender.org is blocked by the network proxy.
- In scripts, `import bpy` must come **before** `import bmesh` / `mathutils`.
- The source file runs to about 300 MB, and opening it takes about 5 seconds. It prints harmless warnings (a dependency cycle in the oesophagus, "scripts disabled").

---

## Session B: Blender pipeline and compression (plan steps 3 and 4)

**Trigger:** the user says "begin session B". Run setup, read `docs/PLAN-milestone-1.md` (steps 3 and 4) and `assets/audit/REPORT.md`, then work through the list below without waiting for confirmation, unless something blocks you.

### Source facts that drive the pipeline
- Metres, **Z up, facing −Y**, patient's right is −X. The glTF exporter's default +Y-up conversion, (x, y, z) → (x, z, −y), gives the spec's Y up, facing +Z.
- The vertebrae, ribs and sternum have an object scale of 10 with geometry stored at 1/10. 119 left-side objects are **linked duplicates with negative scale** (mesh data shared with the right side). So: make each object's mesh data single-user, apply the full world transform to the vertices, then make sure the winding and normals point outward.
- Modifiers to apply (use the evaluated mesh): Boolean ×6 on `Ethmoid bone`, Subdivision on `Lunate bone.*` and `Pisiform bone.*`, Mirror on `Xiphoid process`.
- Holes and non-manifold edges are listed in the report (frontal, sphenoid, occipital, mandible, ethmoid, T8, sacrum, xiphoid, humerus, body of sternum). Loose vertices are listed too.
- The mapped geometry totals about 580k triangles: scapula about 25k each, distal finger phalanges about 130 each.

### Step 3: write `scripts/blender/build_skeleton.py`
Usage: `.cache/venv/bin/python -I scripts/blender/build_skeleton.py <Startup.blend> <out_dir>`. It reads `assets/mapping/source-to-id.json`, and the source `.blend` is never saved.
1. For each ID in `map`: take the evaluated mesh of every source object (modifiers applied), transform it to world space, flip the winding if the determinant is negative, and join the parts (only `sternum` has more than one). The result is a new object named by the stable ID, in a fresh scene or file. Delete everything else.
2. Clean up: merge vertices by distance (about 1e-6 m), delete loose vertices and edges, delete duplicate faces, recalculate normals to point outward, and fill small holes (cap the hole size, and log whatever is filled). Log any object still non-manifold to a JSON report. That's acceptable if it's only a few edges.
3. Origin to centroid: set the origin to the geometry's centre (bounds or median), which moves the origin and not the vertices. Then **assert that each object's world-space bounding box matches the audit's `bboxMin`/`bboxMax` within 1e-4 m**. Fail loudly if it doesn't.
4. Baked AO in vertex colours (`COLOR_0`): first try a Cycles CPU bake into a colour attribute. If that's too slow or isn't supported in the `bpy` module, fall back to a scripted ray-cast AO (for example, 16 to 32 hemisphere rays per vertex using `BVHTree` over the whole skeleton). Write down which method was used.
5. LODs: **high** about 500k triangles, **low** about 150k, using the Decimate (collapse) modifier with a ratio for each object. Weight it so small objects keep detail: no object goes below about 300 triangles, or keeps its source count if that's lower. Teeth, ossicles and phalanges lose little. Large flat bones (scapula, skull bones, ribs) lose the most.
6. Export each LOD with the glTF exporter: `.glb`, +Y up, one node per object, node name = stable ID, vertex colours included, no materials or textures needed (or one shared default material), no cameras or lights.
7. Write `assets/build/manifest.json`: for each ID and each LOD, the triangle count, world bounding box and centroid (in glTF Y-up coordinates), plus the AO method and the cleanup log.

### Step 4: compression and checks
- `npm i -D gltfpack @gltf-transform/core @gltf-transform/extensions meshoptimizer` (gltfpack is available as an npm package).
- `scripts/compress-models.sh`: `gltfpack -i <in> -o public/models/skeleton-{high,low}.glb -cc -kn`. Keep the names with `-kn`, and don't let it merge nodes. If quantisation moves positions beyond tolerance, try `-vp 14` or higher.
- `scripts/check-models.ts` (run with `npx tsx`; add a `check-models` npm script). Using `@gltf-transform/core` with the Meshopt decoder, it fails with a non-zero exit code unless:
  - the node names exactly match the IDs in `content/ids.json` that have `meshAvailable: true` (234, with no extras and none missing),
  - `skeleton-high.glb` is under 15 MB and `skeleton-low.glb` is under 6 MB, with triangle counts within about ±15% of the targets,
  - each node's world bounds match `assets/build/manifest.json` within quantisation tolerance (about 1 mm), which proves nothing moved.
- Add Vitest coverage for the checker's pure logic.
- Commit both `.glb` files directly. Don't use LFS, because Pages doesn't serve LFS objects.

### Done when
- Steps 3 and 4 are ticked in the plan's progress table, and "238 objects… shared coordinate space" (as 234 meshes plus 4 known missing) and "Both LODs exported… under budget" are ticked in the exit criteria.
- `npx tsc --noEmit`, `npx vitest run` and `npm run check-models` all pass.
- `assets/audit/REPORT.md` or a new `assets/build/REPORT.md` records the triangle counts, file sizes, AO method and any geometry that's still non-manifold.
- Everything is committed and pushed. Tell the user that the next prompt is **"begin session C"**.

---

## Session C: bare viewer and Pages deploy (plan steps 5 and 6)
Follow `docs/PLAN-milestone-1.md` steps 5 and 6.
- Credits for `public/ATTRIBUTION.md`: Z-Anatomy (CC BY-SA 4.0, Gauthier Kervyn and Marcin Zielinski) and BodyParts3D (© The Database Center for Life Science, CC BY-SA 2.1 Japan).
- The user may still need to set **Settings → Pages → Source → GitHub Actions**. Remind them if the deploy fails for that reason.
- Finish by putting the hosted Milestone 1 link in `README.md` and the plan, and give it to the user.
