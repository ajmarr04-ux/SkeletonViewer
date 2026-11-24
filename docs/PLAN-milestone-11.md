# Milestone 11 Plan: Registry (Platform spec, M11)

Source of truth: `SPEC-platform.md` §2 (hard rules), §3 (systems, layers, kinds, descriptors), §8 (the Layers panel paragraph), §10 (registry isolation test, fixture layer, golden tests), §11 (M11) and §13 (working rules). The earlier specs and `CLAUDE.md`'s ground rules still apply. Workflow: `docs/WORKFLOW_NEW.md` (the spec says `docs/WORKFLOW.md`; that file was replaced by the user). **This phase adds no anatomy:** `git diff public/models/ content/` stays empty in every session unless a step below says otherwise. QUESTIONS start at **140**.

## Goal

Turn the four musculoskeletal layers, bones included, into **descriptors** listed in one **registry**, and make every per-layer and per-kind literal table in the runtime and the TypeScript build scripts a registry lookup. After M11 the app looks and behaves exactly as at M10, except that the Layers panel groups its layers under a collapsible **Musculoskeletal** system header with a group On / Ghost / Off control. Golden snapshots of tiers, panels, URLs and search are recorded **before** any refactor and match exactly at the end.

Out of scope (later milestones, `SPEC-platform.md` §11): the relationship graph, tier rules as data, descriptor-driven panels, tree builders and announcements wording (M12); regions and the budget governor (M13); per-layer search indexes, filter chips, the colour model (M14); `build.json` and the Python build scripts (M15). New anatomy, content changes, Blender work.

## What exists already (from M6 to M10)

- **No registry.** `LAYERS`, `TISSUE_LAYERS`, `LAYER_CODE` and `DEFAULT_LAYERS` live in `src/state/url.ts`; kinds are separate unions (`SoftKind` in `src/layers/softIds.ts`, `"bone" | "tooth"` in `src/content/placeholder.ts`). 45 files in `src/` and `scripts/` contain a quoted layer or kind name. `STATUS-M10.md` §3 lists every table by file.
- **Bones are special:** they load with the main chunk (`loadSkeleton.ts`, `batchSkeleton.ts`), every soft layer is lazy (`LayerScenes.tsx`, one chunk) and keyed by `TissueLayer`.
- **Pure functions to snapshot:** `relatedAt(id, tier, modes)` (`src/scene/isolation.ts`), `panelModel` (`src/content/panel.ts`) and `softSections` / `softPanelModel` (`src/content/softPanel.ts`), `parseUrlState` / `serialiseUrlState` (`src/state/url.ts`), the searchers (`src/content/search.ts`, `searchMerge.ts`). `compileAllSoftFromDisk` (`scripts/lib/content-files.ts`) already gives the full soft content in Node, so all four goldens can be produced in Vitest without a browser.
- **IDs:** 238 bones and teeth (`content/ids.json`) + 900 soft (`content/soft-ids.json`) = **1,138**, the spec's count.
- **Main chunk at M10:** 470.1 kB gzip -9 (AR's final, side-by-side method, `STATUS.md` §6). The spec quotes 470.4 (AN's figure). M11's budget is **≤ 500.1 kB** (decision 1).
- **No DOM test library** (no jsdom or testing-library in `devDependencies`): UI is proven by pure helpers in Vitest and by Playwright.

## Progress

Session kinds: **design** = strong model (schemas, architecture); **routine** = Sonnet is fine (mechanical migration against fixed goldens). No subagents in any session (spec §2.5).

| Session | Kind | Serial task (one sentence) | Fan-out | Inputs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| (planning) | design | M10 → M11 handover and this plan (step 0) | none | `SPEC-platform.md` | `current` 11, plan written | **Done.** See step 0 |
| AS | design | Record the four golden snapshots and the M10 performance baseline, before any refactor (step 1) | none | decisions 1, 6 | `tests/golden/*.json` committed; `tests/golden.test.ts` passes in `npm run check`; baseline table filled | **Done.** See step 1 |
| AT | design | Descriptor types, `src/systems/registry.ts` and the four layer descriptors; layer-identity tables (codes, defaults, labels, colours, ghost order, depth) moved onto them (step 2) | none | decisions 2–4 | the tables in step 2's list are deleted; goldens unchanged; `check` green |**Done.** See step 2 |
| AU | routine | Kind tables in the runtime moved onto `KindDescriptor`s (step 3) | none | AT's types | step 3's list deleted; goldens unchanged | **Done.** See step 3 |
| AV | routine | Build-side and content-side tables (TS scripts, virtual modules, loaders, schemas, model checks) driven by the registry (step 4) | none | decision 2 | step 4's list deleted; `check-models` and `validate-content` output unchanged | |
| AW | design | Layers panel grouped by system with a group control; presets from the registry (step 5) | none | decision 5 | panel, keyboard and a11y e2e pass (changes listed); announcements tested | |
| AX | design | Registry isolation test and the fixture layer (step 6) | none | decisions 7–8 | isolation test green with only the allowlisted later-milestone files; fixture proves the M11 surfaces | |
| AY | routine | Wrap-up: goldens, bench and main-chunk parity, perf-load, full e2e in the background, `/m11/` (step 7) | none | everything above | exit criteria ticked; `/m11/` live | |

