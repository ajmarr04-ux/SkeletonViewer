# Skeleton Viewer: project status

Written 2026-11-19, after Milestone 5. This file is for whoever writes the next spec. It records what exists, how it works, what was measured, and where the build departs from the original spec.

The spec is `SPEC (2).md` in this repo. The spec itself calls it `SPEC.md`, but the file was never renamed. All five phases are done. `/m1/` to `/m5/` are live and frozen on GitHub Pages (`README.md` has the links), and the main site at https://ajmarr04-ux.github.io/SkeletonViewer/ follows `main`.

---

## 1. Folder layout (two levels, tracked files only)

```
/
├─ SPEC (2).md               the build spec (source of truth)
├─ STATUS.md                 this file
├─ CLAUDE.md                 working notes for Claude Code sessions (key-file table, rules, status)
├─ README.md                 milestone table with hosted links
├─ index.html                Vite entry; preloads the low-detail model
├─ package.json, package-lock.json, tsconfig.json, vite.config.ts, playwright.config.ts
├─ .github/workflows/        deploy.yml: npm run check, then build-pages.sh, then GitHub Pages
├─ assets/
│  ├─ audit/                 REPORT.md and z-anatomy.json: audit of the source's skeletal collection
│  ├─ build/                 REPORT.md and manifest.json: Blender build results, per-ID bounds per LOD
│  └─ mapping/               source-to-id.json: stable ID → source object names, plus what's missing or excluded
├─ content/
│  ├─ bones/                 238 files, <id>.md (front matter + 40–80-word summary)
│  ├─ ids.json               the 238 canonical IDs (generated)
│  ├─ articulations.json     357 articulation pairs
│  ├─ regions.json           238 tier-2 sets
│  ├─ hierarchy.json         axial / appendicular / dentition tree
│  ├─ synonyms.json          extra search terms (Milestone 5)
│  └─ QUESTIONS.md           36 open anatomical choices for a reviewer
├─ deploy/
│  ├─ pages.json             frozen milestone commits; "current": null
│  └─ README.md
├─ docs/
│  ├─ PLAN-milestone-1.md … PLAN-milestone-5.md   per-milestone plans, decisions and session notes
│  └─ BACKLOG.md             requests from the user (entry 1 was built in M3; nothing open)
├─ public/
│  ├─ models/                skeleton-high.glb, skeleton-low.glb
│  ├─ ATTRIBUTION.md         credits (compiled into the app at build time)
│  └─ fallback.png           shown when WebGL 2 is missing
├─ scripts/
│  ├─ blender/               audit_source.py, build_skeleton.py (the bpy pipeline)
│  ├─ mapping/               generate_ids.py
│  ├─ content/               mirror.ts (left → right files), build-hierarchy.ts
│  ├─ lib/                   content-plugin.ts (Vite virtual modules), search-data.ts, content-files.ts
│  ├─ setup-blender.sh, build-models.sh, compress-models.sh, check-models.ts
│  ├─ validate-content.ts, build-content.ts, build-search-index.ts
│  ├─ build-pages.sh         live site plus frozen /m<N>/ snapshots
│  └─ perf-load.ts           throttled load-time measurement
├─ src/
│  ├─ main.tsx, App.tsx, styles.css
│  ├─ scene/                 Viewer, loading, BatchedMesh, isolation view, outlines, labels, explode, screenshot, bench
│  ├─ camera/                CameraRig (camera-controls + own pan/zoom), pure maths, input helpers
│  ├─ state/                 zustand store, URL parse/serialise, isolation reducer, history wiring
│  ├─ content/               schemas, validation, compiler, relations, search, tree, groups, names
│  └─ ui/                    InfoPanel, Sidebar, Toolbar, Popover, Breadcrumb, Labels, Legend, Footer, etc.
└─ tests/
   ├─ *.test.ts              24 Vitest files (307 tests)
   └─ e2e/                   12 Playwright specs (105 tests)
```

Not tracked: `.cache/`, which holds the Blender venv and the pinned source, fetched by `scripts/setup-blender.sh`.

---

## 2. 3D model source

