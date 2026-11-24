# Handoff — written 2026-11-24 at the end of M11 session AX

## Next session
AY (wrap-up, plan step 7): goldens unchanged, the parity table (bench, perf-load, main chunk against `317b445`), the full e2e in the background with a log, exit criteria ticked, then the `/m11/` PR to `main`, merge, Deploy and the freeze.
Done when: step 7's list is complete and the hosted `/m11/` copy is live.

## State
- Last commit: AX (isolation test, allowlist, fixture layer, plan step 6 notes, this handoff)
- `npm run check`: pass (41 files, 606 tests incl. goldens)
- e2e in AX: layers, layers-debug, smoke, announce, keyboard, fixture. **Result: see the line below** (the run was still going when this was first committed)
- Main chunk: not re-measured in AX (the code change in the main chunk is one line in `Viewer.tsx` and the registry split); AY measures it.
- Open fan-out work: none

## Waiting on the user
Nothing.

## Things the next session must know
- The registry's list is `src/systems/registered.ts`; `registry.ts` holds the lookups. `--mode fixture` swaps the list for `tests/fixtures/systems/registry.ts` (real layers + `widgets`), builds into `dist-fixture/`; Playwright runs two servers (app 4173, fixture 4175), so a full `npm run e2e` also builds the fixture (about 5 s).
- `tests/registryIsolation.test.ts` fails on any registry ID in `src/` or `scripts/` outside `src/systems/**`, including layer IDs as object keys and as `….layers.<id>` accesses. `tests/registry-allowlist.json` only shrinks (24 files: M12 17, M14 1, M15 6), with an `otherVocabulary` list for words that aren't IDs (the colour mode `"bone"`).
- The fixture re-runs `tests/colourVision.test.ts` with the fifth layer; that file's table sizes now count from `LAZY_LAYERS`.
- Regenerate the fixture's files with `npx tsx tests/fixtures/systems/demo/widgets/generate.ts` (deterministic).
- `CLAUDE.md`'s key-files table doesn't list `src/systems/` or the fixture yet: AY's STATUS/CLAUDE update.
- Goldens: `npm run golden` compares; never `--write --force` without the user's approval.
