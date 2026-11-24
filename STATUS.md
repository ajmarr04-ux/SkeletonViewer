# Skeleton Viewer: project status

Written 2026-11-19 after Milestone 5; brought up to date for Milestones 6 to 10 on 2026-11-24 (M10 session AQ). This file is for whoever writes the next spec. It records what exists, how it works, what was measured, and where the build departs from the two specs.

There are two specs. `SPEC (2).md` is the bone spec (it calls itself `SPEC.md`, but the file was never renamed) and covers M1–M5. `SPEC-musculoskeletal.md` extends it with muscle, ligament and cartilage layers and covers M6–M10; it wins where the two conflict. `/m1/` to `/m9/` are live and frozen on GitHub Pages (`README.md` has the links), and the main site at https://ajmarr04-ux.github.io/SkeletonViewer/ follows `main`.

**Where M10 stands.** Sessions AK (labels for every kind), AL (colour vision), AM (announcements), AN (keyboard) and AQ (this file) are done on branch `claude/keen-clarke-32a10a`. AO (measurement and the real-device gate) and AP (the user's results) were **skipped at the user's request**, so every real-device figure for the new layers that M7 didn't already take is marked *unmeasured* below. AR (wrap-up: full e2e, merge, `/m10/`, freeze, programme close) is not done, and M10 is not on `main` yet.

`STATUS-M10.md` is a companion written in the same week: it looks forward to the full-body phase (organs, vessels, nerves), with an audit of the remaining Z-Anatomy collections and the risks for that phase. This file describes the build as it is.

---

## 1. Folder layout (two levels, tracked files only)

```
/
├─ SPEC (2).md               the bone spec (M1–M5)
├─ SPEC-musculoskeletal.md   the layer spec (M6–M10); wins where they conflict
├─ STATUS.md                 this file
├─ STATUS-M10.md             forward look for the next phase: remaining collections, risks
├─ CLAUDE.md                 working notes for Claude Code sessions (key-file table, rules, status)
├─ README.md                 milestone table with hosted links
├─ index.html                Vite entry; preloads the low-detail bone model
├─ package.json, package-lock.json, tsconfig.json, vite.config.ts, playwright.config.ts
├─ .claude/agents/           content-writer, mesh-auditor, verifier (subagents, docs/WORKFLOW.md §6)
├─ .github/workflows/        deploy.yml: npm run check, then build-pages.sh, then GitHub Pages
├─ assets/
│  ├─ audit/                 REPORT.md + z-anatomy.json (bones); REPORT-soft-tissue.md + soft-tissue.json (M6);
│  │                         REPORT-body-systems.md + body-systems.json (collections 5–9, for the next phase)
│  ├─ build/                 REPORT.md + manifest.json (bones); REPORT-soft-tissue.md + manifest-{muscles,
│  │                         ligaments,cartilage,attachments}.json (M6); REPORT-patches.md (patch vs content, M9)
│  └─ mapping/               source-to-id.json (bones); soft-to-id.json (soft tissue: map, merged, missing,
│                            missingNoId, excluded, attachments, notes)
├─ content/
│  ├─ bones/                 238 files, <id>.md (front matter + 40–80-word summary)
│  ├─ muscles/               537 files: 408 muscles + 129 parts (M8)
│  ├─ ligaments/             302 files (M8)
│  ├─ cartilage/             61 files: cartilage, discs, menisci (M8)
│  ├─ ids.json               the 238 bone and tooth IDs (generated)
│  ├─ soft-ids.json          the 900 soft-tissue IDs (generated, M6)
│  ├─ articulations.json     357 articulation pairs
│  ├─ joints.json            47 functional joints, each a set of articulation pairs (M8)
│  ├─ movements.json         24 allowed movements and 10 antagonist pairs (M8)
│  ├─ regions.json           238 bone tier-2 sets
│  ├─ hierarchy.json         axial / appendicular / dentition tree
│  ├─ muscle-hierarchy.json  muscles by region → group → muscle (M8)
│  ├─ muscle-depth.json      depth 1/2/3 per side-free muscle key (M7)
│  ├─ attachment-migration.json  frozen record of the old muscleAttachments strings (M8)
│  ├─ synonyms.json          extra search terms, bone and soft IDs, plus soft "groups" (M5, M9)
│  └─ QUESTIONS.md           139 open anatomical and design choices for a reviewer
├─ deploy/
│  ├─ pages.json             frozen milestone commits m1–m9; "current": 10
│  └─ README.md
├─ docs/
│  ├─ PLAN-milestone-1.md … PLAN-milestone-10.md   per-milestone plans, decisions and session notes
│  ├─ WORKFLOW.md            sessions, handoffs and subagents (adopted in M8)
│  ├─ HANDOFF.md             the last session's handoff
│  ├─ batches/M8-AC/         the one content fan-out: BRIEF.md and items.json
│  ├─ m6/                    four screenshots of the M6 debug layer view
│  └─ BACKLOG.md             requests from the user (entry 1 was built in M3; nothing open)
├─ public/
│  ├─ models/                skeleton-, muscles-, ligaments-, cartilage-, attachments-{high,low}.glb (10 files)
│  ├─ ATTRIBUTION.md         credits (compiled into the app at build time)
│  └─ fallback.png           shown when WebGL 2 is missing
├─ scripts/
│  ├─ blender/               audit_source.py, build_skeleton.py (bones); audit_soft_tissue.py,
│  │                         build_soft_tissue.py, pipeline_lib.py (shared steps) (M6)
│  ├─ mapping/               generate_ids.py; classify_soft_tissue.py, generate_soft_ids.py (M6)
│  ├─ content/               mirror.ts, build-hierarchy.ts; attachment-match.ts, migrate-attachments.ts,
│  │                         attachment-check.ts (M8); patch-check.ts (M9)
│  ├─ lib/                   content-plugin.ts, search-data.ts, content-files.ts, model-checks.ts,
│  │                         model-versions-plugin.ts, soft-ids-plugin.ts, soft-tree-data.ts
│  ├─ setup-blender.sh, build-models.sh, build-soft-tissue.sh, compress-models.sh, check-models.ts
│  ├─ validate-content.ts, build-content.ts, build-search-index.ts
│  ├─ build-pages.sh         live site plus frozen /m<N>/ snapshots
│  └─ perf-load.ts           throttled load-time measurement
├─ src/
│  ├─ main.tsx, App.tsx, styles.css
│  ├─ scene/                 Viewer, loading, BatchedMesh, isolation and layer view, outlines, tints, labels,
│  │                         explode, screenshot, bench, layer registry, debug layer view
│  ├─ layers/                (lazy chunk) LayerScenes, loadLayer, hashed URLs, soft ID table, layer colours
│  ├─ camera/                CameraRig (camera-controls + own pan/zoom), pure maths, input helpers
│  ├─ state/                 zustand store, URL parse/serialise, isolation reducer, history wiring
│  ├─ content/               schemas, validation, compilers, relations, soft tiers, roles, derive, search,
│  │                         trees, groups, names, announcements, depth
│  └─ ui/                    InfoPanel, Sidebar, Toolbar, LayersPanel, Legend, Labels, Announcer, etc.
└─ tests/
   ├─ *.test.ts              37 Vitest files (561 tests)
   └─ e2e/                   23 Playwright specs (about 160 tests)
```

Not tracked: `.cache/`, which holds the Blender venv, the pinned source and the uncompressed builds, fetched or written by `scripts/setup-blender.sh` and the build scripts.

---

## 2. 3D model source

- **Source:** Z-Anatomy, `Startup.blend` from https://github.com/Z-Anatomy/Models-of-human-anatomy, pinned to commit `71919ee`. Bones come from `1: Skeletal system` (M1). The soft tissue comes from `3: Joints` and `4: Muscular system`, the cartilage meshes in `1: Skeletal system`, and the origin/insertion patches in `2: Muscular insertions` (M6). Collections 5–9 are audited but unused (`STATUS-M10.md` §9).
- **Licence:** Z-Anatomy is **CC BY-SA 4.0** (Gauthier Kervyn and Marcin Zielinski). Its meshes come from **BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan**. The spec lists BodyParts3D as CC BY 4.0, but Z-Anatomy credits it as CC BY-SA 2.1 JP, so the app credits both as Z-Anatomy does. The result is share-alike: anything built from these meshes must stay CC BY-SA. `public/ATTRIBUTION.md` names the collections used and every model file.

### Bones (M1)
Audit in `assets/audit/REPORT.md`, mapping in `assets/mapping/source-to-id.json`, pipeline `scripts/blender/build_skeleton.py`. Details in §3.

### Soft tissue (M6)
- **Audit** (`scripts/blender/audit_soft_tissue.py` → `assets/audit/soft-tissue.json`, then `scripts/mapping/classify_soft_tissue.py` → `REPORT-soft-tissue.md`; `npm run audit-soft`). Every mesh classed as muscle, part, tendon, ligament, cartilage, disc, meniscus, patch or excluded type, with left/right pairing and the spec's stop conditions answered. **The source has no articular cartilage**; the user decided on 2026-11-20 to go on without it.
- **Patches are usable** (M6 decision 12): 98 % of `2: Muscular insertions` lies within 1 mm of a bone or cartilage surface. They are exported as geometry only; the names can be wrong (the rectus abdominis pair looks swapped), so origins and insertions in the content come from references.
- **Mapping** (`scripts/mapping/generate_soft_ids.py`, `npm run soft-ids` → `content/soft-ids.json`, `assets/mapping/soft-to-id.json`). 838 mapped IDs, 23 merges (each intervertebral disc with its nucleus pulposus), 4 IDs with no mesh, 15 structures missing with no ID, 269 source objects excluded (bursae 78, fascia 38, joint capsules 34, tendon sheaths 26, retinacula 18, intermuscular septa 14, and smaller groups). Parts exist only where the source splits a muscle along anatomical lines; meshes are never cut (M6 decision 3). The judgement calls are tables in the generator and QUESTIONS 37–62.
- **Build** (`scripts/blender/build_soft_tissue.py`, shared steps in `pipeline_lib.py`; `npm run build-soft [-- --layer X]`, about 8 minutes). The same steps as the bones: evaluated mesh × world matrix once, winding reversed for the 739 mirrored left-side duplicates, merge by distance, delete loose and duplicate geometry, fill holes up to 100 edges, origin to bounds centre (origin only), per-object AO into `COLOR_0`, decimate per object to the layer budget. **The bounds check fails loudly**: all 1,534 objects match the audit's world bbox within 1e-4 m (where cleanup deleted a stray loose vertex, the shrink is recorded in the manifest's `boundsCheck`). The bone files were never rebuilt and stay byte-identical to M5. Report: `assets/build/REPORT-soft-tissue.md` (holes filled, objects still non-manifold).

