# Handoff — written 2026-11-25 at the end of M12 BC

## Next session
BD (design): panel sections as data (plan decision 11, step 5). `PanelSection` types in `src/systems/types.ts`; `panel` on every kind; `src/panel/model.ts` (sections + chrome) turns an ID + its layer's content + the graph into what `panels.json` records; the `attachments` custom section's model. The golden harness reads the new model.
Done when: `panels.json` unchanged (harness imports only); `panel.ts`, `placeholder.ts`, `softPanel.ts` keep only what `InfoPanel.tsx` still imports until BE (listed in the notes), with no kind switches left; `npm run check` green.

## State
- Last commit: M12 BC: ship the graph in the chunks; tiers, roles and tints on it (see `git log`).
- `npm run check`: pass (651 tests, the five goldens unchanged). E2E `tiers`, `tints`, `related`, `attached`, `joints`, `nested`, `labels-layers`, `fixture`: 36 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- The runtime graph is `src/content/appGraph.ts`: `appGraph()` (eager edges added on first use), `tiers()` (engine), `rolesOf`, `structureLoaded`, `useGraphVersion`. Lazy chunks register through `registerSoftContent` (`softContentLoader.ts`); tests use it plus `resetSoftContent()` + `resetAppGraph()`.
- Joint names: `indexNode(joint)?.name`. Bone articulations: `appGraph().out(id, "articulates_with")` (meta `joint`); neighbouring teeth `neighbours(id, "adjacent_tooth")` (mesial first). `panel.ts` names them today (allowlisted); BD should move that into the bone kind's panel descriptor.
- The muscles chunk still ships `derived` (synergists, antagonists, attached: about 18.6 kB gzip) because `softPanel.ts` and `attachedTo` (now in `groups.ts`) read it. Once BD reads them off the graph (`synergist_of`, `antagonist_of`, inverse `origin of`/`insertion of` without meta `inherited`), `derived` can leave the chunk.
- Roles live in `src/systems/musculoskeletal/muscles/roles.ts` (`KindDescriptor.roles`); the chunk's `patches` field feeds them. `npm run content:patch-check -- --check` must stay "up to date".
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
