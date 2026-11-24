# Handoff — written 2026-11-24 at the end of M11 session AS

## Next session
AT (design): descriptor types, `src/systems/registry.ts` and the four layer descriptors (bones, cartilage, ligaments, muscles); the layer-identity tables in step 2's list moved onto them.
Done when: step 2's tables are deleted, the goldens are unchanged, and `npm run check` is green.

## State
- Last commit: AS (goldens `58d1e72`, then the baseline notes, `bench-container` and this handoff)
- `npm run check`: pass (38 files, 567 tests including `tests/golden.test.ts`; check-models, validate-content, migrate-attachments OK)
- Open fan-out work: none (M11 plans no subagents)

## Waiting on the user
None needed before AT. Decisions 1–8 in `docs/PLAN-milestone-11.md` still stand unless the user changes them.

## Things the next session must know
- Goldens: `npm run golden` compares; never `--write --force` without the user's approval of the difference. If AT moves a function the harness imports (`tests/golden/harness.ts`), change the import, not the snapshot.
- The URL golden runs the real `initSelectionFromUrl` in Vitest with a stubbed `window` (no extraction was needed). It records some M10 quirks on purpose (step 1 notes): don't "fix" them in M11.
- Baseline (step 1 table): main chunk 470.1 kB (budget ≤ 500.1); bench bones 1 draw call / 499,981 tris, all layers 4 / 1,499,634. AY re-runs `npm run bench-container` and `perf-load` in the same container for parity.
- `LayerId` must stay a TS union derived from the registry (decision 3); URL codes `b c l m` and `formatLayers` output must match `urls.json`'s `serialised` byte for byte.
