# Milestone 14 Plan: Search, colour and scale UX (Platform spec, M14)

Source of truth: `SPEC-platform.md` §2 (hard rules), §5.2 (sidebar tree), §7 (colour model), §8 (search, tree and keyboard at scale), §10 (fixture layer, goldens), §11 (M14), §12 (defaults) and §13 (working rules). The earlier specs and `CLAUDE.md`'s ground rules still apply. Workflow: `docs/WORKFLOW_NEW.md`. **This phase adds no anatomy:** `git diff dc55686 -- public/models/ content/` stays empty in every session, apart from `content/synonyms.json` if decision 3 needs a generic-word list there (it doesn't by default). QUESTIONS start at **140**.

## Goal

The app should stay usable as later systems bring it from about 1,100 structures to 3,000 or more. **Search** gets one lazy index per layer, a ranking that doesn't depend on how the indexes are split (exact name, then common names and synonyms, then partial matches; inside each band, structures in the current body region first, then visible layers), and filter chips per system. The **sidebar** groups its roots under system headers, and each system's tree loads lazily. The **colour model** separates jobs: hue identifies the layer, a pattern marks a relation role, and context dimming keeps the focus layer's colours meaningful. A table of proposed colours for future systems (arteries, veins, nerves, lymph nodes, organs) is tested and recorded but not shipped. The milestone ends with the **real-device checks** (PC and iPhone `?bench`), which also close the M10 device gate.

With every new feature at its default (no chip chosen, no selection), the app looks and behaves **exactly as at M13**, apart from the search ranking (spec §11: "`golden/search.json` differences reviewed with the user") and the sidebar's system header (decision 6). `tiers`, `panels`, `urls`, `tree` and `regions` goldens stay unchanged.

Out of scope (M15, `SPEC-platform.md` §11): `build.json`, the Python build reading per-layer config, the curve spike, the `STATUS.md` platform rewrite and `docs/ADDING-A-SYSTEM.md`. Also out of scope: new anatomy, new content, a "Located in" panel section, and shipping the future-system colours.

## What exists already (M1 to M13)

- **Search** (`src/content/search.ts`, M5, M9). Two lazy indexes, both minisearch: the bones' (`virtual:skeleton-search`, fetched when the sidebar opens or the field gets focus) and one for all the soft layers (`virtual:skeleton-search-soft`, first keystroke), each with group-synonym documents. Fields and boosts: name 3, common 2, synonyms 2, Latin 1, FDI 3; prefix, fuzzy 0.2 over 3 letters, `AND`. Side words filter (`parseQuery`). `mergeSearchers` sorts both lists by **BM25 score**, so splitting an index changes the order: BM25's term weights depend on the corpus. The sidebar asks for 30. `KindDescriptor.searchFields` is still unused (M11 decision 2).
- **`tests/golden/search.json`**: 60 queries, top 10 each (`id | label | match | group | drawn`), scores not recorded.
- **Sidebar** (`src/ui/Sidebar.tsx`). Roots: the bones' tree (eager, `EAGER_TREE`, its groups in the main chunk for breadcrumbs and `grp=`), then Muscles, Ligaments and Cartilage from **one** lazy chunk, `virtual:skeleton-soft-tree` (`softTreeLoader.ts`). The roots aren't grouped by system. The Layers panel is already grouped by system (M11).
- **Colours.** Layer colours are in the descriptors (`ColourSpec.material`, M11); the tendon colour is a constant (`src/layers/colours.ts`). The role tints are Okabe–Ito (`src/scene/tints.ts`: origin `#F0E442`, insertion `#0072B2`, antagonist `#CC79A7`), drawn as a tint of the whole structure or of an attachment patch (M9). `tests/colourVision.test.ts` (M10 AL) checks every pair that can meet: ΔE2000 ≥ 8 under normal vision, deuteranopia and protanopia, ≥ 20 for the tints and their neighbours, with an `EXEMPT` list. It reads the layer colours from the registry, but its pair table is hand-written.
- **Keyboard and labels at scale**: done in M13 BQ (`focusLayerFirst`, `[` / `]`, thinning to 60). Nothing left for M14 apart from the device timings.
- **Fixture** (`tests/fixtures/systems/demo/`). A second system (`demo`, layer `widgets`, region-chunked), so it is the only place where more than one system exists. It has no search yet (M11 decision 8 left search to M14).
- **Allowlist.** One M14 entry: `scripts/perf-load.ts` (times turning on the muscles by name). It must go in M14.
- **Main chunk at M13:** **490.9 kB** `gzip -9` (index + modulepreloads). Budget **≤ 500.1 kB** (spec §2.4). That leaves **9.2 kB** for all of M14. The search, tree and picker code is lazy already. The chips, the pattern shader and dimming are not (decision 12).

## Progress

Session kinds: **design** = strong model; **routine** = Sonnet is fine. No subagents (spec §2.5). Session IDs continue from M13 (BS onwards).

| Session | Kind | Serial task (one sentence) | Fan-out | Inputs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| (planning) | design | M13 → M14 handover and this plan (step 0) | none | `SPEC-platform.md` | `m13` frozen, `current` 14, plan written | **Done** (2026-11-26). See step 0 |
| BS | design | The new search ranking: match bands, generic words, the context tie-breaks, on today's two indexes, and the `search.json` difference report (step 1) | none | decisions 1–3 | ranking unit tests; `REPORT-search-golden.md` lists every changed query; **gate: the user approves the differences**, then the golden is rewritten | **Done** (2026-11-27); gate approved. See BS notes |
| BT | design | One lazy search index per layer, built from `searchFields`, loaded when its layer is on or a query is typed, plus the fixture's search (step 2) | none | decisions 4–5, BS | `search.json` as approved in BS, unchanged; fixture Vitest and e2e find widgets; chunk sizes recorded || **Done** (2026-11-27). See BT notes |
| BU | routine | Search filter chips and the region and visibility context wired from the store (step 3) | none | decision 5, BT | chips e2e on the fixture build; `sidebar` and `soft-sidebar` e2e pass; a11y pass | **Done** (2026-11-27). See BU notes |
| BV | routine | Sidebar roots grouped by system, each system's tree lazy (step 4) | none | decision 6 | `tree.json` unchanged; `sidebar`, `soft-sidebar`, `keyboard`, `a11y` e2e pass; fixture's system root lazy | **Done** (2026-11-27). See BV notes |
| BW | design | The colour model's data and test: `ColourSpec` shades, the registry-driven colour-vision test, and the future-system colours table (step 5) | none | decisions 7, 10 | `colourVision.test.ts` builds its pairs from the registry; the table passes and is recorded here; no on-screen colour changes | **Done** (2026-11-28). See BW notes |
| BX | design | Pattern cue for the role tints: per-instance pattern on the batches and patches, legend swatches, screenshot (step 6) | none | decision 8 | `tints` e2e and screenshot tests pass; pattern unit tests; main chunk measured | **Done** (2026-11-28). See BX notes |
| BY | routine | Context dimming of other layers in the related set (step 7) | none | decision 9 | dimming unit and e2e tests; colour-vision test covers the dimmed colours; `tints`, `tiers`, `layers` e2e pass || **Done** (2026-11-28). See BY notes |
| BZ | routine | Device-run prep: the three bench links, `perf-load` from the registry (the last M14 allowlist entry), the container parity table; then **gate: the user runs `?bench` on PC and iPhone** (step 8) | none | decision 11 | links in the plan; allowlist has no M14 entry; the user's figures recorded here | **Done** (2026-11-28; figures in; iPhone in Low Power Mode, 30 fps cap). See BZ notes |
| CA | design | Pattern scale and motion, from the device runs: period × 3, and the pattern stops swimming when the camera moves (the user chose surface-locked marks, see BZ notes) | none | decision 8, BZ notes | `tints` e2e and pattern unit tests pass; legend and screenshot still match the shader; checked by the user on a device | **Built** (2026-11-28); waiting on the user's device check (needs a merge to `main`). See CA notes |
| CB | routine | Wrap-up: goldens, parity table, full e2e in the background, docs, `/m14/` (step 9) | none | everything above | exit criteria ticked; `/m14/` live | **Built** (2026-11-28); merge, CA's device check and the `m14` freeze follow (the user's choice). See CB notes |

