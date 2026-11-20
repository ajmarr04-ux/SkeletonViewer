# Handoff — written 2026-11-20 at the end of M9-AE

## Next session
**M9-AF: tiers per kind** (`docs/PLAN-milestone-9.md`, step 2; decisions 3–5). Trigger: "begin session AF".
Done when: tier sets for muscles, parts, ligaments and cartilage are unit-tested on real content and per layer combination; with only the bones layer on, every bone tier equals M8's (equivalence test written first); "Show related"/"Expand" enabled for the soft kinds with the muscle labels "Show attachments"/"Show functional group"; `NEW_KIND_TIERS_REASON` removed; e2e for a muscle's tier 1 with bones on and off, and a bone's tier 1 with muscles on and off.

## State
- Last commit: M9-AE (nested selection), on `claude/keen-clarke-32a10a`.
- `npm run check`: pass. Vitest 443 tests. E2E: `nested.spec.ts` (new, 3) plus layers, soft-content, select, related, joints, panel, smoke, sidebar, keyboard and layers-debug specs — see the session notes for the result.
- Main chunk 293.0 kB gzipped (+0.9 over M8; budget +10 for M9).
- Open fan-out work: none.

## Waiting on the user
- Decision 3's bone half (session AF's reading): with muscles (or ligaments, cartilage) on, a **bone's** related set also gains the muscles attached to it (and ligaments connecting it, cartilage on it). Say if bones should stay bones-only.
- Still open from earlier: the real-device muscles-layer load time (M7), the per-browser `?bench` table (M5 step 12), the content review of `content/QUESTIONS.md` (1–131).

## Things the next session must know
- Decision 3 as the user gave it: related sets show only structures in layers that are **On or Ghost**; Off layers contribute nothing; the focus always shows. This reverses the spec's §5.2 "isolation overrides layer toggles". `sceneView` currently draws `iso.solid` in every layer "whatever its layer's mode": AF must filter the tier set by layer mode (focus excepted).
- `isolationView(sel, tier, ghostMode, hasMesh, grp, partsOf, parentOf)`: a part's siblings and a muscle's parts are already added to `solid`; tier sets go on top. `relations.visibleAt` is bones-only today.
- The reducer stays pure: `parentOf` is passed in (`parentOf` in `src/state/selection.ts`).
- Known edge from AE: the side toggle on a part replaces the entry, so Back after it lands on the previous entry's side.
- M9's QUESTIONS start at 132.
