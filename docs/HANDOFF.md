# Handoff — written 2026-11-24 at the end of M10 session AM

## Next session
**AN**: keyboard pass for the new kinds (plan step 4, decision 5): the spec's M9 journey by keys only in `keyboard.spec.ts`, `tabCursor` across layers and parts, `X`/"Show all" from the cursor, axe on every new state; fix what can't be done.
Done when: the journey passes in `keyboard.spec.ts`, `tabCursor` is tested across layers and the part level, and gaps are fixed. Trigger: "begin session AN".

## State
- AM done: every live-region message is built in `src/content/announce.ts` (pure, tested in `tests/announce.test.ts`) and composed per user action by `composeAnnouncement`, driven from the store in `src/ui/Announcer.tsx` (changes made in one task are folded after a microtask). The Layers panel and `LayerScenes` no longer call `say`. Final wording table and departures: step 3 notes in `docs/PLAN-milestone-10.md`.
- New store field `hushed`/`hush()`: `selectSoftFromUrl` and `softGroupFromUrl` hush their changes so nothing is said on page load.
- Fixed: going from a bone to its own "Show attached muscles" said "Back to …".
- `npm run check`: pass. Vitest 557 pass. E2E: see the session's commit message for the run (`announce` (4, new), `layers`, `related`, `sidebar`, `panel`, `attached`, `joints`, `tiers`, `nested`, `soft-sidebar`, `keyboard`, `polish`).
- Main chunk 470.0 kB (+1.9 over M9; budget +5).
- Open fan-out work: none.

## Waiting on the user
- QUESTIONS 139 (AL's colours and the region pause). Nothing blocks AN.
- Still open, any time: a glance at `/m9/`; QUESTIONS 132–138 and `assets/build/REPORT-patches.md`; the per-browser `?bench` table (M5 step 12).

## Things the next session must know
- An explicit `say()` in the same task as an isolation change replaces the isolation message (Hide relies on it); a layer change in that task is still folded in after it.
- The joint/row highlight still sets the live region directly (its own effect in `Announcer.tsx`); in e2e, a pointer left over a panel row after a click can overwrite the last message. `tests/e2e/announce.spec.ts` records every text (`window.__said`) for that reason; reuse its `open`/`mark` helpers.
- `STATUS.md` must list AL's colour changes and the region pause, and AM's announcement table (AQ, decision 8).
- M10's next question is **140** (AM added none).
