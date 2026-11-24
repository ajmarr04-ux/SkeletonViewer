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
| AS | design | Record the four golden snapshots and the M10 performance baseline, before any refactor (step 1) | none | decisions 1, 6 | `tests/golden/*.json` committed; `tests/golden.test.ts` passes in `npm run check`; baseline table filled | |
| AT | design | Descriptor types, `src/systems/registry.ts` and the four layer descriptors; layer-identity tables (codes, defaults, labels, colours, ghost order, depth) moved onto them (step 2) | none | decisions 2–4 | the tables in step 2's list are deleted; goldens unchanged; `check` green | |
| AU | routine | Kind tables in the runtime moved onto `KindDescriptor`s (step 3) | none | AT's types | step 3's list deleted; goldens unchanged | |
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

- [ ] Golden snapshots recorded (§2.2), before any refactor.
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

*Notes added when the session runs.*

## Step 2 (AT): descriptors, registry, layer-identity tables

Tables to delete and replace (from `STATUS-M10.md` §3): `LAYERS`, `TISSUE_LAYERS`, `LAYER_CODE`/`CODE_LAYER`, `DEFAULT_LAYERS`/`DEFAULT_LAYER_SETTING`, the muscles-only depth suffix (`src/state/url.ts`); the literal layer loop in `src/state/store.ts`; `LAYER_LABELS` (`src/content/softRegistry.ts`, `src/ui/LayersPanel.tsx`); `LAYER_COLOURS` (`src/layers/colours.ts`); `LAYER_NAMES`, `GHOST_ORDER`, per-layer material colours, `wantsPatches` (`src/layers/LayerScenes.tsx`; patches become `overlays`); the batch store key (`src/scene/layerRegistry.ts`); `Record<Layer, LayerShow>` and the muscles peel hook (`src/scene/isolation.ts`, via `depth`); `BENCH_TISSUE` (`src/scene/bench.ts`); `LAYER_KEY` (`src/ui/Legend.tsx`); the M6 debug codes (`src/scene/debugLayers.ts`, `DebugLayers.tsx`; `a` = the attachments overlay); `layerOnAt`; `tests/colourVision.test.ts` reads layer colours from the registry (the full rewrite is M14).

*Notes added when the session runs.*

## Step 3 (AU): kind tables (runtime)

`SoftKind`, `PartType`, `isTendinous` (`src/layers/softIds.ts`); `isMuscleKind` and `loadSoftContent("muscles")` (`src/state/selection.ts`); the bone `kind` union (`src/content/placeholder.ts`); `layerOfKind`/`SoftLayerName` (`src/content/softTiers.ts`, the lookup only; the rules stay for M12); `groupLayer` (`src/content/groups.ts`); `focusLayerOf` and the kind priorities (`src/scene/labels.ts`, `src/ui/Labels.tsx`: `labelPriority`); `NOUNS` and `ORDER` (`src/content/announce.ts`: `noun` and layer order; wording must not change, checked by `announce.test.ts`); `MAX_PARTS` and the muscle part level (`parentOf`); cursor stops (`src/camera/CameraRig.tsx`); `muscleDepth*.ts` keyed by the `depth` layer.

*Notes added when the session runs.*

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
