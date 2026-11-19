# Milestone 3 Plan: Select and Isolate (Spec Phase 3)

Source of truth: `SPEC (2).md`, sections 6 (Camera, Selection, Isolation, Teeth), 7 (Info panel, Breadcrumb, URL state), 8 (click → highlight budget), 10 (accessibility) and 11 (Phase 3). Plus `docs/BACKLOG.md` entry 1 (fixed orbit pivot), which the user approved for this milestone.

## Goal

Make the skeleton selectable. Hover outlines and names a bone on desktop, a click or tap selects it, a drag never does, and tiny objects (ossicles, distal phalanges, sesamoids, teeth) have enlarged hit areas so a phone can pick them. Selecting a bone isolates it (tier 0): the rest of the skeleton is ghosted or hidden, the bone gets the accent colour and an outline, and an info panel (placeholder content) opens. Selection lives in the store and the URL (`sel`, `tier`, `ghost`), and the browser's Back button steps back out of isolation. The camera's orbit pivot becomes fixed (CAD style), as requested after `/m2/`. The milestone ends with a hosted copy at `/m3/`.

Out of scope until Milestone 4: tiers 1 and 2 (Show related, Expand region), joint highlighting, Explode, real content files and `validate-content`. Out of scope until Milestone 5: search, labels, colour-by-region, screenshots, share link, Tab through visible objects, the axe-core pass.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| G | 0 (Milestone 2 handover), 1 (fixed orbit pivot), 2 (selection state and URL), 3 (picking, drag vs click, hit proxies) | **Done.** See "Session G notes" below. Needs the user: a hand check of the new orbit |
| H | 4 (highlight and outline), 5 (tier-0 isolation: ghost and hide), 6 (hover tooltip) | **Done.** See "Session H notes" below. Needs the user: the outline choice, and a look on a real device |
| I | 7 (info panel and breadcrumb), 8 (keyboard, Back and a11y announcements), 9 (performance check), 10 (tests, including all 234 on a 390 px viewport), 11 (hosted copy) | Not started |

