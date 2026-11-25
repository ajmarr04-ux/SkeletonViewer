# Handoff — written 2026-11-25 at the end of M11 session AY

## Next session
M12 planning (`SPEC-platform.md` §11, M12: relationship graph, tier rules as data, descriptor-driven panels, tree builders, announcement wording). Start with `CLAUDE.md`'s milestone handover: `m11` is already frozen at `a2709f6`, so only set `current` to 12, confirm `/m11/` is live (ask the user), tick "Hosted copy is live" in `docs/PLAN-milestone-11.md`, then write `docs/PLAN-milestone-12.md`.

## State
- M11 merged to `main` as `a2709f6` ([PR #25](https://github.com/ajmarr04-ux/SkeletonViewer/pull/25)); the freeze (`m11`, `"current": null`) goes in a follow-up PR from this branch.
- `npm run check`: pass (41 files, 606 tests incl. goldens). Full e2e: 173 of 173 (36.7 min).
- Parity against `317b445` (step 7's table): bench and perf-load the same within noise; main chunk 472.3 kB (+2.3; budget 500.1).
- Open fan-out work: none

## Waiting on the user
- A glance at https://ajmarr04-ux.github.io/SkeletonViewer/m11/ (plan checkpoint "after AY").

## Things the next session must know
- The registry allowlist (`tests/registry-allowlist.json`) names 17 files for M12: that list is M12's work queue, and each file removed must leave the goldens unchanged.
- Goldens: `npm run golden` compares; never `--write --force` without the user's approval. When M12 moves a function, change `tests/golden/harness.ts`'s import, never the snapshot.
- `npm run bench-container [runs] [dist dir]` takes the dist dir **relative** to the working directory (it joins it onto cwd).
- QUESTIONS: 1–139, the next is 140.
