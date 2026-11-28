# Handoff — written 2026-11-28 at the end of M14 CA

## Next session
CB (routine): the M14 wrap-up (plan step 9): goldens, the parity table, the full e2e in the background, docs (`STATUS.md`), freeze `m14` in `deploy/pages.json` at CB's own merge, `/m14/` live.
Before CB starts, CA's gate: the user checks the surface-locked patterns on a device. That needs this branch merged to `main` (`/m14/` rebuilds only there); ask before merging. Use link 3: `/m14/?layers=b:on,c:on,l:on,m:on&sel=flexor_carpi_radialis_left&tier=2&ant=1`, orbit to the back of the forearm, then pan, zoom and orbit.

## State
- Last commit: M14 CA: surface-locked patterns
- `main` = PR #30 (`ab33337`), M14 up to BZ; CA is on `claude/keen-clarke-32a10a`, not merged
- `npm run check`: pass (823 tests, 1 skipped); `tints` e2e: 8 passed
- Open fan-out work: none

## Waiting on the user
- Merge for the device check (asked at the end of CA), then their verdict on the patterns: size (22 mm on the surface ≈ 18 px at link 3's framing), the zoomed-out octaves, the look in the legend. If they want a different size, change `PATTERN_PERIOD_M` / `PATTERN_MIN_CSS` in `src/scene/patterns.ts` (the unit tests follow the constants).

## Things the next session must know
- Patterns are world space now (CA notes in the plan): `PATTERN_VERTEX` (before `project_vertex`), `PATTERN_FRAGMENT_PARS` (uniform `uPatternMinPx`, varyings, mark functions), `PATTERN_FRAGMENT`; any shader stub in a test needs `#include <project_vertex>` in its vertex source.
- `tints.spec.ts`'s pattern sample is a shade spread (darkest tenth vs brightest in 40 px), not neighbour jumps.
- Kill stale `vite preview` servers before a Playwright run (`pkill -f "vite preview"`).
- Main chunk 494,550 B (budget 500.1 kB, 5.5 kB left). Measure: index + modulepreloads, `gzip -9`.
