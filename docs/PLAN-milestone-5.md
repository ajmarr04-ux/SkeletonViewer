# Milestone 5 Plan: Polish (Spec Phase 5)

Source of truth: `SPEC (2).md`, sections 6 (Teeth: isolating a whole tooth type from the tree), 7 (UI: sidebar, toolbar, search, labels, attribution), 8 (performance budgets and supported browsers), 10 (accessibility) and 11 (Phase 5). Ground rules from §12 apply throughout: no geometry moves, no invented landmark coordinates, TA2 IDs or articulations, and anything uncertain goes in `content/QUESTIONS.md`.

## Goal

Finish the app as the spec describes it. A **sidebar** with search (English, Latin and common names, plus synonyms) and the hierarchy tree, which is also the accessible twin of the 3D view. Selecting a whole group from the tree (for example "all molars") isolates it. **Floating labels** that never overlap. **Colour-by-region** with a legend that stays readable for people with colour-vision deficiency. **Screenshots** (PNG with the attribution stamped on), **share links** and a proper **attribution page**. Then the checks: axe-core with no violations, a manual keyboard-only pass, the performance budgets on the supported browsers, and the spec's Playwright smoke test. The milestone ends with a hosted copy at `/m5/`.

Out of scope: pinned landmark labels stay disabled, because no landmark has a position (spec §5: never invent coordinates). Deriving positions from the mesh is possible later, but it isn't planned here. Content review (spec §13) stays open; every file stays `reviewed: false`.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| (planning) | 0 (Milestone 4 handover) | **Done.** See step 0 |
| M | 1 (search index), 2 (sidebar: search and tree), 3 (group isolation from the tree), 4 (Tab through visible objects) | **Done.** See "Session M notes" |
| N | 5 (floating labels), 6 (colour-by-region and legend), 7 (screenshot), 8 (share link), 9 (attribution page), 10 (toolbar layout on phones) | **Done.** See "Session N notes" |
| O | 11 (accessibility: axe-core and the keyboard pass), 12 (performance on the supported browsers, needs the user), 13 (tests and the smoke test), 14 (hosted copy) | **Steps 11 and 13 done; 12 done in Chromium, the browser table needs the user; 14 needs the merge.** See "Session O notes" |

