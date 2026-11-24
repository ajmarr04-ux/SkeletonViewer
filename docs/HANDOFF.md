# Handoff — written 2026-11-24 at the end of M11 session AW

## Next session
**Wait for the user's checkpoint first:** they look at the grouped Layers panel (`docs/screenshots/m11-aw-layers-expanded.png`, `…-collapsed.png`, plan step 5) before AX.
Then AX (**design**): the registry isolation test and the fixture layer (plan step 6, decisions 7 and 8): `tests/registryIsolation.test.ts` + `tests/registry-allowlist.json` (milestone and reason per file, shrink-only), `tests/fixtures/systems/demo/` (system `demo`, layer `widgets`, code `w`, 3 kinds, 12 boxes, generated `.glb` per LOD), the test registry, the Vitest checks, `vite.config.ts` `--mode fixture` alias and `tests/e2e/fixture.spec.ts`.

## State
- Last commit: AW (panel code, tests, plan notes, screenshots, this handoff)
- `npm run check`: pass (39 files, 584 tests incl. goldens)
- e2e in AW: layers, keyboard, a11y, announce, 38 of 40 on the first run; both failures were in AW's new checks and are fixed; the re-run of those specs' affected tests passes 7 of 7 (plan step 5 notes)
- Main chunk 472.4 kB gzip -9 (budget 500.1)
- Open fan-out work: none

## Waiting on the user
The AW panel checkpoint (above).

## Things the next session must know
- Systems and presets: `SystemDescriptor.presets` (`PresetDescriptor`: `id`, `label`, `summary`, `modes`, `depth?`); registry `layersOfSystem`, `systemMode`, `PRESETS`, `presetOf`, `presetModes`, `presetDescriptor`. The fixture's `demo` system needs a `presets` array (can be empty) for the `PresetId` type to hold.
- The group control: `setSystemMode` → `setLayerSetting(next, system)` → store `layersVia` → `layersAnnouncement(…, via)`. Expanded state: `localStorage` `skeleton-viewer:systems` (`src/ui/systemGroups.ts`).
- `announce.ts` no longer names "bones"; its other wording tables are still on AU's M12 list.
- Content side of the registry: never import `src/systems/registry.content.ts` or the `content.ts` halves from runtime code (zod).
- Goldens: `npm run golden` compares; never `--write --force` without the user's approval.
