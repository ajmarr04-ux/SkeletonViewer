# Handoff — written 2026-11-25 at the end of M12 BB

## Next session
BC (design): ship the graph in the chunks and switch tiers, roles and tints onto it (plan decisions 3 and 8, step 4). The content plugin emits each layer's edges into its content chunk and the eager layer's into the main chunk; `softContentLoader.ts` registers them with the graph; `relatedAt` asks `query.ts`; `hasSoftTier2`, `softTiersLoaded`, `tierBlockedReason` and `withTints` read the graph. Delete `relations.ts`, `softTiers.ts`, `softRelations.ts`, `softRoles.ts` and the chunks' `tiers`/`reverse`/`roles` fields.
Done when: those modules are gone; goldens unchanged (harness imports only); content chunk sizes before/after in the notes; e2e `tiers`, `tints`, `related`, `attached`, `joints`, `nested`, `labels-layers` pass; `npm run check` green.

## State
- Last commit: M12 BB: the always-loaded ID index (see `git log`).
- `npm run check`: pass (645 tests, the five goldens unchanged). Main chunk 483.1 kB `gzip -9` (+10.1 kB for the index, inside decision 7's 12 kB budget).
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- The index: `src/content/index.ts` (`isKnownId`, `hasMesh`, `layerOfId`, `lazyEntry`, `lazyEntries`, `isEagerId`, `indexNode` for joint names). It is handed over by `src/content/indexData.ts`, which `src/main.tsx` and `tests/setup.ts` import first. Scripts and Vite plugins never load it, so `index.ts` must not import a virtual module (or the registry at run time).
- The golden harness's `freshModules()` re-imports `indexData` after `vi.resetModules`; any new harness builder that resets modules must use it.
- `anatomical` order: keep `indexRank([...ids.json, ...lazyEntries()])` (the index is in file order, not ID-sorted).
- A soft `sel=` still goes through `selectSoftFromUrl` (`initSelectionFromUrl` parses with `isEagerId`), which keeps `urls.json`; `onPopState` parses with `isKnownId` (Back to a muscle entry).
- The app still runs on `relations.ts`, `softTiers.ts`, `softRelations.ts` until BC. Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
