# Handoff — written 2026-11-24 at the end of M11 session AT

## Next session
AU (routine): the kind tables in the runtime moved onto `KindDescriptor`s (plan step 3's list: `SoftKind`, `PartType`, `isTendinous`, `isMuscleKind`, the bone kind union, `layerOfKind`, `groupLayer`, `focusLayerOf` and label priorities, `NOUNS`/`ORDER`, `MAX_PARTS`/part level, cursor stops, `muscleDepth*.ts`).
Done when: step 3's list is deleted, the goldens are unchanged, `announce.test.ts` wording unchanged, and `npm run check` is green.

## State
- Last commit: AT (`683c4c4` code and plan notes, then this handoff)
- `npm run check`: pass (39 files, 574 tests incl. goldens and the new `tests/registry.test.ts`)
- e2e run in AT: layers, layers-debug, smoke, polish, tints, nested, announce, labels-layers, interaction (61 pass)
- Open fan-out work: none

## Waiting on the user
None.

## Things the next session must know
- Registry API: `src/systems/registry.ts` (`LAYER_IDS`, `LAZY_LAYERS`, `EAGER_LAYER`, `DEPTH_LAYER`, `layerOfKind`, `hasNestedParts`, `layerLabel`, `layerColour`, …). Types `LayerId` / `LazyLayerId` are derived from the descriptors; `TissueLayer` is gone.
- Kinds today carry only `id` (+ `parentOf` on `muscle`). AU adds `noun` and `labelPriority` to `KindDescriptor` and the four `layer.ts` files, and deletes the tables in the same commit.
- Left on purpose for AW: the presets in `selection.ts` / `LayersPanel.tsx` and `presetOfModes` + "Skeleton: bones only." in `announce.ts`. For AV: `SOFT_LAYERS`/budgets in `model-checks.ts`, soft-content `importers`, `registry.content.ts`.
- Main chunk 471.2 kB (+1.0 on the baseline); the registry sits in a shared chunk Rolldown names `model-checks-*.js`.
- Goldens: `npm run golden` compares; never `--write --force` without the user's approval.