Triggers: "begin session BS" to "begin session CB". Every session follows `docs/WORKFLOW_NEW.md` §7: read `docs/HANDOFF.md` and this file, do the one serial task, end with `npm run check` and the e2e specs it touched, commit, push to the session branch, tick the row, write `docs/HANDOFF.md`, and stop.

**Order:**
- BS → BT → BU. BS's gate must be answered before BT starts, because BT's acceptance is "unchanged from the approved golden".
- BV needs nothing from BS–BU and can run any time (it touches the sidebar too, so not in parallel with BU).
- BW → BX → BY.
- BZ after BX and BY (the third device view uses the patterns). Its gate waits on the user; CA (pattern scale and motion, added from the device feedback) starts after the figures come back, then CB (wrap-up).

**User checkpoints**
- **Decisions 1 to 12 below.** Sessions build them as written unless the user says otherwise. Decisions 3 (generic words), 5 (chips hidden with one system) and 6 (the sidebar header) are the ones most worth a look.
- **After BS: the search differences** (spec §11). BS writes every changed query, old top 10 against new, to `assets/build/REPORT-search-golden.md` and stops. The golden is rewritten (`npm run golden -- --write --force`, search only) only after the user approves, and the approval is recorded in "Approved golden differences" below.
- **After BW: the future-system colours table.** Not a gate. It's recorded for the next spec, and the user may want to change hues.
- **BZ: the real-device runs** (spec §11). This is a gate: the user runs the three links on a PC browser and an iPhone and pastes the panel's figures back.
- **Any other golden difference** stops the session that caused it.

## Exit criteria (from `SPEC-platform.md` §11, M14)