---

## 3. Loading and rendering

### Files
`public/models/`, glTF binary, gltfpack with Meshopt, `KHR_mesh_quantization`, 14-bit positions (`gltfpack -cc -kn -kv -vp 14`):

| File | Nodes | High triangles | Low triangles | High file | Low file | Max bounds drift |
| --- | --- | --- | --- | --- | --- | --- |
| skeleton | 234 | 499,981 | 149,913 | 2.59 MB | 0.91 MB | 0.014 mm |
| muscles | 477 | 799,750 | 229,800 | 4.62 MB | 1.61 MB | 0.285 mm (low) |
| ligaments | 300 | 119,938 | 39,934 | 0.85 MB | 0.44 MB | 0.019 mm |
| cartilage | 61 | 79,965 | 29,976 | 0.44 MB | 0.20 MB | 0.004 mm |
| **four layers** | 1,072 | **1,499,634** (budget 1.5 M) | **449,623** (budget 450 k) | 8.50 MB | 3.16 MB | |
| attachments (patches) | 697 | 149,676 | 49,772 | 1.29 MB | 0.79 MB | 0.010 mm |

Each node is named by its stable ID and has one unnamed child holding the quantised mesh. `npm run check-models` checks all ten files: names exactly match the `meshAvailable: true` IDs (and the 697 patch keys), size and triangle budgets, and every node's world bounds against its manifest within 1 mm (logic in `scripts/lib/model-checks.ts`). The patches load only when a muscle is at tier 1 or 2, so loaded triangles can go over 1.5 M then, though isolation draws only a small part of them.

### Load order
`src/scene/Viewer.tsx`, `loadSkeleton.ts`, `lod.ts`:
1. `index.html` preloads `skeleton-low.glb`.
2. The low model is parsed and shown.
3. The high model's download starts as soon as the low one is parsed (`prefetchModel`), then the batches are swapped.
4. The automatic choice (`chooseLod`) stops at low on small screens, low device memory or weak or software GPUs. `?lod=low|high|both` and the Settings menu override it.
5. **Layers** (M7): nothing for a layer is fetched until it is first turned On or Ghost. Then the lazy `LayerScenes` chunk mounts one `TissueLayerScene` per layer, which follows the same LOD plan, with content-hashed file URLs (`virtual:skeleton-model-versions`) and byte progress (`src/layers/urls.ts`, `loadLayer.ts`). The store's `layerLoad[layer]` holds status, LOD, bytes and errors; the Layers panel shows progress and Retry. A scene stays mounted after its layer is turned off. The soft-tissue ID table (`virtual:skeleton-soft-ids`, 11 kB) is one lazy chunk for all three layers. Layer files are **not** prefetched (the fallback planned for a real-device miss was never needed or taken).

