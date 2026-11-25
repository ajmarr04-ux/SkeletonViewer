# Milestone 12 Plan: Relationship graph and descriptor-driven UI (Platform spec, M12)

Source of truth: `SPEC-platform.md` §2 (hard rules), §3.2–3.3 (descriptors, bones are not special), §4 (relationship graph), §5 (descriptor-driven UI), §10 (validation and tests), §11 (M12) and §13 (working rules). The earlier specs and `CLAUDE.md`'s ground rules still apply. Workflow: `docs/WORKFLOW_NEW.md`. **This phase adds no anatomy:** `git diff public/models/ content/` stays empty in every session. QUESTIONS start at **140**.

## Goal

Replace the per-kind relationship code with **one typed graph** and **declarative descriptors**. Every relationship (articulation, region neighbour, joint membership, part of, origin and insertion, connects, attached to, acts on, and the derived synergists and antagonists) becomes an edge compiled at build time from the authoring files, which don't change. Tier sets come from **tier rules as data** evaluated by one engine; the info panel, the sidebar tree builders, announcements and label priority come from the layer and kind descriptors. After M12 the app looks and behaves **exactly as at M11**: all four golden snapshots match with no approved differences, and the 17 M12 entries leave `tests/registry-allowlist.json`.

Out of scope (later milestones, `SPEC-platform.md` §11): `located_in` edges and regions (M13); the sidebar's system grouping and lazy tree per system, per-layer search indexes and `searchFields` (M14, see decision 10); `build.json` and the Python scripts (M15). New anatomy, content changes, new UI.

## What exists already (from M6 to M11)

- **Each relationship has its own shape and code** (`STATUS-M10.md` §4). Bone tiers are computed at runtime in the main chunk (`src/content/relations.ts`: articulations both ways + adjacent teeth, sorted in `ids.json` order; tier 2 adds `regions.json` as written). Soft tiers are **precomputed at build time** (`buildSoftTiers`, `src/content/softTiers.ts`, sorted by ID) and shipped per layer as `tiers` + `reverse`, registered by `softRelations.ts`. `relatedAt` (`src/scene/isolation.ts`) merges them and filters by the layers showing.
- **Derived relations:** `derive.ts` (synergists, antagonists, attached muscles, with `synergistOverrides` and functional joints), `softRoles.ts` (origin/insertion patches and whole-tint fallbacks, antagonists for the tints), `jointScope` (`softTiers.ts`: two joint IDs are the same joint when their pair sets overlap).
- **Panels:** `panel.ts` (bones, with `placeholder.ts`), `softPanel.ts` (`softPanelModel`, `softSections`: a `muscle` or `ligament | cartilage` union), `InfoPanel.tsx` (882 lines: `Body` for bones, `MuscleSectionsView`, `JoinSectionsView`). Five section layouts in the golden: bone (Summary / Functions / Articulations / Key landmarks / Attached muscles / Clinical note, 238), muscle without and with Parts (479 + 58), ligament (Joint / Connects / Functions / Clinical note, 302), cartilage (… Attached to …, 61).
- **Trees:** the bone tree from `content/hierarchy.json` with tooth-type groups (`groups.ts`, main chunk); the soft roots (`softTree.ts`, `SOFT_ROOTS`, one builder per root; built by `scripts/lib/soft-tree-data.ts` into `virtual:skeleton-soft-tree`, 12.1 kB gzip, lazy).
- **ID table:** `virtual:skeleton-soft-ids`, 11.0 kB gzip, lazy (`softTable.ts` → `registerSoftIds`); before it loads, soft lookups answer "unknown". Bones' `ids.json` is already in the main chunk (imported by several modules).
- **Registry (M11):** `src/systems/` descriptors with `noun`, `labelPriority`, `parentOf`, `partTypes`; `tree` is an empty placeholder; `tiers`, `panel`, `searchFields` don't exist yet. The allowlist names 17 files for M12: `src/content/{announce,derive,groups,names,panel,placeholder,schema,softCompile,softPanel,softRoles,softTiers,softTree,softValidate,validate}.ts`, `src/ui/InfoPanel.tsx`, `scripts/content/patch-check.ts`, `scripts/lib/soft-tree-data.ts`.
- **Goldens:** `tiers.json` (t1, t2, `bonesOnly`, `ant`), `panels.json`, `urls.json`, `search.json`. **No golden covers the sidebar tree** (decision 9 adds one first).
- **Main chunk at M11:** 472.3 kB gzip -9 (AY's figure). Budget stays **≤ 500.1 kB** (M11 decision 1, spec §2.4).

## Progress

Session kinds: **design** = strong model (graph, engine, descriptor shapes); **routine** = Sonnet is fine (mechanical migration against fixed goldens). No subagents in any session (spec §2.5).

| Session | Kind | Serial task (one sentence) | Fan-out | Inputs | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- |
| (planning) | design | M11 → M12 handover and this plan (step 0) | none | `SPEC-platform.md` | `current` 12, plan written | **Done.** See step 0 |
| AZ | design | Tree golden, then the graph core: edge types, the edge compiler from the authoring files, derived edges, compiler checks (step 1) | none | decisions 1–4, 9 | `tests/golden/tree.json` committed first; the compiled graph reproduces today's derived facts for every ID; `derive.ts` gone; `check` green | **Done.** See session notes |
| BA | design | Query engine and tier rules as data on every kind, proven offline against `tiers.json` (step 2) | none | decisions 5–6 | the engine over the Node-compiled graph gives `tiers.json` exactly for all 1,138 IDs, every mode set the golden holds | **Done.** See session notes |
| BB | design | The always-loaded ID index replaces `registerSoftIds` and the lazy soft-ids chunk (step 3) | none | decision 7 | `softTable.ts`/`registerSoftIds` gone; goldens unchanged; main chunk measured | **Done.** See session notes |
| BC | design | Ship the graph in the chunks and switch tiers, roles and tints onto it; delete the old relationship modules (step 4) | none | decisions 3, 8 | `relations.ts`, `softTiers.ts`, `softRelations.ts`, `softRoles.ts` deleted; goldens unchanged; tiers/tints/related e2e pass | |
| BD | design | Panel sections as data and one generic panel model for every kind, bones included (step 5) | none | decision 11 | `panel.ts`, `placeholder.ts`, `softPanel.ts`' switches deleted; the panel golden produced by the new model unchanged | |
| BE | routine | `InfoPanel.tsx` renders the sections in descriptor order (step 6) | none | BD's model | per-kind views deleted; panel, soft-content, attached, nested, a11y e2e pass unchanged | |
| BF | routine | Tree builders from `TreeSpec` for all four layers, bones included (step 7) | none | decision 10 | `softTree.ts`' roots and builders, `soft-tree-data.ts`, `groups.ts`' literals gone; tree golden unchanged; sidebar e2e pass | |
| BG | routine | Announcements, tier wording, display names and label priority from descriptors (step 8) | none | decision 12 | `announce.ts`, `names.ts` off the allowlist; `announce.test.ts` unchanged and passing | |
| BH | routine | Validation and compile rules per kind onto the content halves (step 9) | none | decision 13 | `schema.ts`, `validate.ts`, `softValidate.ts`, `softCompile.ts`, `patch-check.ts` off the allowlist; `validate-content` and `content:patch-check` output unchanged | |
| BI | design | The fixture layer gains edges, tier rules, a panel and a tree; the allowlist's M12 entries are all gone (step 10) | none | decision 14 | fixture Vitest and e2e prove graph, tiers, panel and tree; allowlist has no M12 entry | |
| BJ | routine | Wrap-up: goldens, parity table, full e2e in the background, `/m12/` (step 11) | none | everything above | exit criteria ticked; `/m12/` live | |

Triggers: "begin session AZ" to "begin session BJ". Every session follows `docs/WORKFLOW_NEW.md` §7: read `docs/HANDOFF.md` and this file, do the one serial task, end with `npm run check` (which runs `tsc`, Vitest including the goldens, `check-models`, `validate-content`) and the e2e specs it touched, commit, push to the session branch, tick the row, write `docs/HANDOFF.md`, stop.

**Order matters:** AZ's tree golden is committed before any file under `src/` or `scripts/` changes (spec §13). AZ → BA → BC (BC ships what AZ compiles and BA evaluates). BB is independent of BA and can run before or after it, but before BC (BC's link names and filters read the index). BD needs BC (sections ask the graph); BE needs BD. BF and BG need BC only; BH needs AZ only. BI needs all of AZ–BH (the allowlist can only empty once every file is moved).