Triggers: "begin session G", "begin session H" and "begin session I". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models` and `npm run e2e` passing, then a commit and push to the session branch. No Blender work is planned, so `scripts/setup-blender.sh` is only needed if the models have to be rebuilt.

## Exit criteria (from spec §11, Phase 3)

- [ ] Hover, select, drag-versus-click detection and enlarged hit proxies all work.
- [x] Tier-0 isolation works, with ghost and hide modes. (Session H.)
- [ ] The info panel works with placeholder content.
- [ ] Every object, including the ossicles and teeth, can be selected on a 390 px wide viewport.
- [x] Orbit pivot stays put while panning and zooming (backlog 1), and selecting, double-clicking or `F` move it to the bone; Home resets it. (Session G; still needs the user's hand check.)
- [ ] Click → highlight under 50 ms on desktop and 100 ms on a phone (spec §8), and draw calls stay under 20 with a bone isolated.
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Milestone 2 handover (done in the planning session)

- `deploy/pages.json`: `m2` frozen at `eb3e8ff58b3b5b4a4b71d419c82707fa456782e9` (merge of PR #4), `current` is 3.
- `/m2/` confirmed live by the user (smooth on PC and iPhone); "Hosted copy is live" is ticked in `docs/PLAN-milestone-2.md`. `README.md`: Milestone 2 row marked frozen, Milestone 3 row added as "In progress".
- `docs/BACKLOG.md` entry 1 is marked as taken into this plan (step 1).

## Session G notes (steps 1 to 3, done)

- **Fixed pivot, how it works:** camera-controls' target is the pivot, and camera-controls itself now only **rotates** (left-drag, one finger, arrow keys). Its own pan and zoom are switched off: its pan speed grows with the focal offset (it measures from the shifted eye), and its pinch and dolly-to-cursor move the target. The rig handles pan and zoom itself through pure functions in `src/camera/math.ts`, and applies the result as `setLookAt` + `setFocalOffset` (with the y sign flipped, as camera-controls expects). A pose is `{ position, target, offset }`: `position` is the orbit position, and the eye is `position + offset.x × right + offset.y × up`.
  - **Pan** (right-drag, middle-drag, Shift + left-drag, two-finger drag, trackpad two-finger scroll, Shift + arrows): `panPose` changes only the offset. The picture follows the pointer at the depth of the bone grabbed (raycast at the start of the drag; the pivot's depth over empty space), so the bone under the pointer stays under it. Damping during a drag uses `draggingSmoothTime`.
  - **Zoom toward the cursor** (wheel, pinch, Safari gesture, `+`/`-` at the canvas centre): `dollyPose` moves the eye along the line to the **bone surface under the cursor** (once the BVH is built; before that, the pivot's plane, as in Milestone 2). That point stays put on screen, and the minimum distance now applies to the bone being zoomed toward, not the pivot, so the camera can't pass into it. If the zoom would put the pivot nearer the camera than half the depth of that point (zooming down onto the feet from above, past the pelvis), the pivot slides along the view axis to the point's depth so orbiting stays in front of the camera.
  - **Two fingers:** the rig tracks touch pointers itself; camera-controls' two- and three-finger actions are off. Each move pinches toward the old midpoint, then follows the midpoint.
  - **Limits:** distance clamp on the pivot's depth as before (maximum) and on the zoom point (minimum, `clampDollyFactor`). New `clampOffset`: the point at the centre of the view on the pivot's plane (pivot + offset) must stay inside the skeleton's box grown by a quarter of its radius, so panning can't lose the skeleton. The old target boundary still holds the pivot.
  - **Near plane:** 2% of the nearer of the pivot's depth and the depth of the last zoom point (`clipPlanes(..., focusDepth)`), so a close-up of the feet with the pivot at the pelvis doesn't clip. Reset by any command.
  - **Pivot moves:** select (click, tap, URL, Back/Forward) → `repivot` (eye and direction unchanged, so nothing on screen moves; applied without a transition); double-click / double-tap → `centreOn` (the bone to the middle, eased, **at the depth it had**, so it keeps its size on screen; Milestone 2 kept the old pivot distance instead); `F` → frame the selection's box, or the skeleton with nothing selected; Home and presets → the skeleton's centre, no offset.
  - **URL:** `cam=px,py,pz,tx,ty,tz[,ox,oy]`; six values (Milestone 2 links) still work, and the offset is only written when it isn't zero at 0.1 mm.
  - Spec §6 has a dated note recording the change.
- **Selection state** (`src/state/isolation.ts`, `selection.ts`, `store.ts`, `url.ts`): the pure reducer handles select, related, region and back (tiers 1 and 2 are ready for Milestone 4) and says whether the history step is `push`, `pop`, `replace` or `none`. `selection.ts` applies it: push for a new level (marked `{ skvDepth }` in `history.state`), replace for a switch of focus at tier 0, and for back either `history.back()` (when the app pushed the entry) or a replace (when the page was opened with that selection, so Back never leaves the site). **Back / Forward change only the isolation; the camera stays where it is** and the entry's `cam` is updated to match, because jumping the view back on Back felt wrong. URL: `?sel=…&tier=…&ghost=0&cam=…` (tier 0 and ghost mode are left out as defaults; unknown IDs are dropped). The wisdom teeth are valid `sel` values: no error, nothing framed. Opening a link with `sel` and no `cam` frames the selection. Store also holds `ghostMode`, `ghostOpacity` (0.05 to 0.5, default 0.15; storage arrives with the slider in session H) and `hovered`.
- **Picking** (`src/scene/pick.ts`, rig): `tapStep` now reports every still press as a `tap` (moved ≤ 5 px, released within 500 ms), plus `doubleTap` for the second of a pair. Primary button only (right and middle pan). A tap selects the picked object, or steps back on empty space; a double tap then centres on the bone. `Esc` steps back. BVH: built eagerly on the first click if the idle callback hasn't run yet; hover and the zoom-to-surface wait for it.
- **Hit proxies:** objects with a bounding-sphere radius under **2 cm** are "tiny": **100 objects** (all 28 teeth, the 6 ossicles, all distal and middle phalanges of hand and foot, the proximal phalanges of the foot, the carpals, the pisiforms, the intermediate cuneiforms, and the nasal and lacrimal bones). The plan's 6 mm start only caught the ossicles: teeth measure 13 to 17 mm with their roots and distal phalanges up to 18 mm. Proxies are screen-space discs: radius 22 px for touch, 6 px for a mouse; a proxy only counts while the object is smaller than that on screen, and only if it isn't behind the real hit. Tested in Vitest (`tests/pick.test.ts`) and in the browser (a tap 8 px off a tooth at the whole-skeleton view on a 390 px phone picks a tooth, and so does a tap on the sub-pixel stapes).
- **Hover:** mouse only, one pick per frame at most, never while a button is down or the camera is being dragged; `hovered` in the store (shown from session H).
- **Debug hooks** (`?debug`): `window.__viewer` adds `eye()`, `project(p)`, `pick(x, y, touch)`, `select(id)`, `state()`, and the `goto`, `repivot` and `centre` commands.
- **Tests:** Vitest 173 (new: `tests/pivot.test.ts`, `tests/isolation.test.ts`, `tests/pick.test.ts`, selection in `tests/url.test.ts`, single taps in `tests/input.test.ts`). Playwright 41 (new `tests/e2e/select.spec.ts`, 14 tests: pan then orbit keeps the pivot's screen place, zoom toward the feet then orbit keeps the pivot, offset round trip through a reload, Milestone 2 links, Home, click selects without moving the picture, drag doesn't select, switch / Back / Forward / Esc / empty click, Esc on an opened link stays on the site, `sel` without `cam` and `F`, wisdom tooth, unknown `sel`, hover, phone taps and proxies, two-finger pinch and pan). Two Milestone 2 tests were updated for the new rules (Shift-drag now moves the offset, not the target; double-click keeps the bone's depth). Test clicks on "empty space" moved to the right edge: the debug overlay covers the top-left, and on a phone it covers the skull, so phone taps there are sent to the canvas directly.
- **Needs the user (hand check on a real device):**
  - Does orbiting now feel right after panning and zooming? (Mouse, trackpad and phone.)
  - Two fingers to one: when one finger lifts mid-gesture, camera-controls starts rotating with the remaining finger. Check there is no jump; if there is, the rig can ignore the rest of that touch.
  - Middle-drag now pans (it dollied in Milestone 2).

## Session H notes (steps 4 to 6, done)

- **Accent colour:** `#3d8bfd` through `BatchedMesh.setColorAt`. The instance colour is the accent divided by ivory in linear space (`tintFor`), so the bone comes out as the accent. three.js folds the instance colour into `vColor` together with the baked AO, which would have put it through the AO remap, so the bone material now carries it in its own varying (`vTint`, `TINT_VERTEX` in `src/scene/material.ts`). The colours texture is set up at load (all white), so the first selection doesn't compile a new shader.
- **Outline: inverted hull, not `OutlineEffect` (decision for the user to confirm).** `OutlineEffect` would render the whole skeleton again for depth, plus mask, edge and blur passes at full resolution, and would replace the renderer's MSAA with the composer's. The hull (`src/scene/outline.ts`) is one extra draw call over that bone's triangles only: a `Mesh` whose geometry shares the solid batch's position, normal and index buffers, with a draw range over the bone's indices and its instance matrix (nothing copied, nothing moved). Back faces are pushed out along the screen-space normal by a constant width in CSS pixels. Selection: 3 px in the accent colour; hover: 1.5 px, light grey. The spec allows "or the equivalent". If the look isn't good enough on a device, `OutlineEffect` can still go in for the selection only.
- **Isolation:** a second `BatchedMesh` (the ghosts) is built from the same parts at load, with a translucent material (no depth writes, no AO, `sortObjects` back to front). The pure `isolationView` (`src/scene/isolation.ts`) says which bones are solid (tier 0: the selection alone), which are ghosts, and which bone is the focus. `applyIsolationView` sets the per-instance visibility and colours, and `src/scene/Isolation.tsx` re-applies it on every store change, and after an LOD swap. Hide mode doesn't draw the ghost batch. Ghosts and hidden bones can't be picked (raycast and hit proxies); a click on a ghost counts as empty space and steps back. A wisdom tooth isolates nothing. The ghost and outline programs are compiled at load (`compileAsync`).
- **Toolbar:** "Ghosts" toggle (`aria-pressed`; `ghost=0` in the URL for hide, `replaceState`) and a "Ghost opacity" slider popover (0.05 to 0.5, kept in `localStorage`), both only while something is isolated.
- **Hover:** outline at once, tooltip with the name ("Femur (left)"; teeth already name their side) after 150 ms, hidden on wheel and never for the selected bone (`src/ui/Tooltip.tsx`, `src/content/names.ts`).
- **Numbers (container, SwiftShader, so only the draw calls mean anything):** draw calls 2 for the full skeleton, 3 with a bone isolated (solid, ghosts, outline), 4 with a hover outline as well. Click → highlight is measured from the pointer-up to the end of the next draw of the solid batch, shown in the debug overlay (`data-highlight-ms`): 137 ms in SwiftShader. The real numbers come from step 9.
- **Bounds:** the debug bounds check now covers the ghost batch too (`data-bounds-ghost-checked`), and still passes with a bone isolated.
- **Tests:** Vitest 184 (new `tests/scene-isolation.test.ts`; shader and tint tests in `tests/batch.test.ts`). Playwright: new `tests/e2e/isolate.spec.ts` (isolate by click with accent, outline, ghost counts, timing, draw calls, bounds and reload; ghost/hide toggle and the slider; a hide-mode link and Esc; a wisdom tooth; an LOD swap keeps the isolation; hover outline and tooltip). Two session G tests changed, because clicking another bone during isolation now steps back instead of switching focus.
- **Needs the user:**
  - Is the hull outline good enough, or should the selection use `OutlineEffect`?
  - The selection's outline is the same blue as the bone. It shows as a rim but doesn't contrast with the bone. A lighter outline (for example `#cfe3ff`) would separate the two more clearly for colour-blind users; say if you'd prefer that.
  - Ghost look and default opacity (0.15) on a real screen.

