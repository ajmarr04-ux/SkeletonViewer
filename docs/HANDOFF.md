# Handoff — written 2026-11-28 at the end of M14 BZ (prep); the device gate is open

## Next session
Still BZ, gate only: record the user's PC and iPhone `?bench` figures in BZ's notes (`docs/PLAN-milestone-14.md`), tick the "Real-device checks" exit criterion, then CA (wrap-up: goldens, full e2e, docs, `/m14/`).
Done when: the figures for the three links on both devices are in BZ's notes, with any miss against STATUS §6 recorded (not fixed unless the user asks).

## State
- Last commit: M14 BZ: device-run prep, parity table, the gate
- `npm run check`: pass
- Open fan-out work: none

## Waiting on the user
1. **How to reach this branch on the devices.** Pages builds `/m14/` and the live site only from `main` (still M13), so link 3's patterns aren't hosted anywhere. Options: (a) merge the branch to `main` now (the live site and `/m14/` become M14 before CA's wrap-up; CA merges again at the end, and freezes then); (b) the user runs `npm run build` then `npx vite preview --host` on the PC and opens the links on the iPhone over the same Wi-Fi; (c) links 1 and 2 now on the M13 site, link 3 after CA's merge.
2. **The runs.** On a PC browser and an iPhone, open each link (base + query), wait for the bench panel, paste median and 5th-percentile FPS, draw calls, triangles and label times:
   1. `?bench&layers=b:on,c:on,l:on,m:on`
   2. `?bench&layers=b:on,c:on,l:on,m:on&reg=forearm_left`
   3. `?bench&layers=b:on,c:on,l:on,m:on&sel=flexor_carpi_radialis_left&tier=2&ant=1`
   Plus the M10 gate's checks: does the AO look right on a real GPU, and is there a visible LOD pop?

## Things the next session must know
- Kill stale `vite preview` servers before a Playwright run (`pkill -f "vite preview"`).
- `DEVICE=1 npm run bench-container` runs the three links in the container (the reference table is in BZ's notes).
- `perf-load` now times `largestLazyLayer()` (`scripts/lib/model-checks.ts`); the allowlist has no M14 entry.
- Main chunk 493,813 B (budget 500.1 kB, 6.3 kB left). Measure: index + modulepreloads, `gzip -9`.
