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
| BT | design | One lazy search index per layer, built from `searchFields`, loaded when its layer is on or a query is typed, plus the fixture's search (step 2) | none | decisions 4–5, BS | `search.json` as approved in BS, unchanged; fixture Vitest and e2e find widgets; chunk sizes recorded | |
| BU | routine | Search filter chips and the region and visibility context wired from the store (step 3) | none | decision 5, BT | chips e2e on the fixture build; `sidebar` and `soft-sidebar` e2e pass; a11y pass | |
| BV | routine | Sidebar roots grouped by system, each system's tree lazy (step 4) | none | decision 6 | `tree.json` unchanged; `sidebar`, `soft-sidebar`, `keyboard`, `a11y` e2e pass; fixture's system root lazy | |
| BW | design | The colour model's data and test: `ColourSpec` shades, the registry-driven colour-vision test, and the future-system colours table (step 5) | none | decisions 7, 10 | `colourVision.test.ts` builds its pairs from the registry; the table passes and is recorded here; no on-screen colour changes | |
| BX | design | Pattern cue for the role tints: per-instance pattern on the batches and patches, legend swatches, screenshot (step 6) | none | decision 8 | `tints` e2e and screenshot tests pass; pattern unit tests; main chunk measured | |
| BY | routine | Context dimming of other layers in the related set (step 7) | none | decision 9 | dimming unit and e2e tests; colour-vision test covers the dimmed colours; `tints`, `tiers`, `layers` e2e pass | |
| BZ | routine | Device-run prep: the three bench links, `perf-load` from the registry (the last M14 allowlist entry), the container parity table; then **gate: the user runs `?bench` on PC and iPhone** (step 8) | none | decision 11 | links in the plan; allowlist has no M14 entry; the user's figures recorded here | |
| CA | routine | Wrap-up: goldens, parity table, full e2e in the background, docs, `/m14/` (step 9) | none | everything above | exit criteria ticked; `/m14/` live | |

Triggers: "begin session BS" to "begin session CA". Every session follows `docs/WORKFLOW_NEW.md` §7: read `docs/HANDOFF.md` and this file, do the one serial task, end with `npm run check` and the e2e specs it touched, commit, push to the session branch, tick the row, write `docs/HANDOFF.md`, and stop.

**Order:**
- BS → BT → BU. BS's gate must be answered before BT starts, because BT's acceptance is "unchanged from the approved golden".
- BV needs nothing from BS–BU and can run any time (it touches the sidebar too, so not in parallel with BU).
- BW → BX → BY.
- BZ after BX and BY (the third device view uses the patterns). Its gate waits on the user; CA starts after the figures come back.

**User checkpoints**
- **Decisions 1 to 12 below.** Sessions build them as written unless the user says otherwise. Decisions 3 (generic words), 5 (chips hidden with one system) and 6 (the sidebar header) are the ones most worth a look.
- **After BS: the search differences** (spec §11). BS writes every changed query, old top 10 against new, to `assets/build/REPORT-search-golden.md` and stops. The golden is rewritten (`npm run golden -- --write --force`, search only) only after the user approves, and the approval is recorded in "Approved golden differences" below.
- **After BW: the future-system colours table.** Not a gate. It's recorded for the next spec, and the user may want to change hues.
- **BZ: the real-device runs** (spec §11). This is a gate: the user runs the three links on a PC browser and an iPhone and pastes the panel's figures back.
- **Any other golden difference** stops the session that caused it.

## Exit criteria (from `SPEC-platform.md` §11, M14)

- [ ] Per-layer search indexes, filter chips, new ranking; `golden/search.json` differences reviewed with the user (BS, BT, BU).
- [ ] Lazy tree per system (BV).
- [ ] Colour model: registry-driven colour-vision test, pattern cue for role tints, context dimming (BW, BX, BY).
- [ ] The proposed future-system colours table, tested (BW).
- [ ] Real-device checks: the user runs `?bench` on PC and iPhone for: all layers solid; a region focus; a muscle tier 2 with antagonists and patterns (BZ).
- [ ] `tiers`, `panels`, `urls`, `tree` and `regions` goldens unchanged; `search` as approved; old URLs open the same view.
- [ ] No regression: every existing unit and e2e test passes unchanged, except where a step lists why (spec §2.1). Performance parity with the new features off (bench, perf-load, main chunk ≤ 500.1 kB).
- [ ] The allowlist has no M14 entry (M15 ×6 only).
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

## Step 9 (CA): wrap-up

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