Triggers: "begin session M", "begin session N" and "begin session O". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models`, `npm run validate-content` and `npm run e2e` passing, then a commit, a push to the session branch and a PR to `main`. No Blender work is planned.

## Exit criteria (from spec §11, Phase 5)

- [x] Search, labels, colour-by-region, screenshots, share links and the attribution page are done.
- [x] Accessibility checks pass: axe-core reports no violations, and a manual keyboard-only pass succeeds. (Scripted in `a11y.spec.ts` and `keyboard.spec.ts`; a screen-reader pass by the user is still welcome.)
- [ ] Performance budgets are met on the supported browsers.
- [x] A Playwright smoke test passes: load → click femur → Show related → Expand region → Back ×3 → full skeleton. (`tests/e2e/related.spec.ts`, first test; checked against this wording in session O.)
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Milestone 4 handover (done in the planning session)

- `deploy/pages.json`: `m4` frozen at `db07f6252adf4e8d4dfe2db6d1c348f92baa6928` (the merge of PR #10, Milestone 4's last PR), `current` is 5.
- `/m4/` was confirmed live by the user on 2026-11-19, and "Hosted copy is live" is ticked in `docs/PLAN-milestone-4.md`. `README.md`: Milestone 4 row marked frozen, Milestone 5 row added as "In progress".
- Milestone 4 step 9: FPS and draw calls at tier 2 are within spec on both devices. The user waived the click → highlight timing ("responsive"), and said "articulations work great".
- `docs/BACKLOG.md` has no open entries to pull in.
- **Still open, carried over (needs the user, any time):** `content/QUESTIONS.md` (articulations, region sets and text, items 1 to 36); the Milestone 3 hand checks (orbit feel after panning and zooming, the two-to-one-finger handover, the panel and sheet on real devices) unless the user considers them done; how Explode feels on the phone.

## Decisions made in this plan (say if any should change)

These fill gaps the spec leaves open. Each is the smallest choice that fits the spec, and the sessions build them as written unless the user says otherwise.

1. **What search covers.** Index each object's English name, Latin name and common name, plus a small curated synonyms file, `content/synonyms.json` (ID → extra terms such as "innominate", "tailbone", "wisdom tooth", "C1", "T4", "36" for FDI numbers, and "upper left first molar"). Paired bones are written once under the left ID and apply to both sides. It is validated by `validate-content` (known IDs, no empty terms). The spec's front matter stays exactly as §5 shows it. Matching is prefix and fuzzy (`minisearch`). "left" or "right" in the query narrows the results to that side. Paired bones without a side word list both sides.
2. **The index is built at build time** (spec §2) as a second virtual module beside `virtual:skeleton-content`, in its own lazy chunk, loaded when the sidebar first opens or the search field gets focus. `scripts/build-search-index.ts` (spec §3) prints its size. Expect under 20 KB gzipped.
3. **Choosing a search result** selects the object at tier 0 and frames it (spec §7: "selects the object and frames it"). This is the one place where selection moves the camera, because the user asked to find something. It is the same as `F` after a click.
4. **The tree** is `content/hierarchy.json`, shown as an ARIA tree (`role="tree"`, arrow keys, type-ahead) in the sidebar: left and collapsible on desktop, a full-screen sheet behind a search icon on phones (spec §7). Selecting a leaf does exactly what clicking the bone does (spec §10). The selected object's branch opens and scrolls into view whenever the selection changes, however it changed. A wisdom tooth's leaf is selectable and shows its "no 3D model" note, as now.
5. **Group isolation** (spec §6 Teeth: "isolate a whole tooth type at once"). Every inner node of the tree, not only tooth types, gets an "Isolate group" action (a button on the row, and `Enter` on a focused group row opens or closes it as usual). A group isolation is a new isolation state: `grp=<node key>` in the URL (pushed), the group's meshed members drawn solid with no focus (normal bone colour, no outline), the others ghosted or hidden as at tier 0. The panel shows the group's name, its member count and its members as links. Clicking a member (in the view or the panel) makes it the focus at tier 0 (pushed), Back returns to the group, and Back again returns to where the user was. Tiers 1 and 2 don't apply to groups. Announced: "Molars, upper and lower: 12 shown." (wisdom teeth counted as missing: "12 of 16 have a 3D model"). Selection and group are exclusive: setting one clears the other. The reducer gets a `group` action.
6. **Tab through visible objects** (spec §10). With the canvas focused, Tab and Shift+Tab move a keyboard cursor through the solid, visible objects in anatomical order (`ids.json` order, which follows the hierarchy). The cursor shows as the hover outline plus the name tooltip, and it is announced ("Femur, left. 34 of 234."). Enter selects it, as a click would. Tab past the last object (or Shift+Tab before the first) lets focus leave the canvas normally, so the canvas is never a keyboard trap (WCAG 2.1.2). The cursor doesn't move the camera. If the object is off screen, `F` frames it, and the announcement says "off screen" so the user knows to press `F`.
7. **Floating labels** (spec §7: "laid out so they never overlap"). A DOM overlay, one label per object, placed at its box centre's screen position with a short leader line. A greedy layout each time the camera comes to rest (and throttled during movement) places labels by priority (the focus first, then tier-1, then tier-2, then by on-screen size) and drops any that would overlap one already placed. With nothing isolated, only objects whose on-screen size passes a threshold get a label, so the full skeleton shows the large bones and gains more as the user zooms in. Ghosts get no labels. The toggle is in the toolbar and is stored in `localStorage` (not the URL). The panel's "Show landmarks" toggle stays disabled ("no positions yet").
8. **Colour-by-region** (spec §7, §10). Eight regions, from the hierarchy's second level: skull (with the ossicles and hyoid), vertebral column, thorax, pectoral girdle, upper limb, pelvic girdle, lower limb and teeth. The colours are the Okabe–Ito palette (designed to stay distinct for deuteranopia and protanopia), lightened as tints on the ivory bone so the AO still reads. A Vitest check simulates deuteranopia and protanopia (Machado 2009 matrices) and requires a minimum ΔE between every pair of region colours under each simulation. The legend sits beside the toolbar and doubles as a key. The focus keeps its accent and outline over the region colour (selection by outline and colour, spec §10). It is stored in `localStorage` and in the URL as `color=region` (it changes what a shared view looks like, so it travels with a share link).
9. **Screenshot** (spec §7). A PNG of the 3D view at the canvas's pixel size: render one frame on demand, read it straight away (`preserveDrawingBuffer` stays off), and stamp the attribution in the bottom-right corner ("Z-Anatomy, CC BY-SA 4.0 · BodyParts3D © DBCLS, CC BY-SA 2.1 JP") on a translucent strip. Labels and the legend, when on, are drawn into the PNG with the 2D canvas API, so the picture matches the screen. Panels and toolbar are not included. The file name is the selection, e.g. `skeleton-femur-left.png`. Phones use the Web Share API with a file where it is supported, else a download.
10. **Share link** (spec §7). The URL already holds the whole view (`sel`, `tier`, `grp`, `cam`, `ghost`, `color`). Share uses `navigator.share` where it exists (phones), else copies the URL to the clipboard and shows a short "Link copied" toast (announced, too).
11. **Attribution page.** The footer's dialog stays. It renders `public/ATTRIBUTION.md` with `marked` at build time (no raw markdown, no fetch at runtime). A direct link, `#attribution`, opens it, so the page can be linked to. It adds a short section on the content: drafted from standard references, not yet reviewed (spec §13), and `content/QUESTIONS.md` as the place where open choices are recorded.
12. **Toolbar on phones** (spec §7: icons only). With the Milestone 5 buttons the bar would overflow 390 px. Home, Views, the isolation button (Related / Region), Ghosts and a "More" menu stay in the bar. Labels, Colour-by-region, Screenshot, Share, Ghost opacity, Explode and Settings go into "More". Desktop shows them all while they fit, and moves the rest into "More" when the side panel leaves too little room (the existing `data-panel` rule).
13. **Supported browsers** (spec §8). The container has Chromium only. Session O runs the Playwright suite in Chromium, and also in Firefox and WebKit if their browsers can be installed through the proxy; if not, it says so. The user checks Safari on the iPhone (as in earlier milestones) and, if they can, Firefox and Edge on the PC and Chrome on an Android phone, with `?bench` and a short hand check. Each result goes in the table in step 12.

