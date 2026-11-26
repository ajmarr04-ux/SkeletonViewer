# Handoff — written 2026-11-26 at the end of M13 session BP

## Next session
BQ (routine): keyboard cursor and label thinning scoped by body region, plus `[` / `]` to jump between layers (`docs/PLAN-milestone-13.md` step 7, decision 12).
Done when: `keyboard`, `sidebar`, `polish` and `labels-layers` e2e pass; new region cases in `regions.spec.ts`; *N* and the label layout times recorded in the plan notes; `npm run check` green.

## State
- Last commit: see `git log` (M13 BP: budget governor)
- `npm run check`: pass (756 tests; the six goldens unchanged)
- e2e this session: `budget` 6/6 (new), `fixture` 6/6 (one new); smoke + viewer + layers + regions + a11y + tints + budget 82/82
- Open fan-out work: none

## Waiting on the user
Nothing blocking.

## Things the next session must know
- Held layers (the phone start) are drawn as Off through `viewOf` (`drawnModes`); anything BQ builds on `viewOf` (cursor stops, label candidates) gets that for free. Read layers through `viewOf`, not `s.layers`, when it means "drawn".
- The governor's estimate is `viewTotals` (`src/state/budget.ts`): index totals per layer for the region, ignoring `hid=` and the depth peel (on purpose).
- In e2e, Auto plans low (SwiftShader); `tests/e2e/budget.spec.ts`'s `capableGpu` init script makes it plan high.
- Main chunk **490.4 kB** `gzip -9` (budget 500.1). Lazy chunks must not import the app's own modules (BN's lesson).
- Goldens: never `--write --force` without the user's approval.
