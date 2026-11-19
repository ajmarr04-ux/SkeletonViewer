# Skeleton Viewer

A browser-based 3D atlas of the adult human skeleton: 206 bones and 32 teeth,
each a separate object in its true anatomical position. Static site, no
backend. The build spec is [`SPEC (2).md`](<SPEC (2).md>).

## Milestones

| Milestone | Hosted copy | Status |
| --- | --- | --- |
| 1: Model ready (bare dual-LOD viewer) | https://ajmarr04-ux.github.io/SkeletonViewer/m1/ | Live (frozen at `b1392fa`) |
| 2: Viewer (camera, URL state, phone frame rate) | https://ajmarr04-ux.github.io/SkeletonViewer/m2/ | Live (frozen at `eb3e8ff`) |
| 3: Select and isolate (picking, tier-0 isolation, info panel, fixed orbit pivot) | https://ajmarr04-ux.github.io/SkeletonViewer/m3/ | In progress ([plan](docs/PLAN-milestone-3.md)) |

Known issues and requested changes for later milestones: [`docs/BACKLOG.md`](docs/BACKLOG.md).

The latest build is always at https://ajmarr04-ux.github.io/SkeletonViewer/.

## Development

```bash
npm ci
npm run dev          # local viewer at http://localhost:5173/
npm run check        # tsc --noEmit, vitest, check-models
npm run e2e          # Playwright smoke test against a production build
```

Viewer URL options: `?lod=low` or `?lod=high` loads only that model
(`?lod=both` forces low then high); `?debug` shows the debug overlay;
`?bench` orbits the skeleton once over 10 s and reports FPS, frame times and
draw calls; `?cam=px,py,pz,tx,ty,tz[,ox,oy]` sets the camera (orbit position,
pivot, and an optional view shift); `?sel=<id>` selects an object; `?nowebgl` shows the
WebGL 2 fallback.

The models in `public/models/` are built from the Z-Anatomy source by the
Blender pipeline (`npm run build-models`, after `bash scripts/setup-blender.sh`).
See `docs/PLAN-milestone-1.md` and `assets/build/REPORT.md`.

## Deployment

`.github/workflows/deploy.yml` deploys to GitHub Pages on every push to
`main` (or by hand). It runs `npm run check`, then `scripts/build-pages.sh`,
which builds the live site plus one snapshot per milestone (see
`deploy/README.md`). One-time setting: **Settings → Pages → Source → GitHub
Actions**.

## Attribution

Model derived from Z-Anatomy (CC BY-SA 4.0, Gauthier Kervyn and Marcin
Zielinski), built on BodyParts3D (© The Database Center for Life Science,
CC BY-SA 2.1 Japan). Full credits: [`public/ATTRIBUTION.md`](public/ATTRIBUTION.md).
The derived models are shared under CC BY-SA 4.0.
