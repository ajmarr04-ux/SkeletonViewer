# Handoff — written 2026-11-28, M14 BW (stopped for the user)

## Next session
Finish BW once the user answers: write `tests/fixtures/future-colours.json` (ids arteries, veins, nerves, lymph_nodes, organs; `label`, `seed`, `material`, `nearest` per vision) and move `docs/batches/BW/futureColours.test.ts.txt` to `tests/futureColours.test.ts`; record the table in the plan; tick BW. Then BX.

## Waiting on the user (see the plan's BW notes)
1. The future colours: no set near the textbook hues passes the shipped pair rule in any order. Without region colours in the rule a set passes (veins `#1450af`, nerves `#dc9600`, organs `#bea5a5`, arteries `#734164`, lymph `#afb4c8`). Which rule, and are those hues acceptable?
2. For BY: the current layers' dimmed colours (40 %) fail five pairs (ligaments against dimmed bone/cartilage, dimmed cartilage against hover, protanopia dimmed muscle against a bone ghost).

## State
- Last commit: M14 BW: tendon shade in the muscles descriptor, colour-vision pairs from the registry (`27f5654`); this handoff after it.
- `npx tsc --noEmit` clean; `npx vitest run` 792 passed, 1 skipped. `npm run check`: pass.

## Things the next session must know
- `tests/lib/colourTable.ts` is the one pair rule (`colourTable`, `pairsOf`, `lowPairs`, `dim`); `dimmed: true` adds the dimmed rows (BY turns it on in `colourVision.test.ts` and moves `dim` into `src/`).
- The search harness (`docs/batches/BW/search-future-colours.test.ts.txt`) runs as a Vitest file under `tests/` (env `ORDERS=all|[[...]]`, `R` radius, `NOREGION=1`, `OUT`, `BLOCK`/`BYVAR` for blocker tallies; it writes to a hard-coded scratchpad path — change it). About 15 min for all 120 orders.
