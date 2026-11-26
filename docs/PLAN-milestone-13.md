# Milestone 13 Plan: Regions (Platform spec, M13)

Source of truth: `SPEC-platform.md` §2 (hard rules), §6 (regions), §8 (the keyboard cursor and label bullets), §10 (region checks, fixture layer), §11 (M13), §12 (defaults) and §13 (working rules). The earlier specs and `CLAUDE.md`'s ground rules still apply. Workflow: `docs/WORKFLOW_NEW.md`. **This phase adds no anatomy:** `git diff public/models/ content/` stays empty in every session, apart from the new region files (`content/regions/`, decision 2) and the fixture's regenerated boxes (decision 11). QUESTIONS start at **140**.

## Goal

**Region focus:** the user picks a body region (the forearm, the orbit, the lumbar back) and sees only what lies in it, on every layer, with the camera framed on it. Membership is a typed edge, `located_in`, computed at build time from the meshes' vertices, with hand overrides. Two features use membership to keep big future systems usable on phones. **Region chunking** lets a layer's model be split into one file per coarse region, so that only the regions in view are downloaded; it is proven on the fixture layer, and the four musculoskeletal layers stay single files. The **budget governor** keeps the drawn triangles under the device budget. The keyboard cursor and the floating labels are scoped by region.

With no region chosen, the app looks and behaves **exactly as at M12**. All five goldens are unchanged, and a sixth, `regions.json`, is added (decision 4).

