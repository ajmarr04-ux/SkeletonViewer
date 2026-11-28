# Handoff — written 2026-11-28 at the end of M14 CB

## Next session
Not a numbered session: the M14 close-out, after the user's device check.
1. The user merges the CB PR (or asks Claude to), the Deploy run rebuilds `/m14/`, and the user checks the surface-locked patterns on a device with link 3: `/m14/?layers=b:on,c:on,l:on,m:on&sel=flexor_carpi_radialis_left&tier=2&ant=1`, orbiting to the back of the forearm, then panning, zooming and orbiting. Ideally also `?bench` on links 1–3 (plan BZ notes) with the iPhone's Low Power Mode **off**, because of the container finding below.
2. A small follow-up PR: any size change (`PATTERN_PERIOD_M` / `PATTERN_MIN_CSS` in `src/scene/patterns.ts`; the unit tests follow the constants), then freeze `m14` in `deploy/pages.json` at the merge commit of the CB PR (or of the follow-up, if it changes code), tick "Hosted copy is live" in the plan, mark M14 live in `README.md`, update `CLAUDE.md`'s status. `current` goes to 15 in M15's planning.

## State
- Last commit: M14 CB: wrap-up (plan, STATUS, handoff)
- `main` = PR #30 (`ab33337`, M14 up to BZ); CA and CB are on `claude/keen-clarke-32a10a`
- `npm run check`: pass (823 tests, 1 skipped); goldens unchanged but the approved `search.json`
- Full e2e: 200/205 with two workers; the 5 timing failures (`keyboard` ×3, `nested`, `polish` share link) pass alone
- Open fan-out work: none

## Waiting on the user
- Merge, then the device verdict on the patterns: size, the zoomed-out octaves, the look in the legend, and whether the frame rate holds.

## Things the next session must know
- **CA's shader is 15–25 % slower in the container with no pattern drawn** (link 2, side by side against BZ; table in the CB notes). Moving `fwidth` into the branch didn't help (reverted). If the devices show a drop, the follow-up is a cheaper variant (one projected plane rather than triplanar, or dropping a varying); if not, record it as a SwiftShader-only cost.
- The container is slower today than on BZ's day: compare only builds benched side by side.
- Kill stale `vite preview` servers before a Playwright run (`pkill -f "vite preview"`); bench runs of all three device links take about 6 min per build, so use a long timeout.
- Main chunk 494,550 B (budget 500.1 kB, 5.5 kB left).
