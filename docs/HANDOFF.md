# Handoff — written 2026-11-21 at the end of M9-AJ

## Next session
**M9 → M10 handover and the M10 plan** (CLAUDE.md "Milestone handover"). Trigger: the user asks to begin M10 planning.
Done when: `m9` frozen in `deploy/pages.json` at `ef6ee75…`, `current` set to 10; README M9 row marked frozen; `docs/PLAN-milestone-10.md` written from `SPEC-musculoskeletal.md` §11 M10 ("Polish and measurement") with a Sessions table per `docs/WORKFLOW.md`.

## State
- M9's PR #21 merged to `main` as **`ef6ee75`** (freeze `m9` at this full SHA: `ef6ee75629dec7b254dd41ef583ecc749cdec739`); Deploy run 24 succeeded. Plan and README already say live.
- `npm run check`: pass (Vitest 528). E2E: full suite 153/156 with the 3 failures fixed in AJ (1 stale assertion, 2 timing), those specs 15/15; `interaction.spec.ts` 1/1.
- Main chunk (eager JS) M8 460.8 → M9 468.1 kB gzip -9 (+7.3, budget +10).
- Open fan-out work: none.

## Waiting on the user
- A glance at https://ajmarr04-ux.github.io/SkeletonViewer/m9/ (the deploy succeeded; the container can't load github.io).
- Still open, any time: QUESTIONS 132–138, `assets/build/REPORT-patches.md`, the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md`.

## Things the next session must know
- perf-load can't separate M8 and M9 on the muscles layer here (single runs range 7–12.6 s in both; the wait before the file request is native/SwiftShader time). M10's performance pass should measure it on a real device.
- Count modulepreloaded chunks when measuring the main chunk: M9's `index.html` preloads `names` and `softRegistry` as well as `index`, meshoptimizer and the runtime.
- M10's questions start at **139**.