Out of scope (M14 and M15, `SPEC-platform.md` §11): search ranking by region, filter chips and per-layer search indexes; the sidebar grouped by system; the colour model; `build.json` and the Python build reading per-layer config (M13's chunk splitter is a Node step after the existing build, decision 9); the curve spike. Also out of scope: new anatomy, new panel sections (decision 6) and renaming existing UI text (decision 3).

## What exists already (M1 to M12)

- **"Region" already means three things** in the code and the UI:
  - **Bone tier 2.** `content/regions.json` holds the bones' tier-2 neighbour sets. They become `region_neighbour` edges, the tier is worded "region", the button says **"Expand region"**, and the reducer action is `{ type: "region" }`.
  - **Colour-by-region** (`src/scene/regionColours.ts`, `color=region`, the toolbar's colour button). It covers 13 bone regions in Okabe–Ito colours.
  - `ModelSpec.chunking: "single"`, whose comment says that M13 adds `"region"`.
- **Graph (M12).** The graph has typed edges, compiled by `compileContentGraph` from each kind's extractor and from the system's sources. Non-structure nodes (the joints, `node: "joint"`) live in the always-loaded index. The eager layer's edges ship in the main chunk; each lazy layer's edges ship in its content chunk. The tier engine is `src/graph/query.ts`. No tier rule or panel section can name an edge type outside `src/systems/**` (the isolation test).
- **View.** `isolationView` → `sceneView(iso, modes, hidden)` → `shownIn`. Hidden structures (`hid=`, the depth peel) are never drawn, except the focus and a highlighted joint's bones. Region focus is a third source of "hidden" (decision 7).
- **Isolation reducer** (`src/state/isolation.ts`). The state is `{ sel, tier, grp }`, with history steps push / pop / replace and `via` for parts. `selection.ts` applies the steps to the browser history (`skvDepth`).
- **LOD and budgets.** `chooseLod` picks one LOD for the whole app: low on a phone-sized screen or a weak GPU, otherwise high. The `lod` Settings value and `?lod=` override it. The spec's budgets are desktop **1.5M** and phone **450k** triangles. The four layers' real totals, from the build manifests, are:

  | Layers | High | Low |
  | --- | --- | --- |
  | Bones | 499,981 | 149,913 |
  | Muscles | 799,750 | 229,800 |
  | Ligaments | 119,938 | 39,934 |
  | Cartilage | 79,965 | 29,976 |
  | **All four** | **1,499,634** (366 under 1.5M) | **449,623** (377 under 450k) |
  | Attachment patches (overlay) | 149,676 | 49,772 |

  **So on today's content, the governor and the phone's region start never trigger** (decision 10). They are built and tested against lower test budgets and the fixture layer.
- **Fixture layer** (`tests/fixtures/systems/demo/widgets/`). It has 12 boxes in three rows, all in front of the chest, generated in TypeScript (no Blender). `chunking: "single"`.
- **Main chunk at M12:** 486.1 kB (`gzip -9`). Budget **≤ 500.1 kB** (spec §2.4). That leaves 14 kB for all of M13's main-chunk additions.

## Progress

Session kinds: **design** = strong model; **routine** = Sonnet is fine. No subagents (spec §2.5). Session IDs continue from M12 (BK onwards).

| Session | Kind | Serial task (one sentence) | Fan-out | Inputs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| (planning) | design | M12 → M13 handover and this plan (step 0) | none | `SPEC-platform.md` | `current` 13, plan written | **Done.** See step 0 |
| BK | design | The region list and its volumes, resolved from anchor bones, plus the `?debug&regions` view (step 1) | none | decisions 1–3 | `content/regions/regions.json`, the resolver and the debug view committed; screenshots in the notes; **gate: the user approves the list** | **Done** (2026-11-25); list **approved by the user** (2026-11-25). See BK notes |
| BL | design | Membership: vertex shares → `located_in` edges, overrides, checks, the regions golden, per-region triangle totals in the index (step 2) | none | decisions 4–6 | `npm run regions` writes the membership and `check` verifies it; the spec §10 region checks pass; `tests/golden/regions.json` committed; the five goldens unchanged; main chunk measured | **Done** (2026-11-25). See BL notes |
| BM | design | Region focus state: reducer, URL `reg=`, history and Back, combined with isolation, groups and tiers, `sceneView` hiding non-members (step 3) | none | decision 7 | unit tests for every transition; the five goldens unchanged; `select`, `related`, `nested`, `layers` e2e pass || **Done** (2026-11-25). See BM notes |
| BN | routine | The region UI: toolbar control, body map and list, camera framing, breadcrumb, announcements (step 4) | none | decision 8, BM | new `tests/e2e/regions.spec.ts` and the a11y pass for the picker; `polish`, `a11y` and `keyboard` e2e unchanged and passing | ✅ 2026-11-26 |
| BO | design | Region chunking: split the model per coarse region after the build, the chunk checks, and a loader that fetches only the regions in view, proven on the regenerated fixture (step 5) | none | decisions 9, 11 | fixture Vitest and e2e prove that only the chunks in view are fetched; `check-models` covers the chunks; musculoskeletal files byte-identical | ✅ 2026-11-26. See BO notes |
| BP | design | The budget governor: drawn-triangle tracking, per-layer LOD capping, the prompt, and the phone's region start (step 6) | none | decision 10 | pure governor unit tests; e2e with `?budget=`; no trigger on today's content (parity) | ✅ 2026-11-26. See BP notes |
| BQ | routine | Keyboard cursor and label thinning scoped by region, plus `[` / `]` to jump between layers (step 7) | none | decision 12 | `keyboard`, `sidebar`, `polish` and `labels-layers` e2e pass; label layout times recorded | ✅ 2026-11-26. See BQ notes |
| BR | routine | Wrap-up: goldens, parity table, full e2e in the background, `/m13/` (step 8) | none | everything above | exit criteria ticked; `/m13/` live | ✅ 2026-11-26 apart from the merge, Deploy and freeze (waiting on the user). See step 8 |

Triggers: "begin session BK" to "begin session BR". Every session follows `docs/WORKFLOW_NEW.md` §7: read `docs/HANDOFF.md` and this file, do the one serial task, end with `npm run check` and the e2e specs it touched, commit, push to the session branch, tick the row, write `docs/HANDOFF.md`, and stop.

**Order:**
- BK → BL → BM → BN.
- BO needs BL (each structure's home region). BP needs BL (the triangle totals) and BN (the picker it opens).
- BQ needs BM.
- BO can run before or after BM and BN.

**User checkpoints**
- **Decisions 1 to 12 below.** Sessions build them as written unless the user says otherwise. Decisions 2 and 3 depart from the spec's names; say if you'd rather keep them.
- **After BK: the region list and volumes** (spec §11: "user checkpoint on the list"). BK ends with screenshots of `?debug&regions` (front, side and back) and the final list. BL starts only after the user approves it.
- **After BL:** a skim of the membership report (structures in many regions, overrides). This is not a gate.
- **Any golden difference** stops the session that caused it. Changing `regions.json` after BL counts as a difference.

## Exit criteria (from `SPEC-platform.md` §11, M13)

- [x] Region list and volumes; `?debug&regions` view; user checkpoint on the list (approved 2026-11-25).
- [x] Membership computed into `located_in` edges, with overrides and checks (BL).
- [x] Region focus UI, breadcrumb, URL, history; combined with isolation and Back (BM, BN).
- [x] Region chunking in the build and loader, proven on the fixture layer (BO).
- [x] Budget governor; phones start in region mode only when over budget (BP; on Auto only since BR).
- [x] Keyboard cursor and label thinning scoped by region (BQ).
- [x] Every golden unchanged (`tiers`, `panels`, `urls`, `search`, `tree`); `regions.json` added; old URLs open the same view (BR: `git diff 3d8adef -- tests/golden/` only adds `regions.json` and the harness's region keys).
- [x] No regression: every existing unit and e2e test passes unchanged, except where a step lists why (spec §2.1). Performance parity with no region chosen (bench, perf-load, main chunk ≤ 500.1 kB). (BR: parity table in step 8; the phone-start fix there)
- [ ] **Hosted copy is live and linked below** (an extra requirement for every milestone).

---

## Step 0: M12 close-out and handover (done in the planning session)

- `/m12/`: confirmed live by the user (2026-11-25). "Hosted copy is live" is ticked in `docs/PLAN-milestone-12.md`. `m12` was already frozen at `3d8adef` by BJ's follow-up (#28, `14cbc32`).
- `deploy/pages.json`: `current` set from `null` to **13**, so the next deploy of `main` builds `/m13/` from it. `README.md` has an M13 row marked "In progress". `CLAUDE.md` has the new status line.
- **Still open, carried over (for the user, any time):** the real-device gate from M10 (AO/AP; M14's device runs can fold it in); QUESTIONS 1–139; the per-browser `?bench` table (M5 step 12).

## Decisions made in this plan (say if any should change)

1. **The region list** (spec §6.1, §12 default: the two-level list). BK starts from the spec's table and records the final list here. The proposed changes are listed below; the user decides at the BK gate.

   **BK's list (10 coarse, 35 fine; approved by the user at the BK gate, 2026-11-25).** Limb regions are per side (`_left` / `_right`; one row shown):

   | Coarse | Key | Fine regions (keys) |
   | --- | --- | --- |
   | Head | `head` | Cranium (`cranium`), Face (`face`), Orbit (`orbit`, two boxes), Ear (`ear`, two boxes), Oral cavity (`oral_cavity`) |
   | Neck | `neck` | Anterior neck (`anterior_neck`), Posterior neck (`posterior_neck`) |
   | Thorax | `thorax` | Thoracic wall (`thoracic_wall`) |
   | Abdomen | `abdomen` | Abdominal wall (`abdominal_wall`), Posterior abdominal wall (`posterior_abdominal_wall`) |
   | Pelvis and perineum | `pelvis_perineum` | Pelvis (`pelvis`), Perineum (`perineum`) |
   | Back | `back` | Thoracic back (`back_thoracic`), Lumbar back (`back_lumbar`), Sacral back (`back_sacral`) |
   | Upper limb (left / right) | `upper_limb_left` | Shoulder (`shoulder_left`), Arm (`arm_left`), Elbow (`elbow_left`), Forearm (`forearm_left`), Wrist and hand (`wrist_hand_left`) |
   | Lower limb (left / right) | `lower_limb_left` | Hip and gluteal region (`hip_gluteal_left`), Thigh (`thigh_left`), Knee (`knee_left`), Leg (`leg_left`), Ankle and foot (`ankle_foot_left`) |

   Departures from the spec's table: no mediastinum, pleural cavities, upper or lower abdomen (as proposed below); **no "Back: cervical"**, because its volume would be the posterior neck's (the cervical vertebrae and the muscles behind them), so the posterior neck stands for it; **"Posterior abdominal wall" added**, because the anterolateral wall's box can't also hold psoas, quadratus lumborum and iliacus without swallowing the lumbar back.
   - **Leave out, for now, regions that would hold no musculoskeletal structure.** These are the mediastinum, the pleural cavities, and the upper and lower abdomen as cavities. Spec §10 says "every region contains at least one structure", so these regions would fail the check. The organs spec adds them back, with their own volumes. The thorax keeps "thoracic wall", and the abdomen keeps "abdominal wall" plus a "posterior abdominal wall" (psoas, quadratus lumborum, iliacus) if the debug view shows that the wall volume misses those muscles.
   - **Sides.** Limb regions are per side, as the spec lists them. Head regions that come in pairs (orbit, ear) are **one region with a volume of two boxes**. A user who picks "Orbit" sees both orbits, which matches how the region is named.
   - **Keys** are snake_case, unique across structure IDs, joint nodes and group keys (checked). Coarse regions have keys like `upper_limb_left`, and fine regions keys like `forearm_left` or `orbit`. The key is the URL value (`reg=forearm_left`). In the graph, a region is a node `node: "region"`, as the joints are `node: "joint"`.
   - Each region has a `name` ("Forearm (left)") and its coarse parent. The file also holds the membership threshold, **15 %** (spec §12 default, tunable in one place).

2. **Volumes come from anchor bones, not typed coordinates.** The ground rule is "never invent landmark coordinates"; the spec allows volumes "written by hand". So:
   - `content/regions/regions.json` is **authored**. Each fine region's volume is one or more shapes, each either:
     - `fit`: the box around named anchor structures (for example `["radius_left", "ulna_left"]`), oriented by their vertices' principal axis. Each `fit` shape has a `pad` in metres (soft tissue lies outside the bones) and an optional `span` (a fraction range along the long axis, so the arm stops at the elbow box); or
     - `box` / `capsule`: written literally, and only with a one-line `reason`. Every literal shape is also a QUESTIONS entry (140 onwards) for the content review.
   - `scripts/regions/volumes.ts` (`npm run regions:volumes`) reads the anchor bones' vertices from `public/models/skeleton-high.glb`, using the decoder that `check-models` already uses. It writes the resolved oriented boxes and capsules to **`assets/build/region-volumes.json`**, which is generated, committed, and checked as up to date by `npm run check` (as `check-models` does). The app and the membership step read only that file.
   - **Paths.** The spec names `content/regions/regions.json`, while `content/regions.json` (the bones' tier-2 sets) already exists beside it. The plan keeps both names, because renaming the old file would touch M4 to M12 code and docs for no behavioural gain. `content/regions/README.md` (three lines) says which file is which, and the region code lives in its own folder, `src/regions/`, so that it never imports `regionColours.ts`. Say if you'd rather rename the folder to `content/body-regions/`.

3. **Words in the UI.** "Expand region" (bone tier 2) and "Colour by region" stay as they are. Renaming them would change `panels.json` and the announcement tests, and spec §2.1 forbids that without a reason. The new control is labelled **"Body region"**, its picker is titled "Focus on a body region", and every new message says "body region" where the bare word would be ambiguous (in the toolbar, the picker, the prompt and announcements). The breadcrumb uses the region's own name ("Forearm (left)"), as the spec shows.

4. **Membership** (spec §6.2).
   - `scripts/regions/membership.ts` (`npm run regions`, which runs `regions:volumes` first) reads every layer's **high-LOD** model through the registry (`ModelSpec.file`). For each structure and each fine region, it counts the share of the structure's vertices inside the volume, using world positions (node world matrix × quantised position, under 1 mm of error).
   - A structure is `located_in` every fine region where the share is ≥ 15 %, or else in its single best region.
   - A structure **with no mesh** inherits membership:
     - a muscle with parts takes the union of its parts' regions (`parentOf`, generic);
     - the four wisdom teeth take the union of their tier-1 neighbours' regions (spec §6.2), through the graph's tier-1 rule for their kind, computed in Node.
   - Overrides come from `content/regions/overrides.json`, as `{ add: [{ id, region, reason }], remove: [...] }`.
   - The output is **`assets/build/located-in.json`**, generated and committed, with each ID's fine regions, its shares, its *home* coarse region (where most of its vertices are; decision 9), and the overrides applied. `npm run check` recomputes it and fails if it is stale.
   - A **report**, `assets/build/REPORT-regions.md`, lists per-region counts by layer, the structures in four or more regions, every override and the inherited memberships.
   - **Checks** (spec §10), in `validate-content`: every structure with a mesh has at least one `located_in`; every override has a reason, names a real ID and region, and changes something; every fine region contains at least one structure; and no region key collides with another ID.
   - **Golden:** `tests/golden/regions.json` holds each ID's regions, plus each region's members per layer. It is written once in BL, as a new file. A new file is not a difference, so it needs no approval (M12's tree golden set this precedent). Any change after BL needs the user's approval.

5. **`located_in` is a platform edge type, and it ships eagerly.**
   - The edge type `located_in` (inverse label "contains"; not symmetric; never derived at run time) is declared in **`src/systems/regions.ts`**. That file is the regions' descriptor: the edge type, the content half's source (`located-in.json`) and the node list. `registered.ts` lists it next to the systems, so the fixture build can swap it, and the isolation test allows its IDs only under `src/systems/**`.
   - **Shipping exception to M12 decision 3, with the reason.** Region focus, the governor and chunked loading must know a structure's regions **before** its layer's content (or model) loads: to hide non-members on the first frame, to estimate triangles, and to choose which chunks to fetch. So every layer's `located_in` edges ship in the **main chunk** with the index. The format is compact: one list of region indices per ID, with the right sides' lists as references where they mirror the left (the index's codec already does this for entries). The estimate is about 1,140 IDs × 1–3 regions, roughly **4–6 kB** gzip. BL measures it. If the main chunk would pass 500.1 kB, BL stops and asks.
   - **Triangle totals.** The index also carries, for each layer, each LOD and each region (fine and coarse), the triangle total of that region's members (a union, counting each structure once), and each layer's whole total, read from the build manifests. The governor estimates from these totals before anything loads (decision 10). That is about 85 regions × 4 layers × 2 LODs of integers.
   - **No tier rule or panel section follows `located_in` in M13.** So `tiers.json` and `panels.json` cannot change. A "Located in" panel section, and search ranking by region, are possible later uses (M14 and beyond), each needing its own golden approval.

6. **No-mesh structures and the checks.** The check "every structure with a mesh has at least one `located_in`" covers meshes only. No-mesh IDs get theirs by inheritance (decision 4), and BL lists them in the report. Joint nodes and region nodes are not structures, so they have no `located_in`.

7. **Region focus state** (spec §6.4).
   - **State.** `Isolation` gains `reg: string | null`, with the fine or coarse key. `FULL_SKELETON` has `reg: null`. Two new reducer actions:
     - `{ type: "focusRegion", key }`: from the whole body it **pushes** a new entry. From another region with nothing isolated it **replaces**. From an isolation, it pushes a new entry at the region level and clears `sel` and `grp`, because the usual flow is "pick a region, then choose".
     - `{ type: "leaveRegion" }`: pops, or replaces when the entry wasn't the app's.
   - **Back.** Back walks out of the isolation first, with today's steps unchanged (they keep `reg`), and then out of the region. `levelOf` counts a region as one level, under everything else.
   - **View.** In `sceneView`, a region adds a membership set: a structure outside it is **hidden** (spec §12 default: hide, not ghost), on every layer, as `hidden` already does. The focus and a highlighted joint's bones stay drawn, as with `hid=`.
     - **Isolation within a region:** the isolation's solid set, its ghosts and a group's members are intersected with the region's members. Off layers still add nothing.
     - A **selection made from outside the region** (a search result, a panel link, a tree row) keeps the region and is drawn as the focus. This is the same rule as a hidden focus, and it is announced as "outside the body region".
   - **URL.** `reg=<key>` sits after `grp` in `serialiseUrlState`'s order. An unknown key is dropped, as an unknown `sel` is. Every existing URL parses exactly as before, so `urls.json` is unchanged. BM adds new URL tests in their own file, not in the golden.
   - **The "N hidden · Show all" chip** counts only `hid=`, never the region's hiding.
   - **Explode, labels, colour-by-region, tints and depth** work inside a region unchanged, over the drawn set.

8. **Region UI** (spec §6.4).
   - **Toolbar.** A "Body region" button opens the picker. It is a lazy chunk, so the picker's code and SVG stay out of the main chunk. The toolbar-fit rules (`toolbarFit.ts`) take it like any other tool: on phones it goes under "More".
   - **Picker.**
     - **The list is the primary control.** It is an ARIA tree of coarse regions, then fine regions, with each region's member count for the layers that are On.
     - **The body map** shows a front view and a back view, made at build time from the resolved volumes (`assets/build/region-volumes.json` projected orthographically into an SVG). Nothing is drawn by hand. Each shape on the map is a button that selects the same region as its list row, with the same name.
     - Both list and map have the M10 contrast and focus rules, and the picker joins the axe pass in `a11y.spec.ts`.
   - **Framing.** Choosing a region frames the camera on the union of the region's volume and its drawn members, using `frameBeside` (so the panel and sidebar insets apply). Leaving the region restores the whole-body frame only if the user hasn't moved the camera since.
   - **Breadcrumb.** The region's name comes first: `Forearm (left) › Muscles › Flexor carpi radialis`. Its crumb leaves the isolation but keeps the region.
   - **Announcements.** These come from `announce.ts`'s composer: "Body region: forearm (left). 4 bones, 21 muscles, 9 ligaments shown." (counted by kind, as tiers are), and "Left the body region." No existing message changes.

9. **Region chunking** (spec §6.3).
   - `ModelSpec.chunking` becomes `"single" | "region"`. The four musculoskeletal layers stay `"single"` (spec §12 default), and **their files must stay byte-identical**.
   - **Build.** `scripts/models/split-regions.ts` splits a layer's built, uncompressed GLB into one file per coarse region per LOD: `public/models/<file>-<coarse>-<lod>.glb`. Each structure goes in its home region's file (decision 4), so it is stored once, keeps its name, and isn't moved. The splitter runs in `compress-models.sh` before gltfpack, for every layer whose descriptor says `"region"`, by a loop over the registry. M15 turns this into `build.json`, and the Python build doesn't change in M13.
   - **Checks.** `check-models` checks a chunked layer the same way as a single one, against the union of its chunks:
     - every ID once, in its home chunk;
     - the bounds against the manifest;
     - a budget per LOD for the layer's sum of chunks.
     - It also reports each chunk's size.
   - **Loading.** `src/layers/urls.ts` hashes each chunk's URL. With a region focus, the loader fetches only the chunks whose coarse region holds a member of the region (from `located-in.json` via the index), and fetches more as the focus moves. With no region, it fetches every chunk. A structure whose chunk isn't loaded can't be drawn, so a ghost is drawn for loaded structures only. The batch takes chunks as they arrive (`BatchedMesh` instances added). The progress bar and Retry in the Layers panel are per layer, summed over its chunks.

10. **The budget governor** (spec §6.5). There is one pure module, `src/scene/budget.ts`, with a store slice next to it.
    - **What it counts.** It counts the triangles of the *layer batches' drawn instances*: solid plus ghost, at each layer's current LOD, from the batches once they are loaded and from the index's totals before then. **Overlays (the attachment patches) are reported but not counted**, because the budgets were set for the layer files (spec §6.5: "budgets stay as they are"). Counting patches would make a muscle selected with all four layers On cross 1.5M by a few hundred triangles on desktop, and change M12's behaviour.
    - **Step 1.** Over budget, with the LOD setting on Auto and no `?lod=`, the governor caps the heaviest drawn layers to low, one at a time, until the total fits. The cap is lifted only when the high total would fit under 90 % of the budget (hysteresis), so that turning a layer on and off doesn't flap. An explicit Settings value or `?lod=` is the user's choice, and the governor never overrides it (rule 3).
    - **Step 2.** If the total is still over, the governor keeps the view and shows a non-blocking prompt: "This view is heavy for this device. Focus on a body region?" The prompt has a button that opens the picker, and a dismiss button. It is shown at most once per change of layers or region, and it is announced politely.
    - **Phones** (the existing small-screen class). When the app opens with no `reg=` and the requested layers' estimate at the planned LOD is over the phone budget, it **opens the picker before drawing the over-budget layers**. Their files still load (they are single files), but their batches stay hidden until a region, or "Whole body", is chosen. "Whole body" is always offered, and choosing it leads to step 2's prompt, never to a silent drop.
    - **Parity.** On today's content nothing triggers (the table above: 366 and 377 triangles to spare). A unit test asserts that the real totals fit the budgets, so that a rebuild that pushes them over is noticed rather than silently changing behaviour.
    - **Testing.** `?budget=<triangles>` (with `?debug` only) overrides the device budget, so the e2e tests can trigger steps 1 and 2 and the phone start on the real layers. The fixture covers step 1 with chunked loading.
    - The debug overlay shows the drawn total, the budget and any caps.

11. **The fixture in M13** (spec §10: "region chunking … and a generated `.glb`").
    - `generate.ts` moves the 12 boxes into **three coarse regions**: four in the head, four in the thorax and four in the left lower limb, at positions taken from the resolved volumes' centres. Their kinds, IDs and edges are unchanged.
    - The widgets switch to `chunking: "region"`. `generate.ts` writes the uncompressed build, and the splitter and gltfpack make the chunks, the same path the real layers would take.
    - **Vitest:** membership puts each box in its region, and the chunk plan for a region lists only its chunk.
    - **Playwright** (`tests/e2e/fixture.spec.ts`): focusing the head fetches only `widgets-head-*.glb` (checked with request interception); moving the focus to the thorax fetches that chunk too; whole body fetches all three.
    - Fixture tests that depend on box positions (picking a widget by its screen position) change only their coordinates. BO lists them.

12. **Keyboard cursor, labels and `[` / `]`** (spec §8, as far as M13's checklist takes it).
    - **Tab cursor** (`cursorStops`, `tabCursor`). In a region, it walks the drawn members of the **focus layer** first (the labels' focus layer, `focusLayerOf`) and then the other layers' members, in today's order within each layer. With no region, the order is exactly today's (`keyboard.spec.ts` unchanged).
    - **`[` and `]`** move the cursor to the first stop of the previous or next layer that has stops. They are in spec §8's keyboard bullet, and no other milestone's checklist names them. They are added to the key map and the keyboard help text. Say if they should wait for M14.
    - **Label thinning.**
      - **Before projection**, the label candidates are cut to the drawn structures (region membership, layer visibility, hidden), and then to the best *N* by `labelPriority` and tier.
      - *N* is a constant sized so that the bones-only layout cost holds with all four layers On. BQ measures *N* and records it.
      - With only the bones drawn and no region, the candidate set is exactly today's, so the labels e2e tests are unchanged.
      - `?bench`'s label layout times are recorded for whole body with all layers, and for a region focus.

## Step 1 (BK): region list and volumes

- Decisions 1–3. `content/regions/regions.json` (the list, anchors and threshold) and `content/regions/README.md`.
- `scripts/regions/volumes.ts`, its pure fitting helpers (`src/regions/volume.ts`: oriented boxes from points by principal axes, `span`, `pad`, and point-in-shape tests), and `assets/build/region-volumes.json`.
- Unit tests:
  - the fit for a known point cloud;
  - point-in-box and point-in-capsule, edges included;
  - the "stale file" check.
- `?debug&regions` draws each fine region's shapes as translucent coloured wireframes with their names, in a lazy chunk, like `?debug&layers=all`. `?debug&regions=<key>` draws one region.
- **Gate.** BK writes the final list into decision 1, with front, side and back screenshots of `?debug&regions` (all layers On) in `docs/screenshots/m13/`, and stops for the user's approval.

## Step 2 (BL): membership and `located_in`

- Decisions 4–6:
  - `scripts/regions/membership.ts`, `npm run regions`, and `assets/build/located-in.json`;
  - `content/regions/overrides.json` (possibly empty) and `assets/build/REPORT-regions.md`;
  - the descriptor `src/systems/regions.ts`, the `located_in` edge type, the compiler source, the region nodes in the index, and the compact eager shipping;
  - the per-region triangle totals.
- The four region checks go in `validate-content`, each with a unit test on a bad input. The staleness check goes in `npm run check`.
- `tests/golden/regions.json` is written once, by the golden harness (`npm run golden -- --write` for the new file only).
- Main chunk measured; the budget is in decision 5.

## Step 3 (BM): region focus state

- Decision 7:
  - the reducer's `reg`, `focusRegion` and `leaveRegion`, `levelOf` and Back;
  - `selection.ts`'s history (`skvDepth` counts the region level);
  - URL `reg=` parse and serialise;
  - `sceneView` and `isolationView` intersections;
  - `isPickable` (members only, plus the focus).
- Unit tests:
  - every transition: region → select → tier 1 → tier 2 → Back × 4; group inside a region; region → region; selecting a part via its muscle inside a region; a selection outside the region;
  - URL round trips;
  - the view sets on fixed IDs.
- No UI yet beyond the store. The e2e tests drive it through `window.__viewer` and URLs.

## Step 4 (BN): region UI

- Decision 8:
  - the toolbar button and the lazy picker (list + generated front and back SVG maps);
  - framing; breadcrumb; announcements;
  - the picker in the keyboard pass (`Esc` closes it; the arrow keys move through the tree).
- `tests/e2e/regions.spec.ts`:
  - pick from the list and from the map;
  - non-members hidden on every layer that is On;
  - select inside, then tiers inside, then Back × N;
  - `reg=` deep link and browser Back;
  - breadcrumb crumbs;
  - the announcement text;
  - phone layout under "More".

## Step 5 (BO): region chunking

- Decisions 9 and 11:
  - `ModelSpec.chunking` widened; the splitter; `compress-models.sh` looping over the registry;
  - `check-models` for chunked layers;
  - the loader's chunk plan (a pure `chunksFor(regionKey, layer)` with tests) and incremental batch filling;
  - the fixture regenerated and chunked.
- Musculoskeletal parity: `sha256sum public/models/*.glb` before and after, identical.

## Step 6 (BP): budget governor

- Decision 10:
  - `src/scene/budget.ts` (pure: given the drawn totals per layer and LOD, the budget, the LOD source and the current caps, returns the caps and whether to prompt) and its store slice;
  - per-layer LOD caps reaching `LayerScenes`, so the plan's final LOD can differ by layer;
  - the prompt; the phone's start; `?budget=`; the debug overlay line;
  - the parity unit test (real totals fit the budgets).
- e2e:
  - `?debug&budget=900000&layers=…all on…` caps the muscles to low;
  - a lower budget shows the prompt, and its button opens the picker;
  - a 390 px phone with `?budget=` low opens the picker first and offers "Whole body".

## Step 7 (BQ): keyboard cursor, labels, `[` / `]`

- Decision 12. `keyboard.spec.ts`, `polish.spec.ts` (labels) and `labels-layers.spec.ts` unchanged and passing, plus new region cases in `regions.spec.ts`. *N* and the label layout times are recorded in the notes.

## Step 8 (BR): wrap-up

- Goldens: the five unchanged, `regions.json` as BL wrote it, or every difference listed here with the user's approval.
- Parity table against M12 (`3d8adef`), built side by side from the same `node_modules`:
  - triangles and draw calls;
  - `?bench` FPS and label times;
  - `perf-load`;
  - main chunk;
  - content chunks;
  - and, new, the picker chunk and `?bench` with a region focus.
- Full e2e in the background with a log file, then a grep for failures.
- Docs:
  - `CLAUDE.md`'s key-file table (`src/regions/`, `scripts/regions/`, `src/systems/regions.ts`, `src/scene/budget.ts`, the splitter);
  - `STATUS.md` gains "How regions work".
- `/m13/`: PR to `main`, merge, Deploy run, then freeze `m13` in `deploy/pages.json` at the merge commit, with `current` set to `null` until M14's planning.

**Done** (2026-11-26, apart from the merge, the Deploy run and the freeze, which wait on the user). `npm run check` green (52 files, 764 tests); `npm run golden`: the five unchanged, `regions.json` as BL wrote it, **no approved differences**. `git diff 3d8adef HEAD -- public/models/` is empty: M13 changed no model file (`content/` only gains `content/regions/`).

**Fix found by `perf-load`:** on a phone with an explicit high LOD (`?lod=high|both`, or Settings → High), the bones alone (499,981) pass the 450k phone budget, so BP's phone start **held the bones and opened the picker on a bones-only page** (perf-load's phone run timed out on the dialog). M12 drew them, and decision 10 rule 3 makes an explicit LOD the user's choice, as step 1 already did. `initBudget` now holds layers only when the plan's source is Auto (on a small screen Auto always plans low, so nothing else changes). Step 2's non-blocking prompt still applies over budget, as decided. Tests: `tests/budget.test.ts` + 1, `budget.spec.ts` + 1 (phone, `?lod=both`: nothing held, no picker); the picker waits in `budget.spec.ts` get 20 s (the lazy chunk took over 5 s under the full run's load).

**Parity table.** Both builds made in this container from the same `node_modules` (`3d8adef` in a scratch worktree), measured back to back with the same scripts (`LABELS=1 npm run bench-container 3`; M12 ignores `reg=` and has no `labelCandidates`, so the script now prints "n/a" there). SwiftShader at 1280 × 800, so FPS only compares like with like.

| Measure | M12 (`3d8adef`) | M13 head |
| --- | --- | --- |
| Triangles, bones only / all four layers (high) | 499,981 / 1,499,634 | 499,981 / 1,499,634 |
| Draw calls, bones only / all four layers | 1 / 4 | 1 / 4 |
| `?bench` bones only, median / 5th pct FPS (labels on) | 2.2 / 2.0 | 2.3 / 2.1 |
| `?bench` all four layers, median / 5th pct FPS | 0.7 / 0.5 | 0.7 / 0.6 |
| `?bench` all four layers in `reg=thorax`, triangles / FPS | n/a (whole body) | **628,779** / 0.7 |
| Label layout median: bones only / all layers / all layers in the thorax | 0.6 / 1.4 / 1.5 ms (no thinning: every drawn structure, 191 with all layers by BQ's count) | 0.6 / 1.2 / 0.8 ms (42 / 60 / 60) |
| `perf-load` desktop: skeleton / full detail / muscles | 2.02 / 6.64 / 10.03 s | 2.14 / 6.57 / 9.67 s |
| `perf-load` phone: skeleton / full detail / muscles | 4.70 / 8.11 / 10.61 s | 2.14 / 6.66 / 10.30 s |
| Main chunk, `gzip -9` of `index` + modulepreloads | **486.1 kB** (index 307.6 + meshoptimizer 167.6 + registry 9.7 + names 0.8 + runtime 0.5) | **490.9 kB** (index 476.9, meshoptimizer folded in + registry 9.8 + jsx-runtime 3.4 + names 0.8) |
| Content chunks: bones / muscles / ligaments / cartilage | 40.0 / 114.1 / 40.5 / 8.9 kB | identical (same hashes) |
| Soft tree / bone search / soft search | 12.1 / 9.1 / 36.8 kB | identical (same hashes) |
| New lazy chunks: region picker / `DebugLayers` (with `?debug&regions`) | — | 4.1 / 4.7 kB |

Main chunk **+4.8 kB** on M12 (region membership and triangle totals in the index, the governor, the prompt), under the 500.1 kB budget. (BQ's note said 490.4; measured here the same way as the M12 figure, which matches M12's own note.) The bones-only label layout is M12's; with all layers it is lower (thinning to 60). `perf-load` differences are within run-to-run spread (M12's phone runs all spent about 3.3 s of main thread before the skeleton this time; one desktop run of each build took over 4 s); the muscles layer FAILs its 3 s / 5 s budget in both builds, as in every container run since M7 (STATUS §6). The first M13 bench (contended by an `npm run check` run) gave bones only 1.4 FPS; the figures above are the uncontended re-run.

**Docs:** `STATUS.md` gains "How regions work (M13: body regions)" at the end of §5; `CLAUDE.md`'s key-file table gains rows for BM to BQ (focus state, picker, chunking, governor, keyboard and labels), beside BK's and BL's.

**e2e:** the full suite in one background run (`npx playwright test --trace off`, both projects, 2 workers): **193 of 196 passed** in 48.4 min. The three failures were under load: `keyboard.spec.ts:191` and `:242` (time limits, as in M12's run) and `budget.spec.ts:114` (the lazy picker not visible within 5 s). Re-run alone, **all three pass** (8.4 min); `budget.spec.ts` with the fix and the new test: 7/7. No pre-M13 e2e test was edited.

## Approved golden differences

None yet.

## Session notes

### BK (design, 2026-11-25): region list and volumes

- **Files.** `content/regions/regions.json` (authored list, anchors, threshold 0.15) and `README.md`; `src/regions/volume.ts` (pure: PCA frame by Jacobi, `fitShape`, spans, pads, `inShape`/`inRegion`, `expandRegions`, `checkRegionsFile`, `resolveRegions`), `src/regions/stale.ts`, `src/regions/debug.ts`, `src/regions/DebugRegions.ts`; `scripts/regions/volumes.ts` (`npm run regions:volumes`, `-- --check` added to `npm run check` after `check-models`); `scripts/lib/glb-points.ts` (world vertices per named node, BL reuses it for every layer); `assets/build/region-volumes.json` (generated, 38 shapes). Tests: `tests/regionVolumes.test.ts` (14).
- **The fit vocabulary grew beyond decision 2's `fit`/`pad`/`span`,** because plain boxes around whole bones overlapped far too much (the first pass put the thoracic spine in the shoulders and the coccyx in the thighs): an anchor can be `{id, span, axis}` (part of one bone along its long axis, or along `vertical` / `anteroposterior` / `mediolateral`, the last measured from the medial end on either side); `orient: "world"` boxes take per-face pads in anatomical words (`medial`/`lateral` by side), negative to trim; PCA shapes take `{long, cross}`; `eachSide` makes a paired midline region (orbit, ear). `shape: "capsule"` exists but nothing uses it. **No literal shapes**, so no QUESTIONS entries (the next is still 140).
- **Checks in the resolver** (`checkRegionsFile`): snake_case keys, unique, not an existing structure / joint / articulation / hierarchy key; known coarse parents; `{side}` consistent; anchors are structures with a mesh; a reason on any literal shape; the threshold in (0, 1). Anchors may be on any layer (only the needed layer files are read; today all anchors are bones).
- **Preview of membership** (a scratch probe, not committed; BL computes it for real): every structure with a mesh reaches 15 % somewhere; every fine region holds members on at least two layers (smallest: arm 1 bone + 17 muscles, thigh 1 + 21 + 3 ligaments). 118 structures are in four or more regions, mostly long trunk muscles and the bones at region borders. **Overlaps BL has to settle** (override or accept): ribs 2–7 fall about 50 % into the shoulder (the scapula lies on them); the femoral heads 21 % into the pelvis; rib 1 and the medial clavicle into the anterior neck; the thoracic vertebrae into the thoracic wall (correct: the thoracic cage); the digastric's posterior belly into the cranium's base box.
- **Debug view:** `?debug&regions` (all), `?debug&regions=<fine or coarse key>`; wireframe + 7 % fill drawn over everything, a name sprite per region, a line in the debug overlay (`data-testid="debug-regions"`, `data-regions`). Screenshots (all four layers On): `docs/screenshots/m13/regions-{anterior,left,posterior}.png`, close-ups `regions-head-{anterior,left}.png` (`?debug&regions=head`).
- **Main chunk: 486.3 kB** `gzip -9` (index + modulepreloads; +0.2 kB over M12's 486.1). Lesson for BN's lazy picker: a lazy chunk that imports `three` (or `react`) but not `meshoptimizer` makes rolldown split the shared vendor chunk differently, costing about 1 kB of main chunk (and `@react-three/drei` was not the cause). The region debug view therefore rides inside the existing `DebugLayers` chunk and is plain three.js; measure the picker's chunk the same way (`index` + every `modulepreload` in `dist/index.html`).
- `npm run check`: pass (672 tests; goldens unchanged). No e2e touched (the debug view has no spec; the screenshots were its check).

### BL (design, 2026-11-25): membership and `located_in`

- **Gate.** The user approved BK's list as it is (2026-11-25), departures included.
- **Files.** `src/systems/regions.ts` (the descriptor: edge type `located_in` / inverse "contains", node kind `region`, `membershipFile`, `volumesFile`; `RegionsDescriptor` in `types.ts`; `REGIONS` exported by `registered.ts` and by the fixture's registry; `EDGE_TYPES` = the systems' types then `located_in`, so it is last). `src/regions/membership.ts` (pure: `vertexShares` with a bounding-box reject, `memberIndices`, `checkOverrides`, `applyOverrides`, `inheritRegions`, `checkMembership`, `triangleTotals`). `scripts/regions/membership.ts` (`npm run regions` = volumes then membership; `npm run regions:membership -- --check` in `npm run check`), `scripts/lib/region-files.ts` (mesh layers, taken keys, manifest paths; shared with `volumes.ts`). Output `assets/build/located-in.json` (one structure per line) and `assets/build/REPORT-regions.md`. `content/regions/overrides.json`. Runtime: `src/regions/codec.ts` (wire format) and `src/regions/index.ts` (`regionList`, `regionInfo`, `isRegionKey`, `regionsOf`, `membersOf`, `isInRegion`, `regionTriangles`, `locatedInEdges`), handed over by `indexData.ts` from `virtual:skeleton-index`'s new named export `regions`; `appGraph` adds the edges as chunk `regions`. Tests: `tests/regionMembership.test.ts` (17). Golden: `tests/golden/regions.json` (each ID's regions; each region's name, coarse parent and members per layer), harness `buildRegions`.
- **Numbers.** 1,138 structures, 1,072 with a mesh (751,546 high-LOD vertices, under 1 s), **2,414 `located_in` edges**, 101 structures in four or more regions (118 before the overrides). Smallest regions: arm 1 bone + 21 muscles; thigh 1 + 3 ligaments + 25 muscles. Whole-layer totals equal the manifests (1,499,634 high, 449,623 low; unit-tested).
- **Overrides: 63, bones only (plus one no-mesh muscle), each with a reason.** BL's policy: soft tissue keeps what its vertices say (long muscles in several regions are correct, spec §6.2); a bone is moved only where a region's box reaches a bone that anatomy places elsewhere. Removed: the ossicles, temporal and occipital bones from the posterior neck; the hyoid from the face; the mandible and C3–T1 from the anterior neck; L1–L3 from the thoracic wall, L1–L5 from the abdominal wall, L4–L5 from the pelvis; the sacrum from the posterior abdominal wall and the lumbar back; ribs 1–7 from the shoulders, ribs 6–11 from the abdominal wall; the femora from the pelvis; the scapulae and clavicles from the thoracic wall; `articularis_genus_*` from the hip (it inherits the femur's regions). **Accepted as computed:** rib 1 and the medial clavicle in the anterior neck (root of the neck), the thoracic vertebrae in the thoracic wall (the thoracic cage), the ribs' posterior halves in the thoracic back, the hip bone in six regions, the digastric's posterior belly in the cranium and the posterior neck. The thoracic wall's world box is the loosest volume (it reaches the lumbar back muscles); if that matters in BN's UI, the fix is in `regions.json`'s pads, which would change the approved volumes, so ask first.
- **Departures from decision 4, with reasons.**
  - **Inheritance by tier-1 neighbours is "the regions most neighbours share"**, not their union: the union put the wisdom teeth in the orbit (the maxilla reaches it) and the lower ones in the anterior neck. Now `tooth_18` = face + oral cavity, `patellar_ligament_*` = knee. A structure with parts still takes the union of its parts' regions. 66 structures inherit (58 by parts, 8 by neighbours).
  - **`located_in` is not compiled by `compileContentGraph`.** It isn't authored content, and as a graph source it would ship in the lazy chunks' edge lists (`shipEdges`), changing them. validate-content checks its endpoints with the generic `compileGraph` over the structures plus the region keys; the region checks run there too (the key collision check is `checkRegionsFile`, also run by `regions:volumes`).
  - **Region nodes** are not in the index's `nodes` (the joints' list): the regions' keys and names ship in the packed `regions` instead, and `regionInfo` answers for them. `indexNode` is unchanged.
- **Home coarse region** (decision 9) is in the file for every structure with a mesh (`null` without one): head 159, neck 90, thorax 128, abdomen 24, pelvis and perineum 50, back 47, each upper limb 138, each lower limb 149.
- **Vitest trap:** `src/regions/index.ts` must not import the registry at run time. The setup file loads it before a test's `vi.mock` of `registered.ts`, and a registry evaluated then never sees the fixture's list (12 fixture tests failed until `locatedInEdges` took the edge type as an argument).
- **Main chunk: 489.3 kB** `gzip -9` (index + modulepreloads; +3.0 kB over BK's 486.3; budget 500.1). The `registry` chunk is 9.8 kB of it.
- `npm run check`: pass (690 tests; the five goldens unchanged, `regions.json` new). e2e: `fixture` (3) and `smoke` + `related` (12) pass.

### BM (design, 2026-11-25): region focus state

- **Reducer** (`src/state/isolation.ts`). `Isolation.reg`; `FULL_SKELETON.reg = null`; every existing step carries `reg` through (with no region it is exactly M12's). `focusRegion`: from the whole body **push**, from another region with nothing isolated **replace**, the same region with nothing isolated **none**, from any isolation (in a region or not, the same region included) **push** with `sel`/`grp` cleared. `back`: out of the isolation first (a group or a tier-0 leaf goes to the region level, `{reg}`), then out of the region (pop to the whole body). `levelOf` adds 1 for a region. New helper `isIsolated`.
- **Departure, `leaveRegion` from an isolation:** decision 7 says "pops, or replaces"; a pop from an isolation inside a region would land on the region level, not leave it. So `leaveRegion` **pops only with nothing isolated**; with an isolation it **replaces** the entry with the same isolation and `reg: null` (shown over the whole body). BN's "leave region" control can rely on that.
- **Store / history** (`store.ts`, `selection.ts`). `reg` in the store; `setIsolation`'s `reg` left out keeps the current region (so the partial callers, `selectSoftFromUrl`, `selectAndFrame`, keep it); `hideStructure` keeps the region. `dispatchIsolation` writes `reg` to the URL; `skvDepth` counts the region entry like any push. New actions `focusRegion(key)` (unknown key: nothing) and `leaveRegion()`, also on `window.__viewer` (`focusRegion`, `leaveRegion`, and `state().reg`). `onPopState` treats `reg` as part of the isolation. An unknown `reg=` at load is dropped from the URL (replace).
- **URL** (`url.ts`). `UrlState.reg`, `parseUrlState`'s fourth argument `isRegion` (snake_case checked first); `reg=` after `sel`/`tier`/`ant` or `grp`, before `ghost`. `urls.json` unchanged; `tests/url.test.ts`'s two whole-object expectations gained `reg: null`.
- **View** (`scene/isolation.ts`). `memberSet(key)` (cached `Set`, `src/regions/index.ts`). `isolationView`/`groupView` take `region` (last argument): the solid set is cut to the members, the focus kept; an isolation with nothing in the region stays an isolation (nothing solid) instead of falling back to the full view. `sceneView` takes `region` and `SceneView.region`; `shownIn` hides non-members after the focus/joint and `hidden` checks, so ghosts are cut too and `isPickableIn` (picking, hover, Tab cursor, labels, legend) follows. `viewOf` reads `st.reg`. `CameraRig`'s isolation box is cut to the region; the cursor clears on a region change; `Isolation.tsx` and `Labels.tsx` re-apply on `reg`. The old bones-only `isPickable(IsolationView)` is unchanged (no live caller passes a region).
- **Left for BN:** announcements (the composer sees a region step only as its `sel`/`grp` change today: "Body region: …", "Left the body region.", "outside the body region"), breadcrumb, framing on the region, the picker. `announce.ts`'s tier counts still use `isolationView` without a region.
- **Tests.** `tests/regionFocus.test.ts` (24): every transition in the plan's list, `levelOf`, URL round trips and drops, the view sets on real IDs (`forearm_left`: radius/ulna in, humerus out; a femur selected from outside; a joint partner outside; a muscle's parts; a group-less isolation with nothing inside), and the history through `selection.ts` with a fake window holding a real entry stack (Back × 4, region → region, region from an isolation, deep link, unknown key, Hide). e2e: new `tests/e2e/regions.spec.ts` (4, URL and `__viewer` only; BN extends it).
- **Main chunk: 489.5 kB** `gzip -9` (index + modulepreloads; +0.2 kB over BL; budget 500.1).
- `npm run check`: pass (714 tests; the six goldens unchanged). e2e `regions` + `select` + `related` + `nested` + `layers`: 43 of 44 passed; the one failure was `nested`'s first test (the hover tooltip over the triceps didn't appear within 5 s while the layer files loaded in parallel workers); `nested.spec.ts` alone then passed twice (3/3), so it's a load-timing flake, not a BM regression.

### BN (routine, 2026-11-26): region UI

- **Toolbar.** "Body region" (`BodyIcon`, `data-testid="region-tool"`, `aria-pressed` while a region is in focus, title names it) is an overflow tool: in the bar with room, under "More" on phones (`toolbarFit` unchanged). `.tool` gained `white-space: nowrap` (the fit model always measured labels on one line; "Body region" wrapped).
- **Picker = a modal `<dialog>`, not a toolbar popover** (`src/ui/RegionPicker.tsx`, lazy; `RegionPickerHost.tsx` mounts it while store `regionPickerOpen`, `openRegionPicker()` for BP's prompt). Reason: the list plus two maps needs more room than a popover, the More menu would otherwise hold it inline, and a modal gives Esc, the focus trap and the backdrop for free. On closing, focus returns to the Body region button, else "More", else the canvas. Contents: "Whole body" (= `leaveRegion`), the ARIA tree (coarse rows open to fine rows; roving tabindex; Up/Down/Home/End, Right opens or enters, Left closes or goes to the parent, Enter/Space chooses; a coarse row chooses the coarse region, its chevron toggles), and the two maps. Counts: a region's members drawn on the layers showing (**On or Ghost**, as tiers count them, not On only), parts once as their muscle (`regionCounts`, `src/content/announce.ts`).
- **Body map** (`src/regions/bodyMap.ts`, pure; `virtual:skeleton-region-map` in `index-plugin.ts`): each shape's corners projected orthographically (front from +Z, back from −Z), convex hulls, painted back to front by nearest point; a region whose volume lies inside another's (orbit and oral cavity in the face, ear in the cranium) is painted just after it. A region less than 20 % visible in a view (4 mm raster) is left out of that view: front 27 regions, back 27; **the pelvis and the perineum are on neither map** (inside or under the trunk boxes) and are reached from the list. Each region is one `<g role="button">` per map with the list row's name; one Tab stop per map, arrow keys move. The plugin also emits each region's world box (fine and coarse) for framing.
- **Main chunk: 488.6 kB** `gzip -9` (index + modulepreloads), **−1.2 kB** against BM's tree measured the same way (489.8 here; BM's note says 489.5). First try (picker importing the store, selection and announce) measured 493.1: +0.8 kB of my main-chunk code and +2.5 kB of re-chunking. **The fix: the lazy chunk imports only React and its map data, and the host passes regions, counts and callbacks as props.** Rolldown then folded meshoptimizer and the runtime into `index` (still eager, nothing load-critical moved) and split `jsx-runtime` out. Picker chunk 4.1 kB. Lesson for later lazy UI: a lazy chunk must not import the app's own modules.
- **Framing.** `CameraCommand` `frame` takes `region: { box }`; `chooseRegion(key, box)` (`selection.ts`) focuses and frames two frames later. With nothing isolated in a region, `frame` boxes the region's drawn members (`regionBox` in `CameraRig.tsx`, every layer showing) joined with the volume's box; a `reg=` deep link starts framed on the members (no volume box in the main chunk). The rig records `regionFrame {before, after}` (`before` kept across region → region); when `reg` goes to null and the camera is still at `after` (1 mm), it goes back to `before`.
- **Breadcrumb.** `Skeleton › Forearm (left) › …`: **"Skeleton" is kept as the root** (every M12 breadcrumb unchanged); the spec's example is the crumbs after it. The region's crumb is a button while something is isolated (`focusRegion(reg)`: leaves the isolation, keeps the region) and the current crumb at the region level. With a region, "Skeleton" calls `leaveRegion` (BM: an isolation stays, over the whole body).
- **Announcements** (`isolationAnnouncement`; `Isolated.reg`, `isolationChanged` includes it): a new region, or back to the region level: "Body region: forearm (left). 2 bones shown." (`countsPhrase`, so "… and …" as elsewhere; none: "Nothing in the layers showing."); leaving: "Left the body region." (first, when the isolation also changes); a selection outside: the M12 message + " Outside the body region."; tier counts cut to the region. Every message outside a region is unchanged. Groups inside a region keep M5's wording (member counts not cut): left as is.
- **Tests.** `tests/regionUi.test.ts` (14): projection, hulls, nesting, which regions each view shows, boxes, the announcement cases. e2e `regions.spec.ts` 4 → 10 (list by keyboard with framing, focus return and announcement; Esc and Whole body with the camera restored; the maps by click and by keys, same names as the list; select → tiers → region crumb → Back × 4 with announcements; outside selection and the Skeleton crumb; phone under More); the BM layer test now also checks ligaments. `a11y.spec.ts` + 1 (picker, a region with a selection, the picker with a region chosen).
- **e2e.** `regions` 10/10. `polish` + `a11y` + `keyboard` (31): first run 29/31: the new axe test failed (`label-content-name-mismatch`: the rows' `aria-label` added the count to the visible name; fixed by dropping it, the name is now the row's text with a hidden comma) and `keyboard`'s M7 Layers test timed out at 180 s while the muscles layer loaded beside other workers; re-run alone, both pass. No existing e2e test was edited.
- `npm run check`: pass (728 tests; the six goldens unchanged).

### BO (design, 2026-11-26): region chunking

- **Files.** `src/regions/chunks.ts` (pure: `layerChunks` = a layer's structures with a mesh by home coarse region, in coarse order, empty regions left out; `homeChunks`; `chunksFor(chunks, region, members, extra)`; `checkChunks`; `chunkStem` = `<file>-<coarse>-<lod>`). `ModelSpec.chunking: "single" | "region"`. `scripts/lib/index-plugin.ts`: `readMembership` (the descriptor's file plus `RegistryOption.extraMembership`, merged by `mergeMembership` in `src/regions/membership.ts`), `readChunkTable` (refuses a chunked eager layer and a structure with no home), and the virtual module **`virtual:skeleton-chunks`** (the chunk table; imported only by `src/layers/urls.ts`, so it rides in the lazy layer chunk; `{}` in the real app). `scripts/models/split-regions.ts` (prints the chunks it wrote, nothing for a single-file layer) and `scripts/compress-models.sh` (calls it for every stem and LOD; `OUT=` and `SKV_REGISTRY=fixture` added). `scripts/lib/registry-option.ts` (`SKV_REGISTRY=fixture` → `tests/fixtures/systems/option.ts`, split out of `vite.ts` so scripts don't load Vite). `check-models`: a chunked layer is checked as the union of its chunks (names, bounds, summed size and triangles) plus `checkChunks`, and prints each chunk's size; `SKV_REGISTRY=fixture npm run check-models` checks the fixture's own files (`RegistryOption.modelFiles`) and is now in `npm run check`.
- **Musculoskeletal parity.** No real layer is chunked (unit-tested: `readChunkTable()` is empty); `sha256sum public/models/*.glb` identical before and after; `split-regions.ts` prints nothing for all five stems, so `compress-models.sh` runs exactly the old gltfpack command for them.
- **Loader** (`LayerScenes.tsx`, `loadLayer.ts`, `urls.ts`). A chunked layer wants `chunksFor(…, st.reg, membersOf(reg), [st.sel])` (a store subscription keyed by the chunk list). Chunks are fetched in parallel, each once (a pending map survives a change of region mid-download), with the Layers panel's progress summed over them; Retry refetches only what failed. A region with no member in the layer fetches nothing and the layer is "ready" with no batch. On the final LOD, a new region fetches its missing chunks at that LOD only. `?debug`'s bounds line for a chunked layer is checked against the chunks fetched.
- **Departure, "BatchedMesh instances added":** the layer's batches are **rebuilt** from every chunk fetched at that LOD and swapped in, by the same path as a LOD swap, rather than grown in place: the outlines share the solid batch's buffers, and `BatchedMesh.setGeometrySize` reallocates them. So a chunked layer keeps its fetched parts' geometry for the LOD on screen (freed when another LOD replaces it); single-file layers still free theirs at once. Chunks fetched for an earlier region stay in the batch (hidden by the region view), so going back fetches nothing.
- **Departure, the selection's chunk:** decision 7 draws a selection made from outside the region; its home chunk is fetched with the region's, or it couldn't be drawn.
- **Side fix:** the picking BVH (`ensureBoundsTrees`) is now built on the last batch the run built. Before, it read `shownRef`, which still held the previous batch right after `setShown` (React renders later), so without `?debug` the final LOD's batch got no BVH and picking used three.js's slower exact raycast. Results are the same; only the speed differs.
- **Fixture** (decision 11). `widgets/membership.ts`: each kind's row of four sits in a 2 × 2 grid just inside the front face of one fine region's resolved box (gears: face → head; springs: thoracic wall → thorax; levers: thigh (left) → left lower limb), and its membership is computed with the app's `vertexShares`/`memberIndices`/`triangleTotals` into `widgets/located-in.json`, merged into the real file by the fixture's registry option (the index plugin in `--mode fixture`, the scripts with `SKV_REGISTRY=fixture`). Two gears reach the anterior neck (25 %), so focusing the neck fetches the head's chunk: the home-versus-membership case. `generate.ts` writes the uncompressed build to `.cache/build-fixture/`, then runs `compress-models.sh` with the test registry: `models/widgets-{head,thorax,lower_limb_left}-{low,high}.glb`, 2.8 kB each (the two whole files are gone). Deterministic (hashes identical on a re-run). **Re-run it after any change to the region volumes or region list:** `tests/regionChunks.test.ts` fails while the committed membership is stale, and the merge refuses a different region list.
- **Fixture tests changed (positions and file names only):** `fixture.spec.ts`'s first test matches chunk names and expects the three low chunks; `fixture.test.ts`'s file test reads the chunks (`centreOf` → `centres()`), each node in its home chunk. The picking test needed no new coordinates (it reads the box's screen position). New: `tests/regionChunks.test.ts` (9: table, plan, checks, the real registry unchunked, the fixture's membership up to date, homes, merge, the plan per region) and `fixture.spec.ts` + 2 (`reg=head` fetches only `widgets-head-low`, the thorax adds its chunk (8 instances), back to the head fetches nothing, the whole body adds the last (12), bounds OK at each step; `reg=forearm_left` fetches no chunk and shows no progress or Retry).
- **Main chunk: 488.6 kB** `gzip -9` (index + modulepreloads; unchanged from BN).
- **e2e:** `fixture` 5/5; `layers` + `smoke` + `tints` + `regions` 40/40, first run. `npm run check`: pass (737 tests; the six goldens unchanged).

### BP (design, 2026-11-26): budget governor

- **Files.** `src/scene/budget.ts` (pure: `govern`, `drawnTotal`, `cappedLods`, `deviceBudget`, `heldLayers`, `drawnModes`, `promptKey`, the budgets and `BUDGET_PROMPT`); `src/state/budget.ts` (the store slice's wiring: `initBudget` in the Viewer's plan initialiser, before anything is drawn; `watchBudget` (StrictMode-safe effect); `setBudgetPlan` called with each new plan before `setPlan`; `viewTotals`, `layerLods`, `dismissBudgetPrompt`); store `budget` (limit and its source, phone, plan LOD and source, caps, drawn, over), `budgetHeld`, `budgetPrompt` (the view key while shown), `budgetDismissed`; `src/ui/BudgetPrompt.tsx` (main chunk, above the toolbar where the toast sits), `src/ui/BudgetDebug.tsx` (the `?debug` line, `data-testid="debug-budget"`). Tests: `tests/budget.test.ts` (19), `tests/e2e/budget.spec.ts` (6), `fixture.spec.ts` + 1.
- **What it counts: the index's totals for the view**, not the batches' drawn instances: each layer On or Ghost (and not held) adds `regionTriangles(layer, lod, reg)`: the region's members, or the whole layer. Departure from "from the batches once they are loaded": the totals already equal what a loaded layer draws in the view, apart from `hid=` and the depth peel, which are left out on purpose (an upper bound that doesn't move with each Hide, so the caps don't flap with selections). Patches are reported in the debug line (`data-patches`) but not counted, as decided.
- **Step 1.** Only with the plan's source Auto and its final LOD high. Heaviest uncapped drawn layer (by its high total; ties in registry order) first, skipping a layer whose low equals its high (capping it saves nothing: the fixture's boxes). Lifting: lightest capped drawn layer first, kept lifted only if the total stays ≤ 90 % of the budget. **Caps of layers not drawn are kept** (frozen, counting nothing), so turning a capped layer off and on doesn't fetch high in between. A cap reaches the loaders as the layer's plan cut to low (`cappedLods`): `Viewer` (bones, `bonesPlan`, also the debug overlay's plan and `?bench`'s wait) and `TissueLayerScene` (its `lodKey`), through the existing `lodsToLoad` path (a high batch is swapped down to low). `benchLayersState` takes a per-layer final LOD.
- **Step 2.** The prompt "This view is heavy for this device. Focus on a body region?" with "Choose a body region" (primary; opens the picker, which counts as answering it for this view) and "Not now". Key = every layer's mode + the region, so it is shown at most once per change of layers or region; hidden while the picker is open or layers are held. Announced last in the composed message when it appears (`AnnounceState.prompt`); the Announcer starts from `prompt: null`, so a prompt on the page's first view is said too (the one exception to "not the state the page opened with": it asks for an answer).
- **Phone start** (shortest side < 600 px, `chooseLod`'s class). With no `reg=` and the requested layers over budget at the planned LOD, the layers are added in **registry order (inside out: bones, cartilage, ligaments, muscles)** and the first that crosses and every later one are **held**: loaded, drawn as Off (`viewOf` maps them through `drawnModes`, so picking, labels and counts agree), and the picker opens. **Closing the picker any way** (a region, "Whole body", Esc or Close) releases them; with the whole body still over, the prompt follows, so nothing is ever dropped silently. Departure: the plan said "until a region or Whole body is chosen"; Esc counts as Whole body so a phone user can't be left with layers hidden and no visible reason.
- **`?budget=`** only with `?debug` (positive integers). e2e: headless Chromium's SwiftShader makes Auto plan low, so the step 1 tests report a capable GPU with an init script patching `getParameter(RENDERER)` (test-only; no app hook). The plan's e2e budget of 900k caps the bones too (929,684 after the muscles), so the test uses **1M**: muscles capped, 929,684 drawn, bones/ligaments/cartilage reach high, `muscles-high.glb` never fetched; `reg=forearm_left` lifts the cap. 300k (Auto low) shows the prompt; on a 390 px phone 300k holds the muscles and opens the picker.
- **Fixture.** The widgets' two LODs are the same boxes, so the governor never caps them; the fixture test caps the bones in `reg=head` and checks the chunked layer fetches only `widgets-head-{low,high}` (bounds OK, 4 nodes), the bones stay low and the prompt shows.
- **Parity.** `tests/budget.test.ts` asserts the index's whole-layer totals are the manifests' (1,499,634 / 449,623), that they fit both budgets, and that `govern` and `heldLayers` do nothing on them; the e2e parity test checks the same in the app (all four layers On, Auto high: no caps, no prompt; phone: no picker).
- **Main chunk: 490.4 kB** `gzip -9` (index + modulepreloads), +1.8 kB over BO's 488.6 (re-measured at BO's commit in a worktree the same way). Budget 500.1.
- **e2e:** `budget` 6/6 and `fixture` 6/6 (one new); smoke + viewer + layers + regions + a11y + tints + budget **82/82**, first run. No existing e2e test was edited. `npm run check`: pass (756 tests; the six goldens unchanged).

### BQ (routine, 2026-11-26): keyboard cursor, labels, `[` / `]`

- **Tab cursor** (`CameraRig.tsx` `visibleIds`). The stops were already cut to the region by BM (`isPickableIn` over `viewOf`). New pure `focusLayerFirst` (`src/camera/input.ts`): in a region, a stable partition putting the focus layer's structures first, before `cursorStops`. The focus layer is `focusLayerOf` (the labels' rule) over **`drawnModes`** (held layers count as Off, as the handoff asked). With no region the list is untouched (`focusLayerFirst(…, null)` = today's).
- **`[` / `]`** (pure `layerJump`): the first stop of the previous / next layer, layers in the order the stops walk them; with no cursor `]` = the first layer, `[` = the last; **no wrapping** (as Tab stops at the ends): "No next layer." / "No previous layer." The jump announces the layer: "Bones: Radius, left. 9 of 14." Only with the canvas focused, like Tab. Kept in M13 (the plan offered M14; nothing was in the way). The canvas's `aria-label` (the keyboard help) names them.
- **Label thinning** (`Labels.tsx` `computeLayout`, pure `thinCandidates` in `src/scene/labels.ts`). The candidates were already the drawn structures (the batches' `getVisibleAt` follows region, layers, Hide and the held layers). Before projection: centre inside the camera frustum (the layout's own anchor-in-area test, done earlier), size on screen from radius over distance (no projection needed), priority-3 candidates under the size floor dropped (the layout drops them too), then the best *N* in `labelOrder`'s order (priority, size, focus layer on ties); only those are projected and laid out. **Thinning applies only with a region in focus or a second layer drawn**: a bones-only view of the whole body keeps every candidate, so it is exactly today's even zoomed in (a zoomed-in hand can pass *N*). Tested: under the cap the layout is identical; cut to *N*, the first *N* the layout tries are unchanged.
- **Also:** the probe now reads each batch's world spheres once (they move only with Explode; with Explode at 0 they are cached per batch). It saved little (the measurements below are after it).
- **Measuring *N*.** `?debug&labelmax=<n>` overrides the cap (0 = none); `LABELS=1 [LABELMAX=n] npm run bench-container` turns labels on, adds an all-layers `reg=thorax` link and prints each run's label layout median and max and the candidate count (`__viewer.labelCandidates()`). Container (SwiftShader, 1280 × 800, 3 runs each, medians of the run medians; few layouts with all layers because the orbit runs at under 1 FPS here):

  | Link | No cap | *N* = 100 | *N* = 60 | *N* = 40 |
  | --- | --- | --- | --- | --- |
  | bones only, whole body | 0.6 ms (42 candidates) | 0.6 ms | 0.6 ms (42) | 0.6 ms |
  | all four layers On, whole body | **1.3 ms** (191) | 1.1 ms | **0.9 ms** (60) | 1.0 ms |
  | all four layers On, `reg=thorax` | **1.1 ms** (160) | 1.1 ms | **0.8 ms** (60) | 0.8 ms |

  ***N* = 60** (`MAX_LABEL_CANDIDATES`). Below about 60 nothing more is saved: what is left (about 0.3 ms over bones only) is the pass over every drawn instance (about 1,100 with all layers), not the layout. The bones-only figure holds within about 0.3 ms, not exactly; a real device will tell (the M14 device runs).
- **Tests.** `tests/labels.test.ts` + 5 (`thinCandidates`), `tests/sidebar.test.ts` + 2 (`focusLayerFirst`, `layerJump`). e2e `regions.spec.ts` + 2: in `forearm_left` with bones and ligaments, Tab starts on a ligament, `]` goes to the bones (announced "Bones: …"), `]` again says "No next layer.", `[` goes back, and Tab to the end never leaves the region; labels in a region are only drawn members, and all four layers On give the layout exactly 60 candidates.
- **Main chunk: 490.4 kB** `gzip -9` (index + modulepreloads; unchanged at this rounding). Budget 500.1.
- **e2e:** `keyboard` + `sidebar` + `polish` + `labels-layers` + `regions` (2 workers): 38/41. The three failures were all in `keyboard.spec.ts` and all timeouts (a `page.evaluate` or key press that never returned), because a 3-run `bench-container` was running alongside at the same time. Re-run alone, `keyboard.spec.ts` passed 5/5. No existing e2e test was edited.
- The *N* = 120 bench (also contended by that e2e run): all layers 1.2 ms, thorax 1.2 ms, 120 candidates; consistent with the table.
- `npm run check`: pass (763 tests; the six goldens unchanged).
