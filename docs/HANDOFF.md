# Handoff — written 2026-11-28 at the end of M14 BW

## Next session
BX (design): pattern cue for the role tints (plan step 6, decision 8). Done when: `tints` e2e and screenshot tests pass; pattern unit tests; main chunk measured; tint-against-layer pairs relaxed to ≥ 8 in `tests/lib/colourTable.ts`'s `STRONG`.

## State
- Last commit: M14 BW: future colours table, per-layer dimming amounts
- `npm run check`: pass (797 tests, 1 skipped)
- Open fan-out work: none

## Waiting on the user
Nothing. The future colours are accepted "for now" (to revisit); dimming amounts were left to legibility (decision 9 updated).

## Things the next session must know
- `tests/lib/colourTable.ts` is the one pair rule (`colourTable`, `pairsOf`, `lowPairs`, `dim`, `EXEMPT`, `STRONG`); `colourVision.test.ts` and `futureColours.test.ts` both use it.
- `ColourSpec` has `shades` (part types name one: `shade: "tendon"`), `dim` (muscles 0.35 only; BY draws it and moves `dim()` into `src/`), `neverWith` (unused).
- The future test pauses region colours against future layers (the accepted rule).
- The future-colour search harness: `docs/batches/BW/search-future-colours.test.ts.txt`.
