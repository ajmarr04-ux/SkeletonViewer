# Handoff — written 2026-11-27 at the end of M14 BS

## Next session
**Gate first:** the user answers the BS questions at the end of `assets/build/REPORT-search-golden.md` (A: approve the 10 changed queries; B: visibility tie-break at the default layers; C: a generic word alone returns nothing; plus the 7 departures from decisions 1–3 listed there).
Then, in whichever session comes next: apply any changes the user asks for, re-run `npm run search:report`, rewrite the golden with `npm run golden -- --write --force` (only `search.json` should change: check `git diff --stat tests/golden`), record the approval under "Approved golden differences" in `docs/PLAN-milestone-14.md`, tick BS. Then BT (one lazy index per layer).

## State
- Last commit: M14 BS (ranking by match bands, report)
- `npm run check`: fails only on the `search` golden, as expected until the gate (`npx vitest run`: 781 pass, 1 fails = `golden > search`). Every other step passes. `sidebar` + `soft-sidebar` e2e: 12/12.
- Open fan-out work: none

## Waiting on the user
The BS gate (above). Decisions 4–12 in the plan still stand unless the user says otherwise.

## Things the next session must know
- The ranker and merge live in the search chunk; the sidebar gets `mergeSearchers` from `searchLoader.ts`. Keep them out of the main chunk (490.9 kB of 500.1).
- `makeSearcher` ranks all candidates before applying the limit; a per-index limit before ranking would make BT's split change results.
- The golden harness ranks with no region and no visibility; BU wires the store's context into the sidebar only.
- BT's invariance test can start from `tests/searchRank.test.ts` "merging doesn't depend on how the documents are split".
- The last M14 allowlist entry (`scripts/perf-load.ts`) goes in BZ.
