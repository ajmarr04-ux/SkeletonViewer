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
| X | 1 (schemas and vocabulary files), 2 (compiler, mirror, derived data, panel text), 3 (migration table) | **Done.** See "Session X notes" |
| Y | 4 (muscles: head and neck, about 84 files) | **Done.** See "Session Y notes" |
| Z | 5 (muscles: back, thorax, abdomen and pelvis, about 66 files) | **Done.** See "Session Z notes" |
| AA | 6 (muscles: upper limb, about 62 files) | **Done.** See "Session AA notes" |
| AB | 7 (muscles: lower limb, about 67 files) | **Done.** See "Session AB notes" |
| AC | 8 (ligaments, 155 files; cartilage, discs and menisci, 43 files) | Not started |
| AD | 9 (migration finished, `muscleAttachments` removed, strict validation), 10 (tests and no-regression), 11 (hosted copy) | Not started |

Triggers: "begin session X" to "begin session AD". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models`, `npm run validate-content` (with `--allow-missing-soft` until session AD, decision 10) and `npm run e2e` passing, then a commit, a push to the session branch and a PR to `main`. Content sessions (Y to AC) run the e2e smoke and panel specs only, plus the full suite if they touched `src/`.

**User checkpoints**
- **Decisions 2, 3 and 5: decided by the user on 2026-11-20.** Functional joints in `content/joints.json` (decision 2) and `joint: null` for ligaments at no joint (decision 3) as written; ligament and cartilage summaries 40–80 words, like muscles (decision 5).
- **After session X**: the migration table (step 3) lists every old string with its match. The six that match nothing are QUESTIONS 70; the user can answer them any time before session AD.
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
2. **Functional joints (`content/joints.json`).** *Decided by the user (2026-11-20): as written.* The spec says an action's `joint` is "a joint ID from `articulations.json`", but that file holds one entry per **bone pair**: there is no `elbow_joint_left` (it is `humero_ulnar_joint_left` + `humeroradial_joint_left`), the wrist and ankle are split by bone, and the vertebral column is 24 separate pairs. Writing "triceps extends the elbow" against pairs would mean two or three action rows per movement and would make synergists depend on which pairs an author happened to list. So a small new file lists **functional joints, each a named set of existing articulation `joint` IDs** (nothing new is articulated, so ground rule §12 holds):
   `{ "id": "elbow_joint_left", "name": "Elbow joint", "articulations": ["humero_ulnar_joint_left", "humeroradial_joint_left"] }`.
   Expected entries (left, right and midline): elbow, wrist (radiocarpal pairs + the intercarpal pairs of the midcarpal joint), ankle (talocrural tibia + fibula), foot inversion/eversion (subtalar + talonavicular + calcaneocuboid), shoulder girdle (sternoclavicular + acromioclavicular, for scapular elevation, protraction and rotation), cervical, thoracic and lumbar spine (their intervertebral pairs), the craniovertebral joints (atlanto-occipital + atlanto-axial), and the digit sets where one muscle crosses all of them (MCP 2–5, PIP 2–5, DIP 2–5 and the toe equivalents). An action's `joint` may be **either** a pair `joint` ID from `articulations.json` **or** a functional joint ID; validation accepts both. Synergists and antagonists match on the functional joint: a pair inside a functional joint counts as that joint (so "radial collateral ligament → humeroradial" and "biceps → elbow" still meet). Ligament and cartilage `joint` fields take the same IDs. Every entry gets a line in `QUESTIONS.md` under **Joints**. *Alternative if the user prefers the spec's literal rule:* pair IDs only, one action row per pair, and synergists match on pairs.
3. **`joint: null` for ligaments that sit at no joint.** *Decided by the user (2026-11-20): as written.* The spec's ligament schema requires `joint`, but the source has ligaments and membranes that bridge bones without crossing a joint: inguinal ligament, both interosseous membranes, the obturator membrane, sacrospinous and sacrotuberous ligaments, the transverse scapular and coraco-acromial ligaments, stylohyoid, pterygospinous and sphenomandibular ligaments, the nuchal ligament and the intercostal membranes. Those take `joint: null` and must have `connects` (at least one structure) and `functions`. Costal cartilages 8–10 (no interchondral joints in `articulations.json`) take `joint: null` as the spec allows for costal cartilage. Each `null` is checked against a list in the validator, so a forgotten joint still fails.
4. **Schemas** (zod, `src/content/schema.ts`): `muscleSchema`, `musclePartSchema`, `ligamentSchema`, `cartilageSchema` exactly as spec §4.1 to §4.5, plus: `region` and `compartment` are snake keys that must exist in `muscle-hierarchy.json`; `functions: string[]` is optional for muscles and required when `actions` is empty (spec §4.3); `synergistOverrides` is allowed but each use needs a `QUESTIONS.md` number in a YAML comment; `insertion: inherit` (and `origin: inherit`) are allowed only on parts. `ta2` is **not** added to the new kinds in M8 (no checked source for it; same rule as bones).
5. **Body lengths.** Muscles 40–80 words (spec §4.1), parts 20–60 (spec §4.2). The spec gives no length for ligaments and cartilage: **40–80 words, the same as muscles** (decided by the user on 2026-11-20).
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
3. **Joint vocabulary.** Settled (decision 2 accepted); the remaining risk is that individual functional-joint entries need correcting at review, which changes `joints.json` only.
4. **Landmark growth in bone files.** Adding landmark names changes bone files the user may already have reviewed. Only `landmarks` lists change, never `reviewed`, and each session lists the added landmarks in its notes.

## Session X notes (steps 1 to 3, done)

What was built, and where it differs from the plan (say if any should change):

- **Schemas** (`src/content/softSchema.ts`): muscle, part, ligament and cartilage front matter as spec §4.1 to §4.5, plus `movementsSchema`, `jointsSchema` and the muscle hierarchy. Kept out of `schema.ts` (and the main chunk). Choices the spec left open: parts may carry `commonName`, `innervation` (only where it differs, e.g. the heads of pectoralis major) and `clinicalNote` but needn't; `parent` is null only for the linea alba; cartilage `commonName` is optional (the spec's example has none).
- **Vocabulary files.** `content/movements.json` is the spec's list verbatim. `content/joints.json` has **27 functional joints** (11 per side, 5 midline: craniovertebral, cervical, thoracic and lumbar spine, vertebral column), each a set of existing pair joints; listed in QUESTIONS 71. Derived data treats two joint IDs as the same joint when their pairs **overlap** (QUESTIONS 72), which is how "a pair inside a functional joint counts as that joint" (decision 2) is implemented, and also lets the spine entries nest. `content/muscle-hierarchy.json` has the 8 regions, 4 sub-regions in each limb and 49 compartments, all empty except `triceps_brachii_left`; the content sessions fill them and may add compartments.
- **Validation** (`src/content/softValidate.ts`, in `validate-content`): every spec §10 rule, plus: file in its layer's folder; `id`, `name`, `side`, `kind`, `parts`, `parent`, `partType` and `alsoServes` equal `soft-ids.json`; per-kind summary length (decision 5); references to the wrong side fail (a left muscle naming `ulna_right` or `elbow_joint_right`); landmarks only on bones; a part can't inherit an empty origin or insertion; duplicate actions; `joint: null` only for the listed structures (decision 3; QUESTIONS 73); `synergistOverrides` needs a QUESTIONS.md line naming `synergistOverrides` and the muscle; `joints.json` members exist and each side has its mirrored twin; the hierarchy's path for each muscle must equal its `region` + `compartment`, and (strictly) no empty node. **`--allow-missing-soft` is in the `validate-content` npm script itself** (so `check`, `prebuild` and CI all use it); session AD removes it there.
- **Mirroring** covers the three new folders. The opposite-ID function (`makeOpposite` in `scripts/lib/content-files.ts`) also swaps **joint IDs** (pair and functional), which the first mirror run missed and the validator caught.
- **Derived data** (`src/content/derive.ts`): `synergistsOf`, `antagonistsOf`, `actionsOf`, `attachedMuscles`. Only prime and assist actions count, on both sides of the match (a stabiliser is neither a synergist nor an antagonist). A muscle's own parts and sibling parts are never its synergists. A part is listed beside its muscle only when one of its **own** actions matches; otherwise the muscle stands for it. A part's own action replaces the parent's for the same joint and movement (its role wins). Bone attachments list each structure by its own declaration: a part with `origin: inherit` is not listed (its muscle is).
- **Compiler and chunks** (`src/content/softCompile.ts`, `scripts/lib/content-plugin.ts`): `virtual:skeleton-soft-content-{muscles,ligaments,cartilage}`, each with every entry's front matter and summary HTML; the muscles chunk also carries `derived` (synergists, antagonists, structure → attached muscles). `npm run content` prints all four sizes. The chunk is fetched by `LayerScenes` when the layer starts loading, and by the panel (`useSoftContent`, `src/content/softContentLoader.ts`) when a soft-tissue structure is selected.
- **Panel** (`softPanel.ts`, `InfoPanel.tsx`): when written, the Latin name replaces the kind line under the title, "Part of *Muscle*" moves under it (spec §4.7), the common name and summary show. Unwritten structures keep the M7 placeholder.
- **Seed content:** `triceps_brachii_left` and its three heads, `anterior_cruciate_ligament_left`, `medial_meniscus_left` (+ 6 mirrored). The humerus gained one landmark, `posterior_surface` (QUESTIONS 77).
- **Migration table** (`scripts/content/attachment-match.ts`, `migrate-attachments.ts`, `npm run content:migrate-attachments`, `--check` in `npm run check`): `content/attachment-migration.json` lists each of the **200** strings with its `rule`, the IDs **per bone** (needed because e.g. "Abductor digiti minimi" means the hand muscle on the pisiform and the foot muscle on the calcaneus), an `indirect` flag for attachments through a costal cartilage, ligament or fascia, and a note. **133 by name, 61 by variant, 6 unmatched** (muscles the source doesn't have: QUESTIONS 70). Variant calls worth checking: QUESTIONS 74 to 76.
- **Questions added:** 70 to 77, under the new headings *Joints*, *Muscles: attachment migration* and *Muscles: upper limb*.
- **Tests:** `tests/softContent.test.ts` (33: one passing and one failing case per rule on a small fixture, derived data, compiler, the real triceps attachments, joint mirroring, the matcher); `tests/e2e/soft-content.spec.ts` (written part: Latin, Part of, summary; ligament common name; an unwritten structure keeps the placeholder).
- **Size:** main chunk `index` 293.3 kB gzipped (+0.3 kB over M7; budget +5). Content chunks: muscles 1.2 kB, ligaments 0.6 kB, cartilage 0.6 kB gzipped with the seed files.

## Session AB notes (step 7, done)

- **67 left files** (52 muscles, 15 parts; 67 mirrored), which completes the muscles layer's hand-written files: iliopsoas (2); gluteal, superficial (gluteus maximus, medius, minimus; tensor fasciae latae with its belly and the iliotibial tract) and deep (piriformis, the gemelli, obturator internus, quadratus femoris); the thigh, anterior (sartorius, the four quadriceps, articularis genus), medial (pectineus, the three adductors with adductor magnus's two portions, gracilis, obturator externus) and posterior (biceps femoris with 2 heads, semitendinosus, semimembranosus); the leg, anterior (4), lateral (2), posterior superficial (gastrocnemius with 2 heads and the calcaneal tendon, soleus, plantaris) and deep (4); the foot, dorsum (2) and sole (11). `muscle-hierarchy.json` is filled for every lower-limb compartment, so **every muscle in `soft-ids.json` now has a file and a place in the tree**.
- **No new functional joints:** hip and knee are single pairs; the ankle, subtalar/transverse tarsal and toe 2–5 sets from session X cover the rest; the big and little toes use pair joints (QUESTIONS 113).
- **Two-way preview:** every old string on a lower-limb bone is matched by an origin or insertion, with two expected exceptions: "Soleus" on the calcaneus is matched through the calcaneal tendon's `alsoServes` (soleus inserts on the tendon, QUESTIONS 109; **session AD's check should count `alsoServes`**), and the quadriceps → tibia string stays `indirect` (QUESTIONS 110). Over the whole tree, 540 matched; the other misses are still session Z's `indirect` strings.
- **Landmarks added:** hip bone (5), femur (8), tibia (3), fibula (3); listed in QUESTIONS 119.
- **Questions 108 to 119.**
- **Tests:** the real-content test from spec §10: the femur's origins include the vasti; quadriceps against the hamstrings (same side only); the long head of biceps femoris against psoas (a part's own action); dorsiflexors against the calf, invertors against evertors; dorsal against plantar interossei of the foot; the calcaneal tendon carrying gastrocnemius and soleus.
- **Size:** the muscles content chunk is 84.8 kB gzipped with 537 files (lazy).

## Session AA notes (step 6, done)

- **58 left files** (39 muscles, 19 parts; 58 mirrored), which with session X's triceps seed completes the upper limb: deltoid (3 parts) and teres major; the rotator cuff (4); the arm (biceps with 2 heads, brachialis, coracobrachialis); the anterior forearm, superficial (pronator teres, flexor carpi radialis, palmaris longus with its belly and the palmar aponeurosis, flexor carpi ulnaris, flexor digitorum superficialis, each with its heads) and deep (3); the posterior forearm, superficial (7) and deep (5); the hand (thenar 3, hypothenar 3, adductor pollicis, lumbricals, dorsal and palmar interossei). `muscle-hierarchy.json` is filled for every upper-limb compartment.
- **No new functional joints:** the elbow, wrist and finger 2–5 sets from session X covered everything; the thumb and little finger use pair joints (QUESTIONS 100). Radial and ulnar deviation are `abduction` and `adduction` at the wrist (QUESTIONS 99).
- **Two-way preview:** every old string on an upper-limb bone that names one of these muscles is matched by an origin or insertion (0 misses). Over the whole tree, 438 matched; the only misses are still session Z's 20 `indirect` costal-cartilage strings. The preview counts a string naming a muscle as matched when the muscle **or one of its parts** attaches to the bone (needed for e.g. "Pronator teres" on the humerus, where the superficial head carries the origin); session AD's check should use the same rule.
- **Landmarks added:** humerus (4), radius (5), ulna (5); listed in QUESTIONS 106.
- **Questions 99 to 107.**
- **Tests:** the real-content derived-data test from spec §10: biceps' synergists include brachialis (same side only) and its antagonists include triceps; wrist ulnar deviation; dorsal against palmar interossei; the humerus's common flexor origin listed by part; the lumbricals arising from flexor digitorum profundus.
- **Size:** the muscles content chunk is 62.1 kB gzipped with 403 files (lazy).

## Session Z notes (step 5, done)

- **59 left and midline files** (50 muscles, 9 parts; 57 mirrored): superficial back (5), serratus posterior (2), splenius (2), erector spinae (9), transversospinales (6), segmental back (6: interspinales, lateral intertransversarii lumborum, levatores costarum), pectoral region (4), thoracic wall (4), diaphragm, anterolateral abdominal wall (5) and linea alba, quadratus lumborum, pelvic floor (4), external anal sphincter. The pectoral muscles sit under *Thorax › Pectoral region* (as the source groups them); the diaphragm directly under *Thorax* (`compartment: null`).
- **New functional joint:** `costovertebral_joints_{left,right}`, all 20 rib–vertebra pairs of a side, for muscles that move many ribs (QUESTIONS 80 and 71 updated). 29 functional joints in all.
- **Two-way preview:** 285 old strings on the trunk bones matched; the only misses are the 15 marked `indirect` (costal cartilage, thoracolumbar fascia, anococcygeal ligament: QUESTIONS 92). The preview now uses session AD's rule: a string naming several muscles ("Multifidus", "Interspinales") is accounted for when any of them attaches to that bone.
- **Landmarks added:** humerus (crests of the greater and lesser tubercles), hip bone (pubic crest).
- **Questions 89 to 98.** Trunk movements name the thoracic and lumbar spine rather than the nested *vertebral column*, to keep neck muscles out of the trunk's synergists (89).
- **Tests:** a real-content test of rib elevation across the functional and pair joints (external intercostals with the scalenes and levatores), scapular rotation (serratus anterior with trapezius, against the rhomboids), and a part's own action (clavicular head of pectoralis major against latissimus dorsi).
- **Fixed from session X's full e2e run** (132 of 133): the M7 keyboard test timed out once under parallel load (60 s alone against a 90 s limit, while it loads the muscles layer); it now has the 180 s the other layer tests use.

## Session Y notes (step 4, done)

- **82 left and midline files** (63 muscles, 19 parts; 81 mirrored): scalp (2), face (16), extra-ocular (7), mastication (4), tongue (2), soft palate (1), superficial neck (2), suprahyoid (4), infrahyoid (4), prevertebral (4), scalenes (3), pharynx (4), larynx (6), and the 4 suboccipital muscles, which the hierarchy puts under *Back › Suboccipital muscles*. `muscle-hierarchy.json` is filled for these compartments.
- **Two-way preview against the old bone lists:** every old string on a head, neck or vertebral bone that names one of these muscles is matched by an origin or insertion in the new files (97 of 97), so session AD's check should pass for this region.
- **Landmarks added** to 6 bone files (+ mirrors): QUESTIONS 87.
- **Questions 78 to 88.** The one with consequences beyond this session is **78: rotation has no direction**, so left and right rotators count as synergists. Default: leave it; the alternative is a vocabulary change (the user's call).
- **Tests:** a real-content derived-data test (temporalis: synergists masseter and medial pterygoid, same side only; antagonists digastric and lateral pterygoid; the hyoid's insertions).
- **Size:** the muscles content chunk is 22.1 kB gzipped with 171 files (lazy; loaded only with the muscles layer).
- **How the files were written:** from a data table in a scratch generator (`softgen.py` in the session scratchpad, not committed). The `.md` files are the source of truth; later sessions can use any method.

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
