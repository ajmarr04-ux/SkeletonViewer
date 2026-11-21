# Handoff — written 2026-11-21 at the end of M9-AI

## Next session
**M9-AJ: wrap-up** (`docs/PLAN-milestone-9.md`, step 6). Trigger: "begin session AJ".
Done when: the spec's journey test (`tests/e2e/interaction.spec.ts`: full skeleton → muscles on → triceps → long head → Show attachments (scapula + ulna tinted) → Show functional group → Back ×4 → full view); the full e2e suite through `verifier`; main chunk vs M8 measured properly; lazy chunk sizes; `npm run perf-load` vs M8; exit criteria ticked; PR to `main`, merge, deploy, `/m9/` confirmed, README row and plan updated.

## State
- Last commit: M9-AI (sidebar roots, soft groups, soft search and synonyms) on `claude/keen-clarke-32a10a`.
- `npm run check`: pass. Vitest 528 tests. E2E: `soft-sidebar.spec.ts` (new, 5/5) plus the touched specs, see the plan's AI notes.
- Main chunk 300.28 kB gzipped (AH 298.98): about +8.2 kB over M8 (292.1), budget +10, so AJ has ~1.8 kB left. Soft tree chunk 12.2 kB, soft search 37.0 kB gzipped.
- Open fan-out work: none (the synonyms were written in-session; reasons in the notes).

## Waiting on the user (none blocks AJ)
- QUESTIONS 135–138 (group synonym sets, the synonym list, how the tree is cut, four truncated meniscotibial names), any time.
- The patch report, `assets/build/REPORT-patches.md` (QUESTIONS 132–134).
- Still open from earlier: the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md`.

## Things the next session must know
- `isolateGroup` and `selectAndFrame` are async now (they load the soft tree / soft table first when needed); for known IDs and keys they still act synchronously.
- Soft group keys: `muscles.<path>`, `ligaments.<joint>[.<pair>]`, `cartilage.<kind>[.<joint>]`, `muscles.sets.*`; unknown until the soft tree chunk registers (`registerSoftTree`).
- Measure the main chunk against M8 by the same method in AJ (Vite's gzip figure for `index-*.js`, and check no shared chunk was split off that the main chunk loads eagerly: AI hit that once via a runtime import from `search.ts`).
- M9's QUESTIONS continue at **139**.
