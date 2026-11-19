# Attribution

Skeleton Viewer is a personal, non-commercial 3D atlas of the adult human
skeleton (bones and teeth).

## 3D model

The bone and tooth meshes are derived from **Z-Anatomy**
(https://github.com/Z-Anatomy/Models-of-human-anatomy), file `Startup.blend`,
collection "1: Skeletal system", commit 71919ee.

- Z-Anatomy by Gauthier Kervyn and Marcin Zielinski, licensed under
  Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0):
  https://creativecommons.org/licenses/by-sa/4.0/
- Z-Anatomy is built on **BodyParts3D**, © The Database Center for Life
  Science (DBCLS), licensed under Creative Commons Attribution-ShareAlike 2.1
  Japan (CC BY-SA 2.1 JP): https://creativecommons.org/licenses/by-sa/2.1/jp/
  (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/)

## Changes made

The skeletal objects were extracted, renamed to stable IDs, cleaned up
(merged duplicate vertices, removed loose geometry, recalculated normals,
filled small holes), joined where one bone was split into several objects
(the sternum), given baked ambient occlusion in vertex colours, decimated
into two levels of detail and compressed with gltfpack (Meshopt). No bone was
moved or re-posed. Cartilage, the hallux sesamoids and other non-skeletal
structures were left out. The source has no third molars, so teeth 18, 28,
38 and 48 have no mesh.

## Licence of the derived model

Under the share-alike terms, the derived models in `models/`
(`skeleton-high.glb`, `skeleton-low.glb`) are distributed under
CC BY-SA 4.0.

## Text content

The descriptions in the info panel (summaries, landmarks, articulations,
muscle attachments, clinical notes), the articulations and the region sets
were drafted from standard anatomical references for this project. They have
**not yet been reviewed** by an anatomist, and every content file is marked
`reviewed: false`, so treat them as a study aid, not as a reference. Every
choice that was uncertain while drafting (which bones count as articulating,
what a region holds, naming) is recorded in `content/QUESTIONS.md` in the
project's repository, where corrections are welcome.

Screenshots taken in the app carry the model's attribution in the bottom
right corner, as the licences above ask.

## Software

Built with three.js, React Three Fiber, drei, camera-controls,
three-mesh-bvh, zustand, marked, MiniSearch and meshoptimizer (all MIT).
