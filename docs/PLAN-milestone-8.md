# Milestone 8 Plan: Data model and content (Musculoskeletal spec, M8)

Source of truth: `SPEC-musculoskeletal.md` §4 (content model), §4.6 (bone content changes), §10 (validation) and §11 (M8). Where that spec is silent, `SPEC (2).md` §5 and §12 still apply (front matter + Markdown, zod, 40 to 80 word summaries, mirroring, `reviewed: false`, no invented TA2 IDs, landmarks or articulations). Ground rules throughout: no mesh is touched (`git diff public/models/` stays empty); anything uncertain goes in `content/QUESTIONS.md`; **with every new layer off, the app loads, looks and performs as M7 does** (spec §13).

## Goal

Write the content behind the soft-tissue layers: schemas for the four new kinds, the closed movement vocabulary, the functional joint list, the muscle hierarchy, and a drafted content file for every muscle, part, ligament and cartilage structure (left and midline written by hand, right mirrored), all `reviewed: false`. Replace the bones' free-text `muscleAttachments` with data derived from the muscles' origins and insertions, after a migration that accounts for every old string. `validate-content` enforces every spec §10 rule, and Vitest covers the derived synergists, antagonists and bone attachments. The app shows the new text in the existing placeholder panel (name, Latin, "Part of …", summary); the kind-specific panel sections, tiers, cross-links, sidebar and search are M9's. The milestone ends with a hosted copy at `/m8/`.

Out of scope here: nested muscle → part selection, tiers 1 and 2 for the new kinds, origin/insertion highlighting, the bone → muscle links and "Show attached muscles", the kind-specific panel sections, sidebar roots, search and group synonyms (all M9); labels, legend chips, announcements and the performance pass for the new kinds (M10). No Blender work.

## Size of the job (from `content/soft-ids.json`)

| Layer | Kind | Left + midline (hand-written) | Right (mirrored) |
| --- | --- | --- | --- |
| Muscles | muscle | 205 (30 of them have no mesh of their own: their parts carry it) | 203 |
| Muscles | muscle_part | 65 (head 58, portion 40, belly 16, tendon 10, aponeurosis 5, both sides) | 64 |
| Ligaments | ligament | 155 | 147 |
| Cartilage | cartilage, disc, meniscus | 43 (12 + 25 + 6) | 18 |
| | **Total** | **468** | **432** |

Plus the migration: **200 distinct `muscleAttachments` strings** across the 238 bone files (136 hand-written).

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| (planning) | 0 (Milestone 7 handover, this plan) | **Done.** See step 0 |
| X | 1 (schemas and vocabulary files), 2 (compiler, mirror, derived data, panel text), 3 (migration table) | Not started |
| Y | 4 (muscles: head and neck, about 84 files) | Not started |
| Z | 5 (muscles: back, thorax, abdomen and pelvis, about 66 files) | Not started |
| AA | 6 (muscles: upper limb, about 62 files) | Not started |
| AB | 7 (muscles: lower limb, about 67 files) | Not started |
| AC | 8 (ligaments, 155 files; cartilage, discs and menisci, 43 files) | Not started |
| AD | 9 (migration finished, `muscleAttachments` removed, strict validation), 10 (tests and no-regression), 11 (hosted copy) | Not started |

