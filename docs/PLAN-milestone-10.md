# Milestone 10 Plan: Polish and measurement (Musculoskeletal spec, M10)

Source of truth: `SPEC-musculoskeletal.md` §6.3 (colours), §7 (labels, legend), §9 (performance budgets), §11 (M10) and §13 (working rules). Where that spec is silent, `SPEC (2).md` §7 (labels), §10 (accessibility) and §12 still apply. Ground rules: no mesh is touched (`git diff public/models/` stays empty); no landmark, TA2 ID or articulation is invented; uncertain choices go in `content/QUESTIONS.md` (M10's start at **139**); **with every new layer off, the app loads, looks and behaves as M9 does**, and every existing test keeps passing.

## Goal

Finish the musculoskeletal programme (M6 to M10). Labels cover every kind of structure that is drawn solid, with the focus layer winning ties. Every colour the new layers add (layer colours, tendon shade, origin/insertion/antagonist tints, legend chips) passes the colour-vision check together with the colours already on screen. A keyboard and screen-reader user can do everything a pointer user can with the new kinds, the layers and the part level, and hears what changed. The spec's performance budgets are measured, in the container and on the user's PC and iPhone, and each miss is either fixed or documented with the fallback taken. `STATUS.md` describes the whole build, layers included. The milestone ends with a hosted copy at `/m10/`, and, since M10 is the last phase of the spec, the programme is closed (decision 9).

Out of scope: content review and the open content questions (spec §13 of `SPEC (2).md`, the user's), new anatomy or content files except where a session finds an error (fixed, noted, `reviewed` untouched), Blender work, new features. The deferred items of the spec's §1 (capsules, fascia, bursae, nasal/laryngeal/auricular cartilage) stay deferred.

## What exists already (from M5 to M9)

- **Labels** (M5, M7): `src/scene/labels.ts` (greedy layout by priority, then size) and `src/ui/Labels.tsx` take candidates from **every layer's solid batch** (M7 decision 14), bones first; bones are skipped when the muscles layer is solid and they aren't kept solid by isolation. Two gaps: the **priority** uses the bones' `relations.visibleAt`, so a soft focus's tier-1/2 structures get no priority (and a bone's soft relations none either); and nothing implements the spec's "at equal size, the focus layer's labels win". Each part of a muscle is its own candidate, so an unselected triceps can get three labels.
- **Colours** (M5, M7, M9): `tests/layerColours.test.ts` checks the layer colours against each other (ΔE2000 ≥ 8, normal, deuteranopia, protanopia) and the three tints against each other, the layers and the focus accent (≥ 8, and ≥ 20 against their neighbours, tritanopia included). Not yet checked: the tendon/aponeurosis shade against the muscle red and the tints; the hover colour; colour-by-region's bone colours against the muscle, ligament and cartilage colours when both are on screen; the legend chips' contrast against the legend's background (WCAG 1.4.11, 3:1); label text over a muscle-coloured scene.
- **Announcements** (M5, M9): one polite live region (`src/ui/Announcer.tsx`). Soft structures get `softAnnouncement` (name, tier, "N structures"); bones get M5's wording; groups, joints, the Tab cursor and toasts go through `announce`. The Layers panel already says the mode ("Muscles: ghost"), the presets and the depth stop (`depthAnnouncement` with `peeledMuscleCount`), and Hide / "Show all" are announced (`src/state/selection.ts`). Not yet: layer loading, loaded and failed; a layer turned on by a selection, a link or Back/Forward rather than the panel; the muscle → part step and Back from a part; antagonists; counts by kind at a tier; "Show attached muscles". M9 left this fuller wording to M10.
- **Keyboard** (M5, M7, M9): `tests/e2e/keyboard.spec.ts` (Tab round the page, a session by keys, the Layers panel by keys), `soft-sidebar.spec.ts` (the new tree roots by keys), axe in every e2e spec that opens a new state. `tabCursor` (`src/camera/input.ts`) walks the visible IDs; not yet checked across layers and at the part level.
- **Measurement tools**: `?bench` with `layers=` (M7), `?debug`'s "low shown N s after turned on" line (M7), `npm run perf-load` (M5, layer timing M7), `check-models` triangle budgets per file (M6), main-chunk measurement by `gzip -9` of every eager script (M9 AJ). The user ran the bench on `/m7/` (all at vsync, no ghost fallback). **Not measured anywhere yet:** a layer's load time on a real device (the container's software GPU makes its figure meaningless), click → highlight for soft structures, draw calls with every layer on *and* a muscle at tier 2 with patches and antagonists, the bundle against M5 (spec: ≤ +150 kB gzipped).
- **`STATUS.md`** describes the build as of M5 (sections 1 to 8). It has nothing on layers, soft-tissue content, nested selection, tiers per kind or the new measurements, and §8 still says `"current": null`.

## Progress

| Session | Serial task (one sentence) | Fan-out step | Inputs | Done when | Status |
| --- | --- | --- | --- | --- | --- |
| (planning) | M9 → M10 handover and this plan (step 0) | none | M9 plan, spec §11 | `m9` frozen, `current` 10, plan written | **Done.** See step 0 |
| AK | Labels for every kind: kind-aware priorities, one label per unselected muscle, focus layer wins ties (step 1) | none | decisions 1–2 | layout tests per kind; e2e labels with muscles on, at muscle tier 1 and at part level | **Done.** See step 1 |
| AL | Colour-vision pass over every colour the layers add, legend chips and label contrast (step 2) | none | decision 3 | one colour test covering every pair that can be on screen together; legend and label contrast tested; any colour change recorded | **Done.** See step 2 |
| AM | Screen-reader announcements for the new kinds, layers, depth, Hide and the part level (step 3) | none | decision 4 | every row of decision 4's table tested as a pure function and in e2e through the live region | **Done.** See step 3 |
| AN | Keyboard pass for the new kinds: the spec's journey by keys only, Tab cursor across layers and parts, axe on every new state (step 4) | none | decision 5 | `keyboard.spec.ts` journey passes; gaps fixed | **Done.** See step 4 |
| AO | Performance measurement in the container and the tools for the user's run; **ends with the user gate** (step 5) | none | decisions 6–7 | budget table filled for everything the container can measure; bench links ready; deploy of `main` for the user's run | Not started |
| AP | The user's PC and iPhone results recorded; each miss fixed or its fallback taken (step 6) | none | the user's numbers | §9 table complete; misses documented | Not started (waits on the user) |
| AQ | `STATUS.md` brought up to date for M6–M10 (step 7) | none | decision 8 | every section true of the build; §6 and §7 tables extended | Not started |
| AR | Wrap-up: full e2e, no-regression, main chunk vs M9 and M5, perf-load, hosted copy, programme close (step 8) | `verifier` × 1 for the full Playwright run | all of the above | exit criteria ticked; `/m10/` live; decision 9 done | Not started |

Triggers: "begin session AK" to "begin session AR". Every session follows `docs/WORKFLOW.md`: read `docs/HANDOFF.md` and this file, do the one serial task, end with `npx tsc --noEmit`, `npx vitest run`, `npm run check` and the e2e specs it touched (the full suite in AR, through `verifier`), then commit, push to the session branch, write `docs/HANDOFF.md` and stop.

No fan-out is planned: every session changes shared code or one shared document, and none has many independent items of the same kind (`docs/WORKFLOW.md` §3). If AQ's `STATUS.md` rewrite turns out too large for one context, it splits into two sessions by section, not into subagents.

**User checkpoints**
- **Decisions 1 to 9 below** fill gaps in the spec. The sessions build them as written unless the user says otherwise.
- **After AO (gate)**: the user runs the bench links and the `?debug` layer timing on PC and iPhone (decision 7) and pastes the results. AP starts only after that.
- **After AR**: a glance at `/m10/`. The content review (QUESTIONS 1–138 and any new ones) stays the user's, any time.

## Exit criteria (from the musculoskeletal spec §11, M10)

- [ ] Labels, legend chips and colours pass the existing colour-vision check.
- [x] Keyboard and screen-reader announcements cover the new kinds, layers and the part level. (Announcements: AM; keyboard: AN.)
- [ ] Performance budgets met (or misses documented with the fallback taken).
- [ ] `STATUS.md` updated (new sections for layers; §6 and §7 tables extended).
- [ ] No regression: with every new layer off, the main chunk grows by at most 5 kB gzipped over M9 (decision 6), no soft-tissue chunk is requested, and the full e2e suite passes.
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Milestone 9 close-out and handover (done in the planning session)

- `/m9/`: #21 merged as `ef6ee75`; Deploy run 24 for that commit succeeded on 2026-11-21. "Hosted copy is live" was already ticked in `docs/PLAN-milestone-9.md`.
- `deploy/pages.json`: `m9` frozen at **`ef6ee75`** (`ef6ee75629dec7b254dd41ef583ecc749cdec739`, the merge of #21, M9's last PR); `current` set to **10**, so the next deploy builds `/m10/` from `main`. `README.md`: M9 row marked frozen, M10 row added as "In progress".
- `CLAUDE.md`: status and the M10 session triggers.
- **Still open, carried over (needs the user, any time):** a glance at `/m9/` (the container can't load `github.io`); QUESTIONS 1–138 (132–134 and `assets/build/REPORT-patches.md` from M9); the per-browser `?bench` table in `docs/PLAN-milestone-5.md` step 12. The muscles layer's real-device load time (M7) is now part of AO's gate.

## Decisions made in this plan (say if any should change)

1. **Label priority per kind** (spec §7 "the existing priority layout covers all visible structures"). `labelPriority` takes the kind-aware tier sets (`relatedAt` in `src/scene/isolation.ts`, filtered by the layers showing, M9 decision 3) instead of the bones-only `relations.visibleAt`, so a muscle's attachments and a bone's attached muscles rank at their tier. Focus = the selected structure; when a muscle is selected, **its parts are not labelled separately** (the muscle's one label, priority 0); when a part is selected, it is the focus and its siblings rank at tier 1. With no muscle selected, **one label per muscle**, placed at the union of its parts' bounding spheres, named by the muscle; a part is labelled on its own only at the part level. Structures in a Ghost layer, peeled by depth or hidden get no label (as now). Group isolation (`grp=`) labels its members at priority 1, as for bones.
2. **"At equal size, the focus layer's labels win"** (spec §7). Two candidates count as equal size when their on-screen radii differ by less than 10 %; between those, the one in the focus's layer is placed first (the focus layer is the selected structure's layer; with nothing selected, the topmost layer that is On, in the order muscles, ligaments, cartilage, bones). Implemented as a stable tie-break in the pure `layoutLabels` sort, tested. The M5 bones-only layout is unchanged when every layer is off (tested by equality with the old sort on the M5 fixtures).
3. **Colour-vision check** ("the existing colour-vision check": ΔE2000 ≥ 8 under deuteranopia and protanopia, as M5 and spec §6.3 define it; M9's tritanopia and ≥ 20 for the tints' neighbours stay). AL builds one table of **every colour that can be on screen at once**: the four layer colours, the tendon/aponeurosis shade, the focus, hover and outline accent, the three tints, colour-by-region's seven bone colours (they can sit beside solid muscles), ghost colours at their opacity over the background, and checks every pair that can actually meet (the test lists which pairs are exempt and why, e.g. two region colours are already tested by M5). Legend chips and swatches: 3:1 against the legend background (WCAG 1.4.11), in light and dark if both exist. Label text: 4.5:1 against its box (already true in M5; re-checked because the box sits over red muscle now). **If a pair fails, the colour changes, not the threshold**; changes are listed in the session notes and `STATUS.md`, and the screenshot/legend e2e tests updated.
4. **Announcement wording** (spec §10 of `SPEC (2).md`: each change of isolation is announced; extended here). All through the existing polite live region, one message per user action, built by pure functions next to `softAnnouncement` and tested. AM writes the final table, keeping the existing panel and Hide wording where it already fits; the starting point:

   | Action | Announcement |
   | --- | --- |
   | Layer set On / Ghost / Off | "Muscles on." / "Muscles ghosted." / "Muscles off." ("… loading." first, then "Muscles loaded." once the low LOD shows; a failed load: "Muscles failed to load. Retry available.") |
   | Preset | "Full musculoskeletal: all layers on." / "Skeleton: bones only." |
   | Depth stop | "Superficial muscles hidden: 41 muscles." (counts from `peeledMuscleCount`, `src/content/softRegistry.ts`) |
   | Hide / Show all | "Biceps brachii, left, hidden. 3 hidden." / "All hidden structures shown." |
   | Muscle → part | "Long head of triceps brachii, left, selected. Part of triceps brachii." |
   | Back from a part | "Triceps brachii, left, selected." |
   | Muscle tier 1 | "Triceps brachii, left: attachments shown, 2 bones and 3 parts." (counts by kind, not one number) |
   | Muscle tier 2 | "Triceps brachii, left: functional group shown, 6 muscles." Antagonists toggled: "Antagonists shown: 4 muscles." / "Antagonists hidden." |
   | Ligament / cartilage tiers | "Anterior cruciate ligament, left: related structures shown, 2 bones." / "…: joint shown, 5 ligaments and 2 menisci." |
   | Show attached muscles | "Femur, left: 23 attached muscles shown." |
   | A bone's tier with soft layers on | M5's wording, plus "and 12 muscles" when soft structures are in the set |

   No new live regions; no announcement on page load (as now). The layer messages come from the store's layer state, not from the panel, so a change from the panel, a preset, a selection that turns a layer on, or Back/Forward says the same.
5. **Keyboard parity** (spec §10 of `SPEC (2).md`, extended to the new kinds). AN scripts the spec's M9 journey **by keys only** in `keyboard.spec.ts` (open Layers, turn muscles on, reach triceps through search or the tree, Enter, its long head, `R` Show attachments, `E` Show functional group, the antagonist toggle, Back ×4) and fixes what can't be done. `tabCursor` walks the solid structures of every layer that is On, in layer order, and at a muscle selection steps into its parts; `X` (Hide) and "Show all" work from the cursor. axe (WCAG 2.2 A/AA, no rules disabled) on every new state: Layers panel open with progress, depth control, soft panels per kind, legend with chips, the soft tree. A real screen-reader pass (VoiceOver on the iPhone) is offered to the user as an optional hand check, not a gate.
6. **Size budget.** Main chunk ≤ **+5 kB gzipped over M9** (`index` + every modulepreloaded chunk, `gzip -9`, M9 AJ's method: M9 = 468.1 kB). The programme limit (spec §9: ≤ +150 kB over M5) is measured once in AR against `71f04d0` the same way. Label and announcement code is small and stays in the main chunk; anything soft-specific (counts by kind, part grouping tables) comes from the lazy chunks already loaded with the layer.
7. **Performance measurement** (spec §9). AO measures in the container what it can and prepares the rest:
   - **Triangles**: sum of every layer's manifest per LOD with every layer on, against 1.5M (high) and 450k (low), and per layer against the split (muscles ~800k/~230k, ligaments + cartilage ~200k/~70k). A Vitest test on the manifests, so it can't regress.
   - **Draw calls**: e2e with every layer On, a muscle at tier 2, antagonists on and patches loaded, plus the hover and `MAX_BOTH_OUTLINES` outlines: < 20.
   - **Click → highlight** for soft structures: the M3 measurement (`?debug` timing from pointer-up to the frame with the outline) extended to a muscle, a part and a ligament; container figure recorded, real-device figure in the gate.
   - **Layer load** ("low LOD visible ≤ 3 s desktop, ≤ 5 s phone on Fast 4G"): the container can't measure it (M7, M9: SwiftShader's native time dominates), so the real figure comes from the user's `?debug` line in the gate; AO records the network-only part (file size ÷ Fast 4G) as the floor.
   - **FPS**: the M7 bench links plus a third, **muscles at tier 2 with antagonists** (`?bench&layers=b:on,c:on,l:on,m:on&sel=triceps_brachii_left&tier=2&ant=1`), on PC and iPhone.
   - **Fallbacks, decided now so AP doesn't have to:** layer load over budget → prefetch the layer's low file when the Layers panel opens (and on idle after the skeleton's high LOD, phone excluded on Save-Data); FPS below budget with ghosts → the spec's §8 ghost fallback (depth pre-pass, then lower opacity, then Ghost disabled for muscles on low-LOD devices with a note in Settings); click → highlight over budget → profile and fix; triangles over budget → a lower decimation ratio for that layer's LOD in the soft build (a Blender run, so its own session, and only if the miss is real).
   - **The gate** (end of AO): AO's branch goes to `main` through a PR so `/m10/` (the live `current`) has the build to measure; the user opens the three bench links and `?debug&layers=b:on,c:on,l:on,m:on` on PC and iPhone and pastes the overlays. AP records them in this plan and `STATUS.md` §6.
8. **`STATUS.md` scope** (spec: "new sections for layers; §6 and §7 tables extended"). Keep the existing structure and add: §1 the new folders; §2 the soft-tissue source and pipeline (M6); §3 layers, batches, ghosts, depth, patches and draw calls; §4 the new content kinds, each with one real example and its schema (as §4 does for bones), `movements.json`, `joints.json`, the hierarchy and depth files, synonyms' `groups`; §5 nested selection and tiers per kind; §6 every measurement from M6 to M10 (bench, perf-load, chunk sizes, the gate's results); §7 every place the build departs from the musculoskeletal spec (e.g. related sets follow the layers showing; patches drawn only where the content agrees; synergist wins over antagonist; tint thresholds; group synonym sets); §8 loose ends brought up to date (the `"current"` note, the patch disagreements, QUESTIONS count, untested browsers). AQ reads the plans of M6–M10 and the code; it doesn't re-measure.
9. **Closing the programme.** M10 is the spec's last phase. After AR's PR merges and `/m10/` is confirmed, a last small commit (in AR, or the next session if AR runs out of context) freezes `m10` at that merge's full SHA and sets `"current": null` in `deploy/pages.json` (the documented "no milestone in progress" state in `scripts/build-pages.sh`), through one more PR, so `/m10/` stays fixed while the live site keeps following `main`. `CLAUDE.md`'s status and `docs/HANDOFF.md` then point at the open items (content review, browser table) rather than a next milestone.

## Risks found while planning

1. **Label cost with every layer on.** Up to ~1,100 solid instances become candidates instead of 234; M5's layout took 2.4 ms median at 4× CPU. Grouping parts into muscles (decision 1) cuts the count; AK measures with `?bench` (label layout times are already reported) and, if needed, drops candidates under the size threshold before projecting.
2. **Colour changes ripple.** A changed layer or tint colour touches screenshots, legend tests and the M9 tint tests. AL changes colours only for real failures and updates those tests in the same commit.
3. **Live-region chatter.** Layer loading, depth and selection can fire in one action (e.g. selecting a muscle turns its layer on). Decision 4's rule "one message per user action" means the selection message wins and the layer message is folded in ("… Muscles on."). AM tests the combined cases.
4. **The gate needs a deploy of unfinished M10.** `/m10/` will show AK–AO's state during the gate; that's intended (it is the live `current`). If the user prefers not to deploy mid-milestone, AO instead gives a `?bench` checklist to run on `/m9/` (same layers, no M10 changes) and AP measures only what M10 changed.
5. **Real-device layer load may miss.** The muscles high file is large; the low file is the one in the budget. The fallback (decision 7) is prefetching, which costs phone data; it stays off on Save-Data and is recorded in `STATUS.md` §7.

## Step 1: Labels (session AK)
- `labelPriority` with kind-aware tiers; muscle grouping of parts (union spheres per muscle from the soft table's `parts`); focus-layer tie-break in `layoutLabels`; label layout time with every layer on.
- Tests: `tests/labels.test.ts` (tie-break, grouping, priorities per kind, M5 equality with layers off); e2e in `polish.spec.ts` or a new `labels-layers.spec.ts`: muscles on → one triceps label; triceps tier 1 → scapula and ulna labelled; part level → the long head labelled, the triceps not.

**Session AK notes (done).**
- `src/scene/labels.ts`: `labelOrder` (M5's sort, then the focus-layer tie-break: the sorted list is cut into runs of one priority whose radii are within `EQUAL_SIZE` = 10 % of the run's largest, and inside a run the focus layer goes first; runs are cut from the sorted list so the order is deterministic, which a 10 % comparator inside `sort` wouldn't be); `labelKey` (a part labels as its muscle, except the selected part's muscle at the part level); `focusLayerOf` (the selection's layer, else the topmost layer On). `layoutLabels` takes `focusLayer`; candidates carry `layer`.
- `src/ui/Labels.tsx`: tier sets from `relatedAt(sel, tier, st.layers)` instead of `relations.visibleAt`; parts grouped per muscle into one candidate at the union of their world bounding spheres (`Sphere.union`), named by the muscle, with the best priority of the muscle and its parts; at the part level the muscle's parts are separate and the siblings are added to tier 1. Re-lays out when the soft tier sets arrive (`subscribeSoftTiers`). Before this, a selected muscle with parts had **no** focus label (the focus ID has no mesh), and a soft focus's related structures had no priority.
- Group isolation (`grp=`) left as M5: every drawn structure is a member, so priority 1 for all members orders exactly as priority 3 for all with the isolated size threshold of 0; no change made.
- M5 equality: tested on seven 234-candidate fixtures (`labelOrder` = the old sort; `layoutLabels` with `focusLayer: "bones"` equals the old layout), and the M5 label e2e tests (`polish.spec.ts`) pass unchanged.
- **Label layout cost with every layer on** (`?bench&layers=b:on,c:on,l:on,m:on`, labels on, 4× CPU, SwiftShader, `tests/e2e/labels-layers.spec.ts`): full view **median 7.6 ms, max 27.8 ms** (13 layouts); triceps at tier 2 **median 2.7 ms, max 3.3 ms** (11). M5 bones only: 2.4 / 12 ms. Under the 16 ms median bar; layouts run at most every 100 ms while moving, so no candidate pre-filter was added (risk 1). The phone figure comes with AO's gate.
- Main chunk: **468.4 kB** (`gzip -9`, `index` + modulepreloads), +0.3 kB over M9 (budget +5).

## Step 2: Colours (session AL)
- The full colour table and pair rules (decision 3); legend chip contrast; label box contrast over muscle.
- Tests: `tests/layerColours.test.ts` extended (or `tests/colourVision.test.ts`), legend e2e with axe's colour-contrast rule on the chips.

**Session AL notes (done).**
- **One table, one test:** `tests/colourVision.test.ts` replaces `tests/layerColours.test.ts`. The table: bone ivory (also the teeth), the four layer colours and the tendon shade, the accent, selection outline and hover outline, the three tints, the seven region colours, the scene background (now `SCENE_BACKGROUND` in `src/scene/material.ts`) and twelve ghost colours (bone and the three layers at the lowest, default and highest ghost opacity, composited over the background). 300+ pairs checked at ΔE2000 ≥ 8 under normal vision, deuteranopia and protanopia, ≥ 20 for M9's nine neighbour pairs. `EXEMPT` lists the pairs that never meet or are tested elsewhere, each with its reason (two regions and region/teeth: M5; region/tint: never on screen together, see below; accent/bone and accent/regions: the outline carries the selection, M3; accent/outline: drawn together on purpose; hover/accent and hover/outline: never on one structure; ghost/ghost and ghost/background: ghosts are faint context, named in the Layers panel; accent/ghost and accent/background: outlined). A guard test fails if a solid colour's pair with another solid, a tint or a region, or any pair with the selection outline, is ever exempted.
- **Legend and labels:** every swatch the legend can show (bone, three layers, three tints, seven regions) ≥ 3:1 against the legend background composited over the scene (read from `styles.css`, so the test follows the stylesheet); legend text and the new note ≥ 4.5:1; label text ≥ 4.5:1 against both label boxes (plain and focus) composited over every solid, tint, region, the accent, the hover colour, the background and pure white. Only dark styles exist, so no light-theme variant. Label boxes already passed everywhere (worst case over white).
- **Failures found and fixed by changing the colour (decision 3), each by the smallest step (ΔE2000 from the old colour) that passes every pair:**

  | Colour | Was | Now | Why |
  | --- | --- | --- | --- |
  | Muscles | `#a8483f` | `#b44d43` | legend swatch 2.75:1 against the legend (needs 3:1) |
  | Tendon / aponeurosis | `#c98a7c` | `#c18274` | 6.1 from the thorax region colour under protanopia (intercostal and rib attachments sit on it) |
  | Ligaments | `#d9dde3` | `#cccccc` | 5.4 from the hover outline `#f1f3f4` (all three visions) |
  | Cartilage | `#a9bccb` | `#c5dfee` | 4.5 from the pectoral girdle's region colour under deuteranopia (glenoid labrum, AC and SC discs); then 7.8 from the antagonist tint over a 50 % cartilage ghost (protanopia), fixed by the same change |

- **Region colours vs the tints:** origin yellow on an upper-limb bone's region yellow was ΔE 3.4 (a patch on the humerus), antagonist purple beside the pectoral girdle 5.8, insertion blue on a lower-limb bone 10.7 (under the ≥ 20 aim). Both palettes are Okabe–Ito, so no recolouring could separate seven regions from three tints under CVD. Instead **colour-by-region pauses while any tint or patch is drawn** (`drawnColourMode` in `src/scene/isolation.ts`, used by `Isolation.tsx`): the bones go back to ivory, the legend replaces the region buttons with "Region colours paused while origins, insertions or antagonists are shown." (`legend-paused`), the toggle stays pressed and the regions come back when the tints go. `?debug`'s `data-colour` reports the colour drawn. Unit test in `colourVision.test.ts`, e2e in `tints.spec.ts`.
- **Correction to this plan:** the "tritanopia included" in the colours summary above (and "M9's tritanopia" in decision 3) was wrong: M9's test, like M5's, checked normal vision, deuteranopia and protanopia only (`CVD_MATRICES` has no tritanopia). AL kept the spec's rule (§6.3: deuteranopia and protanopia) and added no tritanopia check (QUESTIONS 139).
- Not in the table: `?debug&layers=all`'s debug colours (`DEBUG_LAYER_COLOURS`, a debug tool, M6).
- Screenshot test (`polish.spec.ts`) checks pixels by brightness, not by layer colour, so it needed no change; the legend chip tests (`tints.spec.ts`, `interaction.spec.ts`) check names. `STATUS.md` gets the colour changes in AQ.
- Tests: `npx vitest run` 532 pass; `npm run check` passes; e2e `tints` (5, one new), `polish`, `interaction`, `a11y`, `layers`, `labels-layers` (51 tests) pass.
- Main chunk: **468.5 kB** (`gzip -9`, `index` + modulepreloads), +0.4 kB over M9 (budget +5).

## Step 3: Announcements (session AM)
- Pure wording functions (decision 4), wired to the store's layer, depth, hidden, selection and antagonist changes; folded messages for combined actions.
- Tests: Vitest per row of the table; e2e reading the live region for each action, including a selection that turns a layer on.

### Session AM notes (2026-11-24)
- **One composer, from the store.** `src/ui/Announcer.tsx` subscribes to the store, collects every change made in one task (a selection that turns its layer on is two `set`s) and, in a microtask, hands the before/after snapshot to the pure `composeAnnouncement` (`src/content/announce.ts`). Order in the one message: an explicit `say` (Hide, the Tab cursor, toasts) **or** the isolation change, then antagonists, then layers, then depth, then the layers' files. The Layers panel and `LayerScenes` no longer call `say`: the panel, a preset, a selection, a soft group, "Show attached muscles" and Back/Forward all say the same. Joint highlighting keeps its own effect (it never comes with an isolation change).
- **No announcement on page load** (as before): the composer starts from the state `initSelectionFromUrl` set, and "X loaded." is said only for a layer the user turned on since (`awaiting`), so `?layers=m:on&sel=…` is silent. A failed load is always said.
- **The final table** (all pure functions in `src/content/announce.ts`, tested in `tests/announce.test.ts`; e2e `tests/e2e/announce.spec.ts` records every text the live region is given):

  | Action | Announcement |
  | --- | --- |
  | Layer set On / Ghost / Off | "Muscles on." / "Muscles ghosted." / "Muscles off."; the first time: "Muscles on, loading.", then "Muscles loaded." once the low LOD shows; "Muscles failed to load. Retry available."; Retry: "Muscles loading again." |
  | Several layers at once | a preset: "Full musculoskeletal: all layers on." (+ " Loading cartilage and muscles." for the ones still to come) / "Skeleton: bones only."; otherwise each change in panel order ("Bones ghosted. Muscles on.") |
  | Depth stop | "Superficial muscles hidden: 41 muscles." / "Superficial and intermediate muscles hidden, deep muscles only: 150 muscles." / "All muscles shown." (the Full preset's reset of the depth is not said separately) |
  | Hide / Show all | "Biceps brachii, left, hidden. 3 hidden." / "All hidden structures shown." |
  | Muscle → part | "Long head of triceps brachii, left, selected. Part of triceps brachii." (any part selected at tier 0) |
  | Back from a part | "Triceps brachii, left, selected."; back from a higher tier, as for bones: "Triceps brachii, left, isolated." |
  | Muscle tier 1 | "Triceps brachii, left: attachments shown, 2 bones and 3 parts." |
  | Muscle tier 2 | "Triceps brachii, left: functional group shown, 6 muscles." |
  | Antagonists | "Antagonists shown: 4 muscles." / "Antagonists hidden." / "Antagonists shown: none in the layers showing." |
  | Ligament / cartilage tiers | "Anterior cruciate ligament, left: related structures shown, 2 bones." / "…: joint shown, 4 bones, 5 ligaments and 2 menisci." |
  | Show attached muscles | "Femur, left: attached muscles shown, 20 muscles and 5 parts." (loading: "Femur, left: attached muscles loading."; none: "…: no muscles attach here."; from a member: "Back to Femur, left: …") |
  | A bone's tier with soft layers on | tier 1: M5's wording + " Also 23 muscles and 4 ligaments."; tier 2: "Femur, left: region shown, 8 bones and 40 muscles." |
  | A selection that turns a layer on | the selection, then the layer: "Triceps brachii, left, selected. Isolated. Muscles on, loading." (risk 3) |

- **Counting by kind** (`countByKind`): bones and teeth are "bones"; a soft structure counts as its kind (muscle, part, ligament, cartilage, disc, meniscus: "cartilages", "menisci"). Parts count as **parts only for the focus's own muscle** (a muscle's heads, a part's siblings); any other part counts once, as its muscle, so a functional group is "6 muscles", not their heads. The focus itself is not counted at a soft tier; a bone's own mesh is (M5's "8 bones" includes it).
- **Departures from the starting table:** the tier counts are by kind for every soft kind (not "N structures", M9's wording); a part's message names its muscle whenever a part is selected, not only from its muscle; the attached-muscles group is worded like a tier ("…: attached muscles shown, …") with parts counted apart, instead of "23 attached muscles"; Hide's name is spoken ("Femur, left, hidden.") rather than displayed ("Femur (left) hidden.").
- **Page-load hush:** a soft `sel=` or `grp=` in the link is applied after its table loads, so it used to be announced ("Triceps brachii, left, selected. Isolated."). `selectSoftFromUrl` and `softGroupFromUrl` now call the store's `hush()` before their changes; the composer says nothing for a hushed batch and doesn't await its layer's "loaded".
- Main chunk: **470.0 kB** (`gzip -9`, `index` + modulepreloads), +1.9 kB over M9 (budget +5). The wording moved out of `LayersPanel`, `selection.ts` and `LayerScenes` into `announce.ts`, which stays in the main chunk (decision 6: announcement code is small); the counts use the soft table and tiers already registered by the lazy chunks.
- **Bug fixed on the way:** going from a bone to its own "Show attached muscles" said "Back to …", because the bone is a member of its group. The bone no longer counts as a member stepped back from.

## Step 4: Keyboard (session AN)
- The journey by keys; `tabCursor` across layers and parts; axe on every new state; fixes.
- Tests: `tests/e2e/keyboard.spec.ts` (+ the journey), `tests/input.test.ts` (`tabCursor`).

### Session AN notes (2026-11-24)
- **Gaps found and fixed:**
  - **No keys for the tiers.** The journey's `R` and `E` didn't exist. Added to `keyAction` (`src/camera/input.ts`): `R` = tier 1 (Show related / Show attachments), `E` = tier 2 (Expand region / Show functional group), each only from the tier below and only when the panel's button would allow it (`showRelated` / `expandRegion`, so "Loading content…" and "Not part of a joint" still block). The panel buttons carry `aria-keyshortcuts`.
  - **"Show all" had no key.** `Shift+X` now does what the chip does (the chip carries `aria-keyshortcuts="Shift+X"`).
  - **`X` ignored the Tab cursor.** It hid only the selection. Now `X` hides the cursor's structure when there is one (`hideStructure` in `src/state/selection.ts`: one history entry, Back un-hides; the selection is kept unless it is the structure hidden), and the next Tab goes on to the stop after it.
  - **The cursor stepped through every muscle part,** and Enter on a part then selected its muscle, so what was read ("Long head of triceps brachii") wasn't what Enter chose. Now `cursorStops` (pure, `input.ts`) makes a muscle one stop (spoken and selected as the muscle, the first solid part outlined, framed by the union of its parts) until that muscle or one of its parts is selected; then its parts are stops (the part level).
  - **Layer order.** The soft stops came in table order across layers; now in the panel's order (bones, cartilage, ligaments, muscles), table order within a layer.
  - The canvas description names the new keys; leaving the view says "Left the 3D view." (was "Left the bones.").
- **The journey** (`keyboard.spec.ts`, "M10: the M9 journey by keys only"): Layers by Tab and arrows, muscles On, triceps by `/` search, Tab cursor through its heads to the long head, Enter, `R`, `E`, the antagonist toggle by Tab and Enter, Back ×4 by Escape. A second test walks the cursor across layers, hides a bone and a muscle by `X` from the cursor and shows them by `Shift+X`.
- **axe** on the new states not yet covered (`a11y.spec.ts`, "M10 session AN"): the Layers panel while the muscles load (progress) and with the depth control in use, a muscle at tier 2 with antagonists (legend with tint chips), a meniscus's panel. Already covered before: muscle, part and ligament panels and the attached group (`attached.spec.ts`), the soft tree and soft search (`soft-sidebar.spec.ts`), the hidden chip.
- **Not done (offered to the user):** a real VoiceOver pass on the iPhone, as an optional hand check.
- Tests: Vitest 561 pass (`cursorStops`, the new keys); `npm run check` passes; e2e `keyboard` (5, two new) and `a11y` (two new tests) pass, and `joints`, `layers`, `select`, `sidebar`, `soft-sidebar`, `viewer`, `announce` were re-run for the cursor and `X` changes. The journey test takes about 4 minutes (muscles under SwiftShader), so its limit is 7.
- Main chunk: **470.4 kB** (`gzip -9`), +2.3 kB over M9 (budget +5).
- AM's e2e run (12 specs, 81 tests) passed after the session closed.

## Step 5: Measurement and the gate (session AO)
- Triangle budget test on the manifests; draw-call e2e at muscle tier 2 with everything on; click → highlight timing for soft structures; the third bench link; container figures; PR to `main`, deploy, the user's checklist.

## Step 6: The user's results (session AP)
- Fill the table below; take each decided fallback for a real miss (decision 7); re-measure what changed.

### Budget table (spec §9; filled in AO and AP)

| Metric | Budget desktop / phone | Container | PC | iPhone | Met? |
| --- | --- | --- | --- | --- | --- |
| Triangles, all layers on (high / low) | ≤ 1.5M / ≤ 450k | | | | |
| — muscles | ~800k / ~230k | | | | |
| — ligaments + cartilage | ~200k / ~70k | | | | |
| Layer low LOD visible after turning on | ≤ 3 s / ≤ 5 s | | | | |
| FPS orbiting, all layers solid | 60 / ≥ 30 | | | | |
| FPS orbiting, muscles ghosted over bones | ≥ 45 / ≥ 30 | | | | |
| FPS orbiting, muscle tier 2 with antagonists | 60 / ≥ 30 | | | | |
| Click → highlight (muscle, part, ligament) | < 50 ms / < 100 ms | | | | |
| Draw calls, everything on + muscle tier 2 | < 20 | | | | |
| JS growth over M5 (gzipped) | ≤ 150 kB | | | | |

## Step 7: `STATUS.md` (session AQ)
- Decision 8.

## Step 8: Wrap-up (session AR)
- Full e2e through `verifier`; main chunk vs M9 (decision 6) and vs M5 (spec §9); `perf-load` vs M9; `git diff public/models/` empty; PR to `main`, merge, deploy, confirm `/m10/`, README row; decision 9.

## Hosted copy

Not yet: `/m10/` is built from `main` once M10's work is merged.
