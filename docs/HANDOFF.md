# Handoff — written 2026-11-25 at the end of M13 session BL

## Next session
BM (design): region focus state: the reducer's `reg`, `focusRegion` / `leaveRegion`, `levelOf` and Back, URL `reg=`, history (`skvDepth`), `sceneView` / `isolationView` intersections with the region's members, `isPickable` (`docs/PLAN-milestone-13.md` step 3, decision 7).
Done when: unit tests for every transition; the five goldens and `regions.json` unchanged; `select`, `related`, `nested`, `layers` e2e pass.

## State
- Last commit: see `git log` (M13 BL: body-region membership, located_in, regions golden)
- `npm run check`: pass (690 tests; now also runs `regions:membership -- --check`)
- e2e run this session: `fixture` (3), `smoke` + `related` (12), all pass
- Open fan-out work: none

## Waiting on the user
Nothing blocking. After BL the plan asks for a skim of `assets/build/REPORT-regions.md` (structures in many regions, the 63 overrides); it isn't a gate.

## Things the next session must know
- Runtime lookups for BM: `src/regions/index.ts`: `regionInfo(key)` (fine/coarse, name, coarse parent, side), `isRegionKey`, `membersOf(key)` (a coarse key = the union of its fine regions' members), `isInRegion(id, key)`, `regionsOf(id)`. All available from the first frame (Vitest setup and the app entry load them via `indexData.ts`).
- `src/regions/index.ts` must not import the registry at run time (Vitest's setup loads it before tests mock `registered.ts`).
- Members include structures without a mesh (parent muscles, wisdom teeth): filter with `hasMesh` when drawing, as `isolationView` does.
- `located_in` is in the app graph (chunk `regions`) and last in `EDGE_TYPES`; no tier rule or panel follows it (decision 5).
- Goldens: never `--write --force` without the user's approval; `regions.json` now counts as a golden.
- Main chunk 489.3 kB (`gzip -9`, index + modulepreloads; budget 500.1).
