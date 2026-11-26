# Body regions (M13)

- `regions.json` (this folder) is the **body-region** list: coarse regions, fine regions and their volumes, fitted around anchor structures. `npm run regions:volumes` resolves it into `assets/build/region-volumes.json` (generated; `npm run check` fails if it is stale). Code: `src/regions/`, `scripts/regions/`.
- `../regions.json` (one level up) is unrelated: the bones' tier-2 neighbour sets ("Expand region", M4).

Shapes: `fit` lists anchor IDs (or `{id, span, axis}` for part of one; `axis` is `long` (default), `vertical` 0 = inferior, `anteroposterior` 0 = posterior, `mediolateral` 0 = medial). `orient` is `pca` (default, along the anchors' principal axes) or `world`. `pad` is metres on every face, `{long, cross}` for PCA shapes, or per face (`superior`, `inferior`, `anterior`, `posterior`, `left`, `right`, `medial`, `lateral`) for world boxes; negative trims. `span` keeps a fraction of the fitted points along the long axis. `eachSide` makes one shape per side in a midline region; `"sides": true` makes a region per side, with `{side}` replaced. A literal `box` / `capsule` needs a `reason` and a QUESTIONS entry.