### Rendering: `THREE.BatchedMesh`
- **Bones** (`src/scene/batchSkeleton.ts`): all 234 in one solid `BatchedMesh` with per-instance visibility and colour, plus a **second batch for the ghosts** (translucent, sorted back to front, no depth writes). The instance matrix is the glTF mesh's world matrix; vertices are copied still quantised and never moved.
- **Layers** (`batchLayer`, the generalised `batchSkeleton.ts`): per tissue layer one solid and one ghost batch, with their outlines; the patches add one more solid batch. The batches live in a main-chunk zustand store, `useLayerBatches` (`src/scene/layerRegistry.ts`), built by `LayerScenes` and driven by `Isolation.tsx`. Ghost batches draw after the solids in a fixed order (bones 0, cartilage 1, ligaments 2, muscles 3).
- **The view** (`src/scene/isolation.ts`): `sceneView` computes, per layer, a `LayerShow` of `{ solid: Set | null, rest: "ghost" | "hidden" }` from the layer modes (On / Ghost / Off), the isolation, the muscle depth peel and Hide; `applyLayerView` writes it to the batches. A structure is ghosted if its layer is Ghost or the isolation ghosts it. Depth peel and Hide make structures **hidden, not ghosted**, so whatever is under them can be clicked.
- **Muscle depth** (M7, `content/muscle-depth.json`, `src/content/muscleDepth.ts`): 209 side-free keys with depth 1, 2 or 3 (67 superficial, 62 intermediate, 80 deep); parts inherit unless listed. Three stops: All · Hide superficial · Hide superficial + intermediate. The rules are `peeled`/`peeledAt` in `softRegistry.ts`.
- **Hide** (M7): per structure (a muscle hides all its parts), by `X`, the panel, or the Tab cursor; the "N hidden · Show all" chip and `Shift+X` show them again; `hid=` in the URL keeps the first 100.
- **Tints and patches** (M9, `src/scene/tints.ts`, `withTints`): at a muscle's tiers, origins are yellow, insertions blue and antagonists purple. A patch is drawn only where the content names its bone in that role; otherwise the whole structure is tinted. Tendons and aponeuroses are drawn in a lighter shade than muscle.
- **Picking:** one ray against the solid batch of every layer that has one (`nearestPickable`, `CameraRig.tsx`, three-mesh-bvh per geometry); the nearest hit wins. Ghosts and hidden structures are never pickable. The tiny-object hit proxies (`src/scene/pick.ts`: radius under 2 cm, 22 px touch, 6 px mouse) apply to every layer.
- **Outlines** are **inverted hulls** (`src/scene/outline.ts`) sharing the solid batch's buffers: 3 px selection, 1.5 px hover, one draw call each. A selected muscle outlines each of its parts (`MAX_PARTS`).
- **Draw calls:** 2 for the full skeleton; 3 with a bone isolated; 4 with every layer solid; 2 with muscles ghosted over bones; **9** with every layer on, the long head of triceps at tier 2 and antagonists (8 at tier 1). Budget < 20.
- **Lighting:** one key light, three's `RoomEnvironment`, baked AO remapped by `AO_FLOOR` (`src/scene/material.ts`). No shadows.
- **Colours** (`src/layers/colours.ts`, checked as one table in `tests/colourVision.test.ts`): bone ivory, muscles `#b44d43`, tendon/aponeurosis `#c18274`, ligaments `#cccccc`, cartilage `#c5dfee`, focus accent `#a7caf2`, hover outline `#f1f3f4`, plus the three tints and seven region colours. M10 AL moved the four layer colours (see §7).
- **Missing meshes.** The 4 wisdom teeth have content and tree rows and show a "No 3D model" note. Of the soft IDs with no mesh, the 58 muscles with parts are drawn as their parts; the patellar ligament and articularis genus (each side) show the same note.
- **Debug view.** M6's `?debug&layers=all` (`src/scene/debugLayers.ts`) still draws every layer and patch in fixed debug colours, beside the real layers.

---

## 4. Content data: types, formats and one real example of each

