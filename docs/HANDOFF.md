# Handoff — written 2026-11-25 at the end of M13 session BK

## Next session
BL (design): membership — vertex shares → `located_in` edges, overrides, checks, the regions golden, per-region triangle totals in the index (`docs/PLAN-milestone-13.md` step 2, decisions 4–6).
Done when: `npm run regions` writes `assets/build/located-in.json` and `check` verifies it; the spec §10 region checks pass; `tests/golden/regions.json` committed; the five goldens unchanged; main chunk measured.
**Starts only after the user approves BK's region list** (decision 1's table, screenshots in `docs/screenshots/m13/`).

## State
- Last commit: see `git log` (M13 BK: body-region list, volumes, ?debug&regions)
- `npm run check`: pass (672 tests; now also runs `regions:volumes -- --check`)
- Open fan-out work: none

## Waiting on the user
The BK gate: approve the region list (10 coarse, 35 fine) in plan decision 1, or say what to change. Departures from the spec: no Back: cervical (= posterior neck), Posterior abdominal wall added, no cavity regions.

## Things the next session must know
- Read BK's session notes in the plan: the fit vocabulary (`span`+`axis` per anchor, face pads, `{long, cross}`, `eachSide`) and the overlaps BL must settle by override or accept (ribs 2–7 in the shoulder, femoral heads in the pelvis, rib 1/clavicle in the anterior neck).
- `scripts/lib/glb-points.ts` gives world vertices per named node for any layer file; `inRegion` in `src/regions/volume.ts` is the point test. Positions match the manifests to 0.014 mm.
- Main chunk 486.3 kB (index + modulepreloads, `gzip -9`). A lazy chunk importing `three`/`react` without `meshoptimizer` reshuffles the vendor chunk (+1 kB): measure the whole eager set, not `index` alone.
- Goldens: never `--write --force` without the user's approval; `regions.json` is new in BL.
