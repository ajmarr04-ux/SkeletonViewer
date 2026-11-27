# Handoff — written 2026-11-27 at the end of M14 BU

## Next session
BV (routine): sidebar roots grouped by system, each system's tree lazy (plan step 4, decision 6).
Done when: `tree.json` unchanged; `sidebar`, `soft-sidebar`, `keyboard`, `a11y` e2e pass; the fixture's system root is lazy.

## State
- Last commit: M14 BU: search filter chips, region and visibility context for the ranker
- `npm run check`: pass
- Open fan-out work: none

## Waiting on the user
Nothing. Decisions 5–12 in the plan stand unless the user says otherwise.

## Things the next session must know
- The chips live in `Search` (`src/ui/Sidebar.tsx`): systems with a loaded index, shown with two or more; a chip merges only that system's layers' searchers. BV adds system rows to the tree under the same sidebar: keep the chips' test IDs (`search-chips`, `search-chip-<system|all>`).
- The ranking context (`inRegion`, `visible`) is built in `Search` from the store's `reg` and `layers`; `layerOfHit` there maps a group key to its layer (eager layer if no prefix).
- The chips' axe check is in `fixture.spec.ts` (the fixture project runs only that file).
- Main chunk 491.5 kB of 500.1.
