# Handoff — written 2026-11-26 at the end of M13 session BR

## Next session
BR follow-up (short), once the user has merged the M13 PR: freeze `m13` in `deploy/pages.json` at the PR's merge commit (from `git log origin/main`), set `"current": null` (until M14's planning sets 14), update `README.md`'s M13 row and `CLAUDE.md`'s status paragraph (M13 done, frozen SHAs list), check the Deploy run, and open the freeze PR.
Done when: `m13` frozen, `/m13/` confirmed live by the user, "Hosted copy is live" ticked in `docs/PLAN-milestone-13.md`. Then M14 planning.

## State
- Last commit: see `git log` (M13 BR: parity table, docs, phone-start fix)
- `npm run check`: pass (764 tests; the six goldens unchanged, no approved differences)
- Full e2e: 193/196 under load, the 3 failures pass alone (step 8 notes)
- Open fan-out work: none

## Waiting on the user
Merge the M13 PR to `main` (link in the session's last message), then confirm https://ajmarr04-ux.github.io/SkeletonViewer/m13/ is live after the Deploy run.

## Things the next session must know
- BR fixed BP's phone start: it now holds layers only on Auto LOD (an explicit `?lod=high|both` or Settings → High held the bones on a bones-only page). Plan step 8 has the details.
- The freeze must use the real merge commit, never a placeholder: `scripts/build-pages.sh` fails otherwise.
- `bench-container` against an older build: run it from that build's directory with `dist` (it joins the path to the working directory).
- Main chunk 490.9 kB `gzip -9` (budget 500.1), measured the same way as M12's 486.1.
- Goldens: never `--write --force` without the user's approval.
