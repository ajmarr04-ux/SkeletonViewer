# Handoff — written 2026-11-24 at the end of the M11 planning session

## Next session
AS (design): record the four golden snapshots (`tests/golden/{tiers,panels,urls,search}.json`) and the M10 performance baseline, before any refactor.
Done when: the goldens are committed, `tests/golden.test.ts` passes inside `npm run check`, and the baseline table (bench bones-only and all layers, perf-load, main chunk) is in step 1 of `docs/PLAN-milestone-11.md`.

## State
- Last commit: M11 planning (plan, `current` 11, README, CLAUDE.md, this file)
- `npm run check`: not run (docs and `deploy/pages.json` only)
- Open fan-out work: none (M11 plans no subagents)

## Waiting on the user
Decisions 1–8 in `docs/PLAN-milestone-11.md`. Sessions build them as written unless the user changes them.

## Things the next session must know
- Spec: `SPEC-platform.md` (arrived on `main` as `3d9db59`). It says `docs/WORKFLOW.md`; use `docs/WORKFLOW_NEW.md`.
- AS must commit the goldens before any file in `src/` or `scripts/` changes. If the URL load path can't run in Node, extract its pure part in its own commit with no behaviour change (decision 6).
- Goldens come from pure functions with content from disk: `relatedAt`, `panelModel`, `softPanelModel` + `softSections`, `parseUrlState`, the searchers + `searchMerge.ts`; `compileAllSoftFromDisk` gives the soft content (as `tests/softTiers.test.ts` does).
- Main-chunk budget for M11: ≤ 500.1 kB (AR's 470.1 + 30; decision 1).
- Any golden difference is a bug until the user approves it.
