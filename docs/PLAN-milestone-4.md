# Milestone 4 Plan: Related Isolation and Content (Spec Phase 4)

Source of truth: `SPEC (2).md`, sections 5 (data model: content files, `articulations.json`, `regions.json`, `hierarchy.json`), 6 (Isolation, the femur worked example, Teeth), 7 (info panel sections), 9 (validation), 10 (announcements) and 11 (Phase 4). Ground rules from §12 apply throughout, above all: **no invented articulations, landmark coordinates or TA2 IDs**. Anything uncertain goes in `content/QUESTIONS.md`.

## Goal

Give every object its real relationships and its text. "Show related" (tier 1) adds the bones it articulates with; "Expand region" (tier 2) adds a curated region set; double-clicking a related bone makes it the new focus. Hovering a joint name in the panel highlights both bones, and an Explode slider briefly pushes the tier-1 bones apart. All 238 content files are drafted from standard anatomical references (`reviewed: false`), compiled at build time and shown in the info panel, and `validate-content` guards the data in CI and before every build. The milestone ends with a hosted copy at `/m4/`.

Out of scope until Milestone 5: the sidebar (search and hierarchy tree, including isolating a whole tooth type from the tree), floating labels and pinned landmark labels, colour-by-region, screenshots, share link, Tab through visible objects, the axe-core pass. `hierarchy.json` is written and validated now, because Phase 4 requires it complete; the tree that shows it arrives with the sidebar.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| (planning) | 0 (Milestone 3 handover) | **Done.** See step 0 |
| J | 1 (content schema and `validate-content`), 2 (relationship data: articulations, regions, hierarchy), 3 (tiers 1 and 2) | **Done.** See "Session J notes" below. Needs the user: `content/QUESTIONS.md` (articulation and region choices), and tiers 1 and 2 on a device |
| K | 4 (content compile and real info panel), 5 (content drafting, part 1: axial skeleton and teeth) | **Done.** See "Session K notes" below. Needs the user: `content/QUESTIONS.md` 26 to 31 (text), and the real panel on a phone |
| L | 6 (content drafting, part 2: appendicular skeleton), 7 (joint highlighting), 8 (Explode), 9 (performance check), 10 (tests), 11 (hosted copy) | **Steps 6, 7, 8 and 10 done.** See "Session L notes" below. Needs the user: step 9 (bench at tier 2 on the PC and the iPhone), step 11 (merge the PR, then confirm `/m4/`), `content/QUESTIONS.md` 32 to 36 |