**User checkpoints**
- **Decisions 1 to 14 below** fill gaps in the spec. The sessions build them as written unless the user says otherwise.
- **Any golden difference** stops the session that caused it: it is a bug until the user approves it (spec §13). Approved differences are listed in step 11's table.
- **The escape hatch** (decision 11): if a session finds it needs a third `custom` panel component or a custom tier step, it stops and asks (spec §13).
- **After BJ:** a glance at `/m12/`.

## Exit criteria (from `SPEC-platform.md` §11, M12)

- [ ] Edge types, edge compiler, derived edges, query engine.
- [ ] Tier rules for every kind as data; `golden/tiers.json` matches for all 1,138 IDs.
- [x] The small always-loaded ID index replaces `registerSoftIds`.
- [ ] Panels, tree builders, announcements and label priority from descriptors; `golden/panels.json` matches.
- [ ] The old relationship modules (`relations.ts`, `softTiers.ts`, `softRelations.ts`, `softPanel.ts` switches) deleted.
- [ ] Every golden unchanged (`tiers`, `panels`, `urls`, `search`, and the new `tree`); the allowlist has no M12 entry.
- [ ] No regression: every existing unit and e2e test passes unchanged, except where a step lists why (spec §2.1). Performance parity (bench, perf-load, main chunk ≤ 500.1 kB).
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: M11 close-out and handover (done in the planning session)

- `/m11/`: confirmed live by the user (2026-11-25); "Hosted copy is live" ticked in `docs/PLAN-milestone-11.md`. `m11` was already frozen at `a2709f6` by AY's follow-up (#26, `d679b07`).
- `deploy/pages.json`: `current` set from `null` to **12**, so the next deploy of `main` builds `/m12/` from it. `README.md`: M12 row "In progress". `CLAUDE.md`: status line.
- **Still open, carried over (the user's, any time):** the real-device gate from M10 (AO/AP; M14's device runs can fold it in); QUESTIONS 1–139; the per-browser `?bench` table (M5 step 12).

## Decisions made in this plan (say if any should change)

