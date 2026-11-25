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
| BK | design | The region list and its volumes, resolved from anchor bones, plus the `?debug&regions` view (step 1) | none | decisions 1–3 | `content/regions/regions.json`, the resolver and the debug view committed; screenshots in the notes; **gate: the user approves the list** | |
| BL | design | Membership: vertex shares → `located_in` edges, overrides, checks, the regions golden, per-region triangle totals in the index (step 2) | none | decisions 4–6 | `npm run regions` writes the membership and `check` verifies it; the spec §10 region checks pass; `tests/golden/regions.json` committed; the five goldens unchanged; main chunk measured | |
| BM | design | Region focus state: reducer, URL `reg=`, history and Back, combined with isolation, groups and tiers, `sceneView` hiding non-members (step 3) | none | decision 7 | unit tests for every transition; the five goldens unchanged; `select`, `related`, `nested`, `layers` e2e pass | |
| BN | routine | The region UI: toolbar control, body map and list, camera framing, breadcrumb, announcements (step 4) | none | decision 8, BM | new `tests/e2e/regions.spec.ts` and the a11y pass for the picker; `polish`, `a11y` and `keyboard` e2e unchanged and passing | |
| BO | design | Region chunking: split the model per coarse region after the build, the chunk checks, and a loader that fetches only the regions in view, proven on the regenerated fixture (step 5) | none | decisions 9, 11 | fixture Vitest and e2e prove that only the chunks in view are fetched; `check-models` covers the chunks; musculoskeletal files byte-identical | |
| BP | design | The budget governor: drawn-triangle tracking, per-layer LOD capping, the prompt, and the phone's region start (step 6) | none | decision 10 | pure governor unit tests; e2e with `?budget=`; no trigger on today's content (parity) | |
| BQ | routine | Keyboard cursor and label thinning scoped by region, plus `[` / `]` to jump between layers (step 7) | none | decision 12 | `keyboard`, `sidebar`, `polish` and `labels-layers` e2e pass; label layout times recorded | |
| BR | routine | Wrap-up: goldens, parity table, full e2e in the background, `/m13/` (step 8) | none | everything above | exit criteria ticked; `/m13/` live | |

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

- [ ] Region list and volumes; `?debug&regions` view; user checkpoint on the list.
- [ ] Membership computed into `located_in` edges, with overrides and checks.
- [ ] Region focus UI, breadcrumb, URL, history; combined with isolation and Back.
- [ ] Region chunking in the build and loader, proven on the fixture layer.
- [ ] Budget governor; phones start in region mode only when over budget.
- [ ] Keyboard cursor and label thinning scoped by region.
- [ ] Every golden unchanged (`tiers`, `panels`, `urls`, `search`, `tree`); `regions.json` added; old URLs open the same view.
- [ ] No regression: every existing unit and e2e test passes unchanged, except where a step lists why (spec §2.1). Performance parity with no region chosen (bench, perf-load, main chunk ≤ 500.1 kB).
- [ ] **Hosted copy is live and linked below** (an extra requirement for every milestone).

---

## Step 0: M12 close-out and handover (done in the planning session)

- `/m12/`: confirmed live by the user (2026-11-25). "Hosted copy is live" is ticked in `docs/PLAN-milestone-12.md`. `m12` was already frozen at `3d8adef` by BJ's follow-up (#28, `14cbc32`).
- `deploy/pages.json`: `current` set from `null` to **13**, so the next deploy of `main` builds `/m13/` from it. `README.md` has an M13 row marked "In progress". `CLAUDE.md` has the new status line.
- **Still open, carried over (for the user, any time):** the real-device gate from M10 (AO/AP; M14's device runs can fold it in); QUESTIONS 1–139; the per-browser `?bench` table (M5 step 12).

## Decisions made in this plan (say if any should change)

1. **The region list** (spec §6.1, §12 default: the two-level list). BK starts from the spec's table and records the final list here. The proposed changes are listed below; the user decides at the BK gate.
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

## Approved golden differences

None yet.

## Session notes

(Filled in by each session.)