Triggers: "begin session J", "begin session K" and "begin session L". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models`, `npm run validate-content` (from session J on) and `npm run e2e` passing, then a commit and push to the session branch. No Blender work is planned, so `scripts/setup-blender.sh` is only needed if the models have to be rebuilt (or a landmark position is ever derived from the mesh, which this plan doesn't do).

## Exit criteria (from spec §11, Phase 4)

- [x] `articulations.json`, `regions.json` and `hierarchy.json` are complete. (Session J: 357 articulations, 238 region sets, the hierarchy; the open choices are in `content/QUESTIONS.md`.)
- [x] Tiers 1 and 2, joint highlighting and the Explode slider work. (Tiers in session J; joints and Explode in session L. Still worth a look on a device.)
- [x] All 238 content files are drafted from standard anatomical references, with `reviewed: false`. (Session K: 112 axial and teeth files; session L: 126 appendicular files.)
- [x] `validate-content` passes, and runs in CI and before `build`. (Session L: without `--allow-missing-content`, 238 of 238 files.)
- [ ] Click → highlight and draw calls stay within spec §8 at tiers 1 and 2, and with Explode in use. (Session L, step 9.)
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Milestone 3 handover (done in the planning session)

- `deploy/pages.json`: `m3` frozen at `d377478570af818960c63a0ecea115a45c3fb45c` (merge of PR #8, Milestone 3's closeout), `current` is 4.
- `/m3/` was confirmed live by the user on 2026-11-19; "Hosted copy is live" was already ticked in `docs/PLAN-milestone-3.md`. `README.md`: Milestone 3 row marked frozen, Milestone 4 row added as "In progress".
- `docs/BACKLOG.md` has no open entries to pull in.
- **Carried over from Milestone 3 (needs the user, any time):** orbit feel after panning and zooming; the two-to-one-finger touch handover (no jump when one finger lifts); the info panel on a desktop and the bottom sheet on the iPhone, and the pale-blue selected bone with the stronger blue outline.

## Decisions made in this plan (say if any should change)

These fill gaps the spec leaves open. Each is the smallest choice that fits the spec; the sessions build them as written unless the user says otherwise.

1. **Wisdom teeth and validation.** Spec §9 says "every mesh ID has a content file, and every content file has a mesh" and "exactly 238 objects". With 234 meshes, the rule becomes: 238 content files, one per ID in `content/ids.json`; every mesh in the `.glb` has a file; a file without a mesh is allowed only for an ID with `meshAvailable: false` (the four wisdom teeth). The wisdom teeth get full content files and their articulations (gomphosis), so the panel works for them as it does now.
2. **Paired objects share text by generation, not by a base file.** Authors write the left-side file (and the midline ones): 34 midline bones + 86 left bones + 16 left teeth = **136 written files**. `npm run content:mirror` writes the 102 right-side files from them, swapping `id`, `side`, side words and side IDs in lists. Each generated file starts with a comment saying so. `validate-content` fails if a right-side file differs from what the mirror would write, so they can't drift. This keeps spec §9's "one file per ID" literal, and a non-developer edits one file and runs one command.
3. **Tier 1 for teeth** = the tooth's articulation (its alveolar bone, a gomphosis, recorded in `articulations.json` as the spec asks) **plus the adjacent teeth in the same arch** (including across the midline: 11 ↔ 21, 31 ↔ 41). Adjacent teeth are not an articulation, so they aren't in `articulations.json`; they are derived from FDI numbers in code (`src/content/relations.ts`) and tested. Tier 2 for a tooth (in `regions.json`): the whole skull plus both dental arches, as spec §6 says.
4. **Which maxilla a tooth sits in:** teeth in quadrant 1 → `maxilla_right`, quadrant 2 → `maxilla_left`, quadrants 3 and 4 → `mandible`. Central incisors sit in their own side's maxilla.
5. **Tier 1 = the union of the focus's articulation partners** (looked up from either side of each pair). **Tier 2 = tier 1 ∪ `regions[id]`.** `regions.json` lists only the bones added on top of tier 1 (spec §5); `validate-content` warns (doesn't fail) if a region entry repeats a tier-1 bone.
6. **Clicking a related bone at tier 1 or 2:** a single click and a double-click both make it the new focus at tier 0 (a new history entry, as the reducer already does); the double-click also centres it. The spec names the double-click; letting the single click do the same keeps one rule everywhere (a click on a solid bone selects it). Clicking a ghost, or empty space, steps back one level, as now.
7. **Show related / Expand region don't move the camera** (selection never jerks the view). The pivot stays on the focus bone. `F` frames the whole solid set at tiers 1 and 2 (beside the panel, as now).
8. **The side toggle keeps the tier** (the M3 notes flagged this): toggling femur left at tier 2 gives femur right at tier 2, replacing the entry. The reducer gets a `switchSide` action for it.
9. **Joint highlighting without landmark positions:** no `surfaces` landmark has a position in this milestone, so hovering (or focusing) a joint name highlights **both bones**, as spec §6 allows: the hover outline on the partner bone and a brief brighter tint on both. No landmark positions are derived from the mesh in this milestone; every `position` stays `null`, and the landmarks toggle stays disabled with "No positions yet".
10. **Explode axis:** there is no joint-axis data, so each tier-1 bone moves along the line from the focus bone's box centre to its own box centre (the focus stays still). At the slider's end each moves by its own bounding radius × 0.5, eased; on release it eases back to exactly zero. It only changes the solid batch's instance matrices for those bones, and only while the slider is held: the debug bounds check must pass again after release (the bones are restored to the stored matrices, not recomputed). Picking is off while exploded. Available at tiers 1 and 2; tier-2-only bones don't move. *This is the one place a bone moves at all; spec §6 asks for it explicitly and it snaps back, so it doesn't break §12's rule. If the user would rather leave Explode out, say so.*
11. **Content sources:** drafted from standard references (Gray's Anatomy, Terminologia Anatomica's Latin terms) from Claude's own knowledge; the container can't browse the references, so nothing is checked against them line by line. That is why every file is `reviewed: false` and the panel says so. `ta2` stays `null` everywhere (no reference to hand, spec §5).

## Session J notes (steps 1 to 3, done)

- **Relationship data** (drafted with a one-off script, then committed as data; the JSON files are the record and are edited by hand from now on):
  - `content/articulations.json`: **357 pairs**, one entry per pair, `{ a, b, joint, name }`, no `surfaces` yet (no landmark files exist; validation checks them once they do). Skull sutures and the TMJ (by each bone's standard list of neighbours), ossicles (incudomallear, incudostapedial, and the stapes to the temporal bone as the tympanostapedial syndesmosis), the vertebral column (atlanto-occipital, atlanto-axial, one "intervertebral joints" pair per level, lumbosacral, sacrococcygeal), ribs (head with T(n−1) and T(n) for ribs 2 to 9, one vertebra for ribs 1, 10, 11, 12; ribs 1 to 7 with the sternum "through costal cartilage"), sternoclavicular, the upper and lower limbs bone by bone (carpals, CMC, intermetacarpal 2–5, MCP, IP; tarsals, TMT, intermetatarsal 2–5, MTP, IP), sacroiliac, pubic symphysis, and every tooth's gomphosis with its alveolar bone (decision 4). Every object appears except the hyoid (allowlisted). The femur gives exactly the spec's worked example.
  - `content/regions.json`: **238 sets**, rule-based first drafts (spec: "curated"), the femur exactly as the spec. The rules are listed in `content/QUESTIONS.md` 17 to 25 for the user to check.
  - `content/hierarchy.json`: written by `npm run content:hierarchy` from `ids.json`'s groups; limbs split into left and right. Labels from `src/content/labels.ts`.
  - `content/QUESTIONS.md` (new): 9 pairs left out (cuboid–navicular, MT1–MT2, MC1–MC2, sphenoid–maxilla, rib 10–T9, ulna–triquetrum, interchondral, clavicle–rib 1, hyoid), 7 recorded but worth checking (sternocostal rule, stapes, lunate–hamate, lateral cuneiform–MT4, spheno-occipital, descriptive joint names, combined pairs), and the region rules.
- **Schema and validation:** `src/content/schema.ts` (zod 4: front matter, articulations, regions, hierarchy, the 40 to 80 word rule), `src/content/validate.ts` (pure rules, every problem listed at once), `scripts/validate-content.ts` (`npm run validate-content`, in `npm run check` and `prebuild`; reads the model node names straight from the `.glb` JSON chunk). `--allow-missing-content` is on in the npm script until session L. Warnings (not failures) for a region entry that repeats a tier-1 bone, and for an allowlisted object that has an articulation.
- **Mirror:** `src/content/frontmatter.ts` (split, side-word swap, `mirrorFile`) and `npm run content:mirror` (writes `<id>_right.md` and teeth in quadrants 1 and 4 from their left twins, with a "Generated from …" comment as the first front-matter line). Validation fails if a right-side file differs from the mirror of its left file, or has no left file.
- **Relations:** `src/content/relations.ts`: `articulationsOf`, `tier1` (partners from either side plus `adjacentTeeth`, in `ids.json` order), `regionOf`, `visibleAt(id, tier)`.
- **Tiers in the app:**
  - Reducer: `select` of the current focus is a no-op at any tier (it used to drop a tier-1 view to tier 0); new `switchSide` (replace, keeps the tier). `selection.ts`: `showRelated`, `expandRegion`, `switchSide`.
  - `isolationView` uses `relations.visibleAt`, filtered to objects with a mesh. A wisdom tooth at tier 0 still isolates nothing; at tiers 1 and 2 it shows its related bones with no focus (and no outline).
  - Panel: Show related enabled at tier 0, Expand region at tier 1 (disabled otherwise, with a title saying why); the side toggle keeps the tier. Toolbar: one "Related" / "Region" button for the next tier, shown with a selection (also for a wisdom tooth). Breadcrumb ends with "› Related" or "› Region".
  - Announcer: "Femur, left: related bones shown. Hip bone, patella, tibia.", "Femur, left: region shown, 8 bones.", and "Femur, left, isolated." on stepping back to tier 0. Names in the list drop the side when it matches the focus's.
  - Camera: Show related and Expand region don't move it; `F`, and opening a link with `sel` (any tier) and no `cam`, frame the whole solid set beside the panel.
  - Clicks: a related (solid) bone selects it as the new focus at tier 0 (pushed); a ghost or empty space steps back one level; double-click also centres.
- **Tests:** Vitest 228 (new `tests/content.test.ts`: every validation rule on fixtures, mirror, word count; new `tests/relations.test.ts`: the femur example, spot checks per region, teeth, symmetry, left/right mirror of tier 1 and regions; tier views in `tests/scene-isolation.test.ts`; `switchSide` and same-focus cases in `tests/isolation.test.ts`; tier announcements). Playwright 64 (new `tests/e2e/related.spec.ts`: femur → Show related → Expand region → Back ×3 with solid counts, announcer, breadcrumb, draw calls and the bounds check; a `tier=2` link stepped back by Esc; clicking a related bone; side toggle at tier 2 without a new history entry; `F` at tier 1; a tooth's tiers (4 and 50 solid) and a wisdom tooth at tier 1). The panel test now expects Show related enabled.
- **Not done here:** `marked` is installed with the content compiler in session K (step 4), not now.
- **Needs the user:**
  - Work through `content/QUESTIONS.md` (or say who will). Nothing there blocks the next session.
  - Try tiers 1 and 2 on the live site once this is merged: do the region sets feel like the right "regions"?

## Session K notes (steps 4 and 5, done)

- **Compiler:** `src/content/compile.ts` (pure: front matter through the zod schema, body through `marked`, one entry per ID with the Latin and common names, region, type, functions, landmark names and how many have positions, muscles, clinical note, summary HTML, `reviewed`). **Changed from the plan:** instead of writing a git-ignored `src/content/generated/content.json`, a small Vite plugin (`scripts/lib/content-plugin.ts`) serves the compiled object as the virtual module `virtual:skeleton-content`. Nothing generated sits on disk to go stale, `dev` recompiles on every content edit (full reload), and `tsc` needs only a declaration (`src/content/virtual.d.ts`). `npm run content` (`scripts/build-content.ts`, also in `prebuild` after `validate-content`) compiles the same way and prints the size; `--out <file>` writes the JSON for inspection.
- **Lazy loading:** `src/content/loader.ts` imports the module dynamically, so Vite puts it in its own chunk. The viewer starts the load as soon as the first LOD is on screen; the panel also starts it if it opens first. Until it arrives, the panel shows the placeholder text. **Size:** 112 files are 112 KB raw, **16 KB gzipped**; all 238 should be about 35 KB gzipped, well under the plan's 100 to 150 KB guess.
- **Panel model:** `src/content/panel.ts` builds on `placeholder.ts` (which keeps the names, trail, pair and announcements). Objects without a file still say "Not written yet" section by section (the appendicular skeleton until session L), but every object now lists its real articulations from `articulations.json`.
- **Panel (spec §7 order):** English name with the Latin name underneath (`lang="la"`); the common name line (hidden when a written file has none); side toggle; badges: region (from the file's `region`), "Flat bone" / "Irregular bone" / … or "Tooth type: molar", and the draft note; Summary (HTML); Functions (list); Articulations, each a button showing the partner ("Rib 1 (left)", the side only when it differs from the focus's) and the joint's name; for teeth a "Neighbouring teeth" list under it; "No bony articulation." for the hyoid; Key landmarks (names; the toggle disabled with "(no positions yet)", decision 9); Major muscle attachments ("None (teeth have no muscle attachments)." for teeth); Clinical note; the three buttons. Clicking an articulation or neighbour selects it (a new focus at tier 0; replace at tier 0, push from tier 1 or 2, as the reducer already does) and moves keyboard focus to the panel title. Hovering a joint (step 7) is session L.
- **Content (step 5):** 73 written files (the skull, ossicles and hyoid; C1 to L5, sacrum and coccyx; sternum and ribs 1 to 12 on the left; the 16 left-side teeth) and 39 mirrored right-side files: **112 of 238**. Bodies 40 to 80 words, `reviewed: false`, `ta2: null`, every landmark `position: null`, no side words in paired bodies (so the mirror reads correctly). Teeth carry no muscle attachments. The wisdom teeth have full files. Text-level doubts are in `content/QUESTIONS.md` 26 to 31 (bone-type classification, Latin names, level-by-level muscle ranges, eruption ages, common names, vertebral levels in the clinical notes).
- **Tests:** Vitest 239, Playwright 66, all passing (new `tests/panel.test.ts`: the compiler on fixtures and on every committed file, the axial and teeth coverage, the panel model with and without content, articulation labels, teeth and the hyoid). Playwright: `tests/e2e/panel.spec.ts` gains the real content for rib 1 (Latin, badges, sections, no "Not written yet", an articulation link to T1 with focus on the new title) and a tooth (tooth-type badge, gomphosis, neighbours) and the hyoid; the contrast and 200% reflow tests now run on the mandible, the longest real text; the tooth badge assertion is now "Tooth type: canine".
- **Needs the user:** look at the panel with real text on the phone (sheet at half and full) and on a desktop; work through `content/QUESTIONS.md` 26 to 31 when convenient. Nothing blocks session L.

## Session L notes (steps 6, 7, 8 and 10, done; 9 and 11 need the user)

- **Content (step 6):** 63 written files (clavicle, scapula, humerus, radius, ulna, the 8 carpals, 5 metacarpals, 14 hand phalanges, hip bone, femur, patella, tibia, fibula, the 7 tarsals, 5 metatarsals, 14 foot phalanges, all left side) and 63 mirrored: **238 of 238**. Front matter `name` is the `ids.json` name; bodies 40 to 80 words with no side words; each body names only the articulations that are in `articulations.json`. `--allow-missing-content` is gone from the npm script (the option stays in the script for one-off use). The compiled content is **30 KB gzipped** (237 KB raw), in its own lazy chunk. Text doubts: `content/QUESTIONS.md` 32 to 36.
- **Joint highlighting (step 7):** store `joint` (`{ a, b, name }`, cleared with every selection change). Hovering (mouse), keyboard focus (`:focus-visible` only, so a mouse click doesn't trigger it) or a 450 ms press-and-hold (touch; the tap after a hold doesn't select, and the long-press callout is suppressed) on an articulation in the panel sets it. `withJoint` (`src/scene/isolation.ts`) draws both bones solid (a ghosted or hidden partner shows for the duration) and tints both × `JOINT_GAIN` 1.3 (the focus keeps its accent hue, brighter); the hover outline moves to the partner in the selection's stronger blue (`OUTLINE.joint`), so no extra draw call. Announced: "Hip joint: femur and hip bone highlighted." Teeth's neighbour links are not joints and don't highlight.
- **Explode (step 8):** `src/scene/explode.ts` (pure offsets and matrix helpers), `src/scene/Explode.tsx` (applies the store's `explode` value 0 to 1 to the solid batch), `src/ui/ExplodeSlider.tsx` (toolbar popover, shown at tiers 1 and 2 when the focus has a mesh). Tier-1 bones move along the focus-centre → bone-centre line by radius × 0.5 × slider; the focus and tier-2-only bones stay. Release (pointer up, key up, blur, closing the popover) eases back in 400 ms (ease-out; instant with reduced motion), then the saved matrices are written back exactly and `?debug` re-runs the bounds check. Picking and hover are off while the value is above zero. The ghost batch never moves: its copies of the tier-1 bones are hidden at tiers 1 and 2. The value resets with any selection change (restored at once).
- **Debug:** the overlay adds `data-joint` and `data-explode`; `window.__viewer.boneNow(id)` gives where a bone is drawn now.
- **Tests (step 10):** Vitest 252 (new `tests/explode.test.ts`: offsets, release easing, exact restore on a batch, which bones move, store reset; new `tests/joint.test.ts`: `withJoint`, tints on and off, announcements, store clearing; the panel coverage test now requires all 238). Playwright 72, all passing (new `tests/e2e/joints.spec.ts`: hover, keyboard focus then Enter, phone press-and-hold and tap; Explode drag with bone positions before, during and after, draw calls, the bounds check after release; keyboard hold and release; picking off while exploded; no Explode at tier 0). `panel.spec.ts`'s femur test now checks the real text.
- **Step 9 (needs the user):** open `https://ajmarr04-ux.github.io/SkeletonViewer/?bench&sel=femur_left&tier=2` on the PC and the iPhone once it's deployed, and report the bench panel's median and 5th-percentile FPS and draw calls; also how Explode and the joint highlight feel. Headless SwiftShader numbers aren't meaningful (7 FPS for the whole skeleton here).

