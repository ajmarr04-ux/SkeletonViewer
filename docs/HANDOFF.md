# Handoff — written 2026-11-25 at the end of M13 planning

## Next session
BK (design): the region list and its volumes, resolved from anchor bones, plus the `?debug&regions` view (`docs/PLAN-milestone-13.md` step 1, decisions 1–3).
Done when: `content/regions/regions.json`, `scripts/regions/volumes.ts`, `assets/build/region-volumes.json` and the debug view are committed; front, side and back screenshots are in `docs/screenshots/m13/`; the final list is written into decision 1. **BK ends at a gate: the user approves the list before BL starts.**

## State
- Planning: `/m12/` confirmed live by the user (ticked in the M12 plan); `deploy/pages.json` `"current": 13`; README M13 row; `CLAUDE.md` status line; `docs/PLAN-milestone-13.md` written (sessions BK–BR).
- `npm run check`: pass (no code changed).
- Open fan-out work: none

## Waiting on the user
- Optional: any objection to plan decisions 1–12 (in particular 2: anchors instead of typed coordinates, and the `content/regions/` folder beside the old `content/regions.json`; 3: the new control is called "Body region"; 12: `[` / `]` in M13).

## Things the next session must know
- "Region" already means bone tier 2 (`content/regions.json`, `region_neighbour`, "Expand region", reducer action `region`) and colour-by-region (`regionColours.ts`). Keep the new code in `src/regions/`, `scripts/regions/`, `src/systems/regions.ts`.
- Volumes must come from anchor bones' vertices (`public/models/skeleton-high.glb`, decoded like `scripts/check-models.ts`); a literal box needs a reason and a QUESTIONS entry (next is 140).
- Real triangle totals: all four layers 1,499,634 high / 449,623 low, against budgets of 1.5M / 450k, so the governor never triggers on today's content (decision 10: patches aren't counted).
- Main chunk 486.1 kB of a 500.1 kB budget; eager `located_in` data must fit (decision 5).
- Goldens: never `--write --force` without the user's approval; `regions.json` is new in BL.
