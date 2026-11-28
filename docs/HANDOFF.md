# Handoff — written 2026-11-28 at the end of M14 BZ

## Next session
CA (design): pattern scale and motion, from the device runs. Make the period 3× (6 → 18 CSS px), and stop the pattern "swimming" when the camera zooms or pans, with **surface-locked marks (the user chose option (b))**: laid out on the surface in world space (triplanar), so they stick to the structure through pan, zoom and orbit; anti-aliased and clamped when small; the legend shows the pattern's look, not its exact size.
Done when: `tints` e2e and the pattern unit tests pass; the legend swatch and the screenshot key still show the same marks as the shader; main chunk measured; the user checks it on a device (the `/m14/` copy updates only on a merge to `main`, so ask before merging).
Then CB: the wrap-up (was CA).

## State
- Last commit: M14 BZ: device gate closed
- `main` = PR #30 (`ab33337`), M14 up to BZ, deployed to `/m14/` (not frozen; CB freezes at its own merge)
- `npm run check`: pass (818 tests, 1 skipped)
- Open fan-out work: none

## Waiting on the user
Nothing before CA. (Device gate closed: the iPhone's 30 fps was Low Power Mode, confirmed; no LOD pop seen.)

## Things the next session must know
- The pattern is screen space: `gl_FragCoord / uPatternPeriod` in `PATTERN_FRAGMENT` (`src/scene/patterns.ts`); the period is one shared uniform set from the dpr. The legend (`patternPath`) and screenshot (`patternCells`) rasterise the same rule, so any change has to keep them in step.
- Kill stale `vite preview` servers before a Playwright run (`pkill -f "vite preview"`).
- Main chunk 493,813 B (budget 500.1 kB, 6.3 kB left). Measure: index + modulepreloads, `gzip -9`.