## Step 1: Content schema and `validate-content` (spec §5, §9)

- Dependencies: `zod`, `yaml` (front matter), `marked` (markdown body to HTML at build time).
- `src/content/schema.ts`: the zod schema for the front matter (spec §5 fields; `region` an array of known region keys; `type` one of `long | short | flat | irregular | sesamoid | tooth`; `toothType` required for teeth, `null` for bones; `ta2` `null` or a string; `landmarks` with `position: null | [x, y, z]`; `reviewed: boolean`). Body: 40 to 80 words (counted after stripping markdown).
- `scripts/validate-content.ts` (`npm run validate-content`, run with `tsx`; also `prebuild`, and in `npm run check`, which the Deploy workflow runs). Fails, with every problem listed at once, unless:
  - there is exactly one `content/bones/<id>.md` per ID in `content/ids.json` (238: 206 bones and 32 teeth), and each file's `id`, `side` and `kind` match `ids.json`;
  - every node in `public/models/skeleton-high.glb` and `-low.glb` has a file, and every file without a mesh has `meshAvailable: false` (decision 1);
  - every object appears in `articulations.json` at least once, except the hyoid (an explicit allowlist of one, in the script);
  - every object has an entry in `regions.json`;
  - every ID referenced anywhere (articulations, `surfaces`, regions, hierarchy) exists; every `surfaces` landmark ID exists in that bone's `landmarks`;
  - each articulation pair is stored once (no `a,b` and `b,a`, no self-pairs), and joint IDs are unique;
  - right-side files match the mirror of the left (decision 2);
  - `hierarchy.json` holds every ID exactly once as a leaf, under the three top-level groups;
  - all front matter passes the zod schema, and every file has `reviewed: false` until a human sets it.
