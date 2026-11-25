# Handoff — written 2026-11-25 at the end of M12 BJ

## Next session
M13 planning (design): milestone handover (`CLAUDE.md`), then `docs/PLAN-milestone-13.md` from `SPEC-platform.md` §11, M13 (`located_in` edges and regions). Set `"current": 13` in `deploy/pages.json`.
Before that: the user confirms https://ajmarr04-ux.github.io/SkeletonViewer/m12/ is live; tick "Hosted copy is live" in `docs/PLAN-milestone-12.md`.

## State
- M12 merged to `main` as #27 (`3d8adef`); `m12` frozen at it, `"current": null` (follow-up PR).
- `npm run check`: pass (658 tests, the five goldens unchanged). Full e2e: 171/174 in one 45-minute run; the 3 load timeouts (`keyboard.spec.ts:191`, `:242`, `nested.spec.ts:34`) pass alone.
- Open fan-out work: none

## Waiting on the user
- A glance at `/m12/`.

## Things the next session must know
- BJ fixed a bare JSON import in `bones/panel.ts` that made Playwright collect 0 tests (see `CLAUDE.md` environment notes): JSON imports the registry reaches need `with { type: "json" }`.
- Parity table, main chunk (486.1 kB `gzip -9`) and chunk sizes: plan step 11.
- Allowlist: 7 entries left (M14 ×1, M15 ×6). Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
