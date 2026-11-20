# Handoff — written 2026-11-20 at the end of M9-AF

## Next session
**M9-AG: origins, insertions, antagonists** (`docs/PLAN-milestone-9.md`, step 3; decisions 6–8). Trigger: "begin session AG".
Done when: the attachments batch loads lazily at muscle tier 1 and 2; the content-wins agreement rule and `npm run content:patch-check` → `assets/build/REPORT-patches.md`; whole-bone fallback tint; antagonist toggle (`ant=1`, muscle tier 2 only); `tints` filled (origin, insertion, antagonist) with the ΔE test; legend chips; draw calls still < 20 with every layer on; e2e: triceps long head tier 1 tints scapula and ulna, antagonist toggle, `ant=1` round trip.

## State
- Last commit: M9-AF (tiers per kind), on `claude/keen-clarke-32a10a`.
- `npm run check`: pass. Vitest 463 tests. E2E: `tiers.spec.ts` (new, 3/3) plus 13 touched specs 102/103 (the keyboard search step flaked under load and passed re-run alone). Main chunk +0.8 kB gzipped over AE (Vite's figure: 297.95 kB).
- Open fan-out work: none.

## Waiting on the user
- Decision 3's bone half (built as the plan read it): with muscles (or ligaments, cartilage) on, a **bone's** related set also gains the muscles attached to it, the ligaments connecting it and the cartilage on it. Say if bones should stay bones-only (one line in `relatedAt` to change).
- Still open from earlier: the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md` (1–131).

## Things the next session must know
- Tier sets live in the lazy content chunks (`tiers`, `reverse`), built by `buildSoftTiers` from every layer; the main chunk sees them through `src/content/softRelations.ts`. `relatedAt(id, tier, modes)` is the one place the layer filter is applied; `isolationView(…, modes)` defaults to bones only.
- `sceneView`'s `tints` is still the empty map: AG fills it. The tier-1 set of a muscle/part is exactly the structures its origin + (resolved) insertion name, so AG's origin/insertion split can come from the same front matter (`attachmentsOf` in `softTiers.ts` merges them; split it).
- There are no `R`/`E` keys (the plan assumed them); none were added.
- `__viewer.solidNow(id)` (debug) tells whether a structure is drawn solid right now.
- M9's QUESTIONS start at 132 (none written in AF).