- **Source:** Z-Anatomy, `Startup.blend` from https://github.com/Z-Anatomy/Models-of-human-anatomy, pinned to commit `71919ee`. Only the collection `1: Skeletal system` is used.
- **Licence:** Z-Anatomy is **CC BY-SA 4.0** (Gauthier Kervyn and Marcin Zielinski). Its meshes come from **BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan**. The spec lists BodyParts3D as CC BY 4.0, but Z-Anatomy credits it as CC BY-SA 2.1 JP, so the app credits both as Z-Anatomy does. The result is share-alike: anything built from these meshes must stay CC BY-SA.
- **Other systems in the same file.** I checked these in this session by opening the pinned `Startup.blend` with `bpy` and counting meshes per top-level collection. The "with faces" figure leaves out empty and label objects.

  | Top-level collection | Mesh objects | With faces | Notes |
  | --- | --- | --- | --- |
  | `1: Skeletal system` (used) | 1244 | 278 | 31 cartilage meshes by name (costal, nasal, laryngeal), all excluded here |
  | `2: Muscular insertions` | 705 | not counted | not inspected |
  | `3: Joints` | 480 | 410 | 292 ligament meshes by name, plus 32 discs, 32 capsules, 12 menisci, 12 membranes and 2 cartilage |
  | `4: Muscular system` | 789 | 670 | 339 have "muscle" in the name (many are named only in Latin), plus 28 tendons |
  | `5` to `9` (cardiovascular, lymphoid, nervous, visceral, regions) | 60 / 220 / 460 / 254 / 299 | not counted | |

  So **muscles, ligaments and cartilage are all available** from the same pinned source, in the same coordinate space and under the same licence. Joint cartilage sits partly under `3: Joints` and partly as named cartilage under `1: Skeletal system`. None of it has been audited for mesh quality, left/right separation or naming the way the bones were (`assets/audit/REPORT.md`). The pipeline would need the same audit, mapping and cleanup before using it.

---

## 3. Loading and rendering

- **Files** (`public/models/`, glTF binary, gltfpack with Meshopt, `KHR_mesh_quantization`, 14-bit positions):

  | LOD | Triangles | File size | Budget |
  | --- | --- | --- | --- |
  | high | 499,981 | 2.59 MB | ~500k, < 15 MB |
  | low | 149,913 | 0.91 MB | ~150k, < 6 MB |

  Each file has **234 named nodes**: 206 bones and 28 teeth. Each node has one unnamed child that holds the quantised mesh. `npm run check-models` checks the names, the budgets and that every node's world bounds match `assets/build/manifest.json` within 1 mm. The measured drift is 0.014 mm. AO is baked per bone with Cycles into `COLOR_0`.
- **Load order** (`src/scene/Viewer.tsx`, `src/scene/loadSkeleton.ts`, `src/scene/lod.ts`):
  1. `index.html` preloads `skeleton-low.glb`.
  2. The low model is parsed and shown.
  3. The high model's download starts as soon as the low one is parsed (`prefetchModel`), then the batches are swapped.
  4. The automatic choice (`chooseLod`) stops at low on small screens, low device memory or weak or software GPUs. `?lod=low|high|both` and the Settings menu override it.
- **Rendering: yes, `THREE.BatchedMesh`** (`src/scene/batchSkeleton.ts`). All 234 bones go into one `BatchedMesh` with per-instance visibility and colour. The instance matrix is the glTF mesh's world matrix, and the vertices are copied still quantised and never moved.
  - A **second `BatchedMesh` holds the ghosts**: the same parts with a translucent material, sorted back to front, with no depth writes.
  - Picking uses `three-mesh-bvh`, one BVH per geometry.
  - Outlines are **inverted hulls** (`src/scene/outline.ts`). A hull is a `Mesh` that shares the solid batch's buffers, with a draw range over one bone's indices. The 3 px selection outline and the 1.5 px hover outline are one draw call each.
  - **Draw calls:** 2 for the full skeleton, 3 with a bone isolated (solid, ghosts, outline), 4 with a hover outline as well.
  - **Lighting:** one key light, drei/three `RoomEnvironment`, and baked AO remapped by `AO_FLOOR` (`src/scene/material.ts`). There are no shadows.
- **The 4 missing IDs** (`tooth_18/28/38/48`, the wisdom teeth) have content files and tree rows. They show a "No 3D model" note, isolate nothing at tier 0, and show their neighbours at tier 1.

---

## 4. Content data: types, formats and one real example of each

The schemas are in `src/content/schema.ts` (zod) and are enforced by `npm run validate-content`, which runs in `npm run check`, before every build, and in CI.

### Bone/tooth content: `content/bones/<id>.md`

