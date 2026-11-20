# Handoff — written 2026-11-20 when the repo adopted docs/WORKFLOW.md (before M8 session AC)

## Next session
M8-AC: draft every ligament, cartilage, disc and meniscus file (left and midline), mirror them, and finalise the `joint: null` list.
Done when: every ligament and cartilage file validates; the no-joint lists in `src/content/softValidate.ts` are final; `npm run check` passes.

## State
- Last commit: see `git log -1` (workflow setup)
- `npm run check`: pass (with `--allow-missing-soft`, plan decision 10)
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- Sessions X to AB are done and merged (#19): every muscle and part has a file; QUESTIONS run to 119.
- Seed examples: `content/ligaments/anterior_cruciate_ligament_left.md`, `content/cartilage/medial_meniscus_left.md`.
- `joint` takes a pair from `articulations.json` or a functional joint from `joints.json`; `null` only for IDs in `LIGAMENT_NO_JOINT` / `CARTILAGE_NO_JOINT`.
- Write left and midline only; `npm run content:mirror` writes the right side.