1. **Where the graph lives.** The engine is generic and names no system, layer, kind or edge type:
   - `src/graph/types.ts`: `Edge = { from, type, to, meta? }` (spec §4.1), `EdgeTypeDescriptor = { id, label, inverse, symmetric, derived? }`, `TierRule`, `TierStep`.
   - `src/graph/edgeTypes.ts`: the lookups over the registered edge types (`edgeType`, `byLabel` for steps that name an inverse label, `isSymmetric`).
   - `src/graph/compile.ts`: the generic edge compiler and its checks (spec §10: every endpoint exists, every type is registered, a symmetric edge is stored once, as `from < to`). Pure, run in Node by the content plugin and by Vitest.
   - `src/graph/graph.ts`: the runtime index (forward and inverse adjacency per type, built when a chunk registers its edges; idempotent per chunk) and `src/graph/query.ts`, the tier engine (decision 5).
   - **The edge types themselves are descriptors**, declared where their facts belong: `src/systems/musculoskeletal/edges.ts` holds spec §4.2's table (`articulates_with`, `member_of_joint`, `part_of`, `originates_on`, `inserts_on`, `connects`, `attached_to`, `acts_on`, `region_neighbour`, `synergist_of`, `antagonist_of`) plus the two decision 2 adds. `SystemDescriptor` gains `edgeTypes`; `registered.ts` stays the only list. The registry isolation test (M11 decision 7) **also scans for edge type IDs and inverse labels** from the registry, so the engine can't name one.

2. **Two edge types the spec's table doesn't list**, because two of today's rules aren't paths over the listed edges. Both are derived at build time, in the musculoskeletal descriptor folder (spec §4.2: "the engine needs no change to add one"):
   - `adjacent_tooth` (symmetric, derived): the teeth either side in the arch (`adjacentTeeth`, FDI numbers). Today it is part of a tooth's tier 1 and a "Neighbouring teeth" sub-list inside the tooth's Articulations section, kept apart from the articulation links.
   - `shares_joint_with` (symmetric, derived): two ligaments or cartilages whose joints are the same joint by `jointScope`'s overlap rule. Tier 2 of a ligament or cartilage is "everything at the same joint", and the overlap rule (a pair joint's scope is itself plus every pair of every functional joint containing it) isn't a fixed number of hops over `member_of_joint`. `member_of_joint` edges are still compiled (the panel's "Joint" section reads them, and M13 or later systems may follow them); the derived edge carries the tier.
   - The joints (pair joints from `articulations.json`, functional joints from `joints.json`) are **graph nodes that are not structures**: no layer, no mesh, listed in the ID index as `node: "joint"` with their names (decision 7), so the endpoint check passes and the panel can name them.

3. **Shipping (spec §4.5).** Each layer's content chunk carries the edges **whose `from` is in that layer** and, as its reverse index, **the edges whose `to` is in that layer**; a symmetric edge travels with both endpoints' layers. The eager layer's own edges (articulations, regions, adjacent teeth) ship **in the main chunk**, as `articulations.json` and `regions.json` do today, so bone tiers stay synchronous. Registering a chunk adds its edges to the one runtime graph (deduplicated). The invariant this keeps from M10: *a structure's panel and tiers need the main chunk, its own layer's chunk and the chunks of the layers that are showing, nothing else.* The inverse adjacency is built at registration (a few thousand edges, well under a millisecond) rather than shipped twice; the chunks get **smaller** (precomputed tier-2 lists go), and BC reports each chunk's size before and after.