Triggers: "begin session X" to "begin session AD". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models`, `npm run validate-content` (with `--allow-missing-soft` until session AD, decision 10) and `npm run e2e` passing, then a commit, a push to the session branch and a PR to `main`. Content sessions (Y to AC) run the e2e smoke and panel specs only, plus the full suite if they touched `src/`.

**User checkpoints**
- **Decision 2 (functional joints)** is the one real departure from the spec's wording. Say before session X if you would rather keep the spec's literal rule (pair joints only). The alternative is spelled out under the decision.
- **After session X**: the migration table (step 3) lists every old string with its match. Strings that match nothing are in `QUESTIONS.md`; the user can answer them any time before session AD.
- **Content review** is the user's, as for bones (spec §13 of `SPEC (2).md`): everything ships `reviewed: false`.

## Exit criteria (from the musculoskeletal spec §11, M8)

- [ ] Schemas, `movements.json`, `muscle-hierarchy.json`, `muscle-depth.json` (the depth file already exists from M7; its validation stays).
- [ ] All muscle, part, ligament and cartilage content drafted (left and midline written; right mirrored), `reviewed: false`.
- [ ] `muscleAttachments` migration done and the field removed.
- [ ] `validate-content` passes (strict: no `--allow-missing-soft`); derived synergist/antagonist tests pass.
- [ ] Uncertain choices added to `QUESTIONS.md` under new headings per layer.
- [ ] No regression: with every new layer off, the main chunk grows by at most 5 kB gzipped over M7, no soft-tissue content chunk is requested, and the full e2e suite passes.
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Milestone 7 handover (done in the planning session)

- `deploy/pages.json`: `m7` frozen at **`3af6d5a`**, the merge of #18 (M7's last PR: the user's bench records). `current` set to **8**, so the next deploy builds `/m8/` from `main`.
- `/m7/` was confirmed live before #18 (`docs/PLAN-milestone-7.md`, step 11). `README.md`: M7 row marked frozen, M8 row added as "In progress".
- `CLAUDE.md`: status and the M8 session triggers.
- **Still open, carried over (needs the user, any time):** the per-browser `?bench` table in `docs/PLAN-milestone-5.md` step 12; the muscles layer's real-device load time from M7 (`?debug`, "low shown N s after turned on"); the content questions in `content/QUESTIONS.md` (1–69).

## Decisions made in this plan (say if any should change)

These fill gaps the spec leaves open. Each is the smallest choice that fits the spec; the sessions build them as written unless the user says otherwise.

1. **File layout** (spec §4): `content/muscles/<id>.md` (muscles and parts), `content/ligaments/<id>.md`, `content/cartilage/<id>.md` (cartilage, discs, menisci), `content/movements.json`, `content/joints.json` (decision 2), `content/muscle-hierarchy.json`. IDs, `name`, `side`, `kind`, `parent` and `parts` must equal `content/soft-ids.json` (generated, not edited); `latin` comes from the content file (the source has Latin for only some objects).
2. **Functional joints (`content/joints.json`).** The spec says an action's `joint` is "a joint ID from `articulations.json`", but that file holds one entry per **bone pair**: there is no `elbow_joint_left` (it is `humero_ulnar_joint_left` + `humeroradial_joint_left`), the wrist and ankle are split by bone, and the vertebral column is 24 separate pairs. Writing "triceps extends the elbow" against pairs would mean two or three action rows per movement and would make synergists depend on which pairs an author happened to list. So a small new file lists **functional joints, each a named set of existing articulation `joint` IDs** (nothing new is articulated, so ground rule §12 holds):
   `{ "id": "elbow_joint_left", "name": "Elbow joint", "articulations": ["humero_ulnar_joint_left", "humeroradial_joint_left"] }`.
   Expected entries (left, right and midline): elbow, wrist (radiocarpal pairs + the intercarpal pairs of the midcarpal joint), ankle (talocrural tibia + fibula), foot inversion/eversion (subtalar + talonavicular + calcaneocuboid), shoulder girdle (sternoclavicular + acromioclavicular, for scapular elevation, protraction and rotation), cervical, thoracic and lumbar spine (their intervertebral pairs), the craniovertebral joints (atlanto-occipital + atlanto-axial), and the digit sets where one muscle crosses all of them (MCP 2–5, PIP 2–5, DIP 2–5 and the toe equivalents). An action's `joint` may be **either** a pair `joint` ID from `articulations.json` **or** a functional joint ID; validation accepts both. Synergists and antagonists match on the functional joint: a pair inside a functional joint counts as that joint (so "radial collateral ligament → humeroradial" and "biceps → elbow" still meet). Ligament and cartilage `joint` fields take the same IDs. Every entry gets a line in `QUESTIONS.md` under **Joints**. *Alternative if the user prefers the spec's literal rule:* pair IDs only, one action row per pair, and synergists match on pairs.
3. **`joint: null` for ligaments that sit at no joint.** The spec's ligament schema requires `joint`, but the source has ligaments and membranes that bridge bones without crossing a joint: inguinal ligament, both interosseous membranes, the obturator membrane, sacrospinous and sacrotuberous ligaments, the transverse scapular and coraco-acromial ligaments, stylohyoid, pterygospinous and sphenomandibular ligaments, the nuchal ligament and the intercostal membranes. Those take `joint: null` and must have `connects` (at least one structure) and `functions`. Costal cartilages 8–10 (no interchondral joints in `articulations.json`) take `joint: null` as the spec allows for costal cartilage. Each `null` is checked against a list in the validator, so a forgotten joint still fails.
4. **Schemas** (zod, `src/content/schema.ts`): `muscleSchema`, `musclePartSchema`, `ligamentSchema`, `cartilageSchema` exactly as spec §4.1 to §4.5, plus: `region` and `compartment` are snake keys that must exist in `muscle-hierarchy.json`; `functions: string[]` is optional for muscles and required when `actions` is empty (spec §4.3); `synergistOverrides` is allowed but each use needs a `QUESTIONS.md` number in a YAML comment; `insertion: inherit` (and `origin: inherit`) are allowed only on parts. `ta2` is **not** added to the new kinds in M8 (no checked source for it; same rule as bones).
5. **Body lengths.** Muscles 40–80 words (spec §4.1), parts 20–60 (spec §4.2). The spec gives no length for ligaments and cartilage: **20–60 words** for both (most are small structures; the major ones, such as the cruciates, menisci and discs, can still use the full 60).
6. **Attachments.** `structure` is any ID in `ids.json` or `soft-ids.json` (a bone, a cartilage, a ligament such as the patellar ligament, or another muscle's part such as an aponeurosis); `landmark` must exist in that bone's `landmarks` list. Where a muscle needs a landmark a bone file lacks, the session **adds the landmark (name only, `position: null`)** to the left or midline bone file, and `content:mirror` writes the right. Everything without an object (fascia lata, skin, linea alba where it isn't the mesh, a tendon sheath) is `{ soft: "…" }`. Muscles whose parts each declare an origin use `origin: []` on the muscle (spec §4.1); the "muscle has an origin and an insertion" rule looks at the muscle and its parts together.
7. **Actions.** `movement` from `content/movements.json`, which is the spec's list as written. A session that finds a movement it can't express (for example wrist radial and ulnar deviation, which the spec's list writes as abduction and adduction) uses the nearest listed term and adds a `QUESTIONS.md` entry; nothing is added to the vocabulary without the user. Facial, laryngeal, pharyngeal, palatal, tongue, extra-ocular and pelvic-floor muscles use `actions: []` and `functions` (spec §4.3), except the extra-ocular muscles if the user later wants the eye as a joint (not in `articulations.json`; question added).
8. **Muscle hierarchy** (`content/muscle-hierarchy.json`): the same shape as `hierarchy.json` (`{ key, label, children }`), **region → compartment → muscle**; parts are not listed (they come from `parts`, spec §5.1). Regions: head, neck, back, thorax, abdomen, pelvis and perineum, upper limb, lower limb. Compartments start from the source's groups in `soft-ids.json` (`group`, e.g. `anterior_compartment_arm`, `rotator_cuff`, `suboccipital`), renamed to readable labels; each muscle appears exactly once and its file's `region`/`compartment` must match its place in the tree. Midline and left muscles are listed; the right side is implied, as in `hierarchy.json`. Where the source's grouping differs from the usual textbook one, the textbook one wins and a question is added. Sessions Y to AB each fill in their region; session X writes the skeleton and the validator rule.
9. **Derived data** (spec §4.3, §4.6), pure functions in `src/content/derive.ts`, used by M9's panel and tiers:
   - `synergistsOf(id)`: other muscles or parts with a prime/assist action on the same functional joint (decision 2) and the same movement as one of X's prime/assist actions; a part's actions are its own plus its parent's. A muscle and its own parts are never each other's synergists. `synergistOverrides` applied last.
   - `antagonistsOf(id)`: actions on the same joint with the paired movement (`antagonistPairs`).
   - `attachedMuscles(boneId)`: `{ origins: string[], insertions: string[] }`, from every muscle and part's `origin` and resolved `insertion`. Parts are listed by their own ID; M9 decides how the panel groups them.
   These are compiled into the lazy soft-tissue content chunk (decision 11), not computed in the main chunk.
10. **Validation while content is incomplete.** `validate-content` gains every spec §10 rule in session X. A new flag, `--allow-missing-soft` (the M4 `--allow-missing-content` pattern), turns only "a mesh node or `soft-ids.json` entry has no content file" and "a muscle has no origin/insertion" into warnings with counts; **every file that exists is fully validated**. `npm run check`, `prebuild` and CI use the flag until session AD removes it. The muscle-depth rule from M7 stays as it is.
11. **Compiling and showing the text.** The compiler (`src/content/compile.ts`) handles the new folders. The output is **one lazy chunk per layer** (`virtual:skeleton-soft-content-muscles`, `-ligaments`, `-cartilage`), loaded with the layer's chunk, never with the bones off (spec §9: main chunk ≤ +150 kB over the whole programme, and M8's share is small). The placeholder panel from M7 (`src/content/softPanel.ts`) shows, when a file exists: name, Latin in italics, "Part of *Parent*" for parts, and the summary; it keeps "Not written yet" otherwise. The kind-specific sections (origin, insertion, actions, synergists, …) are M9's (spec §7).
12. **Mirroring.** `content:mirror` extends to the three new folders with the same rules (swap `_left`/`_right` in every ID-valued field, including `structure`, `joint`, `connects`, `attachedTo`, `parent`, `parts` and `alsoServes`; `side: right`). `validate-content` fails on drift, as for bones.
13. **The `muscleAttachments` migration** (spec §4.6):
    - Session X writes `scripts/content/migrate-attachments.ts` and its output `content/attachment-migration.json`: every distinct string → the muscle or part IDs (side-free) it means, with a match rule (exact name, known variant such as "Iliopsoas" → `psoas_major` + `iliacus`, "Biceps femoris (short head)" → the part, or a muscle absent from the source → `unmatched`). The table is reviewed once by eye; `unmatched` strings go to `QUESTIONS.md` under **Muscles: attachment migration**.
    - Session AD then checks **both directions**: every matched string's muscle really has that bone in its derived origins or insertions (catches content errors and bad matches), and every unmatched string has an answered question. Only then is `muscleAttachments` removed from the 136 hand-written bone files (mirror rewrites the other 102), from `frontMatterSchema`, from `compile.ts`, and the bone panel's "Muscle attachments" list becomes the derived one, shown as plain text (links are M9's). The spec §10 rule "any bone still has a `muscleAttachments` field" is added.
14. **Writing standards** (as for bones): English names follow TA2 English or the common British form; `latin` is the TA2 Latin form; `commonName` only where a lay name is in real use ("Calf muscle" for gastrocnemius, "ACL"); innervation as nerve plus root levels in the usual textbook ranges; origins, insertions, innervation and actions from standard references (Gray's Anatomy, Moore's Clinically Oriented Anatomy, TA2), consistent across both sides; clinical notes only where there is a well-known, specific one, otherwise `null`. Every judgement call that is genuinely contested (variable innervation, disputed actions, attachment variants) gets a `QUESTIONS.md` entry, numbered from 70.
15. **Performance and size.** Main chunk ≤ +5 kB gzipped over M7 (only `softPanel.ts` grows; the schemas stay in the scripts and tests, as M7 kept zod out of the main chunk). The three content chunks are reported by `npm run content` with their gzipped sizes and recorded in session AD. Turning the muscles layer on fetches the content chunk in parallel with the low LOD file, so the layer's load time (spec §9: ≤ 3 s desktop, ≤ 5 s phone) is unchanged; session AD reruns `npm run perf-load`.

## Risks found while planning

1. **Volume and accuracy.** 468 hand-written files is about twice M4's bone content. Mitigation: one region per session, a fixed field order, validation on every file as it lands, and the migration's two-way check catching origin/insertion slips against the bones' existing lists.
2. **Source grouping vs anatomy.** Some source objects are odd units (e.g. `hypaxial_back`, `fasciae_upper_limb`, muscles split into "portions" the textbooks don't name). The content follows the object as it is (spec: no re-mapping in M8) and describes it plainly; each oddity is a question.
3. **Joint vocabulary.** If the user rejects decision 2, sessions Y to AB write more action rows, and the derived-data tests change; decided before session X, it costs nothing.
4. **Landmark growth in bone files.** Adding landmark names changes bone files the user may already have reviewed. Only `landmarks` lists change, never `reviewed`, and each session lists the added landmarks in its notes.

## Session X: model, tooling and migration table (steps 1 to 3)

## Step 1: Schemas and vocabulary files (decisions 1 to 8)
- zod schemas for the four kinds; `content/movements.json` (spec §4.3); `content/joints.json` (decision 2) with its own schema and the rule that every member is an existing articulation; `content/muscle-hierarchy.json` skeleton (regions and compartments, no muscles yet).
- `validate-content`: every spec §10 rule, plus decisions 3, 5, 6 and 8, with the `--allow-missing-soft` flag (decision 10). Unit tests in `tests/softContent.test.ts` on small fixtures for each rule (one passing and one failing case per rule).
- Three seed files written in full as worked examples and test fixtures for the real tree: `triceps_brachii_left` with its three heads, `anterior_cruciate_ligament_left` and `medial_meniscus_left` (the spec's own examples).

## Step 2: Compiler, mirror, derived data and panel text (decisions 9, 11, 12)
- `compile.ts` and the content plugin: the three per-layer virtual modules, loaded by the layer chunk; `npm run content` prints their sizes.
- `content:mirror` for the new folders; drift check.
- `src/content/derive.ts` with `synergistsOf`, `antagonistsOf`, `attachedMuscles`; Vitest on fixtures now, on real content from session AA (spec §10 examples: biceps synergists include brachialis; antagonists include triceps; `femur_left` origins include the vasti).
- `softPanel.ts`: Latin, "Part of …" and the summary when a file exists. e2e: select the triceps long head with muscles on and see its summary.

## Step 3: Migration table (decision 13)
- `scripts/content/migrate-attachments.ts` (`npm run content:migrate-attachments`) → `content/attachment-migration.json`; unmatched strings into `QUESTIONS.md`. The field stays in the bone files until session AD.

## Sessions Y to AB: muscle content (steps 4 to 7)

Each session writes its region's muscle and part files (left and midline), runs `content:mirror`, fills its branch of `muscle-hierarchy.json`, adds the landmarks its attachments need to the bone files, and adds questions under **Muscles: <region>**. Step 4 (session Y): head and neck — epicranius, facial, extra-ocular, masticatory, tongue, soft palate, pharyngeal, laryngeal, suprahyoid, infrahyoid, neck and suboccipital groups. Step 5 (session Z): back (splenius, erector spinae, transversospinalis, interspinales, levatores costarum, the source's "hypaxial back" group), thorax, abdomen, pelvic floor and perineum. Step 6 (session AA): upper limb — scapulohumeral and rotator cuff, arm, forearm, hand; the derived-data tests switch to real content here. Step 7 (session AB): lower limb — gluteal, iliopsoas, thigh, leg, foot; the `femur_left` test.

## Session AC: ligaments and cartilage (step 8)

All 155 ligament files and 43 cartilage, disc and meniscus files (left and midline), mirrored. Questions under **Ligaments** and **Cartilage**. The `joint: null` list (decision 3) is finalised.

## Session AD: finish, measure, ship (steps 9 to 11)

## Step 9: Migration finished and strict validation
- The two-way migration check (decision 13), then `muscleAttachments` removed from the bone files, schema and compiler; the bone panel shows the derived list as text. `--allow-missing-soft` removed from `check`, `prebuild` and CI; `validate-content` passes strictly.

## Step 10: Tests and no-regression
- Derived-data tests on real content (spec §10). Full e2e suite. Main chunk size against M7; content chunk sizes; `npm run perf-load` with the muscles layer, compared with M7's numbers.

## Step 11: Hosted copy
- Merge, deploy, confirm `/m8/`; README row and this plan updated.

## Hosted copy

Not yet deployed. When live: https://ajmarr04-ux.github.io/SkeletonViewer/m8/