## Step 1: Fixed orbit pivot (backlog 1, approved by the user on 2026-11-19)

**Decision (user):** the pivot stays at the skeleton's centre while panning and zooming. Selecting a bone, double-clicking or double-tapping a bone, and `F` move the pivot to that bone. Home puts it back on the skeleton's centre. This changes spec §6's "orbit pivots around a focus point" only in what moves the focus point; record it in the spec as a dated note.

- **Mechanism, first choice:** camera-controls' target is the pivot and never moves on pan or zoom. Pan becomes `setFocalOffset` (a view-space shift of camera and target together, so the picture slides and the pivot stays). Zoom toward the cursor becomes a dolly along the view axis plus the focal-offset change that keeps the point under the cursor fixed on screen. Rotation turns about the target, so the skeleton turns about the pivot whatever the offset.
- **Fallback** if focal offset fights the rig (boundary, dolly-to-cursor, the toolbar inset): the same screen shift through `camera.setViewOffset`, composed with the existing 100 px toolbar inset.
- **Pure maths** in `src/camera/math.ts`: `dollyToPointFixedPivot` (new distance and offset that keep a screen point fixed), `offsetForPan`, and `repivot(camera, newPivot)`, which moves the pivot **without moving the picture** (camera position unchanged, offset chosen so the view is identical). Vitest: dolly keeps the cursor point within 1e-6 of where it was, repivot leaves the view matrix unchanged, orbit after a pan keeps the pivot's screen position fixed.
- **When the pivot moves:**
  - Select a bone (click, tap, URL, later search): `repivot` to the bone's box centre, no camera movement. The selection never jerks the view.
  - Double-click / double-tap a bone, or `F` with a selection: ease (400 ms, instant with reduced motion) so the bone is centred and the pivot is on it. `F` also fits the bone's box (`fitDistance`, 5% margin). `F` with nothing selected frames the skeleton, as now.
  - Home, presets and deselect-to-full-skeleton by Home: pivot back to the skeleton centre and offset to zero. Deselecting by Esc / Back / empty click leaves the camera and pivot alone.