```ts
// src/content/schema.ts: frontMatterSchema (strict object), with these refinements:
// teeth must have type "tooth" and a toothType; bones must not; landmark IDs are unique.
type FrontMatter = {
  id: string;                 // snake_case stable ID
  name: string;
  latin: string;
  commonName: string | null;
  side: "left" | "right" | "midline";
  kind: "bone" | "tooth";
  region: string[];           // ≥ 1, snake_case hierarchy keys
  type: "long" | "short" | "flat" | "irregular" | "sesamoid" | "tooth";
  toothType: "incisor" | "canine" | "premolar" | "molar" | null;
  ta2: string | null;         // digits only; null everywhere today
  functions: string[];        // ≥ 1
  landmarks: { id: string; name: string; position: [number, number, number] | null }[];
  muscleAttachments: string[];
  clinicalNote: string | null;
  reviewed: boolean;
};
// Body: Markdown, 40 to 80 words (BODY_WORDS), rendered to HTML at build time.
```

The compiled form that the panel reads (`src/content/compile.ts`, served as the lazy virtual module `virtual:skeleton-content`, about 30 KB gzipped):

```ts
type CompiledEntry = {
  latin: string; common: string | null; region: string[];
  type: FrontMatter["type"]; toothType: FrontMatter["toothType"];
  functions: string[]; landmarks: string[]; landmarkPositions: number;
  muscles: string[]; clinical: string | null;
  summary: string;            // HTML
  reviewed: boolean;
};
type CompiledContent = Record<string, CompiledEntry>;
```

Real example, `content/bones/patella_left.md`:

```markdown
---
id: patella_left
name: Patella
latin: Patella
commonName: Kneecap
side: left
kind: bone
region: [appendicular, lower_limb]
type: sesamoid
toothType: null
ta2: null
functions:
  - Increases the leverage of the quadriceps when straightening the knee
  - Protects the front of the knee joint
  - Lets the quadriceps tendon glide over the femur with little friction
landmarks:
  - { id: base, name: Base, position: null }
  - { id: apex, name: Apex, position: null }
  - { id: articular_surface, name: Articular surface, position: null }
  - { id: lateral_facet, name: Lateral facet, position: null }
  - { id: medial_facet, name: Medial facet, position: null }
muscleAttachments: [Rectus femoris, Vastus lateralis, Vastus medialis, Vastus intermedius]
clinicalNote: "The patella can dislocate sideways, usually in young people with shallow femoral grooves; vastus medialis helps to hold it in place."
reviewed: false
---
The patella is the kneecap, the largest sesamoid bone in the body. It sits in the tendon of quadriceps femoris, which continues below it as the patellar ligament to the tibia. Its back is covered with thick cartilage and glides in the groove between the femoral condyles, articulating with the femur only. It holds the tendon forward, improving the pull of the quadriceps.
```

136 files were written: the midline ones and the left ones. `npm run content:mirror` generates the other 102, the right-side files, and `validate-content` fails if they drift from their left-side files.

### Canonical ID list: `content/ids.json` (generated by `scripts/mapping/generate_ids.py`)

```json
{ "id": "patella_left", "name": "Patella", "kind": "bone", "side": "left", "group": ["appendicular", "lower_limb"], "meshAvailable": true }
{ "id": "tooth_38", "name": "Lower left third molar", "kind": "tooth", "side": "left", "group": ["dentition", "lower", "left", "molars"], "meshAvailable": false }
```

### Articulations: `content/articulations.json`

```ts
type Articulation = {
  a: string; b: string;       // object IDs; each pair is stored once and looked up from either side
  joint: string;              // snake_case joint ID
  name: string;
  surfaces?: Record<string, string>;  // object ID → landmark ID; not used by any entry yet
};
type Articulations = Articulation[];   // 357 entries
```

Real example:

```json
{ "a": "femur_left", "b": "patella_left", "joint": "patellofemoral_joint_left", "name": "Patellofemoral joint" }
```

Every object appears in at least one entry. The hyoid is the exception and is allowlisted. Each tooth has a gomphosis entry with its maxilla or the mandible.

### Regions: `content/regions.json`

```ts
type Regions = Record<string, string[]>;  // ID → tier-2 additions on top of tier 1; all 238 IDs present
```

Real example:

```json
{ "femur_left": ["sacrum", "coccyx", "hip_bone_right", "fibula_left"] }
```

### Hierarchy: `content/hierarchy.json`

