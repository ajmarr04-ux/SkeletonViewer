# Handoff — written 2026-11-25 at the end of M13 session BM

## Next session
BN (routine): the region UI: toolbar "Body region" button, lazy picker (ARIA tree list + generated front/back SVG maps), camera framing on the region, breadcrumb, announcements (`docs/PLAN-milestone-13.md` step 4, decision 8).
Done when: new tests in `tests/e2e/regions.spec.ts` (exists, 4 tests from BM: extend it) and the a11y pass for the picker; `polish`, `a11y` and `keyboard` e2e unchanged and passing.

## State
- Last commit: see `git log` (M13 BM: region focus state)
- `npm run check`: pass (714 tests; the six goldens unchanged)
- e2e run this session: `regions`, `select`, `related`, `nested`, `layers`: 43/44, plus `nested` alone 3/3 twice (the one failure was a hover-tooltip timing flake under parallel load)
- Open fan-out work: none

## Waiting on the user
Nothing blocking.

## Things the next session must know
- Actions: `focusRegion(key)` / `leaveRegion()` in `src/state/selection.ts` (also `window.__viewer.focusRegion/leaveRegion`, `state().reg`). Store `reg`; URL `reg=`. `leaveRegion` with something isolated keeps the isolation (replace), with nothing isolated pops: a deliberate departure, in the BM notes.
- The view: `memberSet(key)` (`src/regions/index.ts`), `isolationView(…, region)`, `sceneView(…, region)`, `shownIn` hides non-members (focus and joint bones excepted). Everything that goes through `viewOf` already follows the region.
- Not done, BN's: announcements (a region step is announced today only via its `sel`/`grp` change; `announce.ts` counts use `isolationView` without a region), the breadcrumb's region crumb, framing on the region volume, the "outside the body region" wording.
- BK's lesson for the lazy picker: a lazy chunk importing `three` or `react` but not `meshoptimizer` can cost ~1 kB of main chunk; measure index + modulepreloads (`gzip -9`), now 489.5 kB of 500.1.
- Goldens: never `--write --force` without the user's approval.
