# Handoff — written 2026-11-20 at the end of M8-AD

## Next session
M8 close-out (short): once the M8 PR is merged and deployed, confirm `/m8/` is live, tick "Hosted copy is live" in `docs/PLAN-milestone-8.md`, and mark the M8 row in `README.md` as live. Then the M9 handover (CLAUDE.md "Milestone handover": freeze `m8` at the merge commit, `current: 9`, write `docs/PLAN-milestone-9.md`).
Done when: `/m8/` confirmed live by the user; M9 plan written.

## State
- Last commit: see `git log` (M8-AD: notes and handoff), on `claude/keen-clarke-32a10a`
- `npm run check`: pass (strict `validate-content`, migration two-way check)
- Full e2e: 133/133 pass. Main chunk +0.3 kB gzipped over M7. perf-load same as M7.
- Open fan-out work: none

## Waiting on the user
Merge the M8 PR to `main`, then say whether https://ajmarr04-ux.github.io/SkeletonViewer/m8/ is live.

## Things the next session must know
- `muscleAttachments` is gone; `validate-content` rejects it. `content/attachment-migration.json` is frozen (the script only checks it now).
- Bone panel muscle lists come from `boneMuscleLists` (`src/content/compile.ts`), computed at build time from the muscle files.
- QUESTIONS 70 answered: the six source-less muscles were dropped.
- The muscles-layer load time misses its budget under perf-load in M7 and M8 alike (software GPU); the real-device number is still open from M7.