- The pure checks live in `src/content/validate.ts` so Vitest can test each rule against small fixtures (a missing file, a duplicate pair, an unknown ID, a drifted mirror, a bad tooth type).
- Until the content is written, the "one file per ID" check fails. To keep CI green between sessions, `validate-content` takes `--allow-missing-content` (used by `check` until session L); the relationship checks run in full from session J on. Session L removes the flag.

## Step 2: Relationship data (spec §5)

- **`content/articulations.json`**, one entry per pair: `{ a, b, joint, name, surfaces? }`, joint IDs `snake_case` with a side suffix where paired. Built region by region, by hand, from standard anatomy (decision 11), and reviewed against the femur worked example (hip bone, patella, tibia; not the fibula). Covers:
  - skull: sutures between the cranial and facial bones, the temporomandibular joints, the ossicles (malleus–incus, incus–stapes; the stapes to the temporal bone at the oval window, if that counts as an articulation: see QUESTIONS);
  - vertebral column: atlanto-occipital, atlanto-axial, the intervertebral pairs (discs and facets as one pair per neighbouring vertebrae), lumbosacral, sacrococcygeal;
  - thorax: costovertebral and costotransverse joints (per rib with its vertebrae), sternocostal (true ribs; with no cartilage in the model, the pair is rib–sternum through costal cartilage: see QUESTIONS for ribs 8 to 10, which reach the sternum only through the cartilage above), sternoclavicular;
  - upper limb: acromioclavicular, glenohumeral, elbow (humero-ulnar, humeroradial, proximal radio-ulnar), distal radio-ulnar, radiocarpal, intercarpal, carpometacarpal, intermetacarpal, metacarpophalangeal and interphalangeal;
  - pelvis and lower limb: sacroiliac, pubic symphysis, hip, knee (tibiofemoral), patellofemoral, tibiofibular (proximal and distal), ankle, intertarsal, tarsometatarsal, intermetatarsal, metatarsophalangeal and interphalangeal;
  - teeth: each tooth with its alveolar bone (gomphosis, decision 4), including the wisdom teeth.
  - Pairs I'm not sure of are left out and listed in `content/QUESTIONS.md` (new) with the reason. Expected candidates: hyoid (allowlisted, no bony articulation), the stapes and the oval window, ribs 8 to 12 and the sternum, vomer contacts, the pisiform (articulates only with the triquetrum), intermetacarpal and intermetatarsal pairs, and anything about sutures between small facial bones.