- **Limits:** the pan boundary (`setBoundary`) applies to the target, which no longer moves on pan, so add a separate clamp on the offset: the pivot's projection must stay within the viewport grown by 50%. Clip planes keep using the camera-to-target distance, but the near plane must be checked with a large offset (a close-up of the feet with the pivot at the pelvis): use the distance to the nearest point of the skeleton's box along the view instead, if that is closer.
- **URL:** `cam=` gains two optional values, the focal offset in metres along the camera's right and up axes: `cam=px,py,pz,tx,ty,tz[,ox,oy]`. Six values (old links, `/m2/` links) still parse, with a zero offset. Tests in `tests/url.test.ts`.
- **Double-click on empty space** keeps doing nothing.
- **Needs the user:** a hand check that orbit now feels right after panning and zooming ("orbit should scale with the zoom"). Orbit stays a fixed angle per pixel, as CAD tools do; if it still feels wrong, ask what they expect.

## Step 2: Selection state and URL (`src/state/`)

- Store additions: `sel: string | null` (a bone ID), `tier: 0` (typed as `0 | 1 | 2` for Milestone 4, only 0 used), `ghostMode: "ghost" | "hide"`, `ghostOpacity: number` (default 0.15, kept in `localStorage`, not in the URL), `hovered: string | null`.
- A **pure isolation reducer** in `src/state/isolation.ts`, the §6 state diagram as code: actions `select(id)`, `back()`, `clickEmpty()`, `escape()`, `home()`. It returns the new state and whether the change is a new history entry. Isolation-level changes (full ↔ tier 0) push; switching focus at tier 0 replaces. Table tests in Vitest.
- **URL** (`src/state/url.ts`): parse and write `sel`, `tier` and `ghost` (`ghost=0` means hide; absent means ghost). An unknown `sel` is dropped. `pushState` for level changes, `replaceState` otherwise (camera rest included, as now). `popstate` restores `sel`, `tier` and `ghost` as well as `cam`.
- **Wisdom teeth** (`tooth_18`, `28`, `38`, `48`, `meshAvailable: false`): valid `sel` values. The panel opens with "No 3D model: this tooth is absent from the source model", nothing is isolated, and the view doesn't change. They are never pickable in 3D.