Triggers: "begin session AS" to "begin session AY". Every session follows `docs/WORKFLOW_NEW.md` §7: read `docs/HANDOFF.md` and this file, do the one serial task, end with `npm run check` (which runs `tsc`, Vitest including the goldens, `check-models`, `validate-content`) and the e2e specs it touched, commit, push to the session branch, tick the row, write `docs/HANDOFF.md`, stop.

**Order matters:** AS must be committed before any file under `src/` or `scripts/` changes (spec §13). AT before AU and AV (they use its types). AU and AV are independent of each other. AW needs AT. AX needs AT to AV (the isolation test can only pass once the tables are gone).

**User checkpoints**
- **Decisions 1 to 8 below** fill gaps in the spec. The sessions build them as written unless the user says otherwise.
- **Any golden difference** stops the session that caused it: it is a bug until the user approves it (spec §13). Approved differences are listed in step 7's table.
- **After AW:** a glance at the new grouped Layers panel (screenshot in the session notes) before AX.
- **After AY:** a glance at `/m11/`.

## Exit criteria (from `SPEC-platform.md` §11, M11)

- [x] Golden snapshots recorded (§2.2), before any refactor. *(AS, `58d1e72`)*
- [ ] `LayerDescriptor` / `KindDescriptor` types; descriptors for bones, cartilage, ligaments, muscles; `registry.ts`.
- [ ] Every literal table listed in STATUS §3 replaced by registry lookups, including bones. *(Runtime and TS scripts; the per-kind tier, panel, tree and derive code is M12's and the Python build tables are M15's, both allowlisted by decision 7.)*
- [ ] URL codes from the registry; old URLs verified against `golden/urls.json`.
- [ ] Layers panel grouped by system, from the registry.
- [ ] Registry isolation test and fixture layer passing.
- [ ] Golden snapshots unchanged; bench and main-chunk parity recorded.
- [ ] No regression: every existing unit and e2e test passes, changed only where step 5 lists why (spec §2.1).
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: M10 close-out and handover (done in the planning session)