- **`content/regions.json`**: one curated set per ID (spec §5), bones added on top of tier 1. The femur's is the spec's own example. For paired bones, the right side is generated from the left (same mirror script). For teeth: the full skull and both arches (decision 3), generated by rule in the script that writes the file, then kept as data.
- **`content/hierarchy.json`**: the spec §5 tree, from `ids.json`'s `group` paths (axial → skull (cranial, facial, ossicles, hyoid), vertebral column, thorax; appendicular → pectoral girdle, upper limbs, pelvic girdle, lower limbs; dentition → upper/lower → left/right → incisors, canines, premolars, molars → teeth). Node labels from `src/content/labels.ts`. Generated once by a script (`scripts/content/build-hierarchy.ts`), committed, and validated.
- `src/content/relations.ts`: pure lookups, `tier1(id)`, `tier2(id)`, `articulationsOf(id)` (from either side), `adjacentTeeth(id)`. Vitest: the femur example exactly; a few spot checks per region (C1, a rib, the scaphoid, the stapes, a central incisor: maxilla + 12 + 21); symmetry (every lookup from `a` finds `b` and back); left/right tier sets mirror each other.

## Step 3: Tiers 1 and 2 (spec §6)

- **Reducer** (`src/state/isolation.ts`): `related` and `region` already exist; add `switchSide` (decision 8). History as now: Show related and Expand region push; Back pops one level.
- **View** (`src/scene/isolation.ts`): `isolationView` gets the tier sets from `relations.ts`: solid = focus ∪ tier-1 (∪ tier-2), ghost or hidden = the rest. The focus keeps the accent and the outline; related bones keep the normal bone colour (spec §6). Missing meshes (wisdom teeth) in a tier set are skipped.
- **Picking:** related bones are solid, so they're pickable; decision 6 for clicks and double-clicks.
- **UI:** the panel's Show related and Expand region buttons are enabled (each shown only where it applies: Show related at tier 0, Expand region at tier 1); the toolbar gains Show related (spec §7 toolbar). Breadcrumb: the trail ends with the tier, for example `Skeleton › Lower limb › Femur › Related`. (Whether the middle levels become links, and to what, is a Milestone 5 question with the tree; they stay plain text.)
- **Announcer:** "Femur, left: related bones shown. Hip bone, patella, tibia." and "Region shown, 8 bones." On Back: "Femur, left, isolated."
- **URL:** `tier=1|2` already parses; a link with `sel=femur_left&tier=2` opens at tier 2, and Back from it steps to tier 1, then tier 0, then the full skeleton without leaving the site (the M3 replace rule, one level at a time).
- `F` frames the solid set (decision 7).

