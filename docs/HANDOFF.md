# Handoff — written 2026-11-23 at the end of the M10 planning session

## Next session
**AK**: labels for every kind: kind-aware priorities, one label per unselected muscle, focus layer wins ties (plan step 1, decisions 1–2). Trigger: "begin session AK".
Done when: layout tests per kind (`tests/labels.test.ts`, M5 layout unchanged with every layer off); e2e: muscles on → one triceps label; triceps tier 1 → scapula and ulna labelled; part level → long head labelled, triceps not; label layout time with every layer on recorded.

## State
- M9 → M10 handover done: `m9` frozen at `ef6ee75` in `deploy/pages.json`, `current` 10; README M9 row frozen, M10 row "In progress"; `docs/PLAN-milestone-10.md` written (sessions AK–AR, decisions 1–9, budget table).
- `origin/main` (`ef6ee75`) merged into the session branch.
- `npm run check`: pass (no code changed).
- Open fan-out work: none (none planned for M10).

## Waiting on the user
- Plan decisions 1–9 in `docs/PLAN-milestone-10.md` (build as written unless changed); especially 7 (the AO gate deploys unfinished M10 to `/m10/` for the PC/iPhone bench; alternative in risk 4) and 9 (close the programme: freeze `m10`, `"current": null`).
- Still open, any time: a glance at `/m9/`; QUESTIONS 132–138 and `assets/build/REPORT-patches.md`; the per-browser `?bench` table (M5 step 12).

## Things the next session must know
- `src/ui/Labels.tsx` ranks with the bones' `relations.visibleAt`; use `relatedAt` (`src/scene/isolation.ts`) with the layer modes.
- Main-chunk budget for M10: +5 kB over M9's 468.1 kB (`index` + every modulepreloaded chunk, `gzip -9`).
- M10's questions start at **139**.
