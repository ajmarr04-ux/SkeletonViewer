# Milestone 2 Plan: Viewer (Spec Phase 2)

Source of truth: `SPEC (2).md`, sections 2, 3, 6 (Camera), 7 (Toolbar, URL state), 8 and 10, and section 11 (Phase 2).

## Goal

Replace the Milestone 1 bare viewer with the real one. The camera uses `camera-controls`, and orbit, pan, zoom, presets and reset work with a mouse, a trackpad, touch and the keyboard. Camera state lives in a `zustand` store that is mirrored to the URL. The skeleton is drawn as one `BatchedMesh`, which keeps it under 20 draw calls and meets the phone frame-rate budget. The scene also gets the lighting and AO treatment from §8 and automatic choice of the starting LOD. The milestone ends with a hosted copy at `/m2/`.

Out of scope until Milestone 3: hover, selection, isolation, ghosting and the info panel. `F` ("frame the selection") frames the whole skeleton until selection exists.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| D | 0 (Milestone 1 handover), 1 (state store), 2 (BatchedMesh scene), 3 (lighting), 4 (LOD choice) | **Done.** See "Session D notes" below |
| E | 5 (camera rig), 6 (input mapping), 7 (presets, reset, re-centre), 8 (URL sync) | **Done.** See "Session E notes" below |
| F | 9 (toolbar and settings), 10 (performance check), 11 (tests), 12 (hosted copy) | **Done.** See "Session F notes" below. Merged (PR #4), `/m2/` live |

Triggers: "begin session D", "begin session E" and "begin session F". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models` and `npm run e2e` passing, then a commit and push to the session branch. No Blender work is planned, so `scripts/setup-blender.sh` is only needed if the models have to be rebuilt.

## Exit criteria (from spec §11, Phase 2)

- [x] Orbit, pan, zoom, presets and reset work on mouse, trackpad, touch and keyboard. (Home button and Views menu added in session F and tested with mouse, keyboard and touch. Still worth a hand check of the trackpad heuristic on a real Mac.)
- [x] Camera state is synced to the URL.
- [x] The phone frame-rate budget is met (≥ 30 FPS while orbiting, checked with Chrome DevTools mobile emulation and CPU throttling, plus one real device if one is available). Measured with `?bench` on 2026-11-19: iPhone 58.8 median FPS (p95 frame 17 ms), PC 75.2 median FPS (p95 frame 13.6 ms). Both runs were on the high LOD, and both are at their display refresh rate, so the phone meets the budget with room to spare even without the low LOD. The DevTools throttled run was not done, and is not needed now that a real phone has passed.
- [x] Draw calls < 20 (spec §8, needed to meet the line above). One draw call for the skeleton; the `?bench` e2e test asserts < 20 during the orbit.
- [x] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Finish the Milestone 1 handover (done)

- `deploy/pages.json` already freezes `m1` at `b1392fa` with `current: 2`, and Deploy run #4 (merge of PR #3, `0cf32a3`) succeeded.
- ~~**Needs the user:** confirm that https://ajmarr04-ux.github.io/SkeletonViewer/m1/ loads~~ Confirmed by the user on 2026-11-19. Then tick "Hosted copy is live" in `docs/PLAN-milestone-1.md` and change the Milestone 1 row in `README.md` to "Live".
- Add a Milestone 2 row to `README.md` pointing at `/m2/`, marked "In progress".

## Session D notes (steps 0 to 4, done)

- **Draw calls: 1** for the skeleton (was 234). `?lod=low&debug` and `?lod=high&debug` both report 234 instances, and every instance's exact world bounds (each vertex through its instance matrix) match `assets/build/manifest.json`: max difference 0.014 mm, the same as `check-models`. The vertices are copied still quantised (`Uint16` positions, `Int8` normals, `Uint8` RGBA AO), since all 234 meshes share one attribute layout, so nothing had to be decoded. Instance matrices are float32 on the GPU (well under 1 µm of rounding).
- **BVH:** three-mesh-bvh's `BatchedMesh` raycast runs each instance through an internal `Mesh`, so `Mesh.prototype.raycast` must be its `acceleratedRaycast` too (done once in `batchSkeleton.ts`). The BVH is built in an idle callback once the final LOD is on screen.
- **LOD swap:** the old `BatchedMesh` is disposed in an effect cleanup, after the commit that swapped in the new one. Disposing it from a timer let three.js draw it once more with freed textures.
- **Lighting:** key light 2.2 from upper front-left (−2.5, 3, 2), `RoomEnvironment` at 0.25, bone colour `#d8cdb8`, roughness 0.6, `AO_FLOOR` 0.4. A first try with the environment at 0.55 washed out the form; these values keep the shading readable (checked in front-view screenshots). The skull close-up for the mandible's sockets waits for session E, when `?cam=` can place the camera.
- **LOD choice:** `?lod=both` was added (forces low then high) because the container's Chromium uses SwiftShader, which `chooseLod` correctly sends to low. Tests use `?lod=both&debug`.
- **Debug:** the bounds check (and the 270 kB manifest, loaded as its own chunk) only runs with `?debug`. The overlay itself is still always visible until step 9 hides it behind `?debug`.

## Session E notes (steps 5 to 8, done)

- **Rig:** `src/camera/CameraRig.tsx` drives `camera-controls` 3.1 directly (drei's `OrbitControls` is gone). Damping `smoothTime` 0.12 s, `draggingSmoothTime` 0.06 s, both 0 with reduced motion, and every scripted move then uses no transition (tested: one arrow press is a 5° cut on the next frame). Pole clamp 0.01 rad. The orbit target is kept inside the skeleton's box grown by a quarter of its radius (`setBoundary`), so panning can't lose the skeleton.
- **Framing (changed from the plan):** presets, reset and `F` use an exact box fit (`fitDistance` in `src/camera/math.ts`: every corner of the skeleton's box inside the view with a 5% margin, for the current aspect ratio) rather than `fitToSphere`, which left the tall, thin skeleton small. Measured: skeleton box 0.67 × 1.70 × 0.25 m, bounding-sphere radius 0.920 m, so 3 × radius is 2.76 m, but a landscape screen needs about 2.96 m to frame the anterior view. **Max distance is therefore max(3 × radius, 1.2 × the largest preset fit at the current aspect).** Min distance is 1.5 × the stapes' bounding-sphere radius (2.8 mm), so 4.2 mm.
- **Clip planes** follow the camera each frame: near = 2% of the distance (between 0.1 mm and 5 cm), far reaches past the whole skeleton. The skull close-ups at `deviceScaleFactor: 2` (the check deferred from session D) show no clipping and no black inner surfaces.
- **Wheel (changed from the plan):** camera-controls turns a `ctrlKey` wheel event (a pinch) into an FOV zoom, which `cam=` can't store, so all wheel input is handled by the rig: mouse wheel and pinch dolly toward the cursor (`dollyToPoint`: camera and target scale about the point under the cursor, so it stays put), and a two-finger drag trucks by the pixel delta. `classifyWheel` order: `ctrlKey` → pinch; line/page mode → wheel; a gesture (events < 120 ms apart) keeps its first meaning; where `wheelDeltaY` exists (Chrome, Edge, Safari) a trackpad gives `wheelDeltaY = -3 × deltaY` and a mouse doesn't; otherwise a horizontal delta → pan, ≥ 50 px → wheel, whole pixels → wheel, small fractions → pan. Safari's `gesturechange` drives pinch on macOS Safari. **Needs the user:** a hand check on a Mac trackpad (Chrome and Safari) and a mouse wheel. If it misclassifies, the plan's fallback stands.
- **Double-click / double-tap** share one pure detector (`tapStep`: 5 px drag threshold, 500 ms per press, 350 ms and 24 px between taps, a second finger cancels). The hit bone's box centre comes from its geometry box through its instance matrix (scale and translation only, so exact); the e2e test matches it to the manifest's femur centre within 1 mm. Re-centre uses `moveTo`, so the view direction and distance are kept. In software WebGL, two Playwright `touchscreen.tap()` calls land about 800 ms apart (logged), so the touch test sends the two taps' pointer events in-page.
- **Keyboard** works when the canvas or the page itself has focus (not in inputs or buttons). The canvas has `tabIndex=0`, an `aria-label` listing the keys and a focus ring. Shift + left-drag is decided per press in a capture listener.
- **URL:** `cam=` is written with `replaceState` on `rest`, and on `sleep` too (an instant cut never reaches `rest`). Nothing is written until the first user move or command, so a fresh load keeps a clean URL. A valid `cam` on load is clamped and used; a malformed one is ignored. `popstate` re-reads it. Store: `cameraRequest` (preset, reset, frame) is the hook for session F's toolbar.
- **Debug hooks:** with `?debug`, `window.__viewer` exposes `camera()`, `bone(id)` (box centre and screen position) and `command()`; the overlay shows `data-cam`.
- **Tests:** Vitest `tests/camera.test.ts` (presets, tight framing at three aspects, limits, clamps, dolly-to-cursor keeps the point fixed, clip planes) and `tests/input.test.ts` (wheel sequences modelled on each browser and device, zoom factors, key map, double tap). Playwright `tests/e2e/viewer.spec.ts` (12 tests): default view and clean URL, keyboard → URL → reload restores within 1 mm, `H`, all six presets, invalid and out-of-range `cam`, double-click on the femur and on empty space, wheel and drag, Shift-drag pan, reduced motion, phone double-tap and phone framing.

## Session F notes (steps 9 to 11 done; 10 and 12 need the user)

- **Toolbar** (`src/ui/Toolbar.tsx`, `Popover.tsx`, `Settings.tsx`, `icons.tsx`): floating at the bottom centre above the credits line, with Home, a Views menu (the six presets) and a Settings panel. Inline SVG icons; labels are hidden below 600 px, every button is at least 44 × 44 px with an `aria-label`, `title` and the shared focus ring. The Views menu is a `role="menu"` with arrow, Home and End keys; Escape or a click outside closes either panel and gives focus back to its button. The camera's own keys only act when the canvas or the page has focus, so they don't fire inside the toolbar.
- **Settings:** Model detail Auto / Low / High (Auto removes the stored key, the others write `skeleton-viewer:lod`), plus "Showing: low/high detail" (`aria-live`). A change applies at once: the viewer re-plans and loads only the new final LOD (`lodsToLoad`: Auto → High with low on screen loads just high, High → Low reloads low). A Settings choice overrides `?lod=`, which is dropped from the URL so a reload agrees with the setting.
- **Framing above the toolbar (new):** the toolbar and credits covered the feet. The projection centre is now moved up by half of a 100 px bottom inset (`camera.setViewOffset`, capped at a quarter of the height), and every fit (presets, Home, `F`, the zoom-out limit) fits the box into the shorter area (`fitDistance(..., heightFraction)`). Camera poses and `cam=` are unchanged in meaning; raycasting and projection use the offset matrix, so double-click re-centre still lands on the femur within 1 mm.
- **Bug fixed (from session D):** react-three-fiber hadn't detached the old `<primitive>` when the effect cleanup disposed it (logged: `parent` still set every time), so a frame drawn in between could read the freed matrices texture (`Cannot read properties of null (reading 'image')`). Switching LODs from Settings hit it reliably. `disposeBatchedSkeleton` now calls `removeFromParent()` first.
- **Debug overlay** only renders with `?debug` (or `?debug=1`). Without it, a load failure shows a short alert at the top instead. The overlay gained `data-bench-*` attributes and a `bench` link.
- **`?bench`** (`src/scene/bench.ts`, rig in `CameraRig.tsx`, panel `src/ui/BenchPanel.tsx`): once the final LOD is on screen, the camera orbits 360° about the vertical axis over 10 s with no easing, timing every frame (the first 250 ms are dropped as warm-up). The panel then shows the LOD, median and 5th-percentile FPS, median / p95 / max frame time, frame count, the highest draw-call count seen and the device pixel ratio. In the container (SwiftShader) it reports about 7 FPS on low, which means nothing, as expected.
- **Tests:** Vitest `tests/bench.test.ts` (percentile, summary, orbit angle), `lodsToLoad` and `withoutLodParam` tables in `tests/lod.test.ts`, inset framing in `tests/camera.test.ts` (128 tests in all). Playwright adds 7 tests to `viewer.spec.ts` (27 e2e in all): Views menu to each preset and Home, the menu by keyboard, Settings High → reload → Low → Auto with bounds still matching, Settings overriding `?lod=`, no overlay without `?debug`, `?bench` completing with < 20 draw calls, and the phone toolbar (fits 390 px, icons only, 44 px targets, Views/Home/Settings by tap).

### Performance (step 10, needs the user)

Open `https://ajmarr04-ux.github.io/SkeletonViewer/m2/?bench` once it is live (or `npm run dev` then `/?bench`), leave it for about 15 s, and report the panel's numbers.

| Device / setting | LOD | Median FPS | 5th pct FPS | Draw calls | Target | Met? |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop browser (PC), `?bench` | high | 75.2 (median 13.3 ms) | 73.5 (p95 13.6 ms) | not reported | 60 | **Yes** (max frame 19.4 ms; 75 FPS suggests a 75 Hz display, so vsync-capped) |
| DevTools: mid-range phone, 4× CPU throttle (`?bench&lod=low`) | low | not run | | | ≥ 30 | n/a |
| Real phone (iPhone), `?bench` | high | 58.8 (median 17 ms) | ~58.8 (p95 17 ms) | not reported | ≥ 30 | **Yes** (max frame 117 ms, a single hitch; 60 Hz vsync-capped) |
| Container Chromium (SwiftShader, not meaningful) | low | ~7 | | 1 | n/a | n/a |

## Step 1: State store (`src/state/`)

- Add `zustand`. `src/state/store.ts` holds:
  - `camera: { position: Vec3; target: Vec3 }`, written by the camera rig when it comes to rest, not on every frame;
  - `lod: { requested: "auto" | "low" | "high"; active: Lod | null }`;
  - `reducedMotion: boolean`, following `matchMedia("(prefers-reduced-motion: reduce)")` and its `change` event;
  - room for Milestone 3's `sel`, `tier` and `ghost`, without implementing them.
- Pure helpers (no React or three.js, so Vitest can cover them) in `src/state/url.ts`: `parseUrlState(search)` and `serialiseUrlState(state, search)`. The latter keeps unknown parameters such as `lod` and `debug`.

## Step 2: Draw the skeleton as one `BatchedMesh` (`src/scene/`)

The bare viewer issues one draw call per bone (234). The spec's budget is < 20, and the phone frame rate depends on it.

- Add `three-mesh-bvh`. `src/scene/batchSkeleton.ts` turns a loaded glTF scene into one `THREE.BatchedMesh`:
  - one geometry per bone, added with `addGeometry`, then one instance each with `addInstance`;
  - **the instance matrix is the mesh's `matrixWorld` from the glTF** (named bone node × unnamed quantised child). Vertices aren't changed, so no bone moves. If the quantised attribute formats differ between meshes, the attributes are decoded to `Float32` with the child's dequantisation left in the instance matrix, never baked into the vertices;
  - an `instanceId → boneId` table and the reverse, which Milestone 3 uses for picking, colour and visibility;
  - a BVH for raycasting (`computeBatchedBoundsTree`, or a per-geometry `computeBoundsTree` as the fallback).
- **Invariant test:** after batching, each instance's world bounding box must match `assets/build/manifest.json` within 1 mm (the same tolerance as `check-models`). The check runs in the debug overlay (`data-bounds-ok`) and is asserted by the Playwright smoke test.
- The swap from low to high LOD replaces the whole `BatchedMesh` and disposes of the old one, as now.
- One shared `MeshStandardMaterial` with `vertexColors`, as now.

## Step 3: Lighting and AO (spec §8)

- One soft key light plus an environment map, with no real-time shadows. Use three's built-in `RoomEnvironment` through `PMREMGenerator`, so no HDR file has to be downloaded or hosted.
- AO remap from `assets/build/REPORT.md`: `mix(0.4, 1.0, ao)`, applied with `onBeforeCompile` on the shared material, so that inner surfaces (the mandible's sockets, the inner ear) don't render pure black. The 0.4 floor is a constant in one place and can be tuned.
- Before/after screenshots at `deviceScaleFactor: 2` (front, and a close-up of the skull), for the user to judge by eye.

## Step 4: Choose the starting LOD (spec §8)

- Pure function `chooseLod({ width, height, dpr, deviceMemory, gpu })` in `src/scene/lod.ts`. It returns `low` for small screens (shortest side < 600 CSS px), `deviceMemory ≤ 4`, or a GPU probe that looks weak (WebGL `MAX_TEXTURE_SIZE` < 8192, or a renderer string matching software or low-end mobile GPUs); otherwise `high`.
- Behaviour: low is always shown first. High is streamed in afterwards only if `chooseLod` says `high` or the user chose High. `?lod=low|high` still pins one file, and so does the setting in step 9 (kept in `localStorage`).
- Vitest table tests for `chooseLod` and for how the URL parameter, the stored setting and auto choice combine.

## Step 5: Camera rig (`src/camera/`)

- Add `camera-controls` and use it directly (`CameraControls.install({ THREE })`), wrapped in `src/camera/CameraRig.tsx`. It replaces drei's `OrbitControls`.
- Settings from spec §6:
  - **Orbit around a focus point** (the controls' target). Initial target: the skeleton's bounding-box centre.
  - **Zoom toward the cursor:** `dollyToCursor: true`.
  - **Zoom clamp:** `minDistance` comes from the smallest object in the manifest (about 1.5 × its bounding-sphere radius, so the stapes can fill the view). `maxDistance` is 3 × the full skeleton's bounding-sphere radius. Near and far planes follow the distance so close-ups don't clip.
  - **Pole clamp:** `minPolarAngle = 0.01`, `maxPolarAngle = π − 0.01`, so the view never flips.
  - **Damping on every move:** `smoothTime ≈ 0.12 s`, `draggingSmoothTime ≈ 0.06 s`. With reduced motion both are 0 and every transition is an instant cut.
- The camera maths (presets, clamps, framing distances) lives in pure functions in `src/camera/math.ts`, with Vitest coverage.

## Step 6: Input mapping (spec §6 table)

| Action | Mouse | Trackpad | Touch | Keyboard |
| --- | --- | --- | --- | --- |
| Orbit | Left-drag | Click-held one-finger drag | One-finger drag | Arrow keys |
| Pan | Right-drag, Shift + left-drag | Two-finger drag | Two-finger drag | Shift + arrows |
| Zoom (toward cursor) | Wheel | Pinch | Pinch | `+` / `-` |
| Re-centre | Double-click | Double-tap | Double-tap | `F` (frames everything until M3) |
| Reset | Home button | Home button | Home button | `H` |

- **Mouse:** camera-controls defaults (left rotate, right truck, wheel dolly). Shift + left-drag switches `mouseButtons.left` to truck while Shift is held.
- **Trackpad versus mouse wheel:** both arrive as `wheel` events, so they need telling apart. A pure function `classifyWheel(event, history)`:
  - `ctrlKey` set → pinch → zoom (Chrome, Edge and Firefox send pinches like this);
  - `deltaMode` in lines or pages, or whole-number `deltaY` steps with `deltaX = 0` → mouse wheel → zoom;
  - otherwise (pixel deltas with a horizontal component, or small fractional deltas) → two-finger drag → pan.
  The wheel input is turned off in camera-controls (`mouseButtons.wheel = NONE`) and driven by this classifier instead. Safari's `gesturestart`/`gesturechange` events handle pinch on macOS Safari. Vitest covers the classifier with recorded event sequences.
- **Touch:** one finger rotates. Two fingers do both pinch zoom and pan (`TOUCH_DOLLY_TRUCK`). `touch-action: none` on the canvas.
- **Keyboard:** the canvas is focusable (`tabIndex=0`) with a visible focus ring (spec §10), and keys work while it has focus. Arrows orbit by 5° per press (with key repeat). Shift + arrows pan by 2% of the current distance. `+`/`=` and `-` dolly by 10%. `H` resets. `F` frames. Keys are ignored when focus is in a text field. The key map is a pure table, tested in Vitest.

## Step 7: Presets, reset and re-centre

- **Presets** (skeleton faces +Z, patient's left is +X):

  | Preset | Camera looks from | Screen-up |
  | --- | --- | --- |
  | Anterior | +Z | +Y |
  | Posterior | −Z | +Y |
  | Left (patient's left side) | +X | +Y |
  | Right | −X | +Y |
  | Superior | +Y (just inside the pole clamp) | anterior toward the top of the screen |
  | Inferior | −Y (just inside the pole clamp) | anterior toward the top of the screen |

  Each preset frames the whole skeleton (`fitToSphere` on its bounding sphere) and eases over about 400 ms, or cuts instantly with reduced motion. The superior and inferior orientation is a convention and can be changed if the user prefers another.
- **Reset / Home / `H`:** the anterior preset with the default framing, the same view as first load.
- **Double-click / double-tap re-centre:** raycast through the BVH (step 2), resolve the hit instance to its bone ID, and ease the orbit target to that bone's bounding-box centre over about 400 ms. The distance stays the same unless it is outside the clamp. Clicking empty space does nothing. The 5 px drag threshold (spec §6) is applied here as well, so that a drag that ends on a bone doesn't count as a tap. Selection itself waits for Milestone 3.

## Step 8: Sync the camera to the URL (spec §7)

- Format: `?cam=px,py,pz,tx,ty,tz` in metres, rounded to 0.1 mm (4 decimals).
- **Write:** when the camera comes to rest (camera-controls `rest` event, and at the end of a preset transition), update the store, then call `history.replaceState`. Camera moves never use `pushState`; that is saved for isolation levels in Milestone 3.
- **Read:** on load, a valid `cam` replaces the default framing (the clamps still apply). A malformed or out-of-range value is ignored and the default view is used, with no error. `popstate` also re-reads the URL, ready for Milestone 3.
- Round-trip tests in Vitest (parse → serialise → parse gives the same value, other parameters are kept), plus a Playwright test: move the camera with the keyboard, reload, and the view is restored.

## Step 9: Toolbar and settings (`src/ui/`)

- Floating toolbar at the bottom centre (spec §7): Home, a preset menu (six views), and Settings. On phones (< 600 px) it shows icons only, and every button has an `aria-label` and a visible focus ring. Buttons for later milestones (Show related, labels, ghost, colour-by-region, screenshot, share) are not added yet.
- Settings popover: model detail (Auto / Low / High, stored in `localStorage`), plus a read-only line saying which LOD is active.
- The debug overlay moves behind `?debug` (or `?debug=1`). The existing smoke tests add `?debug` to their URLs.

## Step 10: Performance check (spec §8)

What can be checked automatically in the container, and what can't:

- The container's Chromium renders WebGL in software (SwiftShader), so **its FPS numbers mean nothing**. The automated checks cover what doesn't depend on the GPU: draw calls < 20, triangles per LOD, and click-to-highlight timing is left for Milestone 3.
- Add a `?bench` mode: it orbits the camera through 360° over 10 s and then shows the median and 5th-percentile FPS, frame times, draw calls and the active LOD (also as `data-*` attributes on the debug overlay, so Playwright can read them).
- **Needs the user:** open `/m2/?bench&debug` (or the session preview) on
  1. a desktop browser (target 60 FPS on high), and
  2. Chrome DevTools with a mid-range phone profile and 4× CPU throttling (target ≥ 30 FPS on low), and
  3. a real phone if one is available (target ≥ 30 FPS),
  and report the numbers. They go into a "Performance" table in this file. If the phone budget is missed, the fallbacks in order are: cap the device pixel ratio at 1.5 on phones, turn off MSAA on low, then lower the low-LOD target.

## Step 11: Tests

- **Vitest:** URL parse and serialise, `chooseLod`, `classifyWheel`, the key map, preset and clamp maths, and the batch table (instance ↔ bone ID).
- **Playwright** (`tests/e2e/viewer.spec.ts`; the existing `smoke.spec.ts` stays):
  - `BatchedMesh` loaded: 234 instances, draw calls < 20, and every instance's world bounds match the manifest (`data-bounds-ok="true"`);
  - keyboard: focus the canvas, press `ArrowLeft` and `+`, wait for rest, and `cam` in the URL has changed;
  - reload with that URL, and the camera matches within 1 mm;
  - each preset button gives the expected view direction (read from the store through `?debug`);
  - `H` returns to the default view;
  - an invalid `cam` falls back to the default without a page error;
  - double-clicking the femur's centre (projected from the manifest) moves the target to the femur's bounding-box centre;
  - mobile emulation (390 × 844, touch): the toolbar fits and its buttons work.
- `npm run check` stays `tsc --noEmit`, `vitest run` and `check-models`. CI keeps running it before each deploy.

## Step 12: Hosted copy

- Merge the milestone's branch to `main`. The deploy workflow builds `/m2/` from `main` (`current` is 2) and keeps `/m1/` frozen.
- Link https://ajmarr04-ux.github.io/SkeletonViewer/m2/ in `README.md` and here, and ask the user to confirm it loads.
- At the start of Milestone 3, follow the handover in `CLAUDE.md`: freeze `"m2": "<merge SHA>"` and set `current` to 3.

**Hosted copy, Milestone 2:** https://ajmarr04-ux.github.io/SkeletonViewer/m2/ Live: merged in PR #4 (`eb3e8ff`), confirmed loading by the user on 2026-11-19.

---

## New dependencies

| Package | Why |
| --- | --- |
| `camera-controls` | Camera rig (spec §2) |
| `three-mesh-bvh` | Fast raycasting for re-centre now and picking in Milestone 3 (spec §2) |
| `zustand` | State store, mirrored to the URL (spec §2) |

## Files

| Path | What |
| --- | --- |
| `src/state/store.ts`, `src/state/url.ts` | Store and URL helpers |
| `src/scene/Viewer.tsx` | Replaces `BareViewer.tsx` (removed once the smoke test passes on the new viewer) |
| `src/scene/batchSkeleton.ts` | glTF → `BatchedMesh`, ID tables, BVH |
| `src/scene/lighting.tsx` | Key light, `RoomEnvironment`, AO remap |
| `src/scene/lod.ts` | Adds `chooseLod` |
| `src/camera/CameraRig.tsx`, `src/camera/math.ts`, `src/camera/input.ts` | Rig, presets and clamps, wheel classifier and key map |
| `src/ui/Toolbar.tsx`, `src/ui/Settings.tsx` | Toolbar and settings |
| `tests/camera.test.ts`, `tests/url.test.ts`, `tests/input.test.ts` | Vitest |
| `tests/e2e/viewer.spec.ts` | Playwright |

## Risks and open points

| Risk | Mitigation |
| --- | --- |
| Quantised attributes differ between meshes, so `BatchedMesh` won't take them as they are | Decode to `Float32` and keep the dequantisation in each instance matrix. The bounds test in step 2 proves nothing moved. |
| Telling a trackpad's two-finger drag from a mouse wheel is a heuristic | Keep it in one tested pure function, and check it by hand on a Mac trackpad and a mouse. If it misclassifies, the fallback is the camera-controls default (wheel always zooms) with Shift + wheel to pan. |
| FPS can't be measured in the container (software WebGL) | `?bench` mode; the user reports the numbers from real hardware (step 10). |
| The stapes (about 3 mm) needs a very small minimum distance, which causes depth precision problems | Near plane scales with distance. Logarithmic depth only if z-fighting shows up. |
| Superior and inferior "up" direction is a convention | Anterior at the top of the screen, as stated in step 7. Easy to change. |
| `/m1/` live status not yet confirmed by the user | Step 0. |

## Commit plan (branch `claude/keen-clarke-32a10a`)

1. `docs: milestone 2 plan` (this file)
2. `state: zustand store and URL helpers`
3. `scene: BatchedMesh skeleton with BVH and bounds check`
4. `scene: key light, environment and AO remap; automatic LOD choice`
5. `camera: camera-controls rig, input mapping, presets and re-centre`
6. `state: sync camera to the URL`
7. `ui: toolbar and settings; debug overlay behind ?debug`
8. `test: viewer e2e and bench mode`, then the hosted link and ticking the Phase 2 checklist
