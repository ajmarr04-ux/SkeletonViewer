# Handoff — written 2026-11-24 at the end of M10 session AR

## Next session
**None planned: the programme (M1–M10) is closed.** `/m10/` is deployed, and `deploy/pages.json` freezes `m1`–`m10` with `"current": null`. The live site keeps following `main`.

If the user wants more work, these are the open items. Each could be its own session:
- **Real-device gate** (M10's skipped AO and AP): layer load ("low shown N s after turned on" with `?debug`), soft click → highlight, the muscle tier 2 bench with antagonists. The steps are in `docs/PLAN-milestone-10.md` (steps 5–6) and the empty budget table. Fallbacks (decision 7) only if something misses.
- **Content review:** `content/QUESTIONS.md` 1–139 (the next is 140), `assets/build/REPORT-patches.md` (QUESTIONS 132–134).
- **Browser table:** the per-browser `?bench` table in `docs/PLAN-milestone-5.md` step 12.
- **VoiceOver pass** on the iPhone (optional).
- **A new phase** (the full-body look in `STATUS-M10.md`). It would need a new spec section and plan, and `current` set again in `deploy/pages.json`.

## State
- AR: full e2e 166/170 under load, and the 3 failures pass alone (`nested` 3/3, `keyboard` 5/5). `npm run check` passes. Main chunk 470.1 kB (+2.1 over M9, +19.1 over M5). `perf-load` matches M9 within noise. Notes are under "Session AR notes" in the M10 plan.
- #23 merged as `317b445`. Deploy run 28 for it built `/m10/`. The user should glance at https://ajmarr04-ux.github.io/SkeletonViewer/m10/, since the container can't load `github.io`.
- The freeze commit (`m10`, `"current": null`, README, `CLAUDE.md`, this file) goes to `main` through its own PR.

## Things the next session must know
- `docs/WORKFLOW.md` was replaced by the user with `docs/WORKFLOW_NEW.md`; `CLAUDE.md` now points there.
- The full e2e takes about 25 min on a quiet machine and about 50 min if anything else runs beside it. Don't build in parallel with it.
