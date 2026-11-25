# Handoff — written 2026-11-25 at the end of M12 planning

## Next session
AZ (design): commit `tests/golden/tree.json` first (decision 9), then the graph core: edge types, the edge compiler from the authoring files, derived edges (incl. `adjacent_tooth`, `shares_joint_with`), compiler checks; delete `src/content/derive.ts`.
Done when: tree golden committed before any `src/`/`scripts/` change; the compiled graph reproduces today's derived synergists, antagonists and attached muscles for every muscle and part; isolation test also scans edge type IDs; `npm run check` green.

## State
- Planning commit on `claude/keen-clarke-32a10a`: `deploy/pages.json` `current` 12; M11 "Hosted copy is live" ticked; README M12 row; `docs/PLAN-milestone-12.md` written.
- `npm run check`: not re-run (docs and `deploy/pages.json` only changed).
- Open fan-out work: none

## Waiting on the user
- Decisions 1–14 in `docs/PLAN-milestone-12.md` (say if any should change). Notable: two extra derived edge types (decision 2), the ID index in the main chunk (~+11 kB, decision 7), the sidebar's system grouping deferred to M14 (decision 10), Origin/Insertion as the two allowed `custom` panel sections (decision 11).

## Things the next session must know
- Order is behaviour: soft tier lists are ID-sorted, bone partners in `ids.json` order, region neighbours as written (decision 5).
- Goldens: never `--write --force` without the user's approval; `--write` for the new `tree.json` only.
- Shipping invariant (decision 3): a structure's panel and tiers need the main chunk, its own layer's chunk and the showing layers' chunks, nothing else.
- QUESTIONS: 1–139, the next is 140.
