# Handoff — written 2026-11-25 at the end of M12 BA

## Next session
BB (design): the always-loaded ID index (plan decision 7, step 3). `virtual:skeleton-index` (plugin from the registry's ID files and the joint nodes), `src/content/index.ts` lookups; `softRegistry.ts` reads the index; `softTable.ts`, `loadSoftIds.ts`, `registerSoftIds`, `virtual:skeleton-soft-ids` deleted; the fixture build's ID file joins the index through the same plugin.
Done when: `isKnownId`, `hasMesh`, `displayName`, `layerOfId` answer at once (no "unknown until the table loads"); goldens unchanged (`urls.json` especially); the `nested`, `layers`, `select`, `tiers` e2e specs pass; main chunk measured against the 12 kB budget (decision 7); `npm run check` green.

## State
- Last commit: M12 BA: tier engine and tier rules (see `git log`); AZ's graph core is `dcae4f7`.
- `npm run check`: pass (638 tests, the five goldens unchanged). Main chunk about 473.0 kB (registry chunk +0.3 kB for the tier rules).
- Open fan-out work: none

## Waiting on the user
none (the user approved BA's amendment to decision 5 in the session: source-by-source order, a rule's own `order`, `anatomical` over soft IDs, and the `result`/`exclude`/`parts`/`requires` options; see the plan's BA notes)

## Things the next session must know
- Engine: `src/graph/graph.ts` (`createGraph`, `add(chunk, edges)`), `src/graph/query.ts` (`tierEngine(ctx)`: `evaluate`, `related(id, tier, modes)`, `hasTier`). Rules: `KindDescriptor.tiers` in each layer's `layer.ts` (ligaments and cartilage share `src/systems/musculoskeletal/jointTiers.ts`). Context: registry `tierContext(graph, { kindOf, rank })`.
- **`anatomical` order = the ID index's order:** the eager layer as `ids.json` lists it, then each other layer in registry order with its IDs sorted (`indexRank(entries)` in the registry). BB should build `virtual:skeleton-index` in that order (or keep using `indexRank`) so BC's `rank` comes from the index.
- Parts come from `parentOf.via` (`part_of` edges without meta `also`): an `alsoServes` part isn't a muscle's part.
- A missing tier (ligament or cartilage with no joint) falls back to tier 1 at tier 2 in the caller, as `relatedAt` does today; BC keeps that in the app's wrapper.
- The app still runs on `relations.ts`, `softTiers.ts`, `softRelations.ts` until BC switches and deletes them.
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
