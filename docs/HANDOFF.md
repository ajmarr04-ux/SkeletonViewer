# Handoff — written 2026-11-28 at the end of M14 BY

## Next session
BZ (routine): device-run prep (plan step 8, decision 11): the three `?bench` links checked in the container, `scripts/perf-load.ts` choosing the layer from the registry (removes the last M14 allowlist entry), the container parity table against M13 (`dc55686`); then **the gate**: the user runs the three links on PC and iPhone. The session ends at the gate; CA starts after the figures are in BZ's notes.

## State
- Last commit: M14 BY: context dimming
- `npm run check`: pass (816 tests, 1 skipped)
- e2e `tints`, `tiers`, `layers`: see the BY notes in the plan
- Open fan-out work: none

## Waiting on the user
Nothing yet (BZ ends at the device gate).

## Things the next session must know
- **Kill stale `vite preview` servers before a Playwright run** (`pkill -f "vite preview"`): `playwright.config.ts` reuses a server already on 4173, so a preview left over from an earlier session serves an old `dist/` and new tests fail for no visible reason (it happened in BY).
- Context dimming is `SceneView.dimmed` (`src/scene/dimming.ts`); only the muscles have an amount, so it shows only for a bone, ligament or cartilage selection at tier 1/2 with the muscles on. Bench link 3 (a forearm muscle at tier 2) dims nothing; that is expected.
- Main chunk 493,813 B after BY (budget 500.1 kB, 6.3 kB left). Measure: index + modulepreloads, `gzip -9`.