## Step 4: Content compile and the real info panel (spec §5, §7)

- `scripts/build-content.ts` (`npm run content`, also `prebuild` after validation, and before `dev`): reads `content/bones/*.md`, validates with the zod schema, renders the body with `marked`, and writes `src/content/generated/content.json` (git-ignored, built in CI) with everything the panel needs, plus the articulations with names. Loaded lazily after the low LOD so it doesn't slow the first frame; measure its gzipped size (expect about 100 to 150 KB) and note it.
- `src/content/panel.ts` replaces `placeholder.ts` as the panel's model, falling back to the placeholder per ID while files are missing (sessions K and L).
- **Panel sections, spec §7 order:** name with the Latin name in italics underneath, common name, side toggle; badges (region from `region`, bone or tooth type, the draft note); summary; functions; articulations (each a button: click selects that bone, which is a new focus at tier 0; hover or focus highlights the joint, step 7); key landmarks (names listed; the toggle disabled with "No positions yet", decision 9); muscle attachments; clinical note; Show related / Expand region / Back. Teeth show "Tooth type: molar" in the badge, and their articulations section lists the alveolar bone and, under "Neighbouring teeth", the adjacent teeth.
- Contrast and 200% reflow tests from Milestone 3 rerun against the longer real text.

## Step 5: Content drafting, part 1: axial skeleton and teeth (session K)

