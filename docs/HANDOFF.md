# Handoff — written 2026-11-20 at the end of the M8 close-out / M9 planning session

## Next session
**M9-AE: nested muscle → part selection** (`docs/PLAN-milestone-9.md`, step 1; decisions 1 and 2). Trigger: "begin session AE".
Done when: `resolveClick` and the reducer's part level are unit-tested for every spec §5.1 rule; the breadcrumb shows the part crumb; e2e covers muscles on → click triceps → click long head → Esc → Esc (and browser Back); `npm run check` passes.

## State
- Last commit: M8 close-out and M9 plan, on `claude/keen-clarke-32a10a` (fast-forwarded to `main` at `0833b48` first).
- `/m8/` live: Deploy run 23 for `0833b48` succeeded. `m8` frozen at `0833b48`; `deploy/pages.json` `current: 9`.
- `npm run check`: pass. No `src/` changes this session, so no e2e run.
- Open fan-out work: none. M9 plans none except the `verifier` run in AJ.

## Waiting on the user
- A look at M9's plan decisions, especially 3 (isolation draws structures from Off layers without turning them on), 6 (patches drawn only where they agree with the content; whole-bone tint otherwise) and 12 (no subagent fan-out for synonyms). Sessions build them as written unless told otherwise.
- Still open from earlier: the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md` (1–131).

## Things the next session must know
- The reducer (`src/state/isolation.ts`) is pure and must stay so: pass `parentOf` in; don't import the soft registry.
- M7 decision 12 (selecting a soft structure turns its layer On) stays for direct selection; M9 decision 3 (tier sets draw from Off layers without changing the panel) is session AF's, not AE's.
- `NEW_KIND_TIERS_REASON` (`src/state/selection.ts`) still disables tiers for soft kinds until AF.
- M9's QUESTIONS start at 132.