```ts
type HierarchyNode = { key: string; label: string; children: (HierarchyNode | string)[] };  // string = object ID
type Hierarchy = HierarchyNode[];  // three roots: axial, appendicular, dentition
```

Real excerpt (the left lower limb; `…` marks members cut here, everything else is verbatim):

```json
{ "key": "appendicular.lower_limb", "label": "Lower limbs", "children": [
  { "key": "appendicular.lower_limb.left", "label": "Left", "children": [
    "femur_left", "patella_left", "tibia_left", "fibula_left",
    { "key": "appendicular.lower_limb.left.tarsals", "label": "Tarsals", "children": [
      "talus_left", "calcaneus_left", "navicular_left", "cuboid_left",
      "medial_cuneiform_left", "intermediate_cuneiform_left", "lateral_cuneiform_left" ] },
    { "key": "appendicular.lower_limb.left.metatarsals", "label": "Metatarsals", "children": [ "metatarsal_1_left", "…" ] },
    { "key": "appendicular.lower_limb.left.phalanges", "label": "Phalanges", "children": [ "proximal_phalanx_foot_1_left", "…" ] } ] },
  { "key": "appendicular.lower_limb.right", "label": "Right", "children": [ "…" ] } ] }
```

The skull splits into `cranial`, `facial`, `ossicles` and `hyoid`. Dentition is `dentition.upper|lower` → `.right|left` → `.incisors|canines|premolars|molars` → teeth. The sidebar adds cross-quadrant tooth-type groups that aren't in the file: `dentition.type.incisors` to `dentition.type.molars` (`src/content/groups.ts`).

### Synonyms: `content/synonyms.json` (not in the spec)

`Record<string, string[]>` holds extra search terms. Keys are left and midline IDs only, and an entry applies to both sides.

---

## 5. Selection and isolation tiers

| Concern | Where |
| --- | --- |
| State: `sel`, `tier`, `grp`, `ghostMode`, `hovered`, `keyCursor`, `joint`, `explode` | `src/state/store.ts` (zustand) |
| The spec §6 state machine as a pure reducer | `src/state/isolation.ts`: `isolationStep(state, action) → { state, history }` |
| Applying it: store, URL, history | `src/state/selection.ts`: `dispatchIsolation`, `selectObject`, `showRelated`, `expandRegion`, `goBack`, `switchSide`, `isolateGroup`, `onPopState` |
| URL format | `src/state/url.ts`: `sel`, `tier`, `grp`, `ghost`, `color`, `cam=px,py,pz,tx,ty,tz[,ox,oy]`, `lod` |
| Which bones are solid, ghosted or the focus (pure) | `src/scene/isolation.ts`: `isolationView`, `groupView`, `withJoint`, `isPickable` |
| Writing it to the GPU | `applyIsolationView` (same file) sets per-instance visibility and colour on the two `BatchedMesh`es. `src/scene/Isolation.tsx` re-applies it on every store change and after an LOD swap. |
| Tier sets | `src/content/relations.ts`: `tier1(id)` is the articulation partners plus, for teeth, the adjacent teeth (worked out from FDI numbers); `regionOf(id)` reads `regions.json`; `visibleAt(id, tier)` is the focus plus tier 1, plus the region set at tier 2 |
| Picking | `src/camera/CameraRig.tsx` handles taps: ≤ 5 px of movement and ≤ 500 ms is a click, anything else a drag; double taps are detected. `src/scene/pick.ts` (`pickWithProxies`) adds screen-space hit areas for the 100 objects with a radius under 2 cm (22 px for touch, 6 px for a mouse). The BVH raycast is in `batchSkeleton.ts`. |
| Outlines | `src/scene/outline.ts` (`setOutlineTarget`) |

How it behaves:

- **States.** The full skeleton, then tier 0, tier 1 and tier 2. There is also a **group** level (`grp`), which sits at the same depth as tier 0.
- **History.** The reducer returns `push`, `pop`, `replace` or `none`. `push` calls `pushState` with an `skvDepth` marker. `pop` calls `history.back()` when the app pushed that entry, otherwise it replaces the entry. The browser's Back button therefore steps back one level.
- **Selecting moves the pivot, not the view.** A newly selected bone becomes the orbit pivot (`repivot`) and the picture stays put. Show related and Expand region don't move the camera at all. `F` frames the selection or the solid set.
- **Ghosts.** Ghosts and hidden bones can't be picked. A click on one, or on empty space, or pressing Esc steps back.
- **The focus** gets the accent colour (`#a7caf2`, with a per-channel gain in `material.ts`) and the 3 px outline. Related bones keep the normal bone colour, or their region colour when colour-by-region is on.
- **Groups and selection exclude each other.** Choosing a member of an isolated group pushes that member at tier 0.