- [x] Per-layer search indexes, filter chips, new ranking; `golden/search.json` differences reviewed with the user (BS, BT, BU).
- [x] Lazy tree per system (BV).
- [x] Colour model: registry-driven colour-vision test, pattern cue for role tints, context dimming (BW, BX, BY).
- [x] The proposed future-system colours table, tested (BW).
- [x] Real-device checks: the user runs `?bench` on PC and iPhone for: all layers solid; a region focus; a muscle tier 2 with antagonists and patterns (BZ; figures in BZ's notes; the iPhone ran in Low Power Mode, capped at 30 fps).
- [x] `tiers`, `panels`, `urls`, `tree` and `regions` goldens unchanged; `search` as approved; old URLs open the same view.
- [x] No regression: every existing unit and e2e test passes unchanged, except where a step lists why (spec §2.1). Performance parity with the new features off (bench, perf-load, main chunk ≤ 500.1 kB).
- [x] The allowlist has no M14 entry (M15 ×6 only).
- [ ] **Hosted copy is live and linked below** (an extra requirement for every milestone).

---

## Step 0: M13 close-out and handover (done in the planning session)

- `/m13/`: confirmed live by the user (2026-11-26). `m13` frozen in `deploy/pages.json` at the merge commit of #29, `dc55686` (`dc5568630b5a7f61d64e4edc4519d4cbb1af5c2d`), and `current` set from 13 to **14**. (BR's handoff suggested `null` until planning; planning happened in the same session, so it went straight to 14.) "Hosted copy is live" is ticked in `docs/PLAN-milestone-13.md`; `README.md` marks M13 live and has an M14 row marked "In progress"; `CLAUDE.md`'s status paragraph is updated.
- **Still open, carried over:** QUESTIONS 1–139 (content review, any time); the per-browser `?bench` table (M5 step 12, which BZ's runs can fill in part); the M10 real-device gate (AO/AP), **folded into BZ** (decision 11).

## Decisions made in this plan (say if any should change)

1. **Ranking by match bands, not BM25 score** (spec §8 "Ranking"). Today's order is minisearch's score, merged across indexes. Those scores depend on each index's term statistics, so per-layer indexes (BT) would reshuffle results for no reason a user could see. So the order becomes a **pure comparator over match facts**, `rankHits` in the search chunk:
   1. **Band.**
      - 0, exact name: the query's terms, after the side word is removed, equal the name's tokens (the FDI number counts as a name, as today).
      - 1, common name or synonym: every query term matches a common-name or synonym token exactly, or the query equals a group synonym.
      - 2, partial: anything else minisearch returns (prefix, fuzzy, Latin, mixed fields).
   2. **Inside a band:** members of the current body region first (`regionsOf`, from the index), then structures on visible layers (On or Ghost) before those on Off layers. With no region and the default layers, these change nothing.
   3. **Then** the number of query terms that matched exactly (more first), then the shorter name, then the ID's index order (`indexRank`), so the order is total and stable. Side isn't a tie-break: the side word already filters.
   - minisearch still finds the candidates (same fields, prefix, fuzzy, `AND`). Only the order changes. A comparator over facts that don't depend on the index's corpus gives the same order whether there is one index or eight; BT's test checks this.
   - The score field stays in `SearchHit` for debugging, but nothing sorts by it.

2. **Group results** (the `muscles.sets.*` and tree-group synonyms) rank in band 1 when the query equals one of their terms, and in band 2 otherwise, as structures do. Today they compete on score; BS lists where they move.

3. **Generic words** (spec §8: "left", "right", "muscle", "ligament", later "artery", "nerve" don't score alone).
   - The words come from the registry, not a list in `search.ts`: the side words (as now), plus each kind's `noun` (one and many: "muscle", "muscles", "ligament", "bone", "tooth"…), plus a small `searchStopWords` on the layer descriptor when a layer needs more ("cartilage", "disc" are nouns already). Future systems add theirs in their own folder.
   - **A query made only of generic words returns nothing** (today "muscle" returns structures whose name contains it). A generic word next to another word **filters**: "biceps muscle" keeps only results of a kind whose noun is "muscle", and "left femur" keeps the left side as today.
   - Some names *are* a generic word plus a qualifier ("Tooth 36"). FDI numbers already match alone, so nothing is lost. BS lists every golden query that changes because of this rule.
   - Say if a query of only a noun ("ligament") should instead list that layer's structures. The spec's wording ("don't score alone") reads as "return nothing".

4. **One lazy index per layer** (spec §8 "Search per system").
   - `KindDescriptor.searchFields` becomes required: which fields a kind's documents fill (name, common, synonyms, Latin, FDI for teeth). The document builders (`searchDocuments`, `softSearchDocuments`) become one generic builder reading each layer's compiled content through its content half, as M12 did for panels and trees.
   - Each layer's content half names its index chunk, `virtual:skeleton-search-<layer>`. The group-synonym documents go in the index of the layer whose tree holds the group.
   - **Loading:** a layer's index is fetched the first time that layer isn't Off, or when a query is typed (all layers then, as the spec says), whichever comes first. The bones' index keeps today's earlier fetch (sidebar open or field focus).
   - The merge becomes `rankHits` over every loaded index's hits. Results from an index still loading appear when it arrives, as soft results do today.
   - **The fixture's widgets get search** (completing M11 decision 8's list): their own `searchFields` and chunk, found by name in Vitest with the test registry and in `fixture.spec.ts`.
   - minisearch's options stay one shared object. Per-kind boosts are not needed (no golden query depends on them) and aren't added.

5. **Filter chips** (spec §8).
   - The row under the search box shows "All" plus one chip per system with a loaded layer. **With only one system (today's app) the row is not shown**, because a single "Musculoskeletal" chip would filter nothing. The fixture build has two systems, so the chips are built and tested there. Say if you'd rather see the row anyway.
   - The chips are a radio group (one chosen; "All" by default), with the M10 focus and contrast rules, and in the axe pass. The choice isn't in the URL or `localStorage` (the spec doesn't ask for it, and a stale filter hiding results is worse than re-choosing).
   - Choosing a chip filters the hits by system (the index's `layerOfId` → layer's system) and is announced ("Search limited to Demo. 4 results.").
   - **Context for decision 1.** The sidebar passes `{ region, visibleLayers }` from the store to the ranker. The golden harness passes the default context, so the golden is region-free.

6. **Sidebar roots grouped by system, each system's tree lazy** (spec §5.2, M12 decision 10).
   - The tree gets one top-level row per system ("Musculoskeletal"), with the layer roots under it in registry order. Rows keep their keys and group keys, so `tree.json`, `grp=` and breadcrumbs are unchanged. The system row is a tree item (`aria-level` 1); everything below moves down one level. The keyboard tests that count levels change for that reason only, and BV lists them.
   - **Lazy per system.** A system's lazy layers' trees become one chunk per system, `virtual:skeleton-tree-<system>` (today's `virtual:skeleton-soft-tree`, keyed by system from the registry). It is fetched the first time the system row is expanded, or when a `grp=` or search result needs one of its groups, as today.
   - **The bones' tree stays eager**: its groups are needed from the first frame for breadcrumbs, announcements and `grp=skull` deep links, and moving them out would change the main chunk and those paths for no user-visible gain. The spec's "each system's tree loads lazily" is met for every lazy layer. The eager layer's tree is the one exception, and the reason is recorded here.
   - The system row starts **expanded** (today the roots are visible on opening the sidebar), so opening the sidebar looks the same apart from the header row. Its expanded state is remembered with the Layers panel's collapsed systems (`systemGroups.ts`), so both panels agree.

7. **Colour data and the registry-driven test** (spec §7 points 1 and 5).
   - `ColourSpec` gains `shades?: Record<string, string>` for subkinds. The tendon colour moves from `src/layers/colours.ts` into the muscles descriptor as `shades.tendon`, and the file goes.
   - `tests/colourVision.test.ts` is rewritten so that **its pairs come from the registry**: every layer (material and shades) against every other layer that can be visible at the same time (every pair today; a descriptor can declare `neverWith` for layers that can't meet, none today), each solid and ghosted at the three opacities, against the region colours (bones only), the marks (accent, outline, hover, background), the tints and, after BY, the dimmed colours. The hand-written `EXEMPT` list stays only for pairs that are about drawing rules rather than layers (for example the ghost of a layer against its own solid), each with its reason.
   - Thresholds stay as they are: ΔE2000 ≥ 8 under normal vision, deuteranopia and protanopia. After BX the tints have a pattern too, so **tint against layer** pairs drop to the ordinary ≥ 8 (spec §7.2: role tints "only need to differ from each other, not from every layer colour"). Tint against tint stays ≥ 20.
   - **No on-screen colour changes in M14.** If the rewritten test finds a pair the old table missed, BW stops and asks (it would mean a colour change).

8. **Pattern cue for role tints** (spec §7.2, §12 default: diagonal stripes for origin, dots for insertion, cross-hatch for antagonist).
   - A screen-space pattern in the fragment shader, chosen by a **per-instance pattern index** on the layer batches (a small data texture read by batch ID, the way `BatchedMesh` reads its colours) and a uniform on the patch meshes. 0 = none. The pattern mixes the tint with a darker shade of itself (about 25 % darker, not black, so the AO still reads), in device pixels scaled by `devicePixelRatio`, about 6 CSS px per period, so it doesn't shimmer or vanish on phones.
   - The pattern is drawn wherever the tint is: a whole tinted structure or a patch. A structure that is both origin and insertion keeps M9's rule (origin tint plus insertion outline) and takes the origin's stripes.
   - **Legend.** Each tint chip shows its pattern (an inline SVG with the same period), and the screenshot's composited legend shows it too.
   - **Reduced motion:** the pattern is static (screen-space, not animated).
   - It is part of the bone material and the layer materials, so it is in the main chunk; BX measures it (decision 12).
   - Patterns are on by default whenever a tint is drawn. There is no setting.

9. **Context dimming** (spec §7.3).
   - With a focus structure selected and a tier showing, structures in the related set **on a layer other than the focus's** are drawn desaturated: mixed about 40 % toward their own luminance, in linear space, at the same brightness. Tinted structures are never dimmed (the tint is the point). Ghosts aren't dimmed further. The focus layer is the labels' `focusLayerOf`.
   - It is per instance (the batch colour), so it costs no draw calls. It turns off with no selection, at tier 0 and with colour-by-region (which is already bones-only).
   - The colour-vision test adds each layer's dimmed colour against its neighbours (decision 7).
   - **Changed in BW (the user left it to legibility):** the amount is per layer, `ColourSpec.dim`: muscles **35 %**, the other three **not dimmed**. At 40 % (or even 15 %) the ivory and the pale cartilage fall within ΔE 8 of the grey ligaments and the hover outline; muscles at 40 % came to 7.5 from a bone ghost under protanopia. The muted layers gain little from dimming anyway; the muscle red is the colour that competes with a focus layer. The dimmed rows are already in `colourVision.test.ts`.

10. **The future-system colours table** (spec §7.5): recorded, not shipped.
   - BW proposes base colours for **arteries, veins, nerves, lymph nodes and organs**, near the textbook hues (red, blue, yellow, green, a neutral organ tone), moved as little as needed. Each must pass the registry-driven test against the four current layers and the tints, **in full and dimmed form**, and against each other.
   - They live in a test fixture, `tests/fixtures/future-colours.json`, with a test that runs them through the same pair rule. Nothing in `src/` reads them.
   - The table (hex, ΔE to the nearest neighbour under each vision type) goes in BW's notes here, for the next spec.

11. **Real-device checks** (spec §11; folds in the M10 AO/AP gate).
   - Three bench links, written into this plan by BZ and checked in the container first:
     1. all four layers On (solid), whole body: `?bench&layers=b:on,c:on,l:on,m:on`;
     2. a region focus: the same layers with `reg=` on a dense fine region (for example the left forearm);
     3. a muscle at tier 2 with antagonists and patterns: `sel=` a forearm muscle, `tier=2`, `ant=1`.
     Each gives the `?bench` panel's median and 5th-percentile FPS, draw calls, triangles and label times.
   - The user runs each on a PC browser and on an iPhone, and pastes the panel's figures (or a screenshot) back. They go in BZ's notes. The M10 gate's own checks (AO looks right on a real GPU, no visible LOD pop) are asked for at the same time.
   - **`scripts/perf-load.ts`** stops naming the muscles: it times turning on the lazy layer with the largest high-LOD budget, read from the registry. That removes the last M14 allowlist entry.
   - Any figure below the spec's targets (STATUS §6) is recorded, not fixed, unless the user asks. A fix would be its own session.

12. **Main-chunk budget: 9.2 kB.** The ranking, the indexes and the system trees are lazy. The chips (decision 5), the pattern shader (8), dimming (9) and the sidebar header (6) are in the main chunk. Each session measures it the same way as M13 (index + modulepreloads, `gzip -9`) and records it. If a session would pass **500.1 kB**, it stops and asks; the likely fix is moving the chips' code into the search chunk, which loads before any chip can show. A lazy chunk must not import the app's own modules (M13 BN's lesson).

## Step 1 (BS): ranking

- Decisions 1–3:
  - `rankHits(hits, facts, context)` (pure, in the search chunk), the band computation from minisearch's match data, the generic-word set from the registry, the filter for kind nouns;
  - `makeSearcher` returns hits with their facts; `mergeSearchers` sorts with `rankHits` instead of the score;
  - the golden harness uses the new merge with the default context.
- Unit tests: each band; ties broken by region, then visibility, then exact terms, then name length, then index order; generic words alone return nothing; a noun filters; the side word as today; group synonyms.
- **The difference report.** `assets/build/REPORT-search-golden.md`: for each of the 60 queries whose top 10 changes, the old and new lists side by side, with the rule that moved each result. Then **stop for the gate**. After approval: rewrite `search.json` only, record it below.

## Step 2 (BT): one index per layer

- Decision 4: required `searchFields`; one generic document builder; `virtual:skeleton-search-<layer>` per layer from the content halves (the Vite plugin and `npm run search-index` print each chunk's size); the loader per layer; groups in their tree's layer.
- **Invariance test:** with the default context, the merged top 30 for every golden query is the same with one index of all documents and with one index per layer.
- Fixture: widgets' `searchFields`, their chunk in the fixture build; Vitest (test registry) and `fixture.spec.ts` + 1 (type a widget's name, choose it).
- `search.json` exactly as approved in BS. The chunk sizes (old two, new four) recorded in the notes.

## Step 3 (BU): chips and context

- Decision 5: the chip row (hidden with one system), radio-group keyboard, filter by system, announcement; the store's region and visible layers passed to the ranker.
- e2e: `fixture.spec.ts` (two systems: chips shown, a chip filters, "All" restores); a new case in `regions.spec.ts` (in a region, its members rank first in a band); `sidebar` and `soft-sidebar` unchanged; the chips in `a11y.spec.ts` on the fixture build.

## Step 4 (BV): sidebar per system

- Decision 6: the system rows; the tree chunk per system (`virtual:skeleton-tree-<system>`) keyed from the registry; loading on expand and on demand; shared collapsed state with the Layers panel.
- Tests: `tests/softTree.test.ts` and `tree.ts`'s row tests for the extra level; `tree.json` unchanged; e2e `sidebar`, `soft-sidebar`, `keyboard` (level changes only, listed), `a11y`; the fixture shows two system rows and its tree loads only when its row is expanded.

## Step 5 (BW): colour data, test and future table

- Decisions 7 and 10: `ColourSpec.shades`, the tendon moved, `src/layers/colours.ts` deleted; the colour-vision test rebuilt from the registry; `tests/fixtures/future-colours.json` and its test; the table in the notes.
- `git diff` of every colour value shipped in `src/` is empty.

## Step 6 (BX): patterns

- Decision 8: the pattern texture on the batches and its uniform on the patches; the shader chunk shared by the bone and layer materials; `withTints` sets the pattern with the tint; the legend's SVG swatches; the screenshot.
- Tests: the pattern index table per tint role (unit); `tints.spec.ts` checks pixels across a tinted structure alternate between two shades (a small sample, not a screenshot comparison); the screenshot test's legend; the colour-vision test's tint-against-layer rule relaxed to ≥ 8 as decision 7 says.
- Main chunk measured.

## Step 7 (BY): dimming

- Decision 9: the dimmed colour per instance in `Isolation.tsx`'s colour pass; off at tier 0, with no selection, with colour-by-region.
- Tests: unit (which IDs dim for a muscle at tier 1 and 2 with all layers on); e2e (a bone in a muscle's tier 1 is drawn less saturated than with the bones-only view); the colour-vision test's dimmed rows.

## Step 8 (BZ): device-run prep and the gate

- Decision 11: the three links checked in the container (`npm run bench-container` style medians as the reference); `perf-load.ts` choosing the layer from the registry; the M14 allowlist entry removed.
- The container parity table against M13 (`dc55686`), built side by side from the same `node_modules` (as M13 BR): triangles, draw calls, `?bench` FPS and label times, `perf-load`, main chunk, every lazy chunk (the new search and tree chunks against the old).
- **Gate:** the user runs the three links on PC and iPhone. Session ends; CA starts after the figures are in BZ's notes.

## Step 9 (CB): wrap-up (was CA; CA is now the pattern session, added after BZ's device runs)

- Goldens: `tiers`, `panels`, `urls`, `tree`, `regions` unchanged; `search` as approved.
- Full e2e in the background with a log file, then a grep for failures.
- Docs: `CLAUDE.md`'s key-file table (the ranker, per-layer search chunks, per-system tree chunks, the pattern shader, dimming, the future colours fixture); `STATUS.md` "Search" and "Colours" sections updated.
- `/m14/`: PR to `main`, merge, Deploy run, then freeze `m14` in `deploy/pages.json` at the merge commit, with `current` set to 15 in M15's planning.

## Approved golden differences

- **BS (2026-11-27), `search.json`:** the user approved all of it: (A) the 10 changed queries in `assets/build/REPORT-search-golden.md` (`vertebra`, `rib`, `pelvis`, `carpals`, `phalanx`, `deltoid`, `hamstrings`, `musculus`, `muscle`, `ligament`); (B) the visibility tie-break applies at the default layers too, as the spec says (BU: `trapezius` puts Trapezium above the trapezius's parts in the app; the golden stays region- and visibility-free); (C) a generic word alone returns nothing; and the seven departures from decisions 1–3 (layers' first-kind nouns only, `searchOrder` as the last tie-break, name length in words, prefix words, band-1 group first, a group's name as a term, the label that holds every typed word). Rewritten with `npm run golden -- --write --force`; `git diff --stat tests/golden`: `search.json` only, 10 lines.

## Session notes

### BS (2026-11-27): ranking by match bands

- **Built.** `src/content/searchRank.ts` (`BAND`, `HitFacts`, `RankContext`, `compareHits`, `rankHits`; pure, no minisearch). `search.ts`: `GENERIC_WORDS` from the registry, `queryWords`, `hitFacts` (bands from the documents' own words, never minisearch's match data or score), the noun filter, and `makeSearcher` ranking every candidate before the limit (so the limit never depends on minisearch's order). `searchMerge.ts`: `mergeSearchers` by `rankHits`, and `searchOrder`, the last tie-break. `SearchHit` gains `facts`; `score` stays for debugging. `LayerDescriptor.searchStopWords?` (none set).
- **Where it lives.** The merge and ranker are in the **search chunk**: `searchLoader.ts` exports a `mergeSearchers` that forwards to the loaded module (only searchers from the loaders reach it, so the chunk is there). The first version kept them in the main chunk, +0.35 kB; moved. **Main chunk 490.9 kB** (490,922 B against M13's 490,914; budget 500.1). Search chunk (`search-*.js`) 6.9 → 7.8 kB `gzip -9`.
- **Departures from decisions 1–3**, each listed in the report for the gate: generic words are each layer's **first** kind's noun (else `meniscus`, `disc`, `part` alone return nothing); the last tie-break is the ID files' order (`searchOrder`), not `indexRank` (sorted IDs: "rib 10" before "rib 1"); name length in **words**; prefix words after exact words; a band-1 group before its members; a group's own name counts as a term.
- **Tests.** `tests/searchRank.test.ts` (18: each band, every tie-break in order, totality, generic words alone, the noun filter, the side word, the label, region and visibility inside a band, one index against two). `tests/search.test.ts` and `tests/softTree.test.ts` pass unchanged. `npx vitest run`: everything passes but the `search` golden (the gate). `sidebar` and `soft-sidebar` e2e: 12/12. Rest of `npm run check`: pass.
- **The report.** `npm run search:report` (`tests/searchGoldenReport.test.ts`, skipped in `vitest run`) writes `assets/build/REPORT-search-golden.md`: 10 of the 60 queries change (`vertebra`, `rib`, `pelvis`, `carpals`, `phalanx`, `deltoid`, `hamstrings`, `musculus`, `muscle`, `ligament`), each row with its facts and the rule that placed it, then the gate's questions (A: approve; B: the visibility tie-break at the default layers changes `trapezius` once BU wires it; C: a generic word alone returns nothing).

### BT (2026-11-27): one search index per layer

- **Built.** `KindDescriptor.searchFields` is required (`SearchField`: name, common, synonyms, Latin, FDI; `src/systems/musculoskeletal/search.ts`: every kind the first four, teeth add FDI; the widgets name and common). `LayerContent.searchChunk` names each layer's index (`virtual:skeleton-search-<layer>`). One generic builder, `layerSearchDocuments` (`src/content/searchDocuments.ts`, build time only), replaces `searchDocuments` and `softSearchDocuments`: a field outside the kind's list stays empty; a lazy layer's documents carry their label and `drawn`; the group documents go to the layer whose tree root holds the group (sets by their `root`). `scripts/lib/search-data.ts` reads every layer (`readAllSearchDocuments`, the soft content and tree compiled once; the plugin caches it per build). The content plugin serves each `searchChunk` and a generated `virtual:skeleton-search-importers` (one static `import()` per layer, like the layer importers). `searchLoader.ts`: `loadLayerSearch(layer)`, `loadSearch()` (the eager layer), `loadAllSearch()`.
- **Documents unchanged.** The new builder's documents are byte-identical to BS's (both dumped and compared, HEAD in a worktree). `search.json` passes unchanged; `tiers`, `panels`, `urls`, `tree`, `regions` too.
- **Loading** (sidebar): the eager layer's index when the panel opens (and on field focus, as before); a lazy layer's while that layer isn't Off; every layer's from the first keystroke. The sidebar is mounted only while open, so a layer turned on with the sidebar closed fetches nothing until it opens (no extra request in `perf-load`'s timing). The "Searching …" status names the layers still loading, from their labels ("Searching muscles, ligaments and cartilage…" at the defaults, as before).
- **Invariance test** `tests/searchSplit.test.ts`: for all 60 golden queries the merged top 30 (every field but the score) is the same from one index of every document, one per layer, and one per layer in reverse order; each index holds only its layer's structures and groups; only teeth fill FDI.
- **Fixture.** The widgets' index is built by the same builder (`widgetsSearch`, `demo/widgets/compile.ts`) and served by the fixture build with its own importers module. `tests/fixture.test.ts` +1 (found by name, "gear" is the layer's generic word: alone nothing, "gear 2" keeps widgets only); `tests/e2e/fixture.spec.ts` +2 (type "Spring 3", choose it, selected with `w:on`; the index waits for a keystroke while Off, and is fetched on opening the sidebar while On): 8/8.
- **Changed tests, and why:** `tests/e2e/soft-sidebar.spec.ts`'s chunk pattern (`search-soft` is now three chunks, `search-(muscles|ligaments|cartilage)`); the golden harness and the report import `loadAllSearch` instead of `loadSearch` + `loadSoftSearch` (the snapshot untouched). `readSearchDocuments` and `readSoftSearchDocuments` stay as wrappers, so `search`, `searchRank` and `softTree` tests are unchanged.
- **Chunk sizes** (`gzip -9`, `vite build`): old two: bones **9,061 B**, soft **36,846 B**. New four: bones **9,067**, cartilage **2,730**, ligaments **12,561**, muscles **22,047** (the soft three 37,338 B, +0.5 kB for the split). Search code chunk 7,781 → **7,419 B** (the builder left it). `npm run search-index` prints each.
- **Checks.** `npm run check`: pass (788 tests, 1 skipped). e2e: `fixture` 8/8; `sidebar`, `soft-sidebar`, `a11y`, `keyboard` pass (`keyboard`'s M7 Layers test timed out once at 3 min with four specs in parallel; it passed alone in 2.2 min, and it doesn't touch search).
- **Main chunk 491.1 kB** (491,125 B; +0.2 kB over BS's 490,922: the search importers module and the `searchFields`). Budget 500.1, 9.0 kB left.

### BU (2026-11-27): filter chips and the ranking context

- **Built.** `Search` in `src/ui/Sidebar.tsx`: a chip row (a `fieldset` of native radios, "All" plus one per system with a loaded index), shown only with two or more such systems, so the app (one system) never shows it. A chip filters by merging only that system's layers' indexes, not by filtering hits: a group's index is its tree's layer, so bone groups (no layer prefix in their key) are filtered right too. The choice is announced through `say` ("Search limited to Demo. 4 results." / "Search in all systems. N results."). Not in the URL or `localStorage` (decision 5).
- **Context.** The sidebar passes `{ inRegion, visible }` to the ranker: `isInRegion(id, reg)` from the store's `reg`, and the hit's layer not Off (a group's layer is its key's prefix, else the eager layer). The golden harness still passes none.
- **Tests.** `regions.spec.ts` +1 (in `forearm_right` the right radius leads, moving to `forearm_left` swaps them; with the default layers the trapezium sits above the trapezius's parts, BS approval B). `fixture.spec.ts` +1 (no chips with only the bones' index loaded; three chips once typed; Demo keeps widgets only and is announced; ArrowLeft moves to Musculoskeletal; axe with the M10 tags; All restores the same list). **The chips' axe check is in `fixture.spec.ts`, not `a11y.spec.ts`**: the `fixture` Playwright project only runs `fixture.spec.ts`, and in the app the row is never shown.
- **Checks.** `npm run check`: pass (788 tests, 1 skipped). e2e `fixture`, `regions`, `sidebar`, `soft-sidebar`: 34/34.
- **Main chunk 491.5 kB** (491,534 B; +0.4 kB over BT's 491,125: the chips and the context). Budget 500.1, 8.6 kB left.

### BV (2026-11-27): sidebar rows per system, a tree chunk per system

- **Built.** Registry: `TREE_ROOTS` entries carry their `system`; `TREE_SYSTEMS` (every system with a tree, registry order: `eager` if the eager layer's hierarchy sits under it, `chunk` = `treeChunk(system)` = `virtual:skeleton-tree-<system>` if it has lazy roots); `treeSystemOf(key)`; `EAGER_SYSTEM`. `src/content/tree.ts`: row kind `system`, `systemRowKey` (`system:<id>`), `sidebarRows(open)` = one row per system with its forest one level down; `visibleRows(open, system?)` is the forest alone as before, so **`tree.json` is unchanged** (its harness still reads `visibleRows`). `groups.ts`: `registerSoftTree` merges per root (idempotent per root, roots kept in sidebar order), `treeLoaded(system)`. `softTreeLoader.ts`: `loadTree(system)`, `loadTreeOf(key)`, `loadSoftTree()` = every system's; through a generated `virtual:skeleton-tree-importers` (content plugin `treeImportersModule`; `systemTree` in `scripts/lib/soft-tree-data.ts` cuts one system's roots and sets). `selection.ts` loads only the system a `grp=` key belongs to.
- **Shared expanded state.** The collapsed systems moved from `LayersPanel`'s local state into the store (`collapsedSystems`, `toggleSystem`, still `SYSTEMS_KEY` in `localStorage`), so collapsing a system in either panel collapses it in both. A selection or group in a collapsed system opens its system row.
- **When a chunk loads (reading of decision 6).** The system row starts expanded, and the layer roots' own rows (label, no count) come from the registry, so a system's chunk is fetched when **one of its lazy roots opens** (or a `grp=`, search result or selection needs it), not merely because its row is expanded. Fetching on expand would fetch the chunk every time the sidebar opens, which `soft-sidebar`'s "the sidebar alone fetches nothing soft" forbids. In the fixture, opening Widgets fetches the demo's chunk only, never the musculoskeletal one.
- **The system row** is a treeitem at `aria-level` 1 with a chevron, no count and no Isolate (`I` does nothing on it); Left from a layer root moves to it, Left on it closes it, `*` opens closed systems. The tree's first tab stop stays the first bone group (`axial`), so `sidebar` and `keyboard` e2e are unchanged.
- **Changed tests, and why:** `soft-sidebar.spec.ts`: the tree chunk's pattern (`skeleton-tree-musculoskeletal`, was `skeleton-soft-tree`) and the triceps long head's `aria-level` 7 (was 6, the extra level). `fixture.test.ts`: `TREE_ROOTS`' last entry carries `system: "demo"`. Added: `softTree.test.ts` +1 (system row, the forest one level down, keys, `systemTree`), `fixture.test.ts` +1 (two system rows, the demo's root before and after its chunk, `treeLoaded` per system), `fixture.spec.ts` +1 (two rows, levels, only the demo chunk fetched on opening Widgets, the row closes by keys and the Layers panel's Demo group follows).
- **Checks.** `npm run check`: pass (790 tests, 1 skipped). e2e: `fixture` (the tree tests) pass; `sidebar`, `soft-sidebar`, `a11y`, `keyboard`, `layers` 47/49 with two workers. The two failures were `keyboard`'s M7 Layers and M10 journey tests, both timing out inside `tabTo` under load (as in BT). Run alone, both pass (2.2 and 5.6 min).
- **Sizes.** Main chunk **492.2 kB** (`gzip -9`, `index` + modulepreloads; +0.7 kB over BU's 491.5: the system rows, the store's shared state and the per-system loader). Budget 500.1, 7.9 kB left. Musculoskeletal tree chunk 12,152 B (the old soft tree chunk, M10: 12.1 kB).


### BW (2026-11-28): colour data, the registry-driven test, the future table

- **Built (commit `27f5654`).** `ColourSpec.shades` (by name) and `ColourSpec.neverWith` (none set); `PartTypeSpec.shade` replaces `tendinous`; the tendon colour is the muscles' `colour.shades.tendon` (`#c18274`, unchanged) and `src/layers/colours.ts` is gone. Registry `partTypeShade` (throws if a part type names a shade its layer lacks); `src/layers/softIds.ts` `shadeOf` replaces `isTendinous`; `LayerScenes` tints per layer and shade. No shipped colour value changed.
- **The test.** `tests/lib/colourTable.ts` builds the table from the registry (each layer's material and shades, three ghosts of each material: ghost batches have no instance colours, so a ghosted tendon is the muscle colour; tints, region colours, marks; `dimmed` adds each layer's dimmed form, `dim()` = decision 9's 40 % toward luminance in linear space), the drawing-rule `EXEMPT` list, `neverWith`, `STRONG` and `lowPairs`. `tests/colourVision.test.ts` uses it. **Its checked pairs are the old hand-written table's 313 exactly** (both dumped and compared), so no missed pair was found.
- **Current dimmed colours fail (for BY).** With every layer's dimmed form added: ligaments / dim:bones ΔE 6.0 (deut. 6.2, prot. 5.9); ligaments / dim:cartilage 7.6 (7.0, 6.6); the same pairs both dimmed; dim:cartilage / hover 7.8 (7.7, 6.8); protanopia ghost:bones@0.5 / dim:muscles 7.5. BY needs a smaller amount, a colour change or an exemption: the user's call.
- **Future table: no textbook set passes.** Search (`docs/batches/BW/search-future-colours.test.ts.txt`): sRGB grid step 5, each layer in full, three ghosts and dimmed, against every current colour (full and dimmed), tints, regions, marks and the future ones already chosen, greedy by smallest ΔE2000 move from the seed (arteries `#c62828`, veins `#2f5fbf`, nerves `#f2d12e`, lymph `#4caf50`, organs `#c9a07e`), every one of the 120 orders.
  - **With the shipped rule (region colours included): no order passes.** Alone, the nearest passes are arteries `#9b3755` (moved 17.4), veins `#1450af` (5.3), nerves `#5f5f5f` (46.9, grey), lymph `#28645f` (33.6), organs `#f08ca0` (23.7); together, one of nerves, lymph, organs or veins always fails. Yellow is blocked by the muscle red and tendon under CVD, the origin tint, the ivory and the yellow/orange region colours.
  - **Without region colours** (i.e. if colour-by-region paused whenever another system's layer is on): 87 of 107 orders pass; the best (total move 100): veins `#1450af`, nerves `#dc9600` (amber, 17.6), organs `#bea5a5` (13.8), arteries `#734164` (plum, 27.2), lymph `#afb4c8` (grey-lavender, 36.1), margins 0–0.8.
  - **Stopped for the user**: which rule the table is held to (shipped, or regions paused for other systems), and whether hues this far from textbook are acceptable, or the next spec relies on BX's patterns / a different cue for some systems. `docs/batches/BW/futureColours.test.ts.txt` is the fixture's test, ready to move to `tests/` once `tests/fixtures/future-colours.json` is chosen.
- **The user's answers.** (1) The no-region set is accepted for now ("maybe we can figure out a better solution later"): the future test adds one rule, colour-by-region pauses while another system's layer is on, which the next spec must adopt if it keeps these colours. (2) Dimming left to legibility: per-layer `ColourSpec.dim` (decision 9 updated: muscles 35 %, bones, ligaments and cartilage not dimmed); `colourVision.test.ts` now runs with the dimmed rows and passes.
- **The future table** (`tests/fixtures/future-colours.json`, `tests/futureColours.test.ts`; each in full, three ghosts and dimmed 40 %; nearest checked neighbour, ΔE2000):

| System | Seed | Proposed | Normal | Deuteranopia | Protanopia |
| --- | --- | --- | --- | --- | --- |
| Arteries | `#c62828` | `#734164` plum | 8.6 (own ghost 0.5 / own dimmed) | 8.0 (lymph ghost 0.5) | 8.0 (own ghost 0.5 / own dimmed) |
| Veins | `#2f5fbf` | `#1450af` | 9.2 (own ghost / own dimmed) | 8.1 (dimmed / insertion tint) | 8.8 (arteries / own ghost 0.5) |
| Nerves | `#f2d12e` | `#dc9600` amber | 15.5 (dimmed / dimmed tendon) | 8.0 (ghost 0.5 / muscles) | 10.9 (dimmed / tendon) |
| Lymph nodes | `#4caf50` | `#afb4c8` grey-lavender | 8.7 (dimmed / ligaments) | 8.0 (ghost 0.5 / arteries) | 8.1 (dimmed / dimmed organs) |
| Organs | `#c9a07e` | `#bea5a5` | 10.0 (dimmed / dimmed lymph) | 8.8 (ghost 0.5 / dimmed arteries) | 8.1 (dimmed / dimmed lymph) |

- **Checks.** `npm run check`: pass (797 tests, 1 skipped). No shipped colour value changed (the tendon hex moved files); nothing draws `dim` until BY.

### BX (2026-11-28): pattern cue for the role tints

- **Built.** `src/scene/patterns.ts` (pure): `PATTERN_OF` (origin stripes, insertion dots, antagonist cross-hatch), `PATTERN_INDEX`, the GLSL (`PATTERN_FRAGMENT`, after the tint in `AO_COLOR_FRAGMENT`) and its JS twin `patternMark`, `patternCells`/`patternPath` (the legend and screenshot rasterise the shader's own rule, rows flipped for `gl_FragCoord`), `markColour` (the swatch's darker shade). Period 6 CSS px (`PATTERN_PERIOD_UNIFORM`, one object shared by every material, set from the canvas's dpr in `Isolation.tsx`); marks 25 % darker in linear light, screen space, static.
- **Deviation from decision 8: no new texture, no patch uniform.** The pattern index rides in the **alpha of each batch's existing colours texture** (RGBA float; the opaque materials never read the batch alpha): alpha = 1 + index, so the texture's default 1 is "none". The patches are a `BatchedMesh` with per-instance origin/insertion colours, so they take the same path instead of a uniform. `paint()` (`src/scene/isolation.ts`) writes colour and pattern together as a `Vector4` everywhere `applyLayerView`, `applyBaseColours` and the patch pass set a colour (a plain `Color` write keeps the old alpha, so every write names its pattern). A tinted structure in a highlighted joint keeps its pattern; the focus never has one. Program cache key now `bone-ao-tint-pattern-0.4`.
- **Legend.** `keyItems()` (`Legend.tsx`) is the one list of chips (layers, then tints with their pattern); tint chips draw an inline SVG swatch (`data-pattern`). **Screenshot:** the composited legend now draws the same key (it drew only the regions before), each tint with a canvas pattern of its marks at the shader's period in image pixels; the regions as before (paused while tints are drawn, as on screen).
- **Debug hook** `window.__viewer.instancePattern(id)`.
- **Tests.** `tests/patterns.test.ts` (10: table, alpha round trip, mark shares and periodicity, the shader in the material with the shared uniform, swatch cells = shader cells, `applyLayerView` sets and clears the pattern). `tints.spec.ts` + 2: pixels across an antagonist alternate between two shades (share of neighbouring pixels differing ≥ 12 %: 0.449 on the tinted biceps long head, 0.000 on the focus) and the chips' patterns; the screenshot's legend contains the antagonist pink and its darker mark shade. `tints.spec.ts` 7/7, `polish.spec.ts` + `a11y.spec.ts` 26/26.
- **Colour-vision rule relaxed** (`tests/lib/colourTable.ts` `STRONG`): tint against layer (bones, cartilage, muscles) drops to ≥ 8; origin/insertion, origin/antagonist and the tints against the selection accent (a mark, not a layer) stay ≥ 20.
- **Main chunk 493.5 kB** (493,543 B; +1.2 kB over BW's 492,317: the shader text, the pattern helpers, the legend swatch and the screenshot's key). Budget 500.1, 6.6 kB left.


### BY (2026-11-28): context dimming

- **Built.** `src/scene/dimming.ts` (pure): `dimAmount(layer)` (the descriptor's `colour.dim`, else 0), `desaturate` (mixed toward its own luminance in linear light, brightness kept), `dimHex` (the colour-vision table's rows: `tests/lib/colourTable.ts`'s `dim` is now this), `dimmedIn(view, focusLayer, layerOf, on)` and `dimTint(layer, target, material)` (the instance colour over the layer's material, cached). `SceneView.dimmed`: set in `viewOf` from the isolation after tints and joint; the focus layer is the selection's layer (= `focusLayerOf` with a selection). Off with no focus, at tier 0 and while colour-by-region is drawn (`drawnColourMode`, so a muscle's tints, which pause the regions, don't stop it); never the focus, a tint or a highlighted joint's structure; ghosts aren't solid so never dim. `viewOf`'s input gains `colourMode` (the store's).
- **Drawing.** `applyLayerView` takes `dimmed?: BaseTint` and paints `view.dimmed` with `paint(…, "none")` after restoring the previous colours and before the tints, focus and joint (the sets don't overlap). `LayerBatches.dimmed` = `layerDimTint` (`LayerScenes.tsx`, lazy chunk: the structure's shade or material, dimmed); the bones get one only if the eager layer has an amount (none). `Isolation.tsx` adds last frame's dimmed IDs to `previous`, so they get their colour back. Debug: `data-dimmed` on the overlay.
- **What dims today.** Only the muscles have an amount (BW), so dimming shows when a bone, ligament or cartilage is selected at tier 1 or 2 with the muscles on: its related muscles. A muscle's own tiers dim nothing (its bones, ligaments and cartilage have no amount).
- **Tests.** `tests/dimming.test.ts` (9): the amounts; the femur at tiers 1 and 2 with every layer on dims exactly its solid muscles; a muscle at tiers 1 and 2 (antagonists on) dims nothing; a ligament's related muscles; off with no selection, tier 0, colour-by-region; focus, tints and joint never dim; luminance kept, saturation lower; instance colour × material = the dimmed colour (material and tendon); `applyLayerView` writes and restores. `tints.spec.ts` + 1: femur tier 1, `vastus_lateralis_left` in `data-dimmed`, pattern none; an uncovered 16 px square's mean saturation 0.505 dimmed against 0.642 with colour-by-region on (dimming off), mean luminance 92.3 against 86.8. `colourVision.test.ts` runs the dimmed rows through `src/`'s rule and passes.
- **e2e** `tints`, `tiers`, `layers`: 29/29 pass (two workers, 11.8 min). Also `fixture`, `keyboard`, `nested`, `polish`, `regions`, `related`, `select`, `sidebar`, `viewer`: 91/91 pass (16.9 min).
- **Main chunk 493.8 kB** (493,813 B; +0.3 kB over BX). Budget 500.1, 6.3 kB left.

### BZ (2026-11-28): device-run prep (the gate is open)

- **`perf-load` from the registry.** `scripts/perf-load.ts` times turning on `largestLazyLayer()` (`scripts/lib/model-checks.ts`: the lazy layer with the largest high-LOD budget, `targetTris` then `maxMiB`; the muscles today), its test ID, row and `<file>-low.glb` from the descriptor. The `scripts/perf-load.ts` entry is gone from `tests/registry-allowlist.json`: **no M14 entry is left** (only the M15 Python files). Test: `tests/model-checks.test.ts` +2.
- **`DEVICE=1 npm run bench-container`** runs the three device links (labels on). Link 3's muscle is the **left flexor carpi radialis**: at tier 2 with `ant=1` the extensor carpi ulnaris heads and extensor digitorum are hatched (`instancePattern`), the origin and insertion patches are drawn, and the legend shows the three tint chips.
- **The three links** (add each to the hosted base, e.g. `https://ajmarr04-ux.github.io/SkeletonViewer/m14/`):
  1. `?bench&layers=b:on,c:on,l:on,m:on`: all four layers On, whole body;
  2. `?bench&layers=b:on,c:on,l:on,m:on&reg=forearm_left`: the same in the left forearm;
  3. `?bench&layers=b:on,c:on,l:on,m:on&sel=flexor_carpi_radialis_left&tier=2&ant=1`: a forearm muscle at tier 2 with antagonists and patterns.
- **Container reference** (SwiftShader, 1280 × 800, labels on, medians of 3):

| Link | Median / 5th pct FPS | Draw calls | Triangles | Label layout median (candidates) |
| --- | --- | --- | --- | --- |
| 1. all four layers | 0.7 / 0.6 | 4 | 1,499,634 | 1.2 ms (60) |
| 2. left forearm | 7.5 / 6.2 | 3 | 38,827 | 0.5 ms (27) |
| 3. FCR tier 2, antagonists | 0.8 / 0.6 | 9 | 1,344,915 | 0.6 ms (31) |

- **Parity table against M13** (`dc55686` in a scratch worktree, same `node_modules`, the same scripts, back to back; `LABELS=1` bench, `perf-load` twice per build):

| Measure | M13 (`dc55686`) | M14 BZ head |
| --- | --- | --- |
| Triangles, bones only / all four layers / `reg=thorax` | 499,981 / 1,499,634 / 628,779 | identical |
| Draw calls, bones only / all four layers | 1 / 4 | 1 / 4 |
| `?bench` bones only, median / 5th pct FPS | 2.5 / 2.1 | 2.4 / 2.2 |
| `?bench` all four layers | 0.7 / 0.7 | 0.7 / 0.6 |
| `?bench` all four layers in `reg=thorax` | 1.0 / 0.8 | 0.9 / 0.8 |
| Label layout median: bones / all layers / thorax (candidates) | 0.6 / 1.0 / 0.8 ms (42 / 60 / 60) | 0.6 / 0.9 / 1.0 ms (42 / 60 / 60) |
| `perf-load` desktop: skeleton / full detail / muscles (run 1; run 2) | 2.01 / 5.99 / 8.74 s; 2.10 / 6.34 / 9.30 s | 2.14 / 6.42 / 9.26 s; 2.10 / 6.21 / 9.09 s |
| `perf-load` phone: same | 2.12 / 6.15 / 9.29 s; 2.15 / 6.49 / 10.46 s | 2.29 / 6.78 / 11.23 s; 2.10 / 6.38 / 9.97 s |
| Main chunk, `gzip -9` index + modulepreloads | 490,914 B | **493,813 B** (+2.9 kB; budget 500.1 kB) |
| Content chunks: bones / muscles / ligaments / cartilage | 40,027 / 114,051 / 40,478 / 8,860 B | identical |
| Search indexes | bones 9,061; soft 36,846 B | bones 9,067; muscles 22,047; ligaments 12,561; cartilage 2,730 B (soft three 37,338) |
| Search code chunk | 6,907 B | 7,422 B |
| Tree chunk | soft tree 12,141 B | `tree-musculoskeletal` 12,152 B |
| `LayerScenes` / `DebugLayers` / `RegionPicker` | 3,494 / 4,686 / 4,086 B | 3,547 / 4,688 / 4,086 B |

  FPS and label times are within run-to-run spread. The first `perf-load` pair put M14's phone muscles 1.9 s behind; the second put it 0.5 s ahead, so it is spread (main-thread time, about 16 s blocked on the software GPU in both builds). The muscles layer misses its 3 s / 5 s budget in both builds, as in every container run since M7 (STATUS §6): recorded, not fixed (decision 11).
- **Hosting finding (for the gate).** Pages builds the live site and `/m14/` only from `main` (`deploy.yml` on push to `main`), which is still M13. So none of M14 is hosted yet; links 1 and 2 already run on M13's site, but link 3's patterns and BS–BY's work don't. Asked the user how to reach this branch on the devices (merge now, run locally over the LAN, or split the runs). **Answer: merge now.** PR #30 merged at `ab33337` (2026-11-28) for the device runs; CA merges again and freezes `m14` at that final merge.
- **Checks.** `npm run check`: pass (818 tests, 1 skipped). No e2e run: no app code changed (scripts and tests only).

#### BZ gate: the user's device runs (2026-11-28, on `/m14/` at `ab33337`)

| Link | Device | Median / 5th pct FPS | Draw calls | Triangles | Notes |
| --- | --- | --- | --- | --- | --- |
| 1. all four layers | PC (high LOD) | 75.2 / 74.6 | 4 | 1,499,634 | vsync (75 Hz); p95 13.4 ms, max 20.0 ms |
| 2. left forearm | PC | 75.2 / 74.6 | 3 | 38,827 | p95 13.4 ms |
| 3. FCR tier 2, antagonists | PC | 75.2 / 74.1 | 10 | 1,421,926 | p95 13.5 ms; one 178.6 ms frame (max) |
| 1. all four layers | iPhone (low LOD) | 30.3 / 29.4 | 4 | 449,623 | |
| 2. left forearm | iPhone | 30.3 / 29.4 | 3 | 12,594 | |
| 3. FCR tier 2, antagonists | iPhone | 30.3 / 29.4 | 9 | 449,927 | |

- **PC:** vsync-limited on every link, as at M7; the M10 muscle-tier-2 bench is now measured. Labels were off (the panel says so), so no label times. Link 3 drew 10 calls and 1,421,926 triangles against the container's 9 and 1,344,915; the bench panel counts what is drawn during the orbit, and the PC's run reports "ghosts" in its isolation line (the ghosted rest of the body), so the figures differ by view rather than by build. The single 178.6 ms frame is probably the high LOD or a lazy chunk arriving mid-orbit; not repeated in the medians.
- **iPhone: an exact 30.3 / 29.4 on all three links**, from 449,623 triangles down to 12,594. At M7 the same link 1 ran at 58.8. A flat figure that ignores a 35× change in load is a frame-rate cap, not the GPU: most likely iOS Low Power Mode (which caps Safari at 30 fps) or a 30 Hz display setting. **Asked the user** to re-run link 1 with Low Power Mode off; recorded as is until then, not treated as a regression. **Confirmed by the user: Low Power Mode was on.** So 30 fps is iOS's cap; the iPhone figures are a floor, not the device's rate (M7's 58.8 was without it). A re-run with it off is optional.
- **The M10 checks:** "the shading visually looks alright" (AO on a real GPU: pass). **LOD pop: none seen** (the user: "it shows the bones briefly then loads the model", i.e. the eager bones draw first and the lazy layers arrive after, which is the intended load order, not a low → high swap). The M10 gate's checks are closed.
- **The user's feedback on the patterns** (screenshot: the extensor digitorum and extensor carpi ulnaris heads hatched, PC at dpr 1):
  1. **Too small: scale the period by about 3×** (6 → 18 CSS px).
  2. **They "swim" when zooming or panning** ("spastic", "annoying"). Cause: the marks are laid out in screen space (`gl_FragCoord`, BX decision 8), so the pattern stays still on the screen while the surface slides under it (the "shower door" effect), and a 6 px period on a dpr 1 screen also shimmers. The user asked whether the pattern could snap to a new size when the camera stops. A new session **CA** (design) does both; the wrap-up moves to **CB**. Approaches put to the user:
     - **(a) Anchored screen space (recommended):** keep the screen-space marks, but offset them by the projected position of an anchor (the selection's centre) so they move with the model while panning, and keep their size fixed while the camera moves, snapping to the new zoom when it stops (the user's idea). Cheap (two uniforms), and the legend still matches the on-screen size exactly. While orbiting the marks still slide a little.
     - **(b) Surface-locked:** the marks are laid out on the surface in world space (triplanar), so they stick to the muscle like a texture through every move. Most natural, but bigger: the mark size changes with zoom (it needs anti-aliasing when small and a clamp), and the legend can only show the pattern's look, not its exact size.
  - **The user chose (b), surface-locked** (2026-11-28). CA builds it: world-space marks, an anti-aliasing and size clamp for zoomed-out views, the legend showing the pattern's look; period about 3× today's at the default framing.

### CA (2026-11-28): surface-locked patterns (design)

- **Where the marks are.** On the surface, not the screen: the vertex shader passes each vertex's offset from its instance's origin and its normal, in world orientation and metres (`mat3(modelMatrix) * mat3(batchingMatrix)`, `PATTERN_VERTEX` before `project_vertex`; the batch matrix carries gltfpack's quantisation scale, and leaving out its translation means Explode carries the marks along). The fragment lays the 2D rule out triplanar (planes yz, zx, xy, weights `|n|^8`), so a front view's surface uses x and y, matching the legend's orientation. Pan, orbit and zoom no longer move the marks on the structure.
- **Size.** `PATTERN_PERIOD_M` = 22 mm on the surface: measured 8.16 px/cm at link 3's tier-2 framing (1280 × 800, dpr 1), so about 18 px there, the user's 3×. Closer, the marks grow with the structure (about 34 px with the extensor digitorum framed alone).
- **Clamp and anti-aliasing.** The shader measures periods per device pixel (`fwidth` of the pattern coordinate, taken outside the branch) and, when a period would be smaller than `PATTERN_MIN_CSS` = 14 CSS px (uniform `uPatternMinPx`, × dpr, replaces BX's `uPatternPeriod`), draws the next octave (2×, 4×, … up to 8), cross-faded by the fractional level so zooming never pops. Edges are smoothsteps over about a pixel (`skvBand` for stripes and hatch lines, the dot's radius).
- **Legend and screenshot.** They show the pattern's look at `PATTERN_SWATCH_CSS` = 7 px (two periods in the 14 px chip), rasterised from the same `patternMark` rule; the on-screen size now depends on the zoom (the user accepted this with option (b)).
- **Tests.** `surfaceMark`, the JS twin of the new shader: close and square-on it equals `patternMark` on each of the three planes (so the legend's cells are the shader's); a point keeps its mark through pan and zoom within an octave; the drawn period never falls below the minimum, octaves continuous at the boundary; edges ramp over a few samples. The shader test checks the vertex chunk, the uniform and that `gl_FragCoord` is gone. `tints.spec.ts`'s pixel sample now measures the spread of shades in a 40 px square (darkest tenth vs brightest), since 18 px anti-aliased marks rarely jump between neighbours: antagonist 0.498, focus 0.023. Program cache key `bone-ao-tint-pattern-surface-0.4`.
- **Main chunk** 494,550 B (+737 B; budget 500.1 kB, 5.5 kB left).
- **Checks.** `npm run check`: pass (823 tests, 1 skipped). `tints` e2e: 8 passed.
- **Gate:** the user checks the patterns on a device, which needs this branch on `main` (`/m14/` only rebuilds there). Asked before merging.

### CB (2026-11-28): wrap-up

- **Order changed (the user's choice).** CA's device check needs a merge; rather than merge CA alone and wait, CB ran now. `m14` is **not** frozen here: after CB merges, the user checks the patterns on `/m14/` (link 3), and a small follow-up applies any size change (`PATTERN_PERIOD_M` / `PATTERN_MIN_CSS`) and freezes `m14` at that merge.
- **Goldens.** `npm run golden`: pass. `git diff --stat dc55686 -- tests/golden public/models content`: `search.json` (the BS approval, 20 lines) and the harness's imports only; `tiers`, `panels`, `urls`, `tree`, `regions` unchanged, so old URLs open the same view.
- **Allowlist.** Six entries, all M15 (the Python build and mapping scripts).
- **Full e2e** (two workers, 55.4 min): **200 of 205 passed.** The 5 failures were timing under load: `keyboard` ×3 (timeouts inside `tabTo`, as in BT and BV), `nested` (the hover tooltip not up within 5 s) and `polish`'s share link (the copied URL taken while the camera was still settling: `cam=` differed in the fourth decimal). Re-run alone, one worker: **5 passed** (10.3 min).
- **Parity.** BZ's table against M13 stands for everything but CA's shader. Main chunk **494,550 B** (M13 490,914; +3.6 kB; budget 500.1 kB, 5.5 kB left).
- **CA's shader costs frame rate in the container, with no pattern drawn.** `DEVICE=1 npm run bench-container`, BZ's head (`93671ba`, scratch worktree, same `node_modules`) against CB's, alternated, four rounds of three runs each, medians of median FPS:

| Link | BZ (`93671ba`) | CB (with CA) |
| --- | --- | --- |
| 1. all four layers | 0.7, 0.6, 0.6, 0.7 | 0.6, 0.5, 0.5*, 0.6* |
| 2. left forearm (no pattern drawn) | 5.1, 5.1, 4.7, 4.9 | 4.1, 3.8, 3.7*, 4.1* |
| 3. FCR tier 2, antagonists | 0.6, 0.5, 0.6, 0.6 | 0.6, 0.5, 0.6*, 0.6* |

  (* with the experiment below.) The container ran slower today than on BZ's day (BZ's own link 2: 7.5 then, about 5 now), so only the side-by-side figures compare. Link 2 is **15–25 % slower**, and it draws no pattern: every fragment pays for the two new varyings (`vPatPos`, `vPatNrm`), the per-vertex matrices and the `fwidth`. SwiftShader shades on the CPU, so per-fragment work shows there in full; on a real GPU the PC was vsync-limited on all three links at BZ. **Tried:** taking `fwidth` inside the pattern branch (the index is per instance): no measurable gain (the * rounds), so reverted. Not fixed here: removing the cost means giving up the surface lock or the anti-aliasing, which is the user's call. Left for the device check: if the PC stays at 75 fps and the iPhone (Low Power Mode off) at 60, it is a container-only cost; otherwise a cheaper variant (e.g. one projected plane instead of three) is a follow-up.
- **Docs.** `STATUS.md`: "Sidebar and search" rewritten for M14 (rows per system, per-layer indexes, bands, chips), a new "How colour works (M14)" (hue, patterns, dimming, the future table), the M14 device figures in §6, the main-chunk row, the allowlist and frozen-milestone lines. `CLAUDE.md`'s key-file rows were kept current by each session (ranker BS, search chunks BT, tree chunks BV, colours BW, patterns BX/CA, dimming BY); its status paragraph updated.
- **Checks.** `npm run check`: pass (823 tests, 1 skipped).