- Files under `content/bones/`, front matter per spec §5, body 40 to 80 words, `reviewed: false`, `ta2: null`, landmark `position: null`.
- Session K writes the skull (cranial, facial, ossicles, hyoid), the vertebral column, the thorax (ribs, sternum) and the 32 teeth. Written files: midline and left only, then `npm run content:mirror` (decision 2). About 75 written files.
- Each file is checked by `validate-content` as it lands. Anything the text needs that I'm unsure of (a Latin name, an attachment, a clinical note) goes in `content/QUESTIONS.md` rather than into the file.

## Step 6: Content drafting, part 2: appendicular skeleton (session L)

- The pectoral girdle, upper limbs, pelvic girdle and lower limbs, the same way: about 61 written files (left and midline), the rest mirrored. Then remove `--allow-missing-content`; `validate-content` must pass with all 238 files.

## Step 7: Joint highlighting (spec §6)

- Hovering or focusing an articulation in the panel highlights both bones (decision 9): the partner gets the hover outline (1.5 px, as for pointer hover, but in the accent's stronger blue) and both bones get a brighter tint for as long as the hover lasts. If the partner is a ghost or hidden (the panel lists all articulations at tier 0), it is shown solid for the duration of the hover, then goes back. No geometry moves; at most one extra draw call (the partner's outline).
- Phone: there's no hover, so a press-and-hold on the articulation highlights it, and a tap selects the partner.
- Announced: "Hip joint: femur and hip bone highlighted."

## Step 8: Explode slider (spec §6)

