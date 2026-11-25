# Handoff — written 2026-11-25 at the end of M12 BI

## Next session
BJ (routine): M12 wrap-up (plan step 11): goldens, parity table (bench, perf-load, main chunk ≤ 500.1 kB), the full e2e run in the background, exit criteria, `STATUS.md`, `/m12/` (set `deploy/pages.json` first as the plan says).
Done when: exit criteria ticked; `/m12/` live (ask the user to confirm; the container can't reach github.io).

## State
- Last commit: M12 BI: the fixture layer gains edges, tier rules, a panel and a tree (see `git log`).
- `npm run check`: pass (658 tests, the five goldens unchanged). E2E `fixture`: 3 pass; `attached`, `panel`: 16 pass.
- Open fan-out work: none

## Waiting on the user
none

## Things the next session must know
- The allowlist has no M12 entry (7 left: M14 ×1, M15 ×6).
- New generic hooks: `compileContentGraph(input, reg: ContentRegistry = CONTENT_REAL)`, `compileSoftLayer(…, lc)`, `importersModule(layers)`. The fixture build serves the layer importers, `virtual:skeleton-soft-content-widgets` and `virtual:skeleton-soft-tree` itself (`tests/fixtures/systems/vite.ts`), because the content plugin runs in Node with the real registry.
- "Show attached muscles" is now the bones' grouped-links section's `isolate` option, not implied by any grouped-links section.
- Main chunk `index` 307.6 kB `gzip -9` (unchanged since BH).
- Goldens: never `--write --force` without the user's approval. QUESTIONS: next is 140.