---

## 6. Measured load time and frame rate

**Frame rate** (`?bench`: a 360° orbit over 10 s; run by the user on the live site):

| When | Device | Median FPS | 5th pct FPS | Draw calls | Notes |
| --- | --- | --- | --- | --- | --- |
| M2, full skeleton, high LOD | PC (Chrome) | 75.2 | 73.5 | n/a | vsync-limited (75 Hz) |
| M2, full skeleton, high LOD | iPhone (Safari) | 58.8 | ~58.8 | n/a | vsync-limited (60 Hz) |
| M3, one bone isolated | PC / iPhone | 75 / 59 | | 3 | |
| M4, `sel=femur_left&tier=2` | PC | 75.2 | 73.5 | 3 | p95 13.6 ms |
| M4, `sel=femur_left&tier=2` | iPhone | 58.8 | 58.8 | 3 | 17 ms per frame throughout |
| M7, all layers solid (`?bench&layers=b:on,c:on,l:on,m:on`) | PC (high LOD) | 75.2 | 74.1 | 4 | vsync-limited; p95 13.5 ms |
| M7, all layers solid | iPhone (low LOD) | 58.8 | 58.8 | 4 | vsync-limited; 449,623 triangles |
| M7, muscles ghosted over bones (`?bench&layers=b:on,c:off,l:off,m:ghost`) | PC (high LOD) | 75.2 | 74.1 | 2 | vsync-limited; 1,299,731 triangles |
| M7, muscles ghosted over bones | iPhone (low LOD) | 58.8 | 58.8 | 2 | vsync-limited; 379,713 triangles. No ghost fallback needed |

**Click → highlight** (M3, measured by the user): PC 10 ms, iPhone 55 ms. The budgets are 50 ms and 100 ms.

**Load time.** Measured only in the container's headless Chromium, with `npm run perf-load`. Settings: Fast 4G (9 Mbit/s, 165 ms round trip), 4× CPU slowdown, cold cache, gzip as on Pages, `?lod=both`, median of 3 runs.

| Profile | First skeleton (low) | Full detail (high) | Budget |
| --- | --- | --- | --- |
| Desktop 1280 × 800 | 1.90 s | 5.96 s | 3 s / 8 s |
| Phone profile (iPhone 13 emulation) | 1.91 s | 6.08 s | 5 s / 12 s |

**M7, every layer off, against M6 in the same container on the same day** (2026-11-20; this container is slower than M5's, so the figures above aren't comparable):

| Profile | M6 (`43dce0e`): skeleton / full detail | M7: skeleton / full detail | M7: muscles on → low LOD shown | Budget (layer) |
| --- | --- | --- | --- | --- |
| Desktop 1280 × 800 | 3.48 s / 6.68 s | 3.25 s / 6.50 s | 7.38 s | 3 s |
| Phone profile | 3.42 s / 6.54 s | 3.19 s / 6.43 s | 7.77 s | 5 s |

With every layer off, M7 loads no slower than M6 (within run-to-run noise), requests no layer file or layer chunk, and its bone files are byte-identical to M5's. The muscles layer misses its budget **in the container only**: its 1.6 MB file arrives about 6 s after the click (still 5.4 s with network throttling off), because SwiftShader takes hundreds of milliseconds of main-thread time per frame and the streamed file is read between frames. A real GPU doesn't do that. The real figure comes from the user's devices: with `?debug`, the layer line in the overlay reads "low shown N s after turned on". On `/m7/` the user's `?debug` skeleton load times were 360 ms (low) and 483 ms (high) on the PC, and 176 ms (low) on the iPhone. The muscles' own figure hasn't been reported yet.

The container renders with SwiftShader, a software GPU, which adds main-thread time a real GPU doesn't spend. Real devices should load faster. Before session O's preload and prefetch changes, the desktop first skeleton took 3.7 s. The user reported that `/m5/` "loads great on smartphone and pc", but didn't give timings.

**Label layout** (M5, container, 4× CPU): median 2.4 ms and max 12 ms per layout with the full skeleton; median 1.1 ms at tier 2. Layouts run at most every 100 ms while the camera moves.

