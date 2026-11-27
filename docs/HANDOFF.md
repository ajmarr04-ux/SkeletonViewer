# Handoff — written 2026-11-27 at the end of M14 BV

## Next session
BW (design): the colour model's data and test (plan step 5, decisions 7 and 10): `ColourSpec.shades` (tendon moves into the muscles descriptor, `src/layers/colours.ts` goes), `tests/colourVision.test.ts` builds its pairs from the registry, and the future-system colours table.
Done when: `colourVision.test.ts` builds its pairs from the registry; the table passes and is recorded in the plan; no on-screen colour changes. **If the rewritten test finds a pair the old table missed, stop and ask** (it would mean a colour change).

## State
- Last commit: M14 BV: sidebar rows per system, a lazy tree chunk per system
- `npm run check`: pass (790 tests, 1 skipped)
- Open fan-out work: none

## Waiting on the user
Nothing. Decisions 5–12 in the plan stand unless the user says otherwise.

## Things the next session must know
- The sidebar now has one `system` row per system (`sidebarRows`, key `system:<id>`); `visibleRows` is still the layer forest alone (the tree golden reads it).
- Collapsed systems live in the store (`collapsedSystems`, `toggleSystem`), shared by the Layers panel and the sidebar.
- Tree chunks: `virtual:skeleton-tree-<system>` (registry `TREE_SYSTEMS`, `treeChunk`); the fixture serves its two itself (`tests/fixtures/systems/vite.ts`).
- Main chunk 492.2 kB of 500.1.