## Session M notes (steps 1 to 4, done)

What was built, and where it differs from the decisions above (say if any should change):

- **Search** (`src/content/search.ts`, `content/synonyms.json`, `virtual:skeleton-search`). The index is 9.2 KB gzipped (`npm run search-index`). Fields: name, common name, synonyms, Latin and the FDI number (from the tooth's ID, so `synonyms.json` doesn't repeat it); boosts as planned. Multi-word queries must match every word (AND), and "of", "the", "a", "an", "and" are ignored. Terms of 3 characters or fewer match exactly or by prefix (so "C1", "T4" and "36" don't fuzz); longer ones allow about one typo in five letters. The result shows the field that matched the most query words ("Os coxae", "Kneecap", "FDI 36"). `synonyms.json` is checked by `validate-content`: known IDs, no right-side keys, no empty, repeated or side-naming terms. The synonyms are everyday and older anatomical terms ("innominate", "collar bone", "greater multangular", "six year molar", finger and toe names); they add no anatomy.
- **Molars:** the plan's example says "12 shown"; there are 12 molars in all, of which 4 are the wisdom teeth with no model, so the announcement is "Molars, upper and lower: 8 shown, 8 of 12 have a 3D model."
- **Sidebar** (`src/ui/Sidebar.tsx`, `src/content/tree.ts`). It starts **closed** on desktop too, so the first view is unchanged; the toolbar's new **Search** button (first in the bar) or `/` opens it, and the ‹ button or Escape (on an empty field) closes it. Desktop: left, 300 px (40% of narrow windows), reported to framing as `sidebarLeft` (`PanelInset.left`), and to CSS as `--sidebar-left` (breadcrumb, toolbar and credits line move over). With the sidebar and the side panel both open, the toolbar goes icons-only below 1600 px wide (1100 px with the sidebar alone) until session N's "More" menu. Phone: a full-screen dialog that keeps Tab inside it; choosing a result, a leaf or a group closes it. While the field holds a query the results replace the tree; Enter chooses the highlighted result (the first by default).
- **Tree.** A flat ARIA tree (`aria-level`, `aria-posinset`, `aria-setsize`) with a roving tab stop: arrows, Home, End, `*`, type-ahead, Enter or Space. Leaves are labelled with the tooltip's names ("Rib 1 (left)") so mixed-side groups read clearly. **Tooth types across all four quadrants** ("All incisors" to "All molars") are extra rows under Teeth, because the hierarchy splits teeth by quadrant and the spec asks for "a whole tooth type". The "Isolate" button on a group row is out of the tab order; `I` on a focused group row isolates it, and a line under the tree says so.
- **Group isolation** (`src/content/groups.ts`, reducer `group` action, `grp=` in the URL). Isolating a group also **frames it** (the ossicles or one quadrant's molars are too small to find otherwise), after the panel has reported its size. Another group from a group replaces the history entry; from anywhere else it pushes. The panel lists the members (a wisdom tooth says "No 3D model"); the breadcrumb's group levels are now links that isolate that group (for a selected bone too: "Lower limb" in `Skeleton › Lower limb › Femur`). Explode and the tier button are hidden for a group; Ghosts and opacity stay.
- **Tab cursor** (`tabCursor` in `src/camera/input.ts`, the rig). As planned, plus two things the plan left open: **Escape** while the cursor is on clears it (rather than going back a level), and the next Tab then leaves the canvas at once, so a keyboard user can pass the canvas without stepping through 234 bones; and **F** with the cursor on frames the cursor's bone without selecting it. Space selects as Enter does.
- **Tests:** `tests/search.test.ts`, `tests/sidebar.test.ts` (tab cursor, groups, tree), URL and reducer cases; `tests/e2e/sidebar.spec.ts` (search by each field, keyboard through results, tree keys, branch following, group isolation and history, Tab and leaving the canvas, the phone sheet).

## Session N notes (steps 5 to 10, done)

What was built, and where it differs from the decisions above (say if any should change):

- **Labels** (`src/scene/labels.ts`, `src/ui/Labels.tsx`). Greedy layout by priority (focus, tier 1, tier 2, then size on screen), six spots around each anchor, a short leader line and a dot. Labels also keep off the toolbar, breadcrumb, legend, panels, sidebar and credits line (their screen boxes are obstacles). With nothing isolated, only objects whose bounding sphere is at least **32 px** in radius on screen get a label (about 25 on a 1280 × 800 window: the long bones, hip bones, a few ribs, the large skull bones); zooming in adds more. While something is isolated, every solid object can get one. The layout runs when the camera comes to rest, every 100 ms while it moves, and every 500 ms at rest (for panels opening). The centres come from the live instance matrices, so labels follow Explode. Toggle in the toolbar, stored in `localStorage` (`skeleton-viewer:labels`), off by default.
- **Colour-by-region** (`src/scene/regionColours.ts`, `src/ui/Legend.tsx`). Seven Okabe–Ito colours lightened 20% toward white: skull sky blue, vertebral column orange, thorax bluish green, pectoral girdle reddish purple, upper limbs yellow, pelvic girdle vermillion, lower limbs blue. **Teeth stay ivory** (the palette has seven usable colours, its eighth is black, and ivory is distinct from all seven). The Vitest check uses CIEDE2000 (checked against Sharma's reference pairs) and requires ΔE ≥ 8 between every pair, with normal vision and with simulated deuteranopia and protanopia (Machado 2009); the closest pair is orange and yellow under deuteranopia, about 9.3. Legend swatches are at least 3:1 against the legend. The legend sits bottom left on desktop (lifted above the toolbar on narrow windows) and as a wrapped strip above the toolbar on phones (hidden while the sheet is at half or full). **Stored choice and links:** `color=region` in a link turns it on for that visit without changing the stored choice; the button changes both. A stored "on" is written into the URL at load, so the address always shows what is on screen.
- **Screenshot** (`src/scene/screenshot.ts`, `src/ui/capture.ts`, `src/scene/ScreenshotService.tsx`). As planned. The legend is drawn bottom left in the PNG whenever colour-by-region is on (on phones too, where the screen shows a strip). The hover outline, if the pointer is on a bone, is in the picture.
- **Share** (`src/ui/share.ts`, `src/ui/Toast.tsx`). The share sheet is used only on touch devices (`pointer: coarse`); desktops copy the link. The last resort is a small dialog, "Copy this link", with the URL selected.
- **Attribution** (`src/ui/Footer.tsx`, `virtual:skeleton-attribution`). The footer's "Attribution" is now a link to `#attribution`; the dialog has its own title and close button; external links open in a new tab. `ATTRIBUTION.md` gained "Text content" (drafted, not reviewed, `content/QUESTIONS.md`) and a note that screenshots carry the attribution; the software list now names all runtime libraries.
- **Toolbar** (`src/ui/toolbarFit.ts`). Rather than fixed breakpoints, the toolbar works out its own width from its buttons and the room between the sidebar and the side panel: **labels**, else **icons only**, else **icons plus "More"**. Phones always use "More". Search, Home, Views, Related / Region and Ghosts stay in the bar; Ghost opacity, Explode, Labels, Colour, Screenshot, Share and Settings go into "More", which shows their controls directly (sliders, toggles, the model-detail choice), so each is two taps away. The old `data-panel` / `data-sidebar` icon-only CSS rules are gone. Icon-only buttons now all have accessible names ("Ghosts", "Related", "Region", "Labels", "Screenshot", "Share"); before, Ghosts was named by its long tooltip.
- **Tests:** `tests/labels.test.ts`, `tests/regionColours.test.ts`, `tests/screenshot.test.ts`, `tests/toolbarFit.test.ts`, the `color` cases in `tests/url.test.ts`; `tests/e2e/polish.spec.ts` (labels never overlap or block a click, follow isolation and zoom, are remembered; region colours, focus accent, legend isolation, white again when off, bounds unchanged; the PNG's size, name, contents and strip; the share round trip for a bone and a group, and the manual fallback; `#attribution`; toolbar fit on desktop and the phone "More" menu). `viewer.spec.ts`'s phone test now finds Settings in "More", and `smoke.spec.ts` opens the attribution through the link.
- **Test run:** `tsc`, Vitest (305 tests), `check-models` and `validate-content` pass; Playwright 90 of 91 in the last full run. The one failure, `viewer.spec.ts` "keyboard moves the camera, the URL follows…", is an **existing flake**: under load the URL's `cam` can be written up to a few millimetres (once 0.3 m) before the camera has settled. It fails about 1 run in 4 on session M's commit too (checked with this session's changes stashed). For session O to look at (step 13), together with the other camera timing.

## Session O notes (steps 11 to 13 done, 12 partly needs the user, 14 needs the merge)

What was done, and where it differs from the steps below (say if any should change):

- **axe-core** (`tests/e2e/a11y.spec.ts`, `@axe-core/playwright`, WCAG 2.0, 2.1 and 2.2 A and AA tags). Zero violations, with **no rule disabled**, on: the full skeleton; a selected bone with the panel; tier 2; a group (molars); the sidebar with the tree and with results; each toolbar popover (Views, Ghost opacity, Explode, Settings, and "More" whenever the width uses it); labels and colour-by-region on; the attribution dialog; the "Link copied" toast; the manual share dialog; and on a 390 px phone: the sheet at peek, half and full, the "More" menu and the search sheet. A first test plants an unnamed button and checks axe reports it, so a pass can't come from axe not running. Nothing needed fixing for axe.
- **Keyboard-only pass, scripted** (`tests/e2e/keyboard.spec.ts`; only `page.keyboard` drives the app). (1) Tab goes round the whole page and back to the start at tier 1 with the panel open, and **every** stop has a visible focus indicator (outline or box shadow, read from the computed style). Order: the 3D view, breadcrumb, panel (collapse, side toggle, articulations, Expand region, Back), then the toolbar (Search, Home, Views, Region, Ghosts, Ghost opacity, Explode, Labels, Colour, Screenshot, Share, Settings), then the footer links. The canvas is left with Escape then Tab, as its description says, so it isn't a trap. (2) A whole session by keyboard: orbit, pan and zoom by keys (the URL's `cam` changes); Tab cursor and Enter selects; Escape back; `/`, type "femur left", Enter selects the femur; Related, Region; Escape ×3 back to the full skeleton; Labels (Space) and Colour (Enter); Settings opens and Escape returns focus to its button; Screenshot downloads a PNG; Share shows "Link copied"; the attribution link opens the dialog and Escape returns focus to the link. The tree's own keys, group isolation with `I` and the Tab cursor's edge cases stay in `sidebar.spec.ts` (session M). **Still for the user, if they can:** the same pass with VoiceOver (iPhone or Mac).
- **Reduced motion:** already covered. The sheet's height transition and the toast's fade are off under `prefers-reduced-motion`; the sidebar, labels and legend have no transitions; camera moves already use `smoothTime 0`.
- **Contrast and 200% reflow** extended (`a11y.spec.ts`): every text node in the sidebar (tree, results, a highlighted result) and the legend is at least 4.5:1 against its background, measured directly (axe leaves text over translucent panels "incomplete"); at 640 × 400 (200% of a 1280 × 800 laptop) with the sidebar, results and legend open, nothing scrolls sideways and the legend stays on screen, clear of the toolbar. **One fix:** on short windows the one-column legend covered most of the 3D view, so below 520 px tall (and at least 600 px wide) it now shows as two compact columns without its title (`src/styles.css`); its `aria-label` still names it.
- **Load budgets** (`npm run perf-load`, `scripts/perf-load.ts`). Chromium, DevTools' Fast 4G (9 Mbit/s, 165 ms round trip), 4× CPU slowdown, cold cache, median of 3, `?lod=both`. The script serves `dist/` with gzip as GitHub Pages does (`vite preview` doesn't compress). **First run: desktop failed**, first skeleton 3.7 s against 3 s. The profile showed why: a 3 to 4 s main-thread block from the container's **software GPU** (SwiftShader) compiling shaders, during which the parsed low model couldn't be shown; and the low model was only requested after the 450 KB (gzipped) script had downloaded and run. **Two fixes:** `index.html` preloads `skeleton-low.glb` (`<link rel="preload" as="fetch">`, matched by the loader's `fetch`, so it is downloaded once), and the viewer starts downloading the high model as soon as the low one is parsed (`prefetchModel` in `src/scene/loadSkeleton.ts`) instead of after it is batched and first drawn. **Now:** desktop 1.90 s to the skeleton and 5.96 s to full detail (targets 3 s and 8 s); phone profile 1.91 s and 6.08 s (targets 5 s and 12 s). These include the software GPU's set-up, so a real device should be faster; the script prints the renderer and the network-bound times separately. With the `?lod=high` debug override the browser warns that the preloaded low file went unused; that's expected.
- **Label layout cost.** `?bench` now also reports the floating labels' layout times (count, median, max) and whether colour-by-region is on. Two new tests in `viewer.spec.ts` run the bench with labels and colour on, at 4× CPU slowdown: full skeleton 33 layouts, median 2.4 ms, max 12 ms; tier 2 72 layouts, median 1.1 ms, max 3.3 ms. Layouts run at most every 100 ms while moving, so they cost at most a few percent of frame time; the tests require a median under 16 ms. The phone's FPS with labels on is in the user's table below.
- **Smoke test.** `related.spec.ts`'s first test matches the spec's wording step for step. It now presses the panel's **"Expand region"** button (the spec's words) rather than the toolbar's "Region"; the toolbar button is pressed in the keyboard and axe tests.
- **The session N flake** ("keyboard moves the camera, the URL follows…") was the test, not the app: camera-controls fires `rest` while the camera is still easing, the URL is written then, and written again with the final pose at `sleep`. The test compared the camera with the first write. It now waits for the URL to settle on the camera (6 of 6 runs with 3 workers in parallel).
- **Firefox and WebKit** (decision 13) were not tried in the container: its instructions say not to run `playwright install`, which is how they'd be fetched. Those browsers rely on the user's checks in the table.
- **Test run:** `tsc`, Vitest (307 tests), `check-models` and `validate-content` pass; Playwright 105 of 105 in one full run (18.8 min, 2 workers).

## Step 1: Search index (spec §2, §7)

- `npm i minisearch`.
- `content/synonyms.json` (decision 1) and its zod schema and validation rules (unknown ID, right-side key, empty or duplicate term).
- `src/content/search.ts`: pure. Build the documents from `ids.json`, the compiled content and the synonyms; the `minisearch` options (fields and boosts: name 3, common name 2, synonyms 2, Latin 1; prefix and fuzzy 0.2); the side filter; the result shape `{ id, label, match }`, with the label from `names.ts` and the matched field shown when it isn't the name ("Thigh bone", "Os coxae").
- `scripts/build-search-index.ts` and the virtual module `virtual:skeleton-search` (serialised index, lazy chunk). `npm run search-index` prints the size.
- Vitest: "kneecap" → patella (both sides), "collarbone" → clavicle, "wisdom tooth" → the four wisdom teeth, "left femur" → `femur_left` only, "os coxae" → hip bones, "36" → `tooth_36`, "C1" → atlas, a typo ("scapla") still finds the scapula, and no result for nonsense.

## Step 2: Sidebar: search and tree (spec §7, §10)

- `src/ui/Sidebar.tsx`: a search field (combobox, `aria-activedescendant` over a listbox of results, arrows and Enter; Esc clears and then closes) above the tree (decision 4). Desktop: left, about 300 px, collapsible, and its width reported to framing as the panel's is (`panelInset.left`). Phone: a search icon in the toolbar opens it as a full-screen sheet, and choosing a result closes the sheet.
- The tree: `role="tree"`, `treeitem`s with `aria-expanded`, `aria-selected` on the selected leaf; arrows, Home and End, type-ahead, `*` to open siblings. Leaf labels use the panel's names. Counts on inner nodes ("Molars (12)").
- `/` focuses the search field from anywhere except a text input.
- Framing: `frameBeside` keeps the bone clear of both the sidebar and the panel.

## Step 3: Group isolation (decision 5)

- Reducer: the `group` action and `grp` in the state; `url.ts` parses and writes `grp`; `selection.ts` pushes it; history and popstate as for tiers.
- `isolationView` for a group: solid = its meshed members, no focus, no outline.
- Panel: group header, count, members as links (the same buttons as articulations). Breadcrumb: the group's trail (`Skeleton › Teeth › Upper left › Molars`).
- Toolbar: the isolation button is hidden for a group (no tiers), and Ghosts, Labels and Colour still apply. Explode is hidden.
- Announcements (decision 5), plus the "back to the group" message.

## Step 4: Tab through visible objects (decision 6)

- `src/camera/input.ts`: a pure `tabCursor(visibleIds, current, shift)` that returns the next ID or `null` (leave the canvas).
- The rig: Tab and Shift+Tab on the focused canvas, Enter selects, the hover outline and tooltip follow the cursor, the announcement includes its position. The cursor clears on a pointer move, on a selection change and when the canvas loses focus.

## Step 5: Floating labels (decision 7)

- `src/scene/labels.ts`: pure. Project the box centres, estimate each label's size from its text, run the greedy no-overlap layout by priority, and apply the on-screen size threshold. Vitest checks that no two placed boxes overlap, that priority order holds, and that the focus is always placed.
- `src/ui/Labels.tsx`: the overlay. It reads the camera at rest (and every 100 ms or so while moving). Labels are `aria-hidden` (the tree is the accessible twin) and `pointer-events: none`, so they never block picking.
- The toolbar toggle and its `localStorage` key.

## Step 6: Colour-by-region and legend (decision 8)

- `src/scene/regionColours.ts`: the region of each ID (from its `group`), the palette and the tint maths. Vitest: every ID has a region; the CVD ΔE check for every pair under deuteranopia and protanopia; the tints keep at least 3:1 contrast against the background for the legend swatches.
- Applied as instance colours on the solid batch (the focus keeps the accent; the joint highlight brightens the region tint). The ghost batch stays neutral. No geometry or matrices change.
- `src/ui/Legend.tsx`: swatches and names; clicking a legend entry isolates that region as a group (step 3), which gives the legend a use beyond being a key.
- URL `color=region` (replaceState, like `ghost`).

## Step 7: Screenshot (decision 9)

- `src/scene/screenshot.ts`: render on demand inside the frame loop, `canvas.toBlob`, then composite on a 2D canvas: the 3D image, the labels and the legend if they are on, and the attribution strip. Name from the selection or group.
- Vitest for the pure parts (file name, strip layout). Playwright: the PNG has the canvas's pixel size, isn't blank, and its corner pixels differ from the bare render (the strip is there).

## Step 8: Share link (decision 10)

- `src/ui/share.ts`: `navigator.share` if present, else `navigator.clipboard.writeText`, else a read-only text field with the URL selected. Toast and announcement.
- Playwright: the copied URL, opened in a new page, restores the same selection, tier, group, ghost mode, colour mode and camera.

## Step 9: Attribution page (decision 11)

- Compile `public/ATTRIBUTION.md` at build time (the content plugin can serve it as a third virtual module, or it can be inlined). The footer dialog renders the HTML, `#attribution` opens it, closing clears the hash.
- Add the content section to `ATTRIBUTION.md`.

## Step 10: Toolbar on phones (decision 12)

- A "More" popover (menu) holding the overflow buttons, with the same labels and test IDs, so existing tests find them the same way.
- Playwright: at 390 px wide, the toolbar fits on screen and every action is reachable within two taps.

## Step 11: Accessibility (spec §10)

- `npm i -D @axe-core/playwright`. A new `tests/e2e/a11y.spec.ts` runs axe (WCAG 2.2 A and AA rules) on: the full skeleton; a selected bone with the panel open; tier 2; a group; the sidebar with results; each toolbar popover open; the phone sheet at half and full; the attribution dialog. Zero violations. Any rule that can't apply to a WebGL canvas is excluded by name with the reason in the test, not silently.
- Manual keyboard-only pass, scripted where possible and written down here: reach every control, the visible focus ring on each, orbit, pan and zoom by keys, select via the tree and via Tab in the canvas, tiers, group, Back, Esc, labels, colour, screenshot, share, settings, and the attribution dialog. No traps. The user does the same pass with a screen reader if they can (VoiceOver on the iPhone or the Mac).
- Reduced motion: every new transition (sidebar, toast, labels fade) is instant with `prefers-reduced-motion`.
- The contrast and 200% reflow tests extend to the sidebar and the legend.

## Step 12: Performance on the supported browsers (spec §8, needs the user)

- Load budgets in Chromium with Playwright and DevTools throttling (Fast 4G, 4× CPU slowdown): time to the first skeleton (low LOD) and to full detail, from the `?debug` overlay's load times. Targets: desktop ≤ 3 s and ≤ 8 s; phone ≤ 5 s and ≤ 12 s.
- `?bench` with labels and colour-by-region on, at the full skeleton and at tier 2: the labels' layout must not pull the phone below 30 FPS.
- **Measured in session O** (container Chromium, software GPU): desktop 1.90 s / 5.96 s, phone profile 1.91 s / 6.08 s, both within budget (`npm run perf-load`). Label layout at 4× CPU: median 2.4 ms (full skeleton), 1.1 ms (tier 2). To check a real device: Chrome DevTools → Network "Fast 4G", Performance "4× slowdown", open `/m5/?debug` and read "low loaded" and "high loaded".
- The browser table, filled from the user's checks (decision 13). For each: open `/m5/?bench&color=region` with Labels on (toolbar or "More"), note the bench's FPS, draw calls and the "Labels" line; then `/m5/?bench&color=region&sel=femur_left&tier=2` the same way; then a short hand check (search, tree, a group, labels, screenshot, share).

| Browser | Device | Median FPS | 5th pct | Draw calls | Hand check |
| --- | --- | --- | --- | --- | --- |
| Chrome | PC | | | | |
| Edge | PC | | | | |
| Firefox | PC | | | | |
| Safari | iPhone | | | | |
| Safari | Mac (if available) | | | | |
| Chrome | Android (if available) | | | | |

## Step 13: Tests

- **Vitest:** search (step 1), synonyms validation, the group reducer and URL, `tabCursor`, the label layout, region colours and CVD separation, screenshot naming.
- **Playwright:** the sidebar (search by English, Latin, common name and synonym; keyboard through results; tree navigation; a leaf selects; the branch follows a 3D selection); a group (molars: solid count, URL, Back, member click, announcement); Tab through objects and out of the canvas; labels never overlap (bounding boxes from the DOM); colour-by-region on and off (instance colours restored, bounds check passes); screenshot; share link round trip; attribution via `#attribution`; the phone toolbar; axe (step 11). The smoke test in `related.spec.ts` is checked against the spec's exact sequence.
- Existing tests are updated where the toolbar moved items into "More".

## Step 14: Hosted copy

**Hosted copy, Milestone 5:** https://ajmarr04-ux.github.io/SkeletonViewer/m5/ (not live yet).

- Merge to `main` through a PR, check the Deploy run, and ask the user to confirm https://ajmarr04-ux.github.io/SkeletonViewer/m5/ loads. Then tick the exit criterion and update `README.md`. Milestone 5 is the spec's last phase. After it, `CLAUDE.md`'s status should say so, and new work goes through `docs/BACKLOG.md`.

## New dependencies

- `minisearch` (spec §2 names it).
- `@axe-core/playwright` (dev).

## Files

| Path | What |
| --- | --- |
| `content/synonyms.json` | Extra search terms per object (decision 1) |
| `src/content/search.ts`, `scripts/build-search-index.ts` | Search documents, options and side filter; the build-time index (`virtual:skeleton-search`) |
| `src/ui/Sidebar.tsx` | Search combobox and hierarchy tree |
| `src/state/isolation.ts`, `src/state/url.ts`, `src/scene/isolation.ts` | Group isolation (`grp`) |
| `src/camera/input.ts`, `src/camera/CameraRig.tsx` | Tab cursor through visible objects |
| `src/scene/labels.ts`, `src/ui/Labels.tsx` | Label layout and overlay |
| `src/scene/regionColours.ts`, `src/ui/Legend.tsx` | Colour-by-region and legend |
| `src/scene/screenshot.ts`, `src/ui/share.ts` | Screenshot PNG; share link |
| `src/ui/Toolbar.tsx`, `src/ui/Footer.tsx` | "More" menu; attribution dialog |
| `tests/search.test.ts`, `tests/labels.test.ts`, `tests/regionColours.test.ts` | Vitest |
| `tests/e2e/sidebar.spec.ts`, `tests/e2e/polish.spec.ts`, `tests/e2e/a11y.spec.ts` | Playwright |

## Risks and open points

- **Label layout cost on the phone.** A greedy layout over about 230 labels is cheap (sort, then box tests against a grid). Running it at rest and throttled while moving keeps it off the frame budget. Checked in step 12.
- **axe and WebGL.** axe can't see inside the canvas. Its accessible name and the tree's twin role are what's tested; the canvas's contents are covered by the keyboard pass.
- **Firefox and WebKit in the container** may not install through the proxy (decision 13). If not, those browsers rely on the user's hand checks.
- **Group isolation is a spec extension** beyond the four nested states in §6. It reuses the tier-0 rules (ghosts, Back) so it doesn't add a new kind of behaviour to learn.
- **Toolbar crowding on desktop** with the side panel and the sidebar both open. The "More" menu is the fallback (decision 12).

## Commit plan (branch `claude/keen-clarke-32a10a`)

One or more commits per session, pushed at the end of each, with a PR to `main` at the end of each session so it can be checked on the live site: M (`search: index and synonyms`, `ui: sidebar and tree`, `state: group isolation`, `camera: Tab through objects`), N (`scene: labels`, `scene: colour-by-region`, `ui: screenshot, share, attribution, More menu`), O (`test: a11y`, docs, perf table).