**Not measured:** Firefox, Edge, Safari on the Mac and Chrome on Android (the browser table in `docs/PLAN-milestone-5.md`, step 12, is empty), and FPS with labels and colour-by-region on a real phone.

---

## 7. Where the build differs from the spec

| Spec says | What was built | Why |
| --- | --- | --- |
| §1, §9: 238 objects, 32 teeth, and every content file has a mesh | **234 meshes.** The four third molars (`tooth_18/28/38/48`) have IDs and content files but no mesh (`meshAvailable: false`). The validation rule was changed to match. | Z-Anatomy has 28 separate teeth and no wisdom teeth. The user decided to ship without them. |
| §4: BodyParts3D is CC BY 4.0 | It is credited as CC BY-SA 2.1 JP | That is how Z-Anatomy credits it |
| §4, step 2: fix non-manifold geometry | 7 objects (8 meshes, counting both humeri) are still non-manifold: T8, mandible, occipital, ethmoid, sternum, sacrum, both humeri | The leftover edges meet at non-manifold vertices, so a simple fill can't close them. No visible artefacts. |
| §4: bake AO | AO is baked **per bone**, with every other bone hidden | Whole-skeleton AO turned isolated enclosed bones black (ossicles, ethmoid). The cost is losing the contact shading between neighbouring bones. |
| Sternum (spec is silent) | Manubrium, body and xiphoid are joined into one object, `sternum` | This matches the 206 count |
| §1: articular cartilage out of scope unless joints are unreadable | All cartilage is excluded, including the costal cartilages | Joints were judged readable without it (user decision) |
| §2: selection outline with `postprocessing` OutlineEffect | Inverted-hull outlines (one draw call per outline, sharing the batch's buffers) | Cheaper: no extra full-scene passes, and the renderer keeps MSAA. The spec allows "or the equivalent". |
| §6 Camera: orbit about a focus point that re-centring moves | **Fixed pivot, CAD style.** Pan and zoom shift the view, not the pivot. `cam=` gains an optional `ox,oy` offset. | User request after `/m2/` (`docs/BACKLOG.md`, entry 1). The spec was amended in place. |
| §6: at tier 0, "click another bone: switch focus" | At tier 0 the other bones are ghosts or hidden and can't be picked, so clicking one steps back a level. Switching focus at tier 0 happens through the tree, search or the side toggle. | Ghosts are not pickable, and a click on a ghost counts as empty space. Decided in M3. |
| §6: double-click a related bone at tier 1 or 2 → new focus | A **single** click also does this; the double-click centres the bone as well | One rule everywhere: clicking a solid bone selects it (M4, decision 6) |
| §6: joint hover highlights the `surfaces` landmarks | It highlights **both whole bones** (hover outline on the partner, brighter tint on both) | No landmark has a position, and no articulation has `surfaces`. The spec allows this fallback. |
| §6: Explode pushes bones apart "along each joint's axis" | Each tier-1 bone moves along the line from the focus bone's box centre to its own, by up to 0.5 × its bounding radius | There is no joint-axis data. |
| §7: landmarks toggle shows pinned 3D labels | The toggle is disabled ("no positions yet") | Every landmark `position` is `null`. Coordinates are never invented, and nothing has been derived from the mesh yet. |
| §5: `ta2` from a real reference | `ta2` is `null` in all 238 files | No reference was available in the container |
| §5: `region: [appendicular, lower_limb, thigh]` | `region` uses hierarchy keys only, e.g. `[appendicular, lower_limb]` | No sub-limb segments exist in the hierarchy |
| §5: paired bones share text (generated, or a base file with overrides) | Generated: you write the left-side file, and `content:mirror` writes the right-side one | The simpler of the two options the spec offers |
| §6 Teeth: isolate a whole tooth type | **Group isolation for every inner tree node** (`grp=` in the URL, an "Isolate" button, `I` on a tree row), plus cross-quadrant tooth-type groups. Legend swatches isolate a region too. | A generalisation of the spec's tooth-type rule (M5, decision 5) |
| §7: colour-by-region | 7 Okabe–Ito colours, lightened 20%. **Teeth stay ivory.** The choice is stored in `localStorage` and in the URL as `color=region`. | The palette has 7 usable colours (the 8th is black). The colours pass a ΔE2000 ≥ 8 test under simulated deuteranopia and protanopia. |
| §7: labels that never overlap | Greedy layout by priority. With nothing isolated, only objects at least 32 px in radius on screen get a label, so about 25 show with the full skeleton. | Labelling all 234 bones at once is unreadable |
| §7: the sidebar is left and collapsible | It starts **closed**. The Search button or `/` opens it. | The first view stays as it was before M5 |
| §7: toolbar, phone icons only | Toolbar items are Search, Home, Views, Related / Region, Ghosts and a **"More"** menu (ghost opacity, explode, labels, colour, screenshot, share, settings), which the toolbar uses whenever the buttons don't fit | Too many tools for the width |
| §7 URL: `ghost=1` | `ghost` stores the mode (ghost or hide); `grp`, `color` and `lod` were added | The extra features need them |
| §8: supported browsers | The automated tests run in Chromium only. Measured on real hardware: Chrome on a PC and Safari on an iPhone. | The container has only Chromium, and its instructions forbid `playwright install`. |
| §9: validation runs in CI | CI (`deploy.yml`) runs `npm run check`: tsc, Vitest, `check-models`, `validate-content`. **Playwright doesn't run in CI.** | The e2e suite takes about 19 minutes with software WebGL. It is run by hand in each session. |
| §11: commit at the end of every phase | Work went in milestones (one per phase), each with a hosted `/m<N>/` snapshot | Extra requirement from the user |
| §13: no reviewer | Unchanged. All 238 files are `reviewed: false` and the panel shows the draft note. 36 open questions are in `content/QUESTIONS.md`. | Still open |

---

## 8. Known bugs, shortcuts and loose ends

**Content**
- All text was drafted from memory of standard references (Gray's, TA Latin terms), not checked line by line against them. Nothing is reviewed.
- `content/QUESTIONS.md` lists 36 uncertain choices: articulations left out or recorded but doubtful, region sets, and text details.
- No landmark positions, TA2 IDs or articulation `surfaces` exist yet.

**Geometry**
- 7 objects (8 meshes) are still non-manifold (see §7).
- Per-bone AO leaves the inside of the mandible's alveoli and the molars' pulp chambers dark. `AO_FLOOR` softens this.
- The source has the little toe's middle and distal phalanges separate. That matches the 206 count, but they are often fused in real skeletons.

**Performance and the build**
- The main JavaScript bundle is one 1.7 MB chunk (450 KB gzipped). Vite warns about chunks over 500 kB. Content (30 KB gzipped) and search (9 KB gzipped) are already lazy chunks.
- The Vite config triggers "configLoader: native" warnings: imports without extensions and a JSON import without attributes. They are harmless today.
- `THREE.Clock` deprecation warning, and `KHR_parallel_shader_compile` unsupported (SwiftShader only).
- `?lod=high` (a debug override) skips the low model, so the browser warns that the preloaded file went unused.
- `?debug` reads pixels for its bounds and timing checks, so the GPU driver logs "GPU stall due to ReadPixels". This happens only with `?debug`.
- Load times have only been measured on the container's software GPU (§6).

**Testing gaps**
- Playwright isn't in CI.
- Firefox, Edge and WebKit/Safari aren't automated.
- The step-12 browser table is empty.
- No screen-reader (VoiceOver) pass has been done. The keyboard pass is scripted (`tests/e2e/keyboard.spec.ts`).

**Hand checks never formally closed (from M3 and M4)**
- Orbit feel after panning and zooming.
- The handover from two fingers to one on touch.
- The panel and the sheet on real devices.
- How Explode feels on a phone.

**Fixed flake.** The camera-URL test (`viewer.spec.ts`) was flaky in session N. It was a test race against camera-controls' `rest` and `sleep` events, and was fixed in session O.

**Accepted shortcuts**
- **Pickability.** Ghosts can't be picked, so at tier 0 another bone can't be clicked directly (see §7).
- **Explode direction.** Explode moves bones along the line between box centres, not along joint axes.
- **Label threshold.** Labels use a fixed 32 px size threshold with nothing isolated.
- **Search scope.** Search covers names, Latin names, common names, synonyms and FDI numbers. It doesn't search the summary text.
- **Deploy.** The site deploys only from `main` through `.github/workflows/deploy.yml`. A second Pages workflow would overwrite it.
- **Frozen milestones.** `deploy/pages.json` has `"current": null`. A new milestone must set `current` before its `/m<N>/` is built.