- `/m10/`: #23 merged as `317b445`; Deploy run 28 for it succeeded, and run 29 (#24, the freeze) too. `m10` was already frozen at `317b445` in `deploy/pages.json` by AR. "Hosted copy is live" is ticked in the M10 plan.
- `SPEC-platform.md` arrived on `main` as `3d9db59` (user upload); merged into the session branch by fast-forward.
- `deploy/pages.json`: `current` set from `null` to **11**, so the next deploy of `main` builds `/m11/` from it (the live root keeps following `main`). `README.md`: M11 row "In progress". `CLAUDE.md`: status and triggers.
- **Still open, carried over (the user's, any time):** the real-device gate from M10 (AO/AP); QUESTIONS 1–139; the per-browser `?bench` table (M5 step 12). M14 asks for real-device `?bench` runs anyway, so the M10 gate could be folded into M14's.

## Decisions made in this plan (say if any should change)

1. **Main-chunk baseline and budget.** Baseline = **470.1 kB** (AR's final measurement of `317b445`, `gzip -9` of `index` + every modulepreload, built side by side). Spec §2.4's +30 kB gives **≤ 500.1 kB** with every new feature off. AY measures `317b445` and the M11 head side by side from the same `node_modules`, as AR did. The descriptors are data and tiny functions; the expected growth is a few kB.

2. **Descriptors are split in two files per layer, so zod stays out of the main chunk** (M7 kept `muscleDepthRules.ts` apart for the same reason). The spec's `KindDescriptor.schema` and `bodyWords` would otherwise pull zod and every schema into the main chunk.
   - `src/systems/<system>/<layer>/layer.ts`: the runtime `LayerDescriptor` and its `KindDescriptor`s, plain data and small pure functions (id, system, code, label, ghostOrder, colour, models, contentChunk, defaultSetting, depth, overlays, tree, and per kind: noun, parentOf, labelPriority, plus M11's existing per-kind facts such as `tendinous` part types).
   - `src/systems/<system>/<layer>/content.ts`: the authoring side (`schema`, `bodyWords`, content folder), imported only by `validate-content`, the content compiler and the Vite plugins.
   - `src/systems/registry.ts` lists the runtime descriptors in order; `src/systems/registry.content.ts` maps layer IDs to their content halves and is checked by a test to cover exactly the same layers.
   - `src/systems/types.ts` holds the spec's types with the split applied. Fields M11 doesn't use yet (`tiers`, `panel`, `searchFields`, and the tree builder details) are **optional in M11** and become required when M12 fills them; `ColourSpec` holds the current colours only (M14 extends it); `ModelSpec.chunking` exists with `"single"` only (M13 adds `"region"`).
   - The system itself is a small `SystemDescriptor` (`id`, `label`, `presets`) in `src/systems/<system>/system.ts`, also listed in the registry.

3. **Bones are an ordinary layer with one flag.** `bones` gets a descriptor like the others. What makes it different today becomes data: `models.eager: true` (loaded with the main chunk by `loadSkeleton.ts`, never through `LayerScenes`), `models.files` naming `skeleton-{high,low}.glb`. `TISSUE_LAYERS` / `TissueLayer` are replaced by registry queries (`lazyLayers()`), and `Record<TissueLayer, …>` maps by `Partial<Record<LayerId, …>>` keyed from the registry. The bone panel model, bone tree, bone search index and bone tiers stay on their M10 code until M12 and M14 move them onto the shared mechanisms (spec §3.3); M11 only stops naming "bones" outside its descriptor (allowlist, decision 7).
   - `LayerId` stays a TypeScript union, derived from the registry with `as const` (`(typeof REGISTRY)[number]["id"]`), so the compiler still catches a misspelt layer.

4. **URL codes and old URLs.** Codes come from `LayerDescriptor.code` (`b`, `c`, `l`, `m`, stable forever; a test fails if two layers share a code or a code changes against `golden/urls.json`). The parser keeps every M10 behaviour: full layer names accepted as codes (`muscles:on`), unknown codes and modes ignored, the depth suffix accepted on **the layer whose descriptor has `depth`** (today muscles) with the legacy `3` → `2`, M6's debug forms (`layers=all`, `m,l,c,a`) unchanged, `hid=` unchanged. `formatLayers` output is byte-identical to M10 for every golden URL. The `localStorage` key and format `skeleton-viewer:layers` don't change.

5. **The grouped Layers panel** (spec §8, last bullet; the only visible change in M11).
   - One collapsible header per system, in registry order: "Musculoskeletal", expanded by default; the expanded state is kept in `localStorage` (`skeleton-viewer:systems`), not in the URL.
   - The header carries a **group control**, On / Ghost / Off, that sets every layer of the system. When the layers differ it shows no option pressed (a "mixed" state, announced as "Musculoskeletal: mixed."). Choosing one is one history step and one announcement ("Musculoskeletal: all on." / "… all ghosted." / "… all off.").
   - **Presets come from the registry:** `SystemDescriptor.presets` ("Skeleton": bones on, others off; "Full musculoskeletal": all on). They keep their test IDs and wording; `presetOf` reads the same data.
   - Layer rows, progress, Retry and the depth control are unchanged, now rendered from the descriptors (the depth control from `depth`).
   - **Tests that change, and why:** `tests/e2e/layers.spec.ts` (new header and group control), `keyboard.spec.ts` (two more Tab stops in the panel: the disclosure button and the group control), `a11y.spec.ts` (axe on the collapsed and expanded states). Nothing else may change.

6. **What the golden snapshots hold** (spec §2.2), all produced in Vitest from the pure functions with the full content from disk, written by `npm run golden -- --write` (refuses to overwrite without `--force`) and compared by `tests/golden.test.ts` inside `npm run check`, with a per-ID diff on failure. Keys sorted; arrays kept in the order the app produces (order is behaviour: labels and announcements use it).
   - `tiers.json`: for each of the 1,138 IDs, tier 1 and tier 2 from `relatedAt` with **all four layers On**; for muscles also the antagonist set (M12 re-expresses antagonists as edges, so this protects it); and, for the 238 bones and teeth, tiers 1 and 2 with **bones only** (the "Off layers add nothing" rule, which M12's engine re-implements).
   - `panels.json`: for each of the 1,138 IDs, from `panelModel` (bones) and `softPanelModel` + `softSections` (soft): the title, the type line, the section titles in order and, per section, the link IDs in order, plus the breadcrumb trail. The DOM is covered by the existing panel e2e specs.
   - `urls.json`: 40 URLs (chosen in AS; at least one per layer, per kind, tiers 0–2 per kind, the part level, `grp=` for bone, soft and `attached:` groups, `hid=`, every depth stop including legacy `3`, `color=region`, `ant=1`, `ghost`, `cam=` with offset, full layer names, M6's `layers=all`, an unknown code, an unknown ID) with the store state after the app's own URL load path (`sel`, `tier`, `grp`, `ghost`, `layers`, `muscleDepth`, `hidden`, `colourMode`, `antagonists`, `cam`) and the URL serialised back from that state. If the load path can't run in Node without the browser, AS extracts the pure part (no behaviour change, its own commit) and says so in the notes.
   - `search.json`: the top 10 IDs for 60 queries through the same merge the sidebar uses (bone index + soft index, `searchMerge.ts`): bone, tooth, muscle, part, ligament, cartilage, disc and meniscus names; common names and synonyms; Latin; side words; a typo; generic words alone ("left", "muscle", "ligament").
   - **Performance baseline** (also AS, same container, before any refactor): `?bench` bones only and all four layers On (median/p5 FPS, draw calls, triangles), `npm run perf-load`, main chunk. Container FPS only compares like with like; real-device figures stay with M14.

7. **The registry isolation test in M11** (spec §10, first bullet). `tests/registryIsolation.test.ts` scans `src/` and `scripts/` (`.ts`, `.tsx`, `.py`, `.sh`) for quoted layer and kind IDs read from the registry itself (`"muscles"`, `'muscle_part'`, `` `bones` ``…). Allowed without listing: `src/systems/**`, `tests/fixtures/**`, `tests/golden/**`. Everything else must be in `tests/registry-allowlist.json`, one entry per file with **the milestone that removes it and why**:
   - M12: the per-kind tier, panel, tree, roles and derive code (`softTiers.ts`, `softPanel.ts`, `softTree.ts`, `softRoles.ts`, `derive.ts`, `relations.ts`, `softRelations.ts`, `panel.ts`, `InfoPanel.tsx`, `soft-tree-data.ts`, `announce.ts`'s wording tables if AU can't move them without changing wording).
   - M14: search (`search.ts`, `scripts/lib/search-data.ts`).
   - M15: the Python and shell build scripts (`build_soft_tissue.py`, `generate_soft_ids.py`, `classify_soft_tissue.py`, `build-models.sh`).
   - The test also fails if an allowlisted file **no longer** contains a literal (so the list only shrinks), and if an entry names no milestone. AU, AV and AX trim it; AX makes it pass. The M11 list is recorded in step 6's notes.

8. **The fixture layer in M11 proves the surfaces M11 builds.** `tests/fixtures/systems/demo/` holds a descriptor (system `demo`, one layer `widgets`, code `w`, 3 kinds, 12 structures with generated IDs), a 12-box `.glb` per LOD generated by a committed Node script with `@gltf-transform/core` (no Blender), and a test registry `tests/fixtures/systems/registry.ts` = the real registry + the demo layer.
   - **Vitest** (pure): with the test registry, the layer appears in the Layers panel rows and the system groups, `layers=` parses and formats with `w:on`, defaults, presets, colours (in the colour-vision table), ghost order, announcements nouns, the layer-load URL table, and the content-side registry.
   - **Playwright, one spec** (`tests/e2e/fixture.spec.ts`): a Vite build in `--mode fixture` aliases `src/systems/registry.ts` to the test registry (one alias in `vite.config.ts`, added once in AX). The spec turns the demo layer on from the panel, sees 12 batched instances load, picks one, and checks `layers=` in the URL.
   - **Not in M11:** the fixture's tree, search, panel sections, tiers, edges and region chunking. M12 extends it to the graph, panel and tree, M13 to region chunking, M14 to search, which together meet the spec's full §10 bullet. "Without touching any other file" is proven by the test registry being the only difference.

---

## Step 1 (AS): golden snapshots and baseline

**Done** (2026-11-24). Goldens committed as `58d1e72`, before any change under `src/` (none was needed: no file in `src/` changed in AS).

**How they are made.** `tests/golden/harness.ts` runs the app's own functions and loaders, the same virtual modules the browser loads (Vitest resolves them through `vite.config.ts`): `loadContent`, `loadSoftIds`, `loadSoftContent` for every layer, `loadSearch` / `loadSoftSearch`. `tests/golden.test.ts` compares inside `npm run check` (one key per line, sorted; on failure up to 20 keys with both values). `npm run golden` compares alone; `npm run golden -- --write` records and refuses existing files; `--write --force` overwrites (only for a difference the user approved). When a later milestone moves a function, change the harness's import, never the snapshot.

| File | Keys | What each holds |
| --- | --- | --- |
| `tiers.json` (1.5 MB) | 1,138 IDs | `t1`, `t2` from `relatedAt` with all four layers On, in the app's order; bones and teeth also `bonesOnly.t1/t2`; muscles and parts with roles also `ant` (the antagonists `withTints` adds at tier 2 with `ant=1`). 21 IDs have an empty tier 1. |
| `panels.json` (1.5 MB) | 1,138 IDs | Mirrors `InfoPanel.tsx`: title, the line under it, Part of, pair, badges, common name, `written`, the sections in render order with their links (`id \| label \| detail`) and short texts (functions, actions, innervation, joint, landmarks), the breadcrumb `trail` (and `parentCrumb` for soft). Summary and clinical HTML as 12-character SHA-1 hashes. |
| `search.json` | 60 queries | Top 10 of the sidebar's merge (bone then soft searcher, asked for 30 as `Sidebar.tsx` does): `id \| label \| match \| group \| drawn`. Scores not recorded (M14 changes ranking and reviews the differences anyway). |
| `urls.json` | 40 URLs | Each opened as a fresh page (`vi.resetModules`, stubbed `window` with empty `localStorage`) through `initSelectionFromUrl` itself, lazy chunks resolved, each layer turned on reported as on screen (as `LayerScenes` would). Records the store (`sel`, `tier`, `grp`, `antagonists`, `ghostMode`, `colourMode`, `layers`, `muscleDepth`, `debugLayersView`, `hidden`, the URL's `cam`, any toast), the **address** afterwards, and **`serialised`** = `serialiseUrlState` of that state on an empty URL (pins `formatLayers`). A page that writes its address after it was recorded fails the build. |

**Decision 6's "extract the pure part" was not needed:** the load path runs in Vitest as is, so the URL golden covers the real code, async soft `sel=` / `grp=` included.

**M10 behaviours the URL golden records as they are** (not bugs to fix in M11; listed so nobody "fixes" them by accident): `ant=1` at tier 1 stays in the address (the state drops it); `sel=` with `grp=` keeps `grp=` in the address; an unparseable `layers=` (`b:on,x:on,m:sideways`) gives the default layers and is left in the address; full layer names (`muscles:ghost`) stay as typed in the address and serialise to codes; a depth suffix on a layer without depth (`l:on:2`) is ignored; legacy `m:on:3` → depth 2 with the address unchanged; unknown bone `sel=` is removed from the address, an unknown soft one too (after the table loads); `grp=muscles.nowhere` is removed.

**Performance baseline** (this container, 2026-11-24, `58d1e72` = M10's code; SwiftShader, so FPS only compares with AY's run here):

| Measure | Figure | Method |
| --- | --- | --- |
| `?bench`, bones only | median **2.4** FPS, 5th pct 1.7; **1** draw call; **499,981** triangles; high LOD | `npm run bench-container` (new, `scripts/bench-container.ts`: serves `dist/`, 1280 × 800, 3 runs, medians) |
| `?bench`, all four layers on | median **0.7** FPS, 5th pct 0.6; **4** draw calls; **1,499,634** triangles; high LOD | same |
| `perf-load`, desktop | skeleton **3.87 s**, full detail **7.10 s**, muscles on → low shown **8.60 s** | `npm run perf-load`, medians of 3 |
| `perf-load`, phone profile | skeleton **3.72 s**, full detail **7.10 s**, muscles **9.22 s** | same |
| Main chunk | **470.1 kB** (index 298.3 + meshoptimizer 168.2 + names 2.7 + softRegistry 0.5 + runtime 0.5) | `gzip -9` of `index` + every modulepreload in `dist/index.html` |

The main chunk equals AR's 470.1 kB, so decision 1's budget (≤ 500.1 kB) stands. `perf-load` prints FAIL for the muscles layer as in every run since M7 (SwiftShader main-thread time; STATUS §6); the bone figures sit between AR's M9 and M10 runs.

**New files:** `tests/golden/{harness.ts,tiers,panels,urls,search}.json`, `tests/golden.test.ts`, `scripts/golden.ts`, `scripts/bench-container.ts`; npm scripts `golden`, `bench-container`. For decision 7: `tests/golden/**` is allowed without listing; `scripts/bench-container.ts` and `scripts/golden.ts` contain no layer or kind literal except the bench link's `layers=` codes (`b:on,c:on,…`), which are URL codes, not quoted IDs.

## Step 2 (AT): descriptors, registry, layer-identity tables

Tables to delete and replace (from `STATUS-M10.md` §3): `LAYERS`, `TISSUE_LAYERS`, `LAYER_CODE`/`CODE_LAYER`, `DEFAULT_LAYERS`/`DEFAULT_LAYER_SETTING`, the muscles-only depth suffix (`src/state/url.ts`); the literal layer loop in `src/state/store.ts`; `LAYER_LABELS` (`src/content/softRegistry.ts`, `src/ui/LayersPanel.tsx`); `LAYER_COLOURS` (`src/layers/colours.ts`); `LAYER_NAMES`, `GHOST_ORDER`, per-layer material colours, `wantsPatches` (`src/layers/LayerScenes.tsx`; patches become `overlays`); the batch store key (`src/scene/layerRegistry.ts`); `Record<Layer, LayerShow>` and the muscles peel hook (`src/scene/isolation.ts`, via `depth`); `BENCH_TISSUE` (`src/scene/bench.ts`); `LAYER_KEY` (`src/ui/Legend.tsx`); the M6 debug codes (`src/scene/debugLayers.ts`, `DebugLayers.tsx`; `a` = the attachments overlay); `layerOnAt`; `tests/colourVision.test.ts` reads layer colours from the registry (the full rewrite is M14).

**Done** (2026-11-24). Goldens unchanged; `npm run check` green (39 files, 574 tests); e2e `layers`, `layers-debug`, `smoke`, `polish`, `tints`, `nested`, `announce`, `labels-layers`, `interaction` pass (61 tests). `git diff public/models/ content/` empty.

**What exists now.**
- `src/systems/types.ts`: `LayerDescriptor`, `KindDescriptor`, `ColourSpec` (`material`, `keyLabel` for the colour key's "Bone", `debug`), `ModelSpec` (`file`, `eager`, `chunking: "single"`, `debugManifest`), `DepthSpec` (`stops`, `legacy` = `{3: 2}`), `OverlaySpec` (the patches: `debugCode` `a`, `file`, `when: "selected-tier"`), `SystemDescriptor`; `defineLayer` / `defineSystem` keep the literal types (`const` type parameter). Optional until their milestone: `contentChunk`, `tree` (an empty placeholder, M12), `presets` (AW). Not added yet, because nothing reads them in AT and the rule is no duplicated tables: `noun`, `labelPriority` (AU), `schema`, `bodyWords` (AV, `content.ts` halves and `registry.content.ts`), `tiers`, `panel`, `searchFields` (M12, M14).
- `src/systems/musculoskeletal/{system.ts, bones,cartilage,ligaments,muscles/layer.ts}`: the four descriptors. Kinds carry only `id` and, for `muscle`, `parentOf`.
- `src/systems/registry.ts`: `SYSTEMS`, `REGISTRY`; types `LayerId`, `LazyLayerId`, `EagerLayerId`, `DepthLayerId` **derived from the descriptors' literal types** (`Extract<…, { models: { eager: false } }>`), so the compiler still checks layer names; lookups `LAYER_IDS`, `LAZY_LAYERS`, `EAGER_LAYER`, `DEPTH_LAYER`, `depthStops`, `DEFAULT_MODES`, `OVERLAYS`, `layerByCode`, `isLayerId`, `isLazyLayer`, `layerDescriptor`, `layerLabel`, `layerColour`, `layerOfKind`, `hasNestedParts`, `debugFacts`, `DEBUG_CODES`.
- `tests/registry.test.ts` (7 tests): unique IDs, codes (one letter) and ghost orders; overlay debug codes don't clash; each kind in one layer; one eager and one depth layer; defaults; **every golden URL's `layers=` formats and parses byte for byte** (decision 4).

**Tables deleted:** `LAYERS`, `TISSUE_LAYERS`, `LAYER_CODE`/`CODE_LAYER`, `DEFAULT_LAYERS`, the muscles-only depth branch (`url.ts`; `Layer`, `LayerMode`, `LayerModes` stay as type aliases of the registry's); the store's literal loop; both `LAYER_LABELS`; `LAYER_COLOURS` (`colours.ts` keeps only `TENDON_COLOUR`; `BONE_COLOUR` in `material.ts` now reads the bones descriptor); `LAYER_NAMES` (unused), `GHOST_ORDER`, the two `loadManifest` ternaries (now `loadLayerManifest` in `debugLayers.ts`, from `debugManifest`), `wantsPatches`' literal (the overlay's layer), `MAX_PARTS` for "muscles" (`hasNestedParts`); `BENCH_TISSUE`; `LAYER_KEY`; the debug `CODES` and `DEBUG_LAYER_COLOURS`' literals; `"bones"` in `isolation.ts`, `Isolation.tsx`, `LayersPanel.tsx` (depth control from `DEPTH_LAYER`, load status from `isLazyLayer`), and the loading checks in `selection.ts`, `announce.ts`, `CameraRig.tsx`. `TissueLayer` → `LazyLayerId` everywhere (13 files, mechanical). `loadLayerParts` takes a file stem (`ModelSpec.file` or the overlay's).

**Decisions taken in the session.**
- The tendon tint is computed per lazy layer from that layer's colour (`TENDON_TINTS`), not from "the muscles": same colour for every tendon (only muscle parts are tendinous).
- The golden harness's one import of `DEFAULT_LAYERS` now reads `DEFAULT_MODES` from the registry (harness changed, snapshot not).
- Left for later sessions on purpose: the presets and "Skeleton: bones only." (`selection.ts`, `announce.ts`: AW), `focusLayerOf` / `Labels.tsx` (AU), `SOFT_LAYERS` and budgets in `model-checks.ts`, the soft-content `importers` (AV).

**Main chunk:** 471.2 kB gzip -9 (+1.0 kB on AS's 470.1; budget 500.1). The registry lands in a shared chunk Rolldown names `model-checks-*.js` (registry + the preload helper the descriptors' `debugManifest` imports need + `compareBounds`, 2.0 kB), now a modulepreload. Only the name is odd; AV may rename it when `model-checks.ts` moves onto the registry.

## Step 3 (AU): kind tables (runtime)

`SoftKind`, `PartType`, `isTendinous` (`src/layers/softIds.ts`); `isMuscleKind` and `loadSoftContent("muscles")` (`src/state/selection.ts`); the bone `kind` union (`src/content/placeholder.ts`); `layerOfKind`/`SoftLayerName` (`src/content/softTiers.ts`, the lookup only; the rules stay for M12); `groupLayer` (`src/content/groups.ts`); `focusLayerOf` and the kind priorities (`src/scene/labels.ts`, `src/ui/Labels.tsx`: `labelPriority`); `NOUNS` and `ORDER` (`src/content/announce.ts`: `noun` and layer order; wording must not change, checked by `announce.test.ts`); `MAX_PARTS` and the muscle part level (`parentOf`); cursor stops (`src/camera/CameraRig.tsx`); `muscleDepth*.ts` keyed by the `depth` layer.

**Done** (2026-11-24). Goldens unchanged; `announce.test.ts` unchanged and passing; `npm run check` green (39 files, 575 tests); e2e: see the handoff. `git diff public/models/ content/` empty.

**What exists now.**
- `KindDescriptor` gains `noun` (`one`/`many`), `labelPriority`, `parentOf.maxParts` and `partTypes` (`{ id, tendinous? }`). The four `layer.ts` files fill them: priorities muscle 0, muscle_part 1, ligament 2, cartilage 3, disc 4, meniscus 5, bone/tooth 6; the tooth's noun is "bone"/"bones".
- `src/systems/registry.ts`: types `KindId`, `EagerKind`, `SoftKind`, `PartType`, all **derived from the descriptors' literals** (checked: a wrong literal fails `tsc`); lookups `kindDescriptor`, `kindNoun`, `countKind` (the first kind with the same noun: tooth → bone), `COUNT_ORDER` (the eager layer's kinds, then the rest by `labelPriority`: bone, muscle, muscle_part, ligament, cartilage, disc, meniscus = M10's `ORDER`), `LABEL_ORDER` (layers by their kinds' lowest priority: muscles, ligaments, cartilage, bones = M10's focus order), `NESTED_LAYER` (the layer with parts), `maxPartsOf`, `PART_TYPES`, `isTendinousType`.
- `tests/registry.test.ts` + 1 test pinning both orders, tooth → bone, one nested layer, `childKind` in its parent's layer.

**Tables deleted:** `SoftKind`/`PartType` literal unions and `isTendinous`' literals (`softIds.ts`, re-exporting the registry's types); `"bone" | "tooth"` (`placeholder.ts`, `validate.ts`: `EagerKind`); `layerOfKind`/`SoftLayerName` in `softTiers.ts` (registry `layerOfKind`, the output record built from `LAZY_LAYERS`; the per-kind rules stay for M12); `groupLayer`'s and `isMuscleKind`'s `"muscles"` and `loadSoftContent("muscles")` (`NESTED_LAYER`); `focusLayerOf`'s order and `"bones"` (`LABEL_ORDER`, `EAGER_LAYER`) and Labels.tsx's `"bones"`/`st.layers.muscles` (eager layer, top of `LABEL_ORDER`, `hasNestedParts` for the label key); `NOUNS`/`ORDER`/`BONE_IDS` (`announce.ts`: `kindNoun`, `COUNT_ORDER`, `countKind`); `MAX_PARTS` (`maxPartsOf`); the cursor's `"muscles"` fallback (`CameraRig.tsx`); `muscleDepth.ts`/`muscleDepthRules.ts`' kind checks (`hasDepth` = kind of `DEPTH_LAYER`; the "muscle"/"part" error word is the kind's noun). Also `softSchema.ts`' `PART_TYPES` now reads the registry (one table instead of two; the rest of `softSchema.ts` is AV's).

**Decisions taken in the session.**
- One number, `labelPriority`, gives both M10 orders: focus = lowest first; counts = the eager layer first, then lowest first. Pinned by the registry test, so a new layer has to choose deliberately.
- Kinds that share a noun are counted together (tooth as bone), so `countsPhrase`/`counted` keep M10's wording with no `countAs` field.
- Left on purpose (wording or rules, M12): `counted(…, "muscle")`, `bone: 0` and the part → `"muscle"` fallback in `announce.ts`; the per-kind tier rules in `softTiers.ts`; `KIND_LABELS` (`softPanel.ts`); `layer: "muscles"` on the synonym sets in `groups.ts` (soft tree). For AV: `CARTILAGE_KINDS` and the rest of `softSchema.ts`.

**Main chunk:** 471.4 kB gzip -9 (index 298.0 + meshoptimizer 167.6 + names 2.7 + registry 2.2 + softRegistry 0.5 + runtime 0.5; +0.2 on AT). The shared chunk is now named `registry-*.js` (it was `model-checks-*.js`).

## Step 4 (AV): build-side and content-side tables

`schemaForKind`, `CARTILAGE_KINDS`, `LAYER_FOLDERS`, `SOFT_BODY_WORDS` (`src/content/softSchema.ts`, into the `content.ts` halves); `SOFT_LAYERS` and the per-layer virtual modules (`scripts/lib/content-files.ts`, `content-plugin.ts`); the `importers` map (`src/content/softContentLoader.ts`; a static import map is still needed for Vite, so it is generated from the registry by the plugin as `virtual:skeleton-layer-importers`); `scripts/lib/soft-ids-plugin.ts`; `SOFT_LAYERS` and `LAYER_BUDGETS` (`scripts/lib/model-checks.ts`, budgets into `models`); the module declarations in `vite-env.d.ts` (one declaration with a template-literal module name). Acceptance: `npm run check-models`, `validate-content` and `npm run content` print the same as before (diffed in the notes).

*Notes added when the session runs.*

## Step 5 (AW): grouped Layers panel

Decision 5. *Notes added when the session runs*, with the screenshot for the user's checkpoint.

## Step 6 (AX): isolation test and fixture layer

Decisions 7 and 8. *Notes added when the session runs*, with the final allowlist.

## Step 7 (AY): wrap-up

- Goldens: unchanged, or every difference listed here with the user's approval.
- Parity table (decision 6's baseline against the M11 head): triangles, draw calls, `?bench` FPS, skeleton load (`perf-load`), main chunk (decision 1).
- Full e2e in the background with a log file (`docs/WORKFLOW_NEW.md` §3), then a grep for failures.
- `/m11/`: PR to `main`, merge, Deploy run, then freeze `m11` in `deploy/pages.json` at the merge commit and set `current` to 12 at the start of M12 (`CLAUDE.md`, milestone handover).

*Notes added when the session runs.*