The bone schemas are in `src/content/schema.ts`, the soft-tissue ones in `src/content/softSchema.ts` (zod; scripts and tests only, never in the main chunk). `npm run validate-content` enforces both; it runs in `npm run check`, before every build, and in CI. Left and midline files are written by hand; `npm run content:mirror` writes the right-side files, and validation fails if they drift.

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
  // muscleAttachments: string[] was removed in Milestone 8 (session AD): each bone's muscle list is
  // now derived from the muscle files' origins and insertions (src/content/compile.ts, boneMuscleLists).
  clinicalNote: string | null;
  reviewed: boolean;
};
// Body: Markdown, 40 to 80 words (BODY_WORDS), rendered to HTML at build time.
```

The compiled form that the panel reads (`src/content/compile.ts`, served as the lazy virtual module `virtual:skeleton-content`, 42 kB gzipped since the derived muscle lists were added):

```ts
type CompiledEntry = {
  latin: string; common: string | null; region: string[];
  type: FrontMatter["type"]; toothType: FrontMatter["toothType"];
  functions: string[]; landmarks: string[]; landmarkPositions: number;
  muscles: string[]; clinical: string | null;   // muscles: derived Origins/Insertions rows (M8, M9)
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
clinicalNote: "The patella can dislocate sideways, usually in young people with shallow femoral grooves; vastus medialis helps to hold it in place."
reviewed: false
---
The patella is the kneecap, the largest sesamoid bone in the body. It sits in the tendon of quadriceps femoris, which continues below it as the patellar ligament to the tibia. Its back is covered with thick cartilage and glides in the groove between the femoral condyles, articulating with the femur only. It holds the tendon forward, improving the pull of the quadriceps.
```

136 bone files were written (midline and left); `content:mirror` generates the other 102.

### Canonical ID lists

`content/ids.json` (generated by `scripts/mapping/generate_ids.py`):

```json
{ "id": "patella_left", "name": "Patella", "kind": "bone", "side": "left", "group": ["appendicular", "lower_limb"], "meshAvailable": true }
{ "id": "tooth_38", "name": "Lower left third molar", "kind": "tooth", "side": "left", "group": ["dentition", "lower", "left", "molars"], "meshAvailable": false }
```

`content/soft-ids.json` (generated by `scripts/mapping/generate_soft_ids.py`; 900 entries, ordered by layer, source group, then anatomically). `kind` is `muscle | muscle_part | ligament | cartilage | disc | meniscus`; parts carry `parent` and `partType` (`head | belly | portion | tendon | aponeurosis`), muscles with parts carry `parts`. `latin` is `null` here (the source names are English; Latin is in the content). Real entries:

```json
{"id": "triceps_brachii_left", "name": "Triceps brachii", "latin": null, "kind": "muscle", "layer": "muscles", "side": "left", "group": ["muscular_system_upper_limb", "upper_limb", "posterior_compartment_arm"], "parts": ["triceps_brachii_lateral_head_left", "triceps_brachii_long_head_left", "triceps_brachii_medial_head_left"], "meshAvailable": false}
{"id": "triceps_brachii_long_head_left", "name": "Long head of triceps brachii", "latin": null, "kind": "muscle_part", "layer": "muscles", "side": "left", "group": ["muscular_system_upper_limb", "upper_limb", "posterior_compartment_arm"], "parent": "triceps_brachii_left", "partType": "head", "meshAvailable": true}
{"id": "anterior_cruciate_ligament_left", "name": "Anterior cruciate ligament", "latin": null, "kind": "ligament", "layer": "ligaments", "side": "left", "group": ["joints_lower_limb", "joints_free_lower_limb", "synovial_joints_free_lower_limb", "knee_joint"], "meshAvailable": true}
```

**Final counts:**

| Kind | IDs | With a mesh | Notes |
| --- | --- | --- | --- |
| Bones | 206 | 206 | |
| Teeth | 32 | 28 | The 4 third molars have no mesh |
| Muscles | 408 | 348 | No mesh: 58 parents (drawn as their parts) and articularis genus each side (missing) |
| Muscle parts: heads, bellies, portions | 114 (58 + 16 + 40) | 114 | |
| Muscle parts: tendons, aponeuroses | 15 (10 + 5) | 15 | Drawn in the tendon shade |
| Ligaments | 302 | 300 | Patellar ligament each side missing |
| Cartilage (costal, labra) | 24 | 24 | |
| Discs (intervertebral, symphyses, articular discs) | 25 | 25 | 23 merged with their nucleus pulposus |
| Menisci | 12 | 12 | |
| **Total** | **1,138** | **1,072** | plus 697 patches, which are not selectable IDs |

### Muscle and muscle part: `content/muscles/<id>.md` (M8)

```ts
// src/content/softSchema.ts (abridged)
attachmentSchema = z.union([
  z.strictObject({ structure: snake, landmark: snake.optional() }),   // a bone or soft ID, optionally a landmark
  z.strictObject({ soft: text }),                                     // a non-object, e.g. "thoracolumbar fascia"
]);
actionSchema = z.strictObject({ joint: snake, movement: snake, role: z.enum(["prime", "assist", "stabiliser"]) });
muscleSchema = z.strictObject({ id, kind: z.literal("muscle"), name, latin, commonName: text.nullable(), side,
  region: z.array(snake).min(1), compartment: snake.nullable(), parts: z.array(snake),
  origin: z.array(attachmentSchema), insertion: z.array(attachmentSchema), actions: z.array(actionSchema),
  functions: z.array(text).min(1).optional(), innervation: text, clinicalNote: text.nullable(),
  synergistOverrides: z.strictObject({ add, remove }).optional(), reviewed: z.boolean() });
musclePartSchema = z.strictObject({ id, kind: z.literal("muscle_part"), partType, parent: snake.nullable(),
  alsoServes: z.array(snake), name, latin, commonName?, side,
  origin: inheritable, insertion: inheritable,      // "inherit" = take the muscle's
  actions, functions?, innervation?, clinicalNote?, reviewed });
// Body: Markdown, 40 to 80 words (SOFT_BODY_WORDS).
```

Real example, `content/muscles/triceps_brachii_left.md` (front matter abridged):

```yaml
id: triceps_brachii_left
kind: muscle
latin: Musculus triceps brachii
region: [upper_limb, arm]
compartment: arm_posterior
parts: [triceps_brachii_long_head_left, triceps_brachii_lateral_head_left, triceps_brachii_medial_head_left]
origin: []                       # every part declares its own
insertion:
  - { structure: ulna_left, landmark: olecranon }
actions:
  - { joint: elbow_joint_left, movement: extension, role: prime }
innervation: Radial nerve (C6–C8)
reviewed: false
```

The calcaneal tendon's parent is gastrocnemius, with `alsoServes: [soleus_left]` (QUESTIONS 37). **Synergists and antagonists are never written**: they are derived (`src/content/derive.ts`) from shared joint and movement (prime/assist) and from `movements.json`'s antagonist pairs, with `synergistOverrides` for exceptions.

### Ligament: `content/ligaments/<id>.md` (M8)

```ts
ligamentSchema = z.strictObject({ id, kind: z.literal("ligament"), name, latin, commonName, side,
  joint: snake.nullable(),            // null only for an allow-listed set that crosses no joint
  connects: z.array(snake).min(1), functions: z.array(text).min(1), clinicalNote, reviewed });
```

```yaml
# content/ligaments/anterior_cruciate_ligament_left.md (abridged)
kind: ligament
commonName: ACL
joint: knee_joint_left
connects: [femur_left, tibia_left]
functions:
  - Limits anterior translation of the tibia on the femur
  - Resists hyperextension and rotation of the knee
```

### Cartilage, disc, meniscus: `content/cartilage/<id>.md` (M8)

```ts
cartilageSchema = z.strictObject({ id, kind: z.enum(["cartilage", "disc", "meniscus"]), name, latin,
  commonName?, side, joint: snake.nullable(), attachedTo: z.array(snake).min(1), functions, clinicalNote, reviewed });
```

```yaml
# content/cartilage/medial_meniscus_left.md (abridged)
kind: meniscus
joint: knee_joint_left
attachedTo: [tibia_left, tibial_collateral_ligament_deep_part_left]
functions: [Deepens the articular surface …, Spreads load …, Adds to the stability of the knee]
```

Soft content compiles per layer (`src/content/softCompile.ts`) into the lazy modules `virtual:skeleton-soft-content-{muscles,ligaments,cartilage}` (127, 42 and 8.5 kB gzipped), which also carry the precomputed tier sets (§5).

### Articulations and functional joints

`content/articulations.json` (357 entries, one per bone pair, looked up from either side):

```ts
type Articulation = { a: string; b: string; joint: string; name: string; surfaces?: Record<string, string> };
```
```json
{ "a": "femur_left", "b": "patella_left", "joint": "patellofemoral_joint_left", "name": "Patellofemoral joint" }
```

Every object appears in at least one entry (the hyoid is allowlisted). Each tooth has a gomphosis entry with its maxilla or the mandible.

`content/joints.json` (M8, 47 entries): a **functional joint** is a named set of articulation `joint` IDs, so an action can say `elbow_joint_left` when `articulations.json` has only humero-ulnar and humeroradial pairs.

```json
{ "id": "shoulder_girdle_left", "name": "Joints of the shoulder girdle", "side": "left", "articulations": ["sternoclavicular_joint_left", "acromioclavicular_joint_left"] }
```

### Movements: `content/movements.json` (M8)

```ts
type Movements = { movements: string[]; antagonistPairs: [string, string][] };  // 24 movements, 10 pairs
```
```json
{ "movements": ["flexion", "extension", "abduction", …, "circumduction", "stabilisation"],
  "antagonistPairs": [["flexion", "extension"], ["abduction", "adduction"], …] }
```

### Regions and hierarchies

`content/regions.json`: `Record<string, string[]>`, bone ID → tier-2 additions on top of tier 1 (all 238 IDs), e.g. `{ "femur_left": ["sacrum", "coccyx", "hip_bone_right", "fibula_left"] }`.

`content/hierarchy.json` (bones) and `content/muscle-hierarchy.json` (M8) share one shape:

```ts
type HierarchyNode = { key: string; label: string; children: (HierarchyNode | string)[] };  // string = object ID
```

Bones: three roots (axial, appendicular, dentition); the skull splits into `cranial`, `facial`, `ossicles` and `hyoid`; dentition is `dentition.upper|lower` → `.right|left` → tooth type → teeth. The sidebar adds cross-quadrant tooth-type groups (`dentition.type.*`). Muscles, a real excerpt:

```json
{ "key": "head", "label": "Head", "children": [
  { "key": "scalp", "label": "Scalp (epicranius)", "children": ["occipitofrontalis_left", "temporoparietalis_left"] }, … ] }
```

Ligaments (by joint) and cartilage (by kind, then joint) have no hierarchy file: their tree is built from `joint` and `kind` (`src/content/softTree.ts`).

### Muscle depth: `content/muscle-depth.json` (M7)

`Record<string, 1 | 2 | 3>`, keyed by side-free muscle or part ID; parts inherit their muscle's depth unless listed. `{ "abductor_pollicis_longus": 2, "adductor_magnus": 3, "biceps_brachii": 1, … }`. Uncertain calls: QUESTIONS 63–69.

### Synonyms: `content/synonyms.json` (not in either spec)

`Record<string, string[]>` of extra search terms, keyed by left and midline IDs (bone or soft; an entry applies to both sides), plus since M9 a `groups` section of named search sets that isolate as soft groups:

```json
"groups": { "muscles.upper_limb.shoulder.rotator_cuff": { "terms": ["rotator cuff muscles", "SITS muscles"] }, … }
```

### Attachment migration: `content/attachment-migration.json` (M8)

The frozen record of how each bone's old hand-written `muscleAttachments` strings map to muscle and part IDs (`npm run content:migrate-attachments`; checked both ways by `scripts/content/attachment-check.ts`). The bones' muscle lists are now derived from the muscle files.

---

## 5. Selection and isolation tiers

| Concern | Where |
| --- | --- |
| State: `sel`, `tier`, `grp`, `ghostMode`, `hovered`, `keyCursor`, `joint`, `explode`; `layers`, `muscleDepth`, `layerLoad`, `hidden`, `antagonists` | `src/state/store.ts` (zustand) |
| The spec §6 state machine as a pure reducer, with nested selection | `src/state/isolation.ts`: `isolationStep(state, action, parentOf) → { state, history }`, `resolveClick` |
| Applying it: store, URL, history | `src/state/selection.ts`: `dispatchIsolation`, `selectObject`, `clickObject`, `showRelated`, `expandRegion`, `goBack`, `switchSide`, `isolateGroup`, `isolateAttached`, `hideSelected`, `hideStructure`, `showAllHidden`, `onPopState`, `tierBlockedReason` |
| URL format | `src/state/url.ts`: `sel`, `tier`, `grp`, `ghost`, `color`, `cam=px,py,pz,tx,ty,tz[,ox,oy]`, `lod`; `layers=b:on,c:off,l:off,m:ghost[:depth]`, `hid=`, `ant=1` |
| Which structures are solid, ghosted or the focus (pure) | `src/scene/isolation.ts`: `isolationView`, `groupView`, `relatedAt`, `sceneView`, `viewOf`, `withJoint`, `withTints`, `drawnColourMode` |
| Writing it to the GPU | `applyIsolationView` / `applyLayerView`, re-applied by `src/scene/Isolation.tsx` on every store change and after an LOD swap |
| Bone tier sets | `src/content/relations.ts`: `tier1` (articulation partners; for teeth, adjacent teeth from FDI numbers), `regionOf`, `visibleAt` |
| Soft tier sets | Built at compile time by `buildSoftTiers` (`src/content/softTiers.ts`), shipped in the lazy content chunks as `tiers` and `reverse`, registered by `softContentLoader.ts` |
| Origins, insertions, antagonists | `src/content/softRoles.ts` (`MuscleRoles`: patches and whole-structure fallbacks per role) |
| Picking | `src/camera/CameraRig.tsx` (≤ 5 px and ≤ 500 ms is a click; double taps), `nearestPickable` across layers, `src/scene/pick.ts` proxies |
| Outlines | `src/scene/outline.ts` (`setOutlineTarget`), `LayerBatches.moreSelected` for a muscle's parts |

How it behaves:

- **States.** The full view, then tier 0, tier 1 and tier 2. A **group** level (`grp`) sits at the depth of tier 0.
- **History.** The reducer returns `push`, `pop`, `replace` or `none`. `push` calls `pushState` with an `skvDepth` marker; `pop` calls `history.back()` when the app pushed that entry, otherwise it replaces it. Back steps out one level.
- **Nested selection** (M9, spec §5.1). Clicking a part selects its **muscle** first (all its parts focused, one outline each); clicking a part of the selected muscle selects the **part**. A part chosen from elsewhere (tree, search, link) goes `via` its muscle in the history, so Back goes part → muscle → out. Breadcrumb: `Muscles › region › muscle › part`.
- **Tiers per kind** (M9):

  | Kind | Tier 1 ("Show related" / "Show attachments") | Tier 2 ("Expand region" / "Show functional group") |
  | --- | --- | --- |
  | Bone, tooth | articulation partners (teeth: neighbours) | the region set from `regions.json` |
  | Muscle, part | its parts plus every structure in its origins and insertions | its synergists plus their attachments; antagonists optional (`ant=1`) |
  | Ligament | its `connects` | every structure at its joint |
  | Cartilage, disc, meniscus | its `attachedTo` | every structure at its joint |

  Related sets include only structures in layers that are **On or Ghost**; an Off layer adds nothing. Buttons are disabled with a reason: "Loading content…" while a layer's tiers are loading, "Not part of a joint" for a `joint: null` structure at tier 2.
- **Bone → muscles.** A bone's panel lists the muscles that originate and insert on it (derived), with row hover. "Show attached muscles" is a group isolation, `grp=attached:<bone>`, and turns the muscles layer On.
- **Soft groups** (M9): every inner node of the Muscles, Ligaments and Cartilage trees isolates as a group (`muscles.<path>`, `ligaments.<joint>`, `cartilage.<kind>[.<joint>]`, `muscles.sets.*` from the synonyms' `groups`), turning its layer On.
- **Selecting moves the pivot, not the view.** A newly selected structure becomes the orbit pivot (`repivot`); the picture stays put. Tiers don't move the camera. `F` frames the selection or the solid set.
- **Ghosts.** Ghosts and hidden structures can't be picked. A click on one, on empty space, or `Esc` steps back.
- **The focus** gets the accent colour and the 3 px outline. At a muscle's tiers, the tints (§3) mark its origins, insertions and (optionally) antagonists; while any tint or patch is drawn, colour-by-region pauses and the bones go back to ivory (M10 AL).
- **Groups and selection exclude each other.** Choosing a member of an isolated group pushes that member at tier 0.

### Panels (M9)
Kind-specific sections (`softSections`, `src/content/softPanel.ts`, rendered by `InfoPanel.tsx`): muscles and parts show Parts / Part of, Origin, Insertion (inherited from the muscle when `inherit`), Actions, Synergists, Antagonists, Innervation, Clinical note; ligaments show Joint and Connects; cartilage, discs and menisci show Joint and Attached to; all show Functions. Every structure named is a link. Bones keep M4's panel model plus the derived Origins/Insertions rows.

### Sidebar and search (M9)
Three soft roots beside the bone tree, loaded lazily (`virtual:skeleton-soft-tree`, 12 kB): Muscles by region → group → muscle → parts; Ligaments by joint; Cartilage by kind. Search merges two prebuilt minisearch indexes by score: bones (9 kB) and soft tissue (37 kB, fetched on the first keystroke).

### Labels, announcements, keyboard (M10)
- **Labels** (AK, `src/scene/labels.ts`): every kind drawn solid can be labelled. One label per muscle, at the union of its parts' bounding spheres; at the part level the parts are labelled. Priorities come from `relatedAt`; within a run of equal priority and radii within 10 %, the focus layer (the selection's, else the topmost On) goes first.
- **Announcements** (AM, `src/content/announce.ts`, driven by `src/ui/Announcer.tsx`): one message per user action, composed from the store's before/after state, in the order: the explicit message or isolation change, antagonists, layers, depth, files. Nothing is said on page load. The full table:

  | Action | Announcement |
  | --- | --- |
  | Layer On / Ghost / Off | "Muscles on." / "Muscles ghosted." / "Muscles off."; first time "Muscles on, loading.", then "Muscles loaded."; "Muscles failed to load. Retry available."; Retry "Muscles loading again." |
  | Preset | "Full musculoskeletal: all layers on." (+ " Loading cartilage and muscles.") / "Skeleton: bones only." |
  | Depth stop | "Superficial muscles hidden: 41 muscles." / "Superficial and intermediate muscles hidden, deep muscles only: 150 muscles." / "All muscles shown." |
  | Hide / Show all | "Biceps brachii, left, hidden. 3 hidden." / "All hidden structures shown." |
  | Part selected | "Long head of triceps brachii, left, selected. Part of triceps brachii." |
  | Muscle tier 1 / 2 | "Triceps brachii, left: attachments shown, 2 bones and 3 parts." / "…: functional group shown, 6 muscles." |
  | Antagonists | "Antagonists shown: 4 muscles." / "Antagonists hidden." / "Antagonists shown: none in the layers showing." |
  | Ligament / cartilage tiers | "Anterior cruciate ligament, left: related structures shown, 2 bones." / "…: joint shown, 4 bones, 5 ligaments and 2 menisci." |
  | Show attached muscles | "Femur, left: attached muscles shown, 20 muscles and 5 parts." (or "…loading.", "…: no muscles attach here.") |
  | Bone tier with soft layers on | M5's wording + " Also 23 muscles and 4 ligaments." / "Femur, left: region shown, 8 bones and 40 muscles." |
  | Selection that turns a layer on | "Triceps brachii, left, selected. Isolated. Muscles on, loading." |

  Counts are by kind; parts count as parts only for the focus's own muscle, otherwise once as their muscle.
- **Keyboard** (AN, `src/camera/input.ts`): M5's keys plus `R` (tier 1), `E` (tier 2), `X` (hide the Tab cursor's structure, else the selection), `Shift+X` (show all hidden). The Tab cursor (`cursorStops`) visits layers in panel order (bones, cartilage, ligaments, muscles) and makes a muscle **one stop** until it or one of its parts is selected; then its parts are stops. The panel buttons and the hidden chip carry `aria-keyshortcuts`. axe-core (WCAG 2.2 A/AA, no rules disabled) runs on every UI state, including the Layers panel while loading, the depth control, a muscle tier with antagonists and every soft panel.

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
| Muscle tier 2 with antagonists | PC / iPhone | *unmeasured* | | 9 (container) | AO's third bench link; AO was skipped |

**Click → highlight:** bones (M3, measured by the user) PC 10 ms, iPhone 55 ms, against budgets of 50 and 100 ms. For a muscle, a part and a ligament: *unmeasured* (AO).

**Load time, bones.** Measured only in the container's headless Chromium with `npm run perf-load`: Fast 4G (9 Mbit/s, 165 ms round trip), 4× CPU slowdown, cold cache, gzip as on Pages, `?lod=both`, median of 3 runs.

| Profile | First skeleton (low) | Full detail (high) | Budget |
| --- | --- | --- | --- |
| Desktop 1280 × 800 (M5) | 1.90 s | 5.96 s | 3 s / 8 s |
| Phone profile, iPhone 13 emulation (M5) | 1.91 s | 6.08 s | 5 s / 12 s |

**M7, every layer off, against M6 in the same container on the same day** (2026-11-20; this container is slower than M5's, so the figures above aren't comparable):

| Profile | M6 (`43dce0e`): skeleton / full detail | M7: skeleton / full detail | M7: muscles on → low LOD shown | Budget (layer) |
| --- | --- | --- | --- | --- |
| Desktop 1280 × 800 | 3.48 s / 6.68 s | 3.25 s / 6.50 s | 7.38 s | 3 s |
| Phone profile | 3.42 s / 6.54 s | 3.19 s / 6.43 s | 7.77 s | 5 s |

**M10 (AR) against M9, same container, same day** (2026-11-24; medians of 3):

| Profile | M9 (`ef6ee75`): skeleton / full detail / muscles on | M10: skeleton / full detail / muscles on |
| --- | --- | --- |
| Desktop 1280 × 800 | 4.16 s / 7.49 s / 10.84 s | 4.47 s / 7.80 s / 9.01 s |
| Phone profile | 4.26 s / 7.68 s / 12.38 s | 4.46 s / 7.79 s / 10.24 s |

Single skeleton runs are bimodal in both builds (1.9 s or about 4.5 s), depending on how long SwiftShader's shader compilation blocks the main thread before the first frame. The low file arrives at about 1.75 s every time, so the bone figures match M9 within noise.

With every layer off, the build loads no slower than M6, requests no layer file or layer chunk, and its bone files are byte-identical to M5's. The muscles layer misses its budget **in the container**: its 1.6 MB low file shows 7–12.6 s after the click across M7–M9 runs (the download alone is about 1.9 s unthrottled, 8.5 s at Fast 4G), because SwiftShader takes hundreds of milliseconds of main-thread time per frame and the streamed file is read between frames. A real GPU doesn't do that. **The real-device figure is unmeasured**: with `?debug`, the layer line in the overlay reads "low shown N s after turned on", and nobody has reported it yet. The user's `?debug` skeleton load on `/m7/`: 360 ms (low) and 483 ms (high) on the PC, 176 ms (low) on the iPhone. The user reported that `/m5/` "loads great on smartphone and pc".

**Label layout** (container, SwiftShader, 4× CPU): M5 bones only, median 2.4 ms, max 12 ms (median 1.1 ms at tier 2). M10 every layer on, median 7.6 ms, max 27.8 ms (13 layouts); triceps at tier 2, median 2.7 ms, max 3.3 ms. Layouts run at most every 100 ms while the camera moves, so no candidate pre-filter was added. Phone figure *unmeasured*.

**JavaScript** (`gzip -9` of `index` plus its modulepreloads, the method used from M6 on):

| Build | Main chunk |
| --- | --- |
| M5 (`71f04d0`, measured in M10 AR) | 451.0 kB (one `index` file; meshoptimizer not yet split out) |
| M6 | 458.4 kB |
| M8 | 460.8 kB |
| M9 | 468.1 kB |
| M10 (AR, final) | 470.1 kB: +2.1 over M9 (M10's budget +5), **+19.1 over M5** (spec budget +150) |

Growth over M5 was measured in AR with the agreed method: M5, M9 and M10 built side by side from the same `node_modules`, every script `index.html` loads eagerly counted with `gzip -9` (one concatenated stream gives the same figures to 0.3 kB). **+19.1 kB against the spec's +150 kB**: the musculoskeletal programme added its content, search data, trees and layer code as lazy chunks, as spec §9 asks. All JavaScript in `dist/assets`, lazy chunks included: M5 518.2 kB, M9 925.5 kB, M10 927.6 kB. Lazy chunks (gzipped): bone content 42.1 kB, muscles content 127.1, ligaments 41.8, cartilage 8.5, bone search 9.1, soft search 36.8, soft tree 12.1, soft ID table 11.0, `LayerScenes` 3.0. Manifests are not shipped to the app except through `?debug`.

**Not measured:** Firefox, Edge, Safari on the Mac and Chrome on Android (the browser table in `docs/PLAN-milestone-5.md`, step 12, is empty); FPS with labels and colour-by-region on a real phone; everything in the M10 budget table that needs a real device (layer load, soft click → highlight, the muscle tier 2 bench). Combinations of layers beyond "all solid" and "muscles ghosted" have not been benched.

---

## 7. Where the build differs from the spec

### The bone spec (`SPEC (2).md`)

| Spec says | What was built | Why |
| --- | --- | --- |
| §1, §9: 238 objects, 32 teeth, and every content file has a mesh | **234 meshes.** The four third molars (`tooth_18/28/38/48`) have IDs and content files but no mesh (`meshAvailable: false`). The validation rule was changed to match. | Z-Anatomy has 28 separate teeth and no wisdom teeth. The user decided to ship without them. |
| §4: BodyParts3D is CC BY 4.0 | It is credited as CC BY-SA 2.1 JP | That is how Z-Anatomy credits it |
| §4, step 2: fix non-manifold geometry | 7 objects (8 meshes, counting both humeri) are still non-manifold: T8, mandible, occipital, ethmoid, sternum, sacrum, both humeri | The leftover edges meet at non-manifold vertices, so a simple fill can't close them. No visible artefacts. |
| §4: bake AO | AO is baked **per bone**, with every other bone hidden | Whole-skeleton AO turned isolated enclosed bones black (ossicles, ethmoid). The cost is losing the contact shading between neighbouring bones. |
| Sternum (spec is silent) | Manubrium, body and xiphoid are joined into one object, `sternum` | This matches the 206 count |
| §1: articular cartilage out of scope unless joints are unreadable | Excluded from the bones layer, including the costal cartilages. The musculoskeletal spec brings costal cartilage, discs and menisci back as their own layer (see below). | Joints were judged readable without it (user decision) |
| §2: selection outline with `postprocessing` OutlineEffect | Inverted-hull outlines (one draw call per outline, sharing the batch's buffers) | Cheaper: no extra full-scene passes, and the renderer keeps MSAA. The spec allows "or the equivalent". |
| §6 Camera: orbit about a focus point that re-centring moves | **Fixed pivot, CAD style.** Pan and zoom shift the view, not the pivot. `cam=` gains an optional `ox,oy` offset. | User request after `/m2/` (`docs/BACKLOG.md`, entry 1). The spec was amended in place. |
| §6: at tier 0, "click another bone: switch focus" | At tier 0 the other bones are ghosts or hidden and can't be picked, so clicking one steps back a level. Switching focus at tier 0 happens through the tree, search or the side toggle. | Ghosts are not pickable, and a click on a ghost counts as empty space. Decided in M3. |
| §6: double-click a related bone at tier 1 or 2 → new focus | A **single** click also does this; the double-click centres the bone as well | One rule everywhere: clicking a solid structure selects it (M4, decision 6) |
| §6: joint hover highlights the `surfaces` landmarks | It highlights **both whole bones** (hover outline on the partner, brighter tint on both) | No landmark has a position, and no articulation has `surfaces`. The spec allows this fallback. |
| §6: Explode pushes bones apart "along each joint's axis" | Each tier-1 bone moves along the line from the focus bone's box centre to its own, by up to 0.5 × its bounding radius | There is no joint-axis data. |
| §7: landmarks toggle shows pinned 3D labels | The toggle is disabled ("no positions yet") | Every landmark `position` is `null`. Coordinates are never invented, and nothing has been derived from the mesh yet. |
| §5: `ta2` from a real reference | `ta2` is `null` in all 238 files | No reference was available in the container |
| §5: `region: [appendicular, lower_limb, thigh]` | `region` uses hierarchy keys only, e.g. `[appendicular, lower_limb]` | No sub-limb segments exist in the hierarchy |
| §5: paired bones share text (generated, or a base file with overrides) | Generated: you write the left-side file, and `content:mirror` writes the right-side one (the same for every soft-tissue kind) | The simpler of the two options the spec offers |
| §6 Teeth: isolate a whole tooth type | **Group isolation for every inner tree node** (`grp=` in the URL, an "Isolate" button, `I` on a tree row), plus cross-quadrant tooth-type groups. Legend swatches isolate a region too. | A generalisation of the spec's tooth-type rule (M5, decision 5) |
| §7: colour-by-region | 7 Okabe–Ito colours, lightened 20%. **Teeth stay ivory.** Stored in `localStorage` and in the URL as `color=region`. Pauses while tints show (M10, below). | The palette has 7 usable colours (the 8th is black). They pass ΔE2000 ≥ 8 under simulated deuteranopia and protanopia. |
| §7: labels that never overlap | Greedy layout by priority. With nothing isolated, only objects at least 32 px in radius on screen get a label, so about 25 show with the full skeleton. | Labelling everything at once is unreadable |
| §7: the sidebar is left and collapsible | It starts **closed**. The Search button or `/` opens it. | The first view stays as it was before M5 |
| §7: toolbar, phone icons only | Toolbar items are Search, Home, Views, Related / Region and Ghosts; ghost opacity, explode, the hidden chip, labels, colour, screenshot, share, Layers and Settings show on the bar when they fit and otherwise go into a **"More"** menu (always on phones) | Too many tools for the width |
| §7 URL: `ghost=1` | `ghost` stores the mode (ghost or hide); `grp`, `color`, `lod`, `layers`, `hid` and `ant` were added | The extra features need them |
| §8: supported browsers | The automated tests run in Chromium only. Measured on real hardware: Chrome on a PC and Safari on an iPhone. | The container has only Chromium, and its instructions forbid `playwright install`. |
| §9: validation runs in CI | CI (`deploy.yml`) runs `npm run check`: tsc, Vitest, `check-models`, `validate-content` and the attachment checks. **Playwright doesn't run in CI.** | The e2e suite takes 20 minutes or more with software WebGL (longer since the muscles load in several specs). It is run by hand in each session. |
| §11: commit at the end of every phase | Work went in milestones (one per phase), each with a hosted `/m<N>/` snapshot | Extra requirement from the user |
| §13: no reviewer | Unchanged. All 1,138 content files are `reviewed: false` and the panel shows the draft note. | Still open |

### The musculoskeletal spec (`SPEC-musculoskeletal.md`)

| Spec says | What was built | Why |
| --- | --- | --- |
| §1, §3: the cartilage layer includes articular cartilage | **No articular cartilage.** The layer has 24 cartilages (costal, labra), 25 discs and 12 menisci. | The source doesn't model it. The user decided on 2026-11-20 to go on without it (`missingNoId`). |
| §3: parts follow anatomy | Parts exist only where the **source splits the mesh** (58 muscles have parts). A muscle modelled as one mesh is a leaf; its heads are described in text only. | Meshes are never cut (M6 decision 3) |
| §3: a tendon has one parent | The calcaneal tendon's parent is gastrocnemius, with `alsoServes: [soleus]` | The spec allows one parent (QUESTIONS 37) |
| §2: everything the anatomy has | **19 structures missing from the source**: 4 have IDs and no mesh (patellar ligament and articularis genus, each side); 15 have no ID (craniovertebral ligaments, anterior tibiotalar ligament, quadriceps tendon, auricular and ossicle muscles, most soft-palate and perineal muscles, subcostales, psoas minor) | Absent from Z-Anatomy (`soft-to-id.json` `missing`, `missingNoId`) |
| §3: one ID per source structure | The nucleus pulposus is **merged into its disc** (23 merges) | It lies inside the disc and is never visible on its own |
| §4.3: an action's `joint` is an articulation ID | `joint` may be a **functional joint** from `content/joints.json` (47, e.g. `elbow_joint_left` = humero-ulnar + humeroradial pairs) | `articulations.json` is one entry per bone pair; there is no "elbow" in it (M8 decision 2) |
| §4.4: a ligament's `joint` is required | `joint: null` for an allow-listed set (inguinal ligament, interosseous and obturator membranes, sacrospinous and sacrotuberous ligaments, …); their tier 2 is blocked with "Not part of a joint" | They bridge bones without crossing a joint (M8 decision 3) |
| §4.4–4.5: no body length given | 40–80 words for ligaments and cartilage, the same as muscles | M8 decision 5 |
| §5.2: "isolation overrides layer toggles" | Related sets show only structures in layers that are **On or Ghost**; an Off layer adds nothing | User, 2026-11-20 (M9 decision 3) |
| §5.3: origins and insertions highlighted with the patches | A patch is drawn **only if the content names the bone it lies on in that role**; otherwise the whole structure is tinted. 512 of 697 patches can be drawn; 185 never are; 1,373 content attachments have no patch and are tinted whole. | Many patch names disagree with the content; the content wins (M9 decision 6, `assets/build/REPORT-patches.md`, QUESTIONS 132–134) |
| §5.2: a structure both synergist and antagonist shows as synergist, **with a QUESTIONS entry for each** | Shown as synergist, but the 846 pairs (423 left and midline) are listed in `REPORT-patches.md`, not filed one by one | Too many to file individually |
| §5.4: bone → muscle cross-link | "Show attached muscles" is a group isolation, `grp=attached:<bone>`, which turns the muscles layer On | It reuses the group reducer and Back |
| §5.5: Hide stored in the URL, "capped" | `hid=` keeps the first 100 IDs; a toast says so | The URL length limit |
| §6.2: 4-stop depth control | **3 stops** (All · Hide superficial · Hide superficial + intermediate) | The fourth, "Deep only", equalled the third (user, M7 session V) |
| §11: the depth file is M8 | `content/muscle-depth.json` was written in M7 | Needed for the depth control on `/m7/` (user checkpoint) |
| §6.3: "muted red / pale grey-white / pale blue-grey" | **Four layer colours moved** in M10 AL, each by the smallest step that passes every pair: muscles `#a8483f` → `#b44d43` (legend swatch 2.75:1, needs 3:1); tendon `#c98a7c` → `#c18274` (6.1 from the thorax region colour under protanopia); ligaments `#d9dde3` → `#cccccc` (5.4 from the hover outline); cartilage `#a9bccb` → `#c5dfee` (4.5 from the pectoral girdle colour under deuteranopia, and 7.8 from the antagonist tint over a cartilage ghost) | They failed real pairs in `tests/colourVision.test.ts` (QUESTIONS 139). The colour changed, not the threshold (M10 decision 3). |
| §6.3: tints pass ΔE2000 ≥ 8 (deuteranopia, protanopia) | Tints pass ≥ 20 against their neighbours. **Colour-by-region pauses** while any tint or patch is drawn: bones go back to ivory, the region toggle stays pressed, and the legend says "Region colours paused while origins, insertions or antagonists are shown." | Region colours and tints are both Okabe–Ito: origin yellow on the upper limb's yellow was ΔE 3.4, and no recolouring separates all ten under CVD (M10 AL) |
| §6.3 / M9: tritanopia | Not checked. M5's and M9's tests checked normal vision, deuteranopia and protanopia only; the M10 plan's mention of tritanopia was a mistake | The spec asks for deuteranopia and protanopia (QUESTIONS 139) |
| §7.1: labels | One label per **muscle** (at the union of its parts), parts labelled only at the part level; ties between equal priorities within 10 % size go to the focus layer | A muscle with parts has no mesh of its own; labelling every head was unreadable (M10 AK) |
| §7.3: announcements | One message per user action, folded in a fixed order; counts by kind; parts counted only for the focus's own muscle; nothing said on page load (a soft `sel=` in a link is hushed) | M10 decision 4, AM |
| M9 decision 5: `R`/`E` keys for tiers | Built only in M10 AN, with `Shift+X` (Show all) and `X` on the Tab cursor | They were missed in M9 |
| §7.3: keyboard parity | The Tab cursor makes a muscle one stop until it is selected, then its parts; layers in panel order | Stepping through every head read one thing and selected another (M10 AN) |
| §9: layer low LOD visible in ≤ 3 s desktop / ≤ 5 s phone | **Unmeasured on a real device.** In the container, 7–12.6 s. The planned fallback (prefetching the layer files, off on Save-Data) was not built. | The software GPU dominates the container figure; AO's gate was skipped |
| §9: FPS at a muscle tier with antagonists; click → highlight for soft structures | **Unmeasured** on real devices; 9 draw calls in the container | AO was skipped |
| (spec silent) | M6's `?debug&layers=all` view is kept beside the real layers | A bounds and patch debugging tool |
| §13: content reviewed against references | All 900 soft-tissue files are `reviewed: false` | Drafted from standard references, never checked line by line |

---

## 8. Known bugs, shortcuts and loose ends

**Content**
- All text, bone and soft tissue, was drafted from standard references (Gray's, TA Latin terms), not checked line by line. Nothing is reviewed.
- `content/QUESTIONS.md` has **139 entries** (3 marked answered in the text). The next is 140.

  | Area | Entries |
  | --- | --- |
  | Bones | 36 (articulations 16, regions 9, text 11) |
  | Muscles | 75 (mapping 14, patches 5, depth 7, attachment migration 3, the regional writing batches 43, origins/insertions/antagonists 3) |
  | Ligaments | 13 (mapping 4, content 9) |
  | Cartilage | 6 |
  | Joints (shared) | 4 |
  | Sidebar and search | 4 |
  | Colours | 1 (139: AL's colour changes, the region pause, tritanopia) |

- Patches disagree with the content in 185 cases (never drawn); 1,373 attachments are tinted whole; 846 synergist/antagonist overlaps are listed in `REPORT-patches.md` and not reviewed (QUESTIONS 132–134).
- 6 old `muscleAttachments` strings never matched a muscle (answered in QUESTIONS). 12 source patches exist on one side only and are not mirrored.
- No landmark positions, TA2 IDs or articulation `surfaces` exist yet.

**Geometry**
- 7 bone objects (8 meshes) are still non-manifold (see §7). Soft tissue: the palmar aponeurosis is an open sheet (182 boundary edges), and about 45 other soft objects have 1–94 non-manifold edges (`assets/build/REPORT-soft-tissue.md`). No visible artefacts.
- Per-bone AO leaves the inside of the mandible's alveoli and the molars' pulp chambers dark. `AO_FLOOR` softens this.
- The source has the little toe's middle and distal phalanges separate. That matches the 206 count, but they are often fused in real skeletons.

**Behaviour**
- "Show attached muscles" before the muscles' content has loaded says "attached muscles loading" and is not re-announced when the counts arrive.
- Joint and row highlights set the live region directly, so a pointer resting on a panel row can replace the last message.
- The Tab cursor outlines only a muscle's first part (a muscle has no mesh of its own), as a pointer hover does.
- `R` and `E` work from the canvas or the page body, not while focus is in the panel (the panel's buttons do the same there).

**Performance and the build**
- Real-device layer load, FPS at a muscle tier with antagonists, and soft click → highlight are unmeasured (AO and AP skipped). The container can't measure layer load meaningfully because of its software GPU.
- The main chunk is about 470 kB gzipped; Vite warns about chunks over 500 kB raw. Everything soft-tissue except the layer registry and announcements is in lazy chunks.
- The Vite config triggers "configLoader: native" warnings (extensionless imports, a JSON import without attributes). Harmless today.
- `THREE.Clock` deprecation warning, and `KHR_parallel_shader_compile` unsupported (SwiftShader only).
- `?lod=high` (a debug override) skips the low model, so the browser warns that the preloaded file went unused.
- `?debug` reads pixels for its bounds and timing checks, so the GPU driver logs "GPU stall due to ReadPixels". This happens only with `?debug`.

**Testing gaps**
- Playwright isn't in CI. Firefox, Edge and WebKit/Safari aren't automated. The step-12 browser table is empty.
- No screen-reader (VoiceOver) pass has been done; it was offered as an optional hand check in M10. The keyboard pass is scripted (`tests/e2e/keyboard.spec.ts`, including the M9 journey by keys only, about 4 minutes under SwiftShader).
- Tests that load the muscles layer need generous timeouts in the container.

**Hand checks never formally closed (from M3 and M4)**
- Orbit feel after panning and zooming.
- The handover from two fingers to one on touch.
- The panel and the sheet on real devices.
- How Explode feels on a phone.

**Accepted shortcuts**
- **Pickability.** Ghosts can't be picked, so at tier 0 another structure can't be clicked directly (see §7). Depth peel and Hide hide rather than ghost, so the layer underneath can be clicked.
- **Explode direction.** Explode moves bones along the line between box centres, not along joint axes. It moves bones only.
- **Label threshold.** Labels use a fixed 32 px size threshold with nothing isolated.
- **Search scope.** Names, Latin names, common names, synonyms, group synonym sets and FDI numbers; not the summary text. Bone words now also match muscles ("femur" finds the femoris muscles).
- **Layers are literal tables.** Each layer and kind is named in about 40 places (`STATUS-M10.md` §3 lists them). Fine for four layers; a fifth wants a per-layer descriptor first.
- **Deploy.** The site deploys only from `main` through `.github/workflows/deploy.yml`. A second Pages workflow would overwrite it.
- **Frozen milestones.** `deploy/pages.json` freezes `m1`–`m10` (`m10` at `317b445`, the merge of #23) and has `"current": null`: the programme is closed (M10 decision 9). The live site keeps following `main`; `/m1/` to `/m10/` stay fixed.
