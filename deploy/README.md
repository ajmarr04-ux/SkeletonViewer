# GitHub Pages layout

`scripts/build-pages.sh` (run by `.github/workflows/deploy.yml`) builds:

| Path | Built from |
| --- | --- |
| `/SkeletonViewer/` | the pushed commit |
| `/SkeletonViewer/m<current>/` | the pushed commit (the milestone in progress) |
| `/SkeletonViewer/m<N>/` for each entry in `frozen` | that milestone's recorded commit |

When a milestone is finished, record its final commit under `frozen` (for
example `"m1": "<sha>"`) and bump `current`, so its snapshot stays exactly as
it shipped while later milestones build on top.
