# Handoff — written 2026-11-27 at the end of M14 BS (gate closed)

## Next session
BT (design): one lazy search index per layer, built from required `searchFields`, loaded when its layer is on or a query is typed, plus the fixture's search (plan step 2, decisions 4–5).
Done when: `search.json` unchanged from the approved golden; the invariance test (one index vs one per layer, top 30 of every golden query); fixture Vitest and `fixture.spec.ts` find widgets; old two and new four chunk sizes recorded in the plan.

## State
- Last commit: M14 BS gate: search.json rewritten as approved
- `npm run check`: pass (782 tests, 1 skipped = the report generator)
- Open fan-out work: none

## Waiting on the user
Nothing. Decisions 4–12 in the plan stand unless the user says otherwise.

## Things the next session must know
- The user approved all of BS (A, B, C and the seven departures); recorded under "Approved golden differences" in the plan. B means BU applies the visibility tie-break at the default layers too.
- The ranker and merge live in the search chunk; the sidebar gets `mergeSearchers` from `searchLoader.ts`. Keep them out of the main chunk (490.9 kB of 500.1).
- `makeSearcher` ranks all candidates before applying the limit; a per-index limit before ranking would make BT's split change results.
- Generic words are each layer's first kind's noun (`GENERIC_WORDS` in `search.ts`, from the registry); the noun filter uses `layerOfId`, and a group's layer is its key's prefix.
- BT's invariance test can start from `tests/searchRank.test.ts` "merging doesn't depend on how the documents are split".
- `npm run search:report` regenerates `assets/build/REPORT-search-golden.md` against the golden (it now lists no changes).
- The last M14 allowlist entry (`scripts/perf-load.ts`) goes in BZ.
