# Handoff — written 2026-11-27 at the end of M14 BT

## Next session
BU (routine): search filter chips (hidden with one system) and the region and visibility context wired from the store into the ranker (plan step 3, decision 5).
Done when: chips e2e on the fixture build (two systems: chips shown, a chip filters, "All" restores); a new `regions.spec.ts` case (region members first in a band); `sidebar` and `soft-sidebar` e2e pass; chips in the a11y pass on the fixture build.

## State
- Last commit: M14 BT: one search index per layer, the fixture's search
- `npm run check`: pass
- Open fan-out work: none

## Waiting on the user
Nothing. Decisions 5–12 in the plan stand unless the user says otherwise.

## Things the next session must know
- Each layer has its own index: `searchChunk` on the content half, served through the generated `virtual:skeleton-search-importers`; `loadLayerSearch(layer)`, `loadSearch()` (eager), `loadAllSearch()` in `searchLoader.ts`. The Sidebar's `Search` keeps a per-layer `loaded` map and merges with `mergeSearchers`.
- BS's approval (B) means BU passes the visibility tie-break at the default layers too: `trapezius` then puts Trapezium above the trapezius's parts in the app (the golden stays context-free).
- The chips filter by system via `layerOfId` → the layer's `system`; a group hit's layer is its key's prefix (`layerOfHit` in `search.ts`).
- Main chunk 491.1 kB of 500.1. Keep the chips' code lean, or in the search chunk (`searchLoader.ts` forwards to the loaded module, as `mergeSearchers` does).
- The fixture build serves its own search importers and widgets index (`tests/fixtures/systems/vite.ts`); the content plugin skips layers with no real content half.