## Step 3: Picking (`src/scene/pick.ts`, rig input)

- **Drag versus click** (spec §6): a press that moves more than 5 px between down and up is a camera drag and never selects. Reuse the threshold in `tapStep`; one pure detector for clicks, taps, double-clicks and double-taps, so a double-click's first click selects and its second re-centres.
- **Raycast** the `BatchedMesh` with the BVH (already built in an idle callback; build it eagerly instead if the first click can come before it, and measure). In isolation, raycast only the visible instances (ghosted and hidden ones are not pickable; a click on a ghost counts as empty space, so it deselects). The ray must use the projection with the toolbar inset and the focal offset.
- **Click on empty space** deselects (back to the full skeleton).
- **Enlarged hit proxies** for tiny objects. Which objects: computed, not hand-listed, from the manifest: bounding-sphere radius below a threshold (start at 6 mm and check the list covers the ossicles, distal phalanges and teeth; the skeleton has no separate sesamoids besides the patellae and pisiforms, so check the pisiform too). Write the resulting list into the plan notes.
  - Each proxy is a screen-space disc: the object counts as hit if the pointer is within `max(22 px, its projected radius)` of its projected centre (44 px targets on a phone, WCAG 2.5.8).
  - Pure function `pickWithProxies(realHit, proxies, pointer)`: if the ray hits a tiny object, take it. Otherwise take the proxy whose centre is nearest the pointer, as long as it is in front of the real hit (depth at its centre less than the real hit's distance, plus its own radius) so a tooth behind the mandible can't steal the click. Otherwise take the real hit. Vitest table tests.
  - Proxies are maths only (no meshes and no draw calls). Hidden and ghosted objects have no proxy.
- **Hover** (pointer type `mouse` only): the same pick on `pointermove`, throttled to one per frame, sets `hovered`. No hover while a button is down or the camera is moving.
- `window.__viewer` (with `?debug`) gains `pick(x, y)`, `select(id)` and `screenOf(id)` for the e2e tests.

## Step 4: Highlight and outline (spec §6, §10)

- **Accent colour** for the focus bone through `BatchedMesh.setColorAt` (instance colour multiplies the material). Choose an accent that still reads against ivory for deuteranopes and protanopes (a blue, for example `#3d8bfd`, checked with a simulator), since selection must be shown by outline **and** colour.
- **Outline** with `postprocessing`'s `OutlineEffect` (`@react-three/postprocessing`). The effect needs `Object3D`s, so the selected and hovered bones each get an **outline proxy mesh**: a `Mesh` whose geometry shares the `BatchedMesh`'s attribute buffers with that bone's index range (`getGeometryRangeAt` → `setIndex` view + `drawRange`) and whose matrix is the instance matrix. Nothing is copied, nothing moves. Hover outline thin and neutral; selection outline thicker in the accent colour.
- If `OutlineEffect` is too slow on the phone (it adds full-screen passes), fall back to an inverted-hull outline on the proxy mesh. Decide on the iPhone numbers in step 9.
- **Budget:** < 50 ms click → highlight on desktop. Measure from `pointerup` to the first frame drawn with the new colour (`performance.now()` in the rig, shown in the debug overlay, asserted loosely in e2e).

## Step 5: Tier-0 isolation (spec §6 Isolation)

- **Two `BatchedMesh`es from the same geometry:** the existing opaque one shows only isolated instances (`setVisibleAt`), and a ghost one shows the rest with a translucent material (`transparent`, `depthWrite: false`, `opacity` from `ghostOpacity`, no AO floor so it stays light), with `sortObjects` on for back-to-front order. The ghost batch is built from the same parts at load (keep the parts until both batches exist), and its memory and build time are measured on both LODs. When nothing is selected, the ghost batch is not drawn.
- **Hide mode:** the ghost batch is not drawn.
- **Toolbar:** a ghost/hide toggle (`aria-pressed`) and, in a small popover, the ghost-opacity slider (0.05–0.5). Both only show while something is isolated.
- Isolation changes visibility and materials only. **No geometry moves or reloads** (spec §6, §12): the e2e bounds check (`?debug`) must still pass with a bone isolated, for both batches.
- Draw calls with a bone isolated: opaque batch + ghost batch + outline passes. Assert < 20 in e2e.
- LOD swap while a bone is isolated keeps the isolation (state lives in the store, batches re-apply it).

## Step 6: Hover tooltip

- Desktop only: after the pointer rests on a bone for 150 ms, a small tooltip near the pointer shows the bone's name (with side, for example "Femur (left)"). It hides on drag, leave or wheel. Not shown for the selected bone while the panel is open.

## Step 7: Info panel and breadcrumb (spec §7)

- **Placeholder content** from `content/ids.json` only, in `src/content/placeholder.ts`: name and side from `ids.json`; Latin name, common name, functions, landmarks, muscles and clinical note show "Not written yet". Nothing anatomical is invented (spec §12); real content arrives in Milestone 4. The panel still shows the "Draft — not yet reviewed" badge.
- **Sections in spec order:** name (English, Latin underneath in italics), common name, side toggle; badge row (region from `group`, `kind`, draft note); summary; functions; articulations ("Not written yet"); landmarks (toggle disabled); muscles; clinical note; buttons: Show related and Expand region (disabled, "Milestone 4"), Back.
- **Side toggle** for paired bones: jumps to the opposite side's ID (from `ids.json`, matched by name and group), repivots, keeps the tier.
- **Layout:** desktop right panel, about 360 px, collapsible. Phone (< 600 px): bottom sheet with peek (name), half (summary) and full, dragged or tapped between them; peek leaves the toolbar usable. The framing inset grows by the panel's width or the sheet's peek height, so an `F` frame isn't hidden behind it.
- **Breadcrumb** top-left (top, one line on a phone): `Skeleton › Lower limb › Femur`, built from `group`. Group labels from a small table in `src/content/labels.ts`. "Skeleton" deselects.
- Text contrast ≥ 4.5:1 and reflow at 200% zoom (spec §10): check both by hand and with a Playwright screenshot at 200%.

## Step 8: Keyboard, Back and announcements (spec §6, §10)

- `Esc` steps back one level (tier 0 → full skeleton), the same as the panel's Back and the browser's Back.
- `F` frames the selection (step 1), or the skeleton with nothing selected.
- An `aria-live="polite"` region announces "Femur, left, selected. Isolated." and "Full skeleton". (The hierarchy tree and Tab cycling are Milestone 5.)
- Focus: selecting with the mouse leaves focus on the canvas; Back in the panel returns focus to the canvas.

## Step 9: Performance check (spec §8, needs the user)

- `?bench&sel=femur_left` runs the same 360° orbit with a bone isolated and ghosting on (transparency and outline cost). Report: median and 5th-percentile FPS, draw calls, click → highlight time.
- Targets: PC 60 FPS, iPhone ≥ 30 FPS, draw calls < 20, click → highlight < 50 ms (desktop) / < 100 ms (phone).

## Step 10: Tests

- **Vitest:** isolation reducer, URL (`sel`, `tier`, `ghost`, 8-value `cam`, old 6-value `cam`), fixed-pivot maths, `pickWithProxies`, tiny-object list, placeholder content (every ID has a panel model; wisdom teeth flagged), opposite-side lookup for every paired ID.
- **Playwright** (`tests/e2e/select.spec.ts`):
  - click the femur → `sel=femur_left` in the URL, 1 opaque instance visible, accent colour applied, panel shows "Femur"; reload restores it;
  - a drag starting on the femur orbits and doesn't select;
  - click another bone switches focus (URL replaced, not pushed); browser Back → full skeleton; Esc and empty click do the same;
  - ghost → hide toggle and the opacity slider; draw calls < 20; bounds check still passes;
  - side toggle femur left ↔ right;
  - `sel=tooth_18` shows the no-model note;
  - fixed pivot: pan, then orbit, the pivot's screen position doesn't move; zoom toward the feet, then orbit, the skeleton's centre stays the pivot; double-click the femur → pivot on the femur; Home → back to the skeleton centre;
  - hover tooltip after 150 ms (desktop);
  - **390 × 844 viewport, every one of the 234 objects:** for each ID, frame it with `F` behaviour from the debug hook (without selecting), tap at a point `__viewer.pick` says is that bone (or its proxy), and assert `sel` is that ID. Also a stricter pass for the teeth and ossicles at a moderate zoom (the whole skull in view) to prove the proxies help. Split into chunks if it runs too long in SwiftShader.
- Existing e2e tests updated for the new `cam=` and pivot behaviour.

## Step 11: Hosted copy

- Merge to `main` through a PR, check the Deploy run, and ask the user to confirm https://ajmarr04-ux.github.io/SkeletonViewer/m3/ loads. Then tick the exit criterion, update `README.md`, and point `CLAUDE.md`'s status at Milestone 4's handover.

## New dependencies

- `postprocessing`, `@react-three/postprocessing` (outline, spec §2).
- Nothing else expected. (`zod` and `minisearch` arrive with Milestones 4 and 5.)

## Files

| Path | What |
| --- | --- |
| `src/state/isolation.ts` | Pure isolation reducer (§6 state diagram) |
| `src/state/store.ts`, `src/state/url.ts` | `sel`, `tier`, `ghost`, hover; `cam=` with offset; push vs replace |
| `src/camera/math.ts`, `src/camera/CameraRig.tsx` | Fixed pivot: focal-offset pan and zoom, `repivot`, frame selection |
| `src/scene/pick.ts` | Click/tap detection, raycast, `pickWithProxies`, tiny-object list |
| `src/scene/isolation.ts` | Opaque + ghost batches, visibility, instance colour, outline proxy meshes |
| `src/scene/Outline.tsx` | Postprocessing outline |
| `src/content/placeholder.ts`, `src/content/labels.ts` | Placeholder panel model, group labels, opposite side |
| `src/ui/InfoPanel.tsx`, `BottomSheet.tsx`, `Breadcrumb.tsx`, `Tooltip.tsx`, `Announcer.tsx` | UI |
| `tests/isolation.test.ts`, `tests/pick.test.ts`, `tests/placeholder.test.ts` | Vitest |
| `tests/e2e/select.spec.ts` | Playwright |

## Risks and open points

- **Focal offset and camera-controls:** boundary, `dollyToCursor` and `setViewOffset` may not compose cleanly; the fallback is a manual view-offset shift (step 1). Budget time in session G for this.
- **Two batches double the vertex memory** on the GPU. The high LOD is about 500k triangles quantised, so expect tens of MB; measure on the iPhone. If it's a problem, the ghost batch can use the low LOD's geometry (ghosts are faint, so detail matters less), but its bounds then differ slightly from the opaque high LOD; check that's acceptable before choosing it.
- **Transparent sorting** is per instance, not per triangle; large overlapping ghosts (skull bones) may show minor ordering artefacts. Acceptable at low opacity; screenshot for the user.
- **Outline cost on the phone:** decided by step 9's numbers (fallback in step 4).
- **The 390 px all-objects test** may be slow in SwiftShader; chunk it, and keep it out of the Pages workflow if it pushes the deploy too long (run it in `npm run e2e` only).

## Commit plan (branch `claude/keen-clarke-32a10a`)

One or more commits per session, pushed at the end of each: G (`camera: fixed orbit pivot`, `state: selection and URL`, `scene: picking and hit proxies`), H (`scene: highlight, outline and isolation`), I (`ui: info panel and breadcrumb`, `test: selection e2e`, docs). A PR to `main` at the end of session I.
