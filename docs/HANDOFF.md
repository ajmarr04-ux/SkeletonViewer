# Handoff — written 2026-11-26 at the end of M13 session BN

## Next session
BO (design): region chunking: `ModelSpec.chunking: "single" | "region"`, `scripts/models/split-regions.ts`, `compress-models.sh` looping over the registry, `check-models` for chunked layers, the loader's chunk plan (`chunksFor(regionKey, layer)`) and incremental batch filling, the fixture regenerated and chunked (`docs/PLAN-milestone-13.md` step 5, decisions 9 and 11).
Done when: musculoskeletal `public/models/*.glb` byte-identical (`sha256sum` before and after); fixture chunked and loading per region; `npm run check` green.

## State
- Last commit: see `git log` (M13 BN: region UI)
- `npm run check`: pass (728 tests; the six goldens unchanged)
- e2e this session: `regions` 10/10; `polish` + `a11y` + `keyboard` 31/31 (two needed a re-run: the new axe test, fixed; `keyboard`'s M7 Layers test timed out under parallel load and passed alone)
- Open fan-out work: none

## Waiting on the user
Nothing blocking.

## Things the next session must know
- **Lazy chunks must not import the app's own modules**: the picker importing the store/selection cost 2.5 kB of main chunk through re-chunking; with props only it saved 1.2 kB. Main chunk now **488.6 kB** `gzip -9` (index + modulepreloads; budget 500.1). Measure the same way after BO's loader changes.
- Picker API for BP's prompt: `openRegionPicker()` (`src/ui/RegionPickerHost.tsx`), store `regionPickerOpen`. "Whole body" = `chooseRegion(null)` → `leaveRegion`.
- Region boxes (fine and coarse world AABBs) are in `virtual:skeleton-region-map`'s `boxes` (lazy); the main chunk frames a region on its drawn members only.
- The pelvis and perineum regions are on neither body map (inside the trunk boxes); reachable from the list.
- Goldens: never `--write --force` without the user's approval.
