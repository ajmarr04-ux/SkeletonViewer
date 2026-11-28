# Handoff — written 2026-11-28 at the end of M14 BX

## Next session
BY (routine): context dimming of other layers in the related set (plan step 7, decision 9 as updated in BW).
Done when: dimming unit and e2e tests; colour-vision test covers the dimmed colours; `tints`, `tiers`, `layers` e2e pass.

## State
- Last commit: M14 BX: pattern cue for the role tints
- `npm run check`: pass (807 tests, 1 skipped)
- Open fan-out work: none

## Waiting on the user
Nothing.

## Things the next session must know
- **Every instance-colour write goes through `paint(batch, i, colour, pattern)`** (`src/scene/isolation.ts`): the pattern index is in the colour's alpha (`src/scene/patterns.ts`), and a plain `setColorAt(i, Color)` keeps the old alpha. BY's dimmed colour must be written with `paint(…, "none")` (tinted structures are never dimmed, so they keep their pattern).
- `ColourSpec.dim` is per layer (muscles 0.35 only); `tests/lib/colourTable.ts`'s `dim()` is the test's copy, which BY moves into `src/`.
- `STRONG` now holds only tint/tint and tint/accent pairs; tint against layer is ≥ 8 (BX).
- Main chunk 493,543 B after BX (budget 500.1 kB, 6.6 kB left). Measure: index + modulepreloads, `gzip -9`.
- `tints.spec.ts`'s `shadeJumps` helper finds an uncovered point on a structure and measures neighbour shade jumps; reusable for BY's "less saturated" e2e.
