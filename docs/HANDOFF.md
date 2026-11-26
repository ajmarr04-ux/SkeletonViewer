# Handoff — written 2026-11-26 at the end of M14 planning

## Next session
BS (design): the new search ranking (match bands, generic words, region and visibility tie-breaks) on today's two indexes, plus the `search.json` difference report.
Done when: ranking unit tests pass; `assets/build/REPORT-search-golden.md` lists every changed query; then **stop for the gate** (the user approves the differences before the golden is rewritten).

## State
- Last commit: M14 planning (m13 frozen at `dc55686`, `current` 14, `docs/PLAN-milestone-14.md`)
- `npm run check`: not re-run (docs and `deploy/pages.json` only; M13 BR left it green)
- Open fan-out work: none

## Waiting on the user
Decisions 1–12 in `docs/PLAN-milestone-14.md` (the ones most worth a look: 3 generic words return nothing alone, 5 chips hidden with one system, 6 the sidebar's system row and the bones' tree staying eager).

## Things the next session must know
- Ranking must not depend on BM25 scores (decision 1): BT splits the indexes and must leave the approved golden unchanged.
- Main chunk 490.9 kB of 500.1 (9.2 kB for all of M14); measure as M13 did (index + modulepreloads, `gzip -9`).
- Goldens: never `--write --force` without the user's approval; after BS's approval rewrite `search.json` only.
- The last M14 allowlist entry (`scripts/perf-load.ts`) goes in BZ.
