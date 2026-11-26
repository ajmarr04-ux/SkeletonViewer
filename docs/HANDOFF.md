# Handoff — written 2026-11-26 at the end of M13 session BQ

## Next session
BR (routine): the M13 wrap-up (`docs/PLAN-milestone-13.md` step 8): goldens, the parity table against M12 (`3d8adef`), full e2e in the background, `CLAUDE.md` key files and `STATUS.md` "How regions work", then the PR to `main`, the Deploy run and freezing `m13`.
Done when: the exit criteria are ticked and `/m13/` is live.

## State
- Last commit: see `git log` (M13 BQ: Tab cursor in regions, `[` / `]`, label thinning)
- `npm run check`: pass (763 tests; the six goldens unchanged)
- e2e this session: see the BQ notes in the plan (keyboard + sidebar + polish + labels-layers + regions)
- Open fan-out work: none

## Waiting on the user
Nothing blocking. BR's PR merge and the `/m13/` check need the user.

## Things the next session must know
- Label layout times for the parity table: `LABELS=1 npm run bench-container 3` (after `npx vite build`) prints them for bones only, all layers and all layers in `reg=thorax`; BQ's figures are in the plan notes (N = 60). For the M12 side, `labelmax=` doesn't exist there; run without `LABELMAX`.
- `bench-container` with three links and labels takes over 10 minutes: run it in the background.
- Thinning applies only with a region in focus or a second layer drawn; bones-only whole-body labels are exactly M12's.
- In e2e, Auto plans low (SwiftShader); `tests/e2e/budget.spec.ts`'s `capableGpu` init script makes it plan high.
- Main chunk **490.4 kB** `gzip -9` (budget 500.1). Lazy chunks must not import the app's own modules (BN's lesson).
- Goldens: never `--write --force` without the user's approval.
