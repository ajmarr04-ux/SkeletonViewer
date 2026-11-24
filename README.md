# Skeleton Viewer

A browser-based 3D atlas of the adult human skeleton: 206 bones and 32 teeth,
each a separate object in its true anatomical position. Static site, no
backend. The build spec is [`SPEC (2).md`](<SPEC (2).md>); milestones 6 to 10 add
muscles, ligaments and cartilage, per [`SPEC-musculoskeletal.md`](SPEC-musculoskeletal.md); milestones 11 to 15 turn it into a platform for more body systems, per [`SPEC-platform.md`](SPEC-platform.md).

## Milestones

| Milestone | Hosted copy | Status |
| --- | --- | --- |
| 1: Model ready (bare dual-LOD viewer) | https://ajmarr04-ux.github.io/SkeletonViewer/m1/ | Live (frozen at `b1392fa`) |
| 2: Viewer (camera, URL state, phone frame rate) | https://ajmarr04-ux.github.io/SkeletonViewer/m2/ | Live (frozen at `eb3e8ff`) |
| 3: Select and isolate (picking, tier-0 isolation, info panel, fixed orbit pivot) | https://ajmarr04-ux.github.io/SkeletonViewer/m3/ | Live (frozen at `d377478`) |
| 4: Related isolation and content (tiers 1 and 2, joints, Explode, 238 content files) | https://ajmarr04-ux.github.io/SkeletonViewer/m4/ | Live (frozen at `db07f62`) |
| 5: Polish (search and tree, labels, colour-by-region, screenshots, share links, accessibility) | https://ajmarr04-ux.github.io/SkeletonViewer/m5/ | Live (frozen at `71f04d0`) |
| 6: Soft-tissue audit, mapping and assets (muscles, ligaments, cartilage; debug view only) | https://ajmarr04-ux.github.io/SkeletonViewer/m6/ | Live (frozen at `43dce0e`; [plan](docs/PLAN-milestone-6.md); layers with `?debug&layers=all`) |
| 7: Layers and rendering (Layers panel, ghost per layer, muscle depth, Hide, picking across layers) | https://ajmarr04-ux.github.io/SkeletonViewer/m7/ | Live (frozen at `3af6d5a`; [plan](docs/PLAN-milestone-7.md)) |
| 8: Content (muscle, ligament and cartilage files; movements and joints; attachment migration) | https://ajmarr04-ux.github.io/SkeletonViewer/m8/ | Live (frozen at `0833b48`; [plan](docs/PLAN-milestone-8.md)) |
| 9: Interaction (muscle → part selection, tiers per kind, origins and insertions, panel sections, sidebar and search for the new kinds) | https://ajmarr04-ux.github.io/SkeletonViewer/m9/ | Live (frozen at `ef6ee75`; [plan](docs/PLAN-milestone-9.md)) |
| 10: Polish and measurement (labels, colours, announcements and keyboard for the new kinds; performance budgets; `STATUS.md`) | https://ajmarr04-ux.github.io/SkeletonViewer/m10/ | Live (frozen at `317b445`; [plan](docs/PLAN-milestone-10.md)) |
| 11: Registry (layer and kind descriptors, one registry, grouped Layers panel; platform phase, [`SPEC-platform.md`](SPEC-platform.md)) | https://ajmarr04-ux.github.io/SkeletonViewer/m11/ | In progress ([plan](docs/PLAN-milestone-11.md)) |

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
`?debug&layers=all` (or a subset, `layers=m,l,c,a`: muscles, ligaments, cartilage,
attachment patches) also draws the M6 soft-tissue layer files over the bones in
flat colours and checks every node's bounds against its manifest (debug only);
`?layers=b:on,c:off,l:on,m:ghost` sets the layers (bones, cartilage, ligaments,
muscles: `on`, `ghost` or `off`; the Layers panel writes it), and with `?debug`
the overlay adds a bounds line per loaded layer;
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