- Toolbar popover (like the ghost opacity slider), shown at tiers 1 and 2, off (zero) by default. While the slider is held, the tier-1 bones move out along decision 10's axes; on release, they ease back to zero (400 ms; instant with reduced motion) and the slider returns to zero.
- Implementation: per-instance matrices of the solid batch (and the ghost batch's copies, if any are shown), each saved before the first move and restored exactly at the end; the outline (focus only) doesn't move. Picking and hover are off while exploded. `?debug`'s bounds check runs after release and must pass.
- Keyboard: the slider is a normal range input, so arrows move it; it snaps back on blur or key release.

## Step 9: Performance check (spec §8, needs the user)

- `?bench&sel=femur_left&tier=2` runs the 360° orbit at tier 2, ghosts on. Report median and 5th-percentile FPS, draw calls, click → highlight, and the time from "Show related" to the next frame.
- Targets as before: PC 60 FPS, iPhone ≥ 30, draw calls < 20, click → highlight < 50 ms (desktop) / < 100 ms (phone).

## Step 10: Tests

- **Vitest:** the schema and every validation rule on fixtures; the mirror script (left → right round trip, side IDs inside lists swapped); `relations.ts` (femur worked example, per-region spot checks, teeth neighbours and alveolar bones, symmetry, left/right mirror); reducer `switchSide`; `isolationView` at tiers 1 and 2; the Explode offsets (direction, size, exact restore); the panel model from compiled content.
- **Playwright** (`tests/e2e/related.spec.ts`): load → click femur → Show related (hip bone, patella, tibia solid, the rest ghosts) → Expand region (+ sacrum, coccyx, opposite hip bone, fibula) → Back ×3 → full skeleton, checking the URL and the announcer at each step (this is also spec §11 Phase 5's smoke test, written early); a `tier=2` link and Back without leaving the site; double-click a related bone → new focus at tier 0; side toggle at tier 2 keeps tier 2; a tooth's tier 1 (alveolar bone and neighbours) and tier 2 (skull and both arches); hovering an articulation outlines the partner; Explode moves the tier-1 bones and the bounds check passes after release; draw calls < 20 at tier 2; the real panel text for the femur; a wisdom tooth at tier 1 (its maxilla or mandible and neighbour tooth shown).
- Existing tests updated where the placeholder text was asserted.

## Step 11: Hosted copy

**Hosted copy, Milestone 4:** https://ajmarr04-ux.github.io/SkeletonViewer/m4/ (not live yet).

- Merge to `main` through a PR, check the Deploy run, and ask the user to confirm https://ajmarr04-ux.github.io/SkeletonViewer/m4/ loads. Then tick the exit criterion, update `README.md`, and point `CLAUDE.md`'s status at Milestone 5's handover.

## New dependencies

- `zod`, `yaml`, `marked` (content schema, front matter, body rendering; spec §2 already names zod).
- Nothing else expected. (`minisearch` arrives with Milestone 5.)

## Files

| Path | What |
| --- | --- |
| `content/bones/<id>.md` | 238 content files (136 written, 102 mirrored) |
| `content/articulations.json`, `regions.json`, `hierarchy.json` | Relationship data (spec §5) |
| `content/QUESTIONS.md` | Every uncertain articulation, region choice or text detail, with the reason |
| `src/content/schema.ts`, `src/content/validate.ts` | zod schema; pure validation rules |
| `scripts/validate-content.ts`, `scripts/content/mirror.ts`, `scripts/content/build-hierarchy.ts`, `scripts/build-content.ts` | CLI: validate, mirror left → right, hierarchy, compile |
| `src/content/relations.ts`, `src/content/panel.ts` | Tier sets and lookups; the panel model from compiled content |
| `src/state/isolation.ts`, `src/scene/isolation.ts` | `switchSide`; tier 1 and 2 views |
| `src/scene/explode.ts`, `src/ui/ExplodeSlider.tsx` | Explode offsets and the slider |
| `src/ui/InfoPanel.tsx`, `Toolbar.tsx`, `Breadcrumb.tsx`, `Announcer.tsx` | Real content, Show related / Expand region, joint hover |
| `tests/content.test.ts`, `tests/relations.test.ts`, `tests/explode.test.ts` | Vitest |
| `tests/e2e/related.spec.ts` | Playwright |

## Risks and open points

- **Anatomical accuracy is the main risk.** Articulations and text are drafted without a reviewing anatomist (spec §13, still open). Mitigations: leave out anything uncertain and log it in `content/QUESTIONS.md`; keep `reviewed: false`; the user (or a reviewer they choose) can work through QUESTIONS and the files later without touching code.
- **Content volume:** 136 written files across sessions K and L, plus the data in J. If a session runs long, the drafting moves on to the next session rather than being rushed, and the progress table says where it stopped.
- **Costal cartilage is excluded from the model** (CLAUDE.md), but the sternocostal joints are through it. Recording rib–sternum pairs is anatomically fair (they are joined, through cartilage); ribs 8 to 10 (joined to the cartilage above, not the sternum) and the floating ribs 11 and 12 need a rule, listed in QUESTIONS for the user.
- **Content size on the phone:** lazy loading after the first frame keeps it off the critical path; checked in step 9.

## Commit plan (branch `claude/keen-clarke-32a10a`)

One or more commits per session, pushed at the end of each: J (`content: schema and validate-content`, `content: articulations, regions, hierarchy`, `state: tiers 1 and 2`), K (`content: compile and info panel`, `content: axial skeleton and teeth`), L (`content: appendicular skeleton`, `scene: joint highlighting and Explode`, `test: related isolation e2e`, docs). A PR to `main` at the end of each session, as in Milestone 3, so each one can be checked on the live site.
