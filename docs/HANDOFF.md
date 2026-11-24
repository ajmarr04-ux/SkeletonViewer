# Handoff — written 2026-11-24 at the end of M10 session AL

## Next session
**AM**: screen-reader announcements for the new kinds, layers, depth, Hide and the part level (plan step 3, decision 4).
Done when: every row of decision 4's table is a tested pure function (next to `softAnnouncement`) and is read from the live region in e2e, including a selection that turns a layer on (one folded message, risk 3). Trigger: "begin session AM".

## State
- AL done: `tests/colourVision.test.ts` (replaces `tests/layerColours.test.ts`) checks every on-screen colour pair, legend swatches (3:1) and label boxes (4.5:1). Four layer colours changed (muscles `#b44d43`, tendon `#c18274`, ligaments `#cccccc`, cartilage `#c5dfee`); colour-by-region pauses while tints or patches are drawn (`drawnColourMode`, `src/scene/isolation.ts`; legend note `legend-paused`). `SCENE_BACKGROUND` now in `src/scene/material.ts`. Notes under step 2 of `docs/PLAN-milestone-10.md`.
- `npm run check`: pass. Vitest 532 pass. E2E: `tints` (incl. the new region-pause test), `polish`, `interaction`, `a11y`, `layers`, `labels-layers` (51) pass.
- Main chunk 468.5 kB (+0.4 over M9; budget +5).
- Open fan-out work: none.

## Waiting on the user
- QUESTIONS 139 (the new colours and the region pause; whether a tritanopia check is wanted). Nothing blocks AM.
- Still open, any time: a glance at `/m9/`; QUESTIONS 132–138 and `assets/build/REPORT-patches.md`; the per-browser `?bench` table (M5 step 12).

## Things the next session must know
- The plan's claim that M9 checked tritanopia was wrong (corrected in AL's notes); there is no tritanopia matrix in `regionColours.ts`.
- `?debug`'s `data-colour` now reports the colour drawn (`bone` while region colours are paused), not the store's `colourMode`.
- `STATUS.md` must list AL's colour changes and the region pause (AQ, decision 8).
- M10's next question is **140**.
