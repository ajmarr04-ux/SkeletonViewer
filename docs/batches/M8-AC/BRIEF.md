# Brief: M8-AC, ligament and cartilage content

You are drafting content files for the Skeleton Viewer, an anatomy atlas. Each batch writes one Markdown file per item, for **left-side and midline structures only**. The main agent mirrors the right side afterwards, so never write a `_right` file.

## Read first
1. `SPEC-musculoskeletal.md` §4 (the intro), §4.4 (ligament), §4.5 (cartilage, disc, meniscus), §4.7 (names) and §10 (validation).
2. `docs/PLAN-milestone-8.md`, decisions 3 (`joint: null`), 5 (summary length) and 14 (writing standards).
3. The two finished examples. **Copy their style, field order and quoting exactly:**
   - `content/ligaments/anterior_cruciate_ligament_left.md`
   - `content/cartilage/medial_meniscus_left.md`
4. Your items: `docs/batches/M8-AC/items.json`, filtered to your `batch` letter. Each item gives `id`, `name`, `kind`, `side`, the source's grouping (`sourceGroup`, a hint only) and the `file` to write.

## The file format

Ligament (`kind: ligament`), fields in this order:
```
---
id: <id from items.json>
kind: ligament
name: <name from items.json, exactly>
latin: <TA2 Latin form>
commonName: <a lay name in real use, quoted, or null>
side: <left | midline, from items.json>
joint: <joint ID, or null (see below)>
connects: [<structure IDs>]
functions:
  - <short sentence>
clinicalNote: "<one or two sentences>"   # or null
reviewed: false
---
<summary: 40 to 80 words>
```

Cartilage, disc or meniscus (`kind` from items.json: `cartilage`, `disc` or `meniscus`): the same, except `attachedTo: [<structure IDs>]` replaces `connects`. Leave `commonName` out unless a lay name is really in use (for example "slipped disc" isn't a name, so leave it out).

### Field rules (`npm run validate-content` enforces them)
- `id`, `name`, `kind` and `side` must equal `items.json` exactly.
- **`joint`** is one of:
  - a pair joint ID from `content/articulations.json` (the `joint` field of an entry, for example `knee_joint_left`, `sternocostal_joint_rib_3_left`, `intervertebral_joint_c4_c5`, `pubic_symphysis`), or
  - a functional joint ID from `content/joints.json` (for example `wrist_joint_left`, `elbow_joint_left`, `ankle_joint_left`, `subtalar_transverse_tarsal_joints_left`, `metatarsophalangeal_joints_2_5_left`).
  Pick the **most specific joint that is really there**. Use a pair joint when the structure belongs to one pair (for example the radial collateral ligament of the elbow → `humeroradial_joint_left`), and a functional joint when it spans the set (for example the dorsal radiocarpal ligament → `wrist_joint_left`). A left structure takes `_left` joints or midline joints, never `_right`.
- **`joint: null`** is allowed only for the IDs listed in `LIGAMENT_NO_JOINT` and `CARTILAGE_NO_JOINT` in `src/content/softValidate.ts` (read them). If you're sure a structure sits at **no joint in either file** and it isn't on the list, still write `joint: null`, and put a line in your questions file saying so. That one validation error is expected; the main agent decides the list.
- **`connects` / `attachedTo`**: at least one ID. Every ID must exist in `content/ids.json` (bones) or `content/soft-ids.json` (soft tissue, for example a meniscus, another ligament or a cartilage). No landmarks here: plain IDs only. Same side or midline, as for `joint`. List what the structure really joins: usually its two (or more) bones; a meniscus or disc lists what it is anchored to.
- **`functions`**: 1 to 3 short sentences, each starting with a verb ("Limits…", "Holds…", "Deepens…").
- **`clinicalNote`**: only a well-known, specific point (a common injury, a named test or sign), quoted. Otherwise `null`. Don't pad.
- **Summary** (the body after the second `---`): 40 to 80 words, plain British English, no lists, no headings. Say where it is, what it runs between, and what it does. Grouped objects (plural names such as "Dorsal intercarpal ligaments") describe the set.
- Quote any string value that contains a colon, a `#` or a leading special character, as the examples do.
- `reviewed: false` always.

### Writing standards (plan decision 14)
- English names as `items.json` gives them. `latin` is the TA2 Latin form (for example `Ligamentum collaterale fibulare`). If you're unsure of the exact Latin, use the standard Terminologia Anatomica form you're most confident of and add a question.
- Attachments and functions from standard references (Gray's Anatomy, Moore's Clinically Oriented Anatomy, TA2). Never invent. If the textbooks disagree, or the source object is an odd unit (part of a ligament, a grouped set, a structure not every text names), describe it plainly and add a question.

## Rules (from docs/WORKFLOW.md §5)
1. Edit **only** the files assigned to your batch. Never edit shared files: `package.json`, lock files, anything in `src/`, `scripts/`, the schemas, `content/ids.json`, `content/soft-ids.json`, `hierarchy.json`, `articulations.json`, `joints.json`, bone files, `content/QUESTIONS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, plans or specs.
2. **Never invent anatomy.** No made-up attachments, functions, joints or TA2 IDs. If unsure, leave it out and write the doubt to your questions file.
3. Don't run `git commit`, `git push`, `npm install`, `npm run content:mirror`, or anything that deploys.
4. Don't spawn subagents.
5. Run the validation command below before you finish, and report the result honestly.
6. Return only the summary format. No file contents, no long explanations.

## Questions file
Write doubts to `docs/batches/M8-AC/questions-<batch letter>.md`, one bullet each: ``- `<id>`: <the doubt and the choice you made, one or two sentences>``. Create it only if you have questions.

## Validation
```
npm run validate-content 2>&1 | grep -E "error|<your first id>|<your second id>|…" | head -40
```
Or simply run `npm run validate-content` and read only the lines naming your files. Other batches are writing at the same time: **ignore errors in files that aren't yours.** The warning about missing soft-tissue files is expected. Fix every error in your own files, except an expected `joint is null … isn't on the no-joint list` error you have reported as a question.

## Summary format (return exactly this)
```
BATCH: <letter>
DONE: <n> — <ids>
SKIPPED: <n> — <id>: <one-line reason>
VALIDATION: pass | fail (<first 3 errors in your files, one line each>)
QUESTIONS: <n> written to questions-<letter>.md
NOTES: <at most 3 lines, only if something affects other batches>
```
