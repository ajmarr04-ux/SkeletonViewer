# Handoff — written 2026-11-24 at the end of M10 session AN

## Next session
**AO**: performance measurement in the container and the tools for the user's run (plan step 5, decision 7). **It ends with the user gate**: AO's branch goes to `main` through a PR so `/m10/` has the build; the user runs the three bench links and `?debug&layers=b:on,c:on,l:on,m:on` on PC and iPhone and pastes the overlays.
Done when: the budget table is filled for everything the container can measure (triangle budget Vitest test on the manifests, draw calls < 20 with every layer on + muscle tier 2 + antagonists + patches + outlines, click → highlight for a muscle, a part and a ligament, the network floor for layer load), the bench links are ready, and `main` is deployed for the user's run. Trigger: "begin session AO".

## State
- AM done (its 81-test e2e run passed after it closed). AN done: `R`/`E` tier keys and `Shift+X` (Show all) in `keyAction`; `X` hides the Tab cursor's structure (`hideStructure`, `src/state/selection.ts`; the selection stays unless it is the one hidden; the next Tab continues after it); `cursorStops` (`src/camera/input.ts`) makes a muscle one stop until it or a part is selected, then its parts; soft stops in the panel's layer order. `aria-keyshortcuts` on the tier buttons and the chip. Notes under step 4 of `docs/PLAN-milestone-10.md`.
- `npm run check`: pass. Vitest 561 pass. E2E: `keyboard`, `a11y` pass; `joints`, `layers`, `select`, `sidebar`, `soft-sidebar`, `viewer`, `announce` re-run: 75 pass.
- Main chunk 470.4 kB (+2.3 over M9; budget +5).
- Open fan-out work: none.

## Waiting on the user
- QUESTIONS 139 (AL's colours and the region pause). Nothing blocks AO until its own gate.
- Optional: a VoiceOver pass on the iPhone (decision 5 offers it as a hand check, not a gate).
- Still open, any time: a glance at `/m9/`; QUESTIONS 132–138 and `assets/build/REPORT-patches.md`; the per-browser `?bench` table (M5 step 12).

## Things the next session must know
- The keyboard journey takes about 4 minutes in the container (muscles load under SwiftShader); its limit is 7. Tests that load the muscles need generous timeouts.
- `STATUS.md` (AQ) must list AL's colour changes and region pause, AM's announcement table, and AN's new keys (`R`, `E`, `Shift+X`, `X` on the cursor).
- M10's next question is **140**.
