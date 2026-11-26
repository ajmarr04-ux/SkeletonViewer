# Handoff — written 2026-11-26 at the end of M13 session BO

## Next session
BP (design): the budget governor: drawn-triangle tracking, per-layer LOD capping, the "Focus on a body region?" prompt, the phone's region start, `?budget=` and the debug overlay line (`docs/PLAN-milestone-13.md` step 6, decision 10).
Done when: pure governor unit tests; e2e with `?debug&budget=`; the parity unit test (real totals fit 1.5M / 450k); nothing triggers on today's content; `npm run check` green.

## State
- Last commit: see `git log` (M13 BO: region chunking)
- `npm run check`: pass (737 tests; the six goldens unchanged; it now also runs `SKV_REGISTRY=fixture npm run check-models`)
- e2e this session: `fixture` 5/5 (two new); `layers` + `smoke` + `tints` + `regions` 40/40
- Open fan-out work: none

## Waiting on the user
Nothing blocking.

## Things the next session must know
- **Per-layer LOD caps (BP) meet the new loader** in `TissueLayerScene` (`src/layers/LayerScenes.tsx`): `lods` is still one plan for every layer; a chunked layer re-batches all chunks fetched at a LOD and keeps their parts until another LOD replaces them. A cap that drops a layer to low must go through the same `lodsToLoad` path.
- The governor's estimate before load: `regionTriangles(layer, lod, key)` (`src/regions/index.ts`). For a chunked layer, only fetched chunks can be drawn.
- `openRegionPicker()` (`src/ui/RegionPickerHost.tsx`) opens the picker for BP's prompt; "Whole body" = `chooseRegion(null)`.
- Main chunk **488.6 kB** `gzip -9` (index + modulepreloads; budget 500.1). Lazy chunks must not import the app's own modules (BN's lesson).
- The fixture's widgets now sit in the head, thorax and left thigh (`widgets/membership.ts`); re-run `npx tsx tests/fixtures/systems/demo/widgets/generate.ts` after any region-volume change (`tests/regionChunks.test.ts` catches a stale file). Goldens: never `--write --force` without the user's approval.
