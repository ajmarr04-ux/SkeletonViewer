# Handoff — written 2026-11-24 at the end of M11 session AU

## Next session
AV (routine): build-side and content-side tables driven by the registry (plan step 4's list: `schemaForKind`, `CARTILAGE_KINDS`, `LAYER_FOLDERS`, `SOFT_BODY_WORDS` into per-layer `content.ts` halves and `registry.content.ts`; `SOFT_LAYERS` and the per-layer virtual modules in `scripts/lib/content-files.ts` / `content-plugin.ts`; the `importers` map → generated `virtual:skeleton-layer-importers`; `scripts/lib/soft-ids-plugin.ts`; `SOFT_LAYERS`/`LAYER_BUDGETS` in `scripts/lib/model-checks.ts`; the `vite-env.d.ts` module declarations).
Done when: step 4's list is deleted; `npm run check-models`, `validate-content` and `npm run content` print the same as before (diff them in the notes); goldens unchanged; `npm run check` green.

## State
- Last commit: AU (code and plan notes, then this handoff)
- `npm run check`: pass (39 files, 575 tests incl. goldens and `tests/registry.test.ts`)
- e2e run in AU: announce, labels-layers, nested, layers, layers-debug, tints, smoke, interaction, keyboard, attached, tiers, soft-sidebar: 68 of 69 pass; `keyboard.spec.ts:232` (M9 journey by keys) hit its 420 s timeout in the full run (SwiftShader about 1 FPS), re-run alone pending
- Open fan-out work: none

## Waiting on the user
None.

## Things the next session must know
- Registry API (`src/systems/registry.ts`): layers as in AT, plus kinds: types `KindId`, `EagerKind`, `SoftKind`, `PartType` (derived from the descriptors' literals); `kindDescriptor`, `kindNoun`, `countKind`, `COUNT_ORDER`, `LABEL_ORDER`, `NESTED_LAYER`, `maxPartsOf`, `PART_TYPES`, `isTendinousType`. `softIds.ts` re-exports `SoftKind`/`PartType`.
- `KindDescriptor` now has `noun`, `labelPriority`, `parentOf.maxParts`, `partTypes`. Still not added (no reader yet): `schema`, `bodyWords` (AV, in the `content.ts` halves so zod stays out of the main chunk), `tiers`, `panel`, `searchFields` (M12, M14).
- `softSchema.ts`' `PART_TYPES` already reads the registry; `CARTILAGE_KINDS` and the rest are AV's.
- Left on purpose for M12 (wording/rules): `counted(…, "muscle")`, `bone: 0` and the part → `"muscle"` fallback in `announce.ts`; per-kind tier rules in `softTiers.ts`; `KIND_LABELS` (`softPanel.ts`); `layer: "muscles"` on the synonym sets (`groups.ts`). For AW: presets (`selection.ts`, `LayersPanel.tsx`, `presetOfModes` + "Skeleton: bones only.").
- Main chunk 471.4 kB (+1.3 on the 470.1 baseline, budget 500.1). The shared chunk is now named `registry-*.js`.
- Goldens: `npm run golden` compares; never `--write --force` without the user's approval.