4. **Derived edges keep today's rules exactly** (spec §4.4). `synergist_of` / `antagonist_of` are `derive.ts` re-expressed over `acts_on` edges (meta `movement`, `role`; a part inherits its muscle's actions; `synergistOverrides`; functional joints; `antagonistPairs` from `movements.json`); "attached muscles" is the inverse of `originates_on` / `inserts_on`. The rule code moves into the muscles' descriptor folder (`src/systems/musculoskeletal/muscles/derive.ts`), where naming kinds is allowed; `src/content/derive.ts` is deleted in AZ. **Acceptance in AZ:** for every muscle and part, the derived edges give exactly today's `derived.synergists`, `derived.antagonists` and `derived.attached` (a Vitest comparison against the M11 compiler's output, run before the old code is deleted, then kept as a graph unit test over a few fixed IDs).

5. **The query engine and step semantics** (spec §4.3), as AZ/BA build them:
   - Steps: `{ self: true }`, `{ follow, from? }` (`follow` = edge type IDs or inverse labels; `from` = `"self"` (default), `"self+parts"`, `"previous"`), `{ tier: "t1" }`, `{ filter: { kind? , layer? } }`, plus one ordering option per step, `order: "id" | "anatomical" | "written"`, because order is behaviour (labels and announcements use it) and today's lists have three: soft lists sorted by ID, bone partners in `ids.json` order, region neighbours as written in `regions.json`.
   - The result is the steps' outputs concatenated in order, first occurrence kept, the structure itself removed; a `t2` excludes what its `t1` already holds, as today.
   - **Parts expansion is generic:** wherever a result holds a structure whose kind has `parentOf` (a muscle with parts, which has no mesh of its own), its parts follow it, from `part_of` edges. No kind name in the engine.
   - **"Off layers add nothing"** is applied after evaluation, by layer mode, exactly as `relatedAt` does now; the antagonist set for the tints (`ant` in the golden) is a third rule, `ant`, on the muscle kinds.
   - Results are memoised per (ID, tier, layer modes, graph version): labels re-rank every 100 ms while the camera moves (`LabelProbe`), so a cold evaluation per frame would show in `?bench`'s label timings. BJ compares them.
   - **Custom steps:** none planned. Spec §13 caps the escape hatches; a session that needs one stops and asks.

6. **Tier rules per kind** (data on each `KindDescriptor.tiers`; BA proves them offline against `tiers.json`, BC switches the app):
   - bone, tooth: `t1` = `articulates_with` + `adjacent_tooth` (anatomical order), then the inverse of `originates_on`, `inserts_on`, `connects`, `attached_to` from `self` (ID order); `t2` = `t1` + `region_neighbour` (written order) + the same inverses `from: "previous"`. With only bones showing this gives the `bonesOnly` sets.
   - muscle, muscle_part: `t1` = `has part` + `originates_on`, `inserts_on` from `self+parts` (a part's `inherit` resolved by the compiler into its own edges with meta `inherited`); `t2` = `t1` + `synergist_of` + their `originates_on`/`inserts_on` from `previous`; `ant` = `antagonist_of`.
   - ligament: `t1` = `connects`; `t2` = `t1` + `shares_joint_with`; no `t2` when the ligament has no joint (today's `t2: null`, so the panel's tier-2 button stays disabled with "Not part of a joint").
   - cartilage, disc, meniscus: as the ligament with `attached_to`.
   - If an ordering can't be expressed with decision 5's options, BA stops and asks before adding one.

7. **The always-loaded ID index** (spec §4.5, replaces `registerSoftIds`). One generated module in the main chunk, `virtual:skeleton-index`, for every structure of every layer plus the joint nodes: `id`, layer (by its URL code), kind, name, side, parent, mesh, and the M7 fields the lazy table carries now (`partType`, parts, depth). Because the bones' `ids.json` is in the main chunk already, the net addition is the 900 soft entries and the joints; `softTable.ts`, `loadSoftIds.ts`, `registerSoftIds` and the "unknown until the table loads" state go, and `isKnownId`, `hasMesh`, `displayName`, `layerOfId` answer at once. **Budget:** the lazy table is 11.0 kB gzip today; BB measures the main chunk, and if it grows by more than **12 kB**, BB keeps `depth` and `partType` in a lazy part and says so. **Behaviour:** the URL golden records each page's state after loading, so a soft `sel=` resolving one tick earlier doesn't change it; BB runs `urls.json` and the `nested`, `layers`, `select`, `tiers` e2e specs to confirm. `perf-load`'s skeleton time is re-measured in BJ (about 10 kB more before first paint).

8. **Roles and tints on the graph.** `MuscleRoles` (origin and insertion patches `p`, whole-tint fallbacks `f`, antagonists `ant`) is computed from `originates_on` / `inserts_on` edges and the attachments overlay's patch list (the overlay's `debugManifest` as now); `withTints` reads it through the graph. `softRoles.ts` and `scripts/content/patch-check.ts`'s kind checks move into the muscles' descriptor folder. `npm run content:patch-check` must print the same report (diffed in the notes).

9. **A tree golden before anything moves** (spec §2.2 lists four goldens, but M12 rebuilds the tree builders and none of the four covers them). AZ's first commit adds `tests/golden/tree.json`, written by the existing harness from the shipped data before any change under `src/`: the bone tree rows (`content/tree.ts`, every key, label, level and leaf), the soft roots from `virtual:skeleton-soft-tree` (keys, labels, names, leaves with `drawn` and parts, the `sets`), and every group's `groupCounts` and `groupAnnouncement`. Compared in `npm run check` like the others. Adding a file is not a difference, so it needs no approval; changing it afterwards does.

10. **Trees in M12: builders only, the sidebar unchanged.** Each layer's `TreeSpec` names a builder: `hierarchy` (bones: `content/hierarchy.json` + the tooth-type groups), `regionCompartment` (muscles: `content/muscle-hierarchy.json`, muscle → parts), `byJoint` (ligaments: functional joint, then pair joint, "Other ligaments"), `byKind` (cartilage: kind, then joint). The builders are generic functions in `src/tree/`; their per-layer facts (labels like "Other ligaments", the cartilage kind order) are data in the descriptors. **The sidebar's roots, their order, the lazy soft tree chunk and the group keys stay exactly as at M11.** Spec §5.2's "roots grouped by system, each system's tree lazy" is M14's checklist item ("Lazy tree per system"), and grouping now would be the milestone's only visible change, so it moves there.

11. **Panel sections as data** (spec §5.1). `KindDescriptor.panel` is a list of `PanelSection`s in render order; one generic model (`src/panel/model.ts`) turns an ID + its layer's content + the graph into the sections the golden records; `InfoPanel.tsx` renders by `render` type. The spec's four render types are used as follows:
    - `text` / `list` (a front-matter field): Summary (HTML), Functions, Key landmarks, Clinical note, Innervation (with `inheritFrom: "part_of"` for a part, today's "from <muscle>").
    - `links` (edges): Parts, Articulations (meta `joint`, `name` as the detail; the hover joint highlight is a `links` option, `highlight: "pair"`; the teeth's "Neighbouring teeth" sub-list is a second edge list in the same section, `also: { title, edges: "adjacent_tooth" }`), Connects, Attached to, Synergists, Antagonists (minus synergists, M9 decision 7, as a `links` option `exclude: "synergist_of"`), Joint (`member_of_joint`, one link-less name).
    - `grouped-links`: the bone's Attached muscles (inverse `originates_on` / `inserts_on`, `groupBy: "type"` → "Origins", "Insertions").
    - `actions-table`: Actions (joint · movement · role, a part's inherited rows apart).
    - `custom`, **the two allowed uses**: Origin and Insertion, one component (`attachments`) used twice. Their rows mix edges (structure + landmark meta) with free text (`{ soft: … }`, which is not a structure and can't be an edge endpoint), a part's `inherit`, and a muscle's rows collected from its parts with the part's short name. A generic render type for that would exist for these two sections only. Reason recorded here, as spec §13 asks.
    - Everything that isn't a section (title, type line, badges, pair toggle, breadcrumb, tier buttons, antagonist toggle, Hide) stays panel chrome, read from the kind descriptor (`typeLine`, `badges`, `trail`) instead of `if (kind === …)`.
    - **Acceptance:** `tests/golden/harness.ts` switches its import to the new model (BD) and `panels.json` matches; BE then deletes the per-kind views and the panel e2e specs pass unchanged.

12. **Announcements, tier wording and display names from descriptors.** Each tier rule carries its wording: `t1.label` / `t2.label` (`"attachments"` / `"functional group"` for muscles, `"related structures"` / `"joint"` for ligaments and cartilage, the bones' current phrases), and the tier buttons' text and titles ("Show attachments", "Show the bones it articulates with", …). `announce.ts` builds every message from `noun`, layer order and these labels; the antagonist counts from the `ant` rule; the part → muscle count fallback from `parentOf`. `names.ts`' "teeth have no side" becomes `KindDescriptor.sideInName: false`. Label priority already comes from `labelPriority` (M11 AU) plus on-screen size; BG only removes the last literal. **Acceptance:** `tests/announce.test.ts` and `tests/e2e/announce.spec.ts` unchanged and passing.

13. **Validation and compile rules per kind** (the last of the allowlist). Each kind's content half (`src/systems/.../content.ts`) gains its cross-file checks (`softValidate.ts`' `d.kind === "muscle"` rules, the muscle-hierarchy rules, the bone validator's per-kind checks) as `validate(entry, ctx)` functions, and its edge extractor (`edges(fm, id)`, used by AZ's compiler). `softCompile.ts`' `layer === "muscles"` → derive becomes "the layers whose content half declares derived edges". `schema.ts` and `validate.ts` (the bone validator) move into the bones' content half. **Acceptance:** `npm run validate-content` prints the same lines for the real content (diffed in the notes) and every existing rule's unit test still fails on its bad example.

14. **The fixture layer in M12** (completes M11 decision 8 for the graph, panel and tree). The demo system gains two edge types in its own folder (`meshes_with`, symmetric; `drives`, with inverse "driven by"), front matter for its 12 widgets with those relations, tier rules, a three-section panel (a `text`, a `links`, a `grouped-links`) and a `byKind` tree. **Vitest** (with the test registry): the compiler accepts its edges and rejects a bad endpoint and an unregistered type; tiers follow its rules; the panel model gives its sections; the tree builder gives its root. **Playwright** (`tests/e2e/fixture.spec.ts` + 1 test): select a widget, its panel shows the links, tier 1 isolates what its rule says. "Without touching any other file" is proven by the test registry being the only difference, as in M11. Region chunking stays M13's, search M14's.

---

## Step 1 (AZ): tree golden, graph core

- First commit, before any change under `src/` or `scripts/`: `tests/golden/tree.json` (decision 9), produced by `npm run golden -- --write` for the new file only.
- `src/graph/{types,edgeTypes,compile}.ts`; `src/systems/musculoskeletal/edges.ts`; `SystemDescriptor.edgeTypes`; each kind's edge extractor in its content half; the system's edge sources (`articulations.json`, `regions.json`, `joints.json`); the derived edges (decision 4, `adjacent_tooth`, `shares_joint_with`).
- Compiler checks (spec §10) with unit tests on bad inputs; `validate-content` runs the compiler over the real content and prints the edge counts per type.
- The acceptance comparison of decision 4, then `src/content/derive.ts` deleted (its callers read the derived edges); `derive.ts` leaves the allowlist.
- The isolation test scans edge type IDs and inverse labels too (decision 1).

## Step 2 (BA): query engine and tier rules

- `src/graph/graph.ts` (runtime index) and `src/graph/query.ts` (decision 5); `TierRule` on every `KindDescriptor` (decision 6).
- `tests/graphTiers.test.ts`: the engine over the graph compiled from disk gives `tiers.json` **exactly** for every ID: `t1`, `t2` with all layers On, `bonesOnly`, `ant`. The app still runs on the old code until BC (one session of overlap, so BC is a switch, not a rewrite; spec §13's "no long-lived parallel implementations" holds because BC deletes the old code).
- Engine unit tests: every step type, `from` modes, the three orders, parts expansion, the Off-layer filter, memoisation invalidated by a new chunk.

## Step 3 (BB): the always-loaded ID index

Decision 7. `virtual:skeleton-index` (plugin from the registry's ID files and the joint nodes), `src/content/index.ts` lookups; `softRegistry.ts` reads the index; `softTable.ts`, `loadSoftIds.ts`, `registerSoftIds`, `virtual:skeleton-soft-ids` deleted; the fixture build's ID file joins the index through the same plugin. Main chunk measured (budget in decision 7).

## Step 4 (BC): ship the graph, switch tiers and roles

Decisions 3 and 8. The content plugin emits each layer's edges (forward + reverse) into its content chunk and the eager layer's into the main chunk; `softContentLoader.ts` registers them with the graph; `relatedAt` asks `query.ts`; `hasSoftTier2`, `softTiersLoaded` and `tierBlockedReason` read the graph; `withTints` reads roles from it. **Deleted:** `src/content/relations.ts` (`adjacentTeeth` moves to the bones' folder as the `adjacent_tooth` rule), `softTiers.ts`, `softRelations.ts`, `softRoles.ts`; the chunks' `tiers`, `reverse` and `roles` fields. Harness imports updated, snapshots untouched. Content chunk sizes before and after in the notes. e2e: `tiers`, `tints`, `related`, `attached`, `joints`, `nested`, `labels-layers`.

## Step 5 (BD): panel sections as data

Decision 11. `PanelSection` types in `src/systems/types.ts`; `panel` on every kind; `src/panel/model.ts` (sections + chrome); the `attachments` custom section's model. The harness reads the new model; `panels.json` unchanged. `panel.ts`, `placeholder.ts` and `softPanel.ts` keep only what `InfoPanel.tsx` still imports until BE (listed in the notes), with no kind switches left.

## Step 6 (BE): InfoPanel renders from descriptors

`InfoPanel.tsx`: one `Sections` component mapping `render` → `TextSection`, `ListSection`, `LinksSection`, `GroupedLinksSection`, `ActionsTable`, and the `custom` map (`attachments` only). `Body`, `SoftBody`, `MuscleSectionsView`, `JoinSectionsView` deleted; test IDs kept (the e2e specs select by them). The leftovers of BD's three files deleted. e2e: `panel`, `soft-content`, `attached`, `nested`, `a11y`, `all-objects` (the 3-minute phone run).

## Step 7 (BF): tree builders

Decision 10. `TreeSpec` per layer, `src/tree/` builders, `soft-tree-data.ts` reduced to running them; `SOFT_ROOTS`, `CARTILAGE_KINDS`, `looksLikeSoftGroup`'s literal pattern (from the registry's tree roots), `groupLayer`'s and the tooth-type groups' literals gone. Tree golden unchanged. e2e: `sidebar`, `soft-sidebar`, `keyboard` (the tree part).

## Step 8 (BG): announcements and names

Decision 12. e2e: `announce`, `labels-layers`, `tiers`.

## Step 9 (BH): validation and compile per kind

Decision 13. Output of `validate-content`, `content:patch-check`, `content:migrate-attachments --check` and `npm run content` diffed before and after.

## Step 10 (BI): fixture and allowlist

Decision 14. The allowlist ends with M14 (1) and M15 (6) entries only.

## Step 11 (BJ): wrap-up

- Goldens: unchanged, or every difference listed here with the user's approval.
- Parity table against M11 (`a2709f6`), built side by side from the same `node_modules`: triangles, draw calls, `?bench` FPS and label layout times, `perf-load` (skeleton, full detail, muscles), main chunk, each content chunk.
- Full e2e in the background with a log file (`docs/WORKFLOW_NEW.md` §3), then a grep for failures.
- Docs: `CLAUDE.md`'s key-file table (`src/graph/`, `src/panel/`, `src/tree/`, the index, the edge types); `STATUS.md` §4 ("How relationships work") rewritten for the graph.
- `/m12/`: PR to `main`, merge, Deploy run, then freeze `m12` in `deploy/pages.json` at the merge commit (`current` to 13 at the start of M13, `CLAUDE.md`, milestone handover).

## Session notes

### AZ (design, 2026-11-25)

- **Tree golden first** (`5dc9ec8`, before any `src/`/`scripts/` change): `buildTree` in `tests/golden/harness.ts`, 2,944 keys: `rows:initial` (before the soft tree loads), `row:<key>` for every row with everything open, `rows:order`, `group:<key>` for every bone group, tooth type, soft node, synonym set and every bone's `attached:` group (label, name, trail, parent, layer, members, counts, both announcements, ancestors), `ancestors:<id>` for all 1,138 IDs. No row key repeats.
- **Built:** `src/graph/{types,edgeTypes,compile}.ts` (generic; checks: type registered, a file can't write a derived type, both ends known, no self edge, symmetric stored once as `from < to`, exact duplicates dropped keeping written order); `src/systems/musculoskeletal/edges.ts` (13 types) on `SystemDescriptor.edgeTypes` → registry `EDGE_TYPES`; extractors `KindContent.edges` (muscle, part, ligament, the three cartilage kinds); `LayerContent.rules` (bones: `adjacent_tooth`; muscles: inherited attachments with meta `inherited: "true"`, then `synergist_of`/`antagonist_of`) and `LayerContent.derivedLists` (the content chunk's `derived`, read off the edges); a system content half `src/systems/musculoskeletal/content.ts` (`SystemContent`: joint nodes `node: "joint"` from `articulations.json` + `joints.json`, sources `articulates_with` meta `joint`, `region_neighbour` as written, `member_of_joint` pair → functional; rule `shares_joint_with` with `jointScopes`, today's `jointScope` over edges). `compileContentGraph` (registry.content) runs it all; `compileGraphFromDisk` reads the disk.
- **Real content:** 17,640 edges, 0 errors, 404 joint nodes (articulates_with 357, member_of_joint 596, part_of 146, originates_on 1,171, inserts_on 987, connects 1,083, attached_to 118, acts_on 726, region_neighbour 4,611, synergist_of 3,508, antagonist_of 2,768, adjacent_tooth 60, shares_joint_with 1,509). `validate-content` prints this line.
- **Acceptance (decision 4), run before `derive.ts` was deleted:** for all 537 muscles and parts, `derivedLists` over the graph equals the M11 compiler's `derived.synergists`, `.antagonists` and `.attached` (same keys, same order); every ligament's and cartilage's same-joint set minus tier 1 equals today's tier 2 (`null` where today's is); every tooth's `adjacent_tooth` list equals `adjacentTeeth`. Then `derive.ts` deleted; `softCompile.ts` reads `derived` from the graph for the layers whose content half has `derivedLists` (no `layer === …` test left there for derivation). The temporary comparison tests were removed; `tests/graph.test.ts` keeps the rule's fixture tests (moved from `softContent.test.ts`, same expectations plus a pair-vs-pair case) and fixed-ID checks on the real graph.
- **Amendment to decisions 2 and 4 (no golden change; spec §4.2's table differs):** `synergist_of` and `antagonist_of` are **directed**, not symmetric: the M8 rule isn't symmetric (a part matching only through its muscle's actions lists the other muscle, which lists the muscle instead): 508 and 572 one-way pairs. Storing them symmetric would change `tiers.json` and `panels.json`. `adjacent_tooth` is also **directed**, written both ways in the rule's order (mesial neighbour first), because that is the panel's "Neighbouring teeth" order (`tooth_11`: 21, 12), which a symmetric edge stored as `from < to` can't keep. BA's "anatomical" order still sorts it for tier 1.
- **Tests changed (spec §2.1):** `tests/softContent.test.ts` lost its `derive` describe (moved to `graph.test.ts`) and builds its fixture's `SoftCompileDeps.graph` with `compileContentGraph` (`antagonistPairs` left the deps). `tests/registryIsolation.test.ts` also scans for the edge types' IDs and inverse labels: no hits outside `src/systems/**` beyond allowlisted files. `src/content/derive.ts` left the allowlist (16 M12 entries remain).
- **For BA:** part order. `part_of` edges are extracted from a muscle's `parts` before its parts' own `parent` (kinds in descriptor order), so per muscle they keep the `parts` list order. Edge order is the written order everywhere; regions are as written.
- **Main chunk:** 472.7 kB `gzip -9` (index 298.6 + meshoptimizer 167.6 + registry 2.9 + names 2.7 + softRegistry 0.5 + runtime 0.5), +0.4 kB over AY (the edge type descriptors in the registry chunk).
- `npm run check`: pass (618 tests, the five goldens unchanged).

### BA (design, 2026-11-25)

- **Built:** `src/graph/graph.ts` (runtime index: `createGraph(types)`, `add(chunk, edges)` idempotent per chunk with edges deduplicated across chunks, forward and inverse adjacency per type built at registration, a symmetric edge read from either end, `neighbours(id, name)` by type ID or inverse label in written order, `has`, `version`, `subscribe`) and `src/graph/query.ts` (`tierEngine(ctx)`: `evaluate`, `related(id, tier, modes)` with the Off-layer filter after evaluation, `hasTier`; memoised per graph version). `TierStep`, `TierRule`, `TierOrder`, `TierFrom`, `KindTiers` in `src/graph/types.ts`. Both name no system, layer, kind or edge type.
- **Rules as data:** `KindDescriptor.tiers` on all eight kinds (bones' `layer.ts` for bone and tooth, muscles' for muscle and part, `src/systems/musculoskeletal/jointTiers.ts` shared by the ligament and the three cartilage kinds). `parentOf.via` (`{ type: "part_of", except: "also" }`) says where a structure's parts come from: an `alsoServes` part is a `part_of` edge with meta `also` and isn't one of the muscle's parts (the iliotibial tract is TFL's part, not gluteus maximus's). Registry: `tierContext(graph, { kindOf, rank })` (rules, parts and layer from the descriptors) and `indexRank(entries)`.
- **Acceptance:** `tests/graphTiers.test.ts`, the engine over `compileGraphFromDisk()` gives `tiers.json` **exactly** for all 1,138 IDs: t1 and t2 all On, `bonesOnly` for the 238 bones and teeth, `ant` for every muscle and part (and no other kind has one). A structure without a tier 2 shows its tier 1 there, as `relatedAt` does (`hasTier` says which: only ligaments and cartilage without `member_of_joint`).
- **Amendment to decision 5 (asked and approved by the user in this session, no golden change):** today's orders needed three ordering rules and four step options beyond the plan's:
  - **Source by source:** a step's `order` sorts each source's targets, sources in `from` order. A bone's tier 2 lists the soft structures of the bone itself, then of each partner and region bone in turn (232 of 238 bones differ from one merged sort).
  - **A rule's own `order`:** sorts everything the rule adds after its `tier` steps. Muscles, ligaments and cartilage use `order: "id"` (t1 fully ID-sorted; t2 = t1, then the rest ID-sorted, as `buildSoftTiers`' `finish`).
  - **`anatomical` = the ID index's order:** the eager layer as `ids.json` lists it, then each other layer in registry order (cartilage, ligaments, muscles), IDs sorted. That is today's bone tier-1 soft order (the reverse lists concatenated in the golden's registration order, which is registry order). **For BB:** build the index in this order, or keep `indexRank`.
  - `from: "result"` (the structure plus everything earlier steps gave: a bone's tier 2 asks the soft structures naming each partner and region bone); `exclude` (the antagonists minus the synergists, with their parts); `parts: "instead"` (the `ant` list holds a muscle's parts, not the muscle, as `softRoles`' `expand`); `requires` (no tier 2 without `member_of_joint`).
- **The rules:** bone/tooth `t1` = `articulates_with` + `adjacent_tooth` (anatomical), then `has attached`, `connected by`, `origin of`, `insertion of` (anatomical); `t2` = the partners, `region_neighbour` (written), then the same inverses `from: "result"`. Muscle/part `t1` = `self` + `originates_on`/`inserts_on` from `self+parts`; `t2` = `t1` + `synergist_of` + their attachments `from: "previous"`; `ant` = `antagonist_of` excluding `synergist_of`. The spec's `{ follow: "has part" }` is left out: it would also follow `alsoServes`; `self` expands to the parts.
- **Engine unit tests** (`tests/graphQuery.test.ts`, 15): symmetric/inverse reads, chunk idempotence, listeners; every step type, the four `from` modes, the three orders, source-by-source order, a rule's own sort after its included tier, parts with/instead (and `also` skipped), `exclude`, `filter` by kind and layer, `requires`, a self-including tier refused, Off and Ghost layers, memo invalidated by a new chunk.
- **Main chunk:** registry chunk 2.9 → 3.2 kB (`gzip -9`, the tier rules); index unchanged; about 473.0 kB in all. The app doesn't import the engine yet.
- `npm run check`: pass (638 tests, the five goldens unchanged).

### BB (design, 2026-11-25)

- **Built:** `scripts/lib/index-plugin.ts` (was `soft-ids-plugin.ts`): `virtual:skeleton-index` = the eager layer's ID, every lazy layer's entries from the `idsFile` its content half names (trimmed by `trimSoftIds`, depth resolved from `DEPTH_FILE`, file order kept), and every system content half's `nodes` (the 404 joints, `node: "joint"`, named). `readIndexData(reg)` takes the registry option, so the fixture build's `widgets` IDs join through the same plugin. `src/content/index.ts` holds the lookups (`isKnownId`, `hasMesh`, `layerOfId`, `lazyEntry`, `lazyEntries`, `lazyLayerOf`, `isEagerId`, `indexNode`); bones come from `content/ids.json` (already in the main chunk). `src/content/indexData.ts` decodes the virtual module and hands it over (`setIndex`); `src/main.tsx` imports it first, and so does Vitest's new setup file `tests/setup.ts`. `softRegistry.ts` reads the index; `selection.ts` re-exports `isKnownId`/`hasMesh`/`layerOfId` from it. Deleted: `src/layers/softTable.ts`, `src/content/loadSoftIds.ts`, `registerSoftIds`, `resetSoftIds`, `softTableLoaded`, `virtual:skeleton-soft-ids`; `LayerScenes` reads `lazyEntry`.
- **Why a hand-over and not a direct import:** `names.ts` → `softRegistry.ts` is imported by the build scripts (`tsx`) and the Vite plugins (`search-data.ts` via `vite.config.ts`), which can't resolve a virtual module. So `index.ts` imports nothing virtual (nor the registry at run time: the eager layer's ID comes with the data, because the setup file loads it before `fixture.test.ts` mocks the registry's list); in scripts the lazy layers stay unknown, as before.
- **Wire format (`src/content/indexCodec.ts`):** positional rows; a right-side entry or joint node that is the exact mirror of its earlier left one (`_left` → `_right` in ID, parent, parts) is a reference (or its left row's flag when adjacent); parents are rebuilt from the parts lists (the encoder refuses data where they disagree). Lossless by construction; round trip tested on the real and fixture data. 14.7 kB gzip as plain JSON → 9.5 kB packed (430 of 432 right entries and all 165 right joint nodes referenced; the two wrist collateral ligaments list their right side first and stay rows).
- **Main chunk:** 483.1 kB `gzip -9` (index 308.7 + meshoptimizer 167.6 + registry 3.2 + names 3.1 + runtime 0.5), **+10.1 kB** over BA's 473.0, inside decision 7's 12 kB budget, so `depth` and `partType` stay in the index (dropping them would have saved only 0.4 kB; the packed format did the work). The lazy `LayerScenes` path loses the 11 kB table chunk. Still under M12's 500.1 kB ceiling; `perf-load` re-measured in BJ.
- **Behaviour:** a soft `sel=` still goes through `selectSoftFromUrl` (it turns the layer on and waits for it): `initSelectionFromUrl` parses `sel` with `isEagerId`, so `urls.json` is unchanged. `selectLink` / `selectAndFrame` no longer wait for a table. The Announcer's depth count no longer checks for a loaded table.
- **Tests changed (spec §2.1):** the seven unit tests that registered `trimSoftIds(soft-ids.json)` themselves (`announce`, `muscleDepth`, `nestedSelection`, `sceneView`, `softPanel`, `softRoles`, `softTiers`) now rely on the setup file; same expectations. The golden harness changed imports only: no `loadSoftIds`, and `freshModules()` re-imports `indexData` after each `vi.resetModules` (as the app's entry would). New `tests/idIndex.test.ts` (7). `perf-load.ts` no longer looks for a `softTable` chunk.
- **For BC:** `indexRank` still takes entries; the index's eager-then-lazy order is `[...ids.json, ...lazyEntries()]`, file order (not ID-sorted), so keep `indexRank` for `anatomical`. Joint names for links: `indexNode(id)?.name`.
- E2E: `nested`, `layers`, `select`, `tiers`, `fixture`: running at commit time; result in the follow-up commit.
- `npm run check`: pass (645 tests, the five goldens unchanged).

| Approved golden difference | File | Why |
| --- | --- | --- |
| none yet | | |
