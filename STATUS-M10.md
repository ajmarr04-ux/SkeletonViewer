# Skeleton Viewer: status after the musculoskeletal phase (M6–M10)

Written 2026-11-24 for whoever plans the next phase: organs, nervous system, vessels and lymphatics on top of the finished musculoskeletal build. `STATUS.md` describes the whole build, layers included (updated in M10 session AQ); this file looks forward: what M6–M10 added and what the next phase starts from. Every number was read from the repository or measured on the date above. **Unmeasured** means exactly that.

**Where M10 stands.** Sessions AK (labels), AL (colour vision), AM (announcements) and AN (keyboard) are done on branch `claude/keen-clarke-32a10a`. Session AO, the real-device performance gate, was skipped at the user's request, so AP (the user's results) has nothing to record yet. AQ (`STATUS.md`) and AR (wrap-up, `/m10/`, programme close) are not done, and M10 is not merged to `main`. This session changed no code, content or assets. It only wrote this file and the audit outputs in §9.

---

## 1. Where M6–M10 ended up

**Built:**
- Three soft-tissue layers (muscles, ligaments, cartilage) beside the bones, each On / Ghost / Off, loaded lazily the first time it is turned on, with high and low detail like the bones.
- A muscle depth "peel", per-structure Hide, and picking across layers.
- Nested selection: a click picks the muscle, a second click the part.
- Related sets per kind: a muscle's attachments, then its functional group; a ligament's or cartilage's related structures, then its joint.
- Origin and insertion patches, and an antagonist toggle.
- Hand-written content for all 900 soft structures.
- Soft-tissue sidebar roots and search.
- Labels for every kind, a colour-vision pass, screen-reader announcements and keyboard access.

| Milestone | What it delivered | Hosted |
| --- | --- | --- |
| M6 | Soft-tissue audit, IDs (`content/soft-ids.json`), mapping (`assets/mapping/soft-to-id.json`), Blender build of 8 layer files, `?debug&layers=all` | `/m6/`, frozen `43dce0e` |
| M7 | Layers panel, one solid and one ghost `BatchedMesh` per layer, layer-aware isolation, picking across layers, Hide, depth control | `/m7/`, frozen `3af6d5a` |
| M8 | Content for 537 muscles and parts, 302 ligaments and 61 cartilage structures; `movements.json`, `joints.json`, `muscle-hierarchy.json`; derived synergists, antagonists and attachments; the bones' muscle lists migrated | `/m8/`, frozen `0833b48` |
| M9 | Nested selection, tiers per kind, patches and tints, antagonists, kind-specific panels, "Show attached muscles", soft-tissue tree and search | `/m9/`, frozen `ef6ee75` |
| M10 (AK–AN) | Labels for every kind, colour-vision pass, announcements, keyboard parity | not deployed |

### Where the build differs from `SPEC-musculoskeletal.md`

| Spec says | What was built | Why |
| --- | --- | --- |
| §1, §3: cartilage layer includes articular cartilage | **No articular cartilage.** The cartilage layer has 24 cartilages (costal cartilages, labra), 25 discs and 12 menisci. | The source doesn't model it. The user decided on 2026-11-20 to go on without it (`missingNoId`). |
| §3: parts follow anatomy | Parts exist only where the **source splits the mesh** (58 muscles have parts). A muscle modelled as one mesh is a leaf; its heads are described in text only. | Meshes are never cut (M6 decision 3) |
| §3: a tendon has one parent | The calcaneal tendon's parent is gastrocnemius, with `alsoServes: [soleus]` | The spec allows one parent (QUESTIONS 37) |
| §2: everything the anatomy has | **19 structures missing from the source**: 4 have IDs with no mesh (patellar ligament and articularis genus, each side); 15 have no ID (craniovertebral ligaments, anterior tibiotalar ligament, quadriceps tendon, auricular and ossicle muscles, most soft-palate and perineal muscles, subcostales, psoas minor) | Absent from Z-Anatomy (`assets/mapping/soft-to-id.json` `missing`, `missingNoId`) |
| §3: one ID per source structure | The nucleus pulposus is **merged into its disc** (23 merges) | It lies inside the disc and is never visible on its own |
| §4.3: an action's `joint` is an articulation ID | `joint` may be a **functional joint** from `content/joints.json` (47, e.g. `elbow_joint_left` = humero-ulnar + humeroradial pairs) | `articulations.json` is one entry per bone pair; there is no "elbow" in it (user, M8 decision 2) |
| §4.4: a ligament's `joint` is required | `joint: null` for an allow-listed set (inguinal ligament, interosseous and obturator membranes, sacrospinous and sacrotuberous ligaments, …) | They bridge bones without crossing a joint (user, M8 decision 3) |
| §4.4–4.5: no body length given | 40–80 words for ligaments and cartilage, the same as muscles | User, M8 decision 5 |
| §5.2: "isolation overrides layer toggles" | Related sets show only structures in layers that are **On or Ghost**; an Off layer adds nothing | User, 2026-11-20 (M9 decision 3) |
| §5.3: origins and insertions highlighted with the patches | A patch is drawn **only if the content names the bone it lies on in that role**. Otherwise the whole structure is tinted. Result: 512 of 697 patches can be drawn; 185 never are; 1,373 content attachments have no patch and are tinted whole. | Many patch names disagree with the content; the content wins (M9 decision 6, `assets/build/REPORT-patches.md`) |
| §5.2: a structure both synergist and antagonist shows as synergist, **with a QUESTIONS entry for each** | Shown as synergist, but listed in `REPORT-patches.md` (846 pairs; 423 left and midline), not as 846 QUESTIONS entries | Too many to file one by one |
| §6.2: 4-stop depth control | **3 stops** (All · Hide superficial · Hide superficial + intermediate) | The fourth, "Deep only", equalled the third (user, session V) |
| §11: depth file is M8 | `content/muscle-depth.json` written in M7 | Needed for the depth control on `/m7/` (user checkpoint) |
| §6.3: tints pass ΔE2000 ≥ 8 (deuteranopia, protanopia) | Tints pass ≥ 20 against their neighbours. **Colour-by-region pauses** while any tint or patch is drawn (bones go back to ivory, and the legend says why). | The seven region colours and three tints are both Okabe–Ito: no recolouring separates all ten under colour-vision deficiency (M10 AL) |
| §6.3: "muted red / pale grey-white / pale blue-grey" | Four layer colours were moved by AL: muscles `#b44d43`, tendons `#c18274`, ligaments `#cccccc`, cartilage `#c5dfee` | The originals failed real pairs in `tests/colourVision.test.ts` (QUESTIONS 139) |
| §5.5: Hide stored in the URL, "capped" | `hid=` keeps the first 100 IDs; a toast says so | The URL length limit |
| §5.4: bone → muscle cross-link | "Show attached muscles" is a group isolation, `grp=attached:<bone>` | It reuses the group reducer and Back |
| §9: layer low LOD visible in ≤ 3 s desktop / ≤ 5 s phone | **Unmeasured on a real device.** In the container, the muscles' low LOD shows 7–12 s after it is turned on. | The software GPU dominates (M7, M9); AO's gate was skipped |
| M9 decision 5: `R`/`E` keys for tiers | Built only in M10 AN, with `Shift+X` (Show all) and `X` on the Tab cursor | They were missed in M9 |
| (spec silent) | M6's `?debug&layers=all` view is kept beside the real layers | A bounds and patch debugging tool |
| §13: content reviewed against references | All 900 soft-tissue files have `reviewed: false` | Drafted from standard references, never checked line by line |

---

## 2. Final object counts

| Kind | IDs | With a mesh | Notes |
| --- | --- | --- | --- |
| Bones | 206 | 206 | `content/ids.json` |
| Teeth | 32 | 28 | The 4 third molars have no mesh (`meshAvailable: false`) |
| Muscles | 408 | 348 | No mesh: 58 parents (drawn as their parts) and articularis genus on each side (missing) |
| Muscle parts: heads, bellies, portions | 114 (58 + 16 + 40) | 114 | `partType` head, belly, portion |
| Muscle parts: tendons, aponeuroses | 15 (10 + 5) | 15 | Drawn in the lighter tendon shade |
| Ligaments | 302 | 300 | Patellar ligament on each side missing |
| Cartilage (costal, labra) | 24 | 24 | |
| Discs (intervertebral, symphyses, articular discs) | 25 | 25 | 23 merged from disc + nucleus pulposus |
| Menisci | 12 | 12 | |
| **Total** | **1,138** (238 + 900) | **1,072** | |

Plus 697 origin/insertion **patches** (`attachments-*.glb`), which are not selectable IDs.

The soft-tissue mapping (`assets/mapping/soft-to-id.json`): 838 mapped IDs, 23 merges, 4 missing with IDs, 15 missing without, and **269 source objects excluded**. The main exclusions: bursae 78, fascia 38, joint capsules 34, tendon sheaths 26, retinacula 18, intermuscular septa 14, sinus and air-cell volumes 8, laryngeal cartilage 6, nasal cartilage 5, tarsal plates 4. Those are deferred or out of scope by spec §1; the rest are single cases with reasons.

---

## 3. How layers are implemented today

**Types.** A layer is a closed string union. Kinds are separate unions per family:

```ts
// src/state/url.ts
export const LAYERS = ["bones", "cartilage", "ligaments", "muscles"] as const;
export type Layer = (typeof LAYERS)[number];
export const TISSUE_LAYERS = ["cartilage", "ligaments", "muscles"] as const satisfies readonly Layer[];
const LAYER_CODE: Record<Layer, string> = { bones: "b", cartilage: "c", ligaments: "l", muscles: "m" };
// src/layers/softIds.ts
export type SoftKind = "muscle" | "muscle_part" | "ligament" | "cartilage" | "disc" | "meniscus";
// src/content/placeholder.ts (bones):  kind: "bone" | "tooth"
```

**Registration.** There is no layer registry. A layer exists because its name is in `LAYERS` and in every `Record<Layer|TissueLayer, …>` that TypeScript then forces you to fill. The soft-tissue ID table (`virtual:skeleton-soft-ids`) is one lazy chunk for all three layers, registered with the main chunk by `registerSoftIds` (`src/content/softRegistry.ts`). Lookups before that answer "unknown".

**Loading.** `LayerScenes.tsx` (lazy chunk) mounts one `TissueLayerScene` per layer the first time the layer isn't Off, and keeps it after that. Each scene fetches `public/models/<layer>-{low,high}.glb` by the shared LOD plan (`src/scene/lod.ts`), with content-hashed URLs and progress (`src/layers/urls.ts`, `virtual:skeleton-model-versions`). The store's `layerLoad[layer]` records status, LOD, bytes, errors and Retry. Content loads per layer as `virtual:skeleton-soft-content-<layer>` through the hard-coded `importers` map in `src/content/softContentLoader.ts`.

**Batching.** Per tissue layer there is **one solid and one ghost `BatchedMesh`** (`batchLayer`, the generalised `batchSkeleton.ts`), plus outlines sharing the solid batch's buffers: selected, hover, and for muscles `MAX_PARTS − 1` more for a muscle's parts. The patches add one more solid batch. The registry is a zustand store:

```ts
// src/scene/layerRegistry.ts
export const useLayerBatches = create<Partial<Record<TissueLayer, LayerBatches>>>(() => ({}));
```

**Ghosting.** A structure is ghosted if its layer is Ghost or if isolation ghosts it. Ghost batches use `depthWrite: false` and draw after the solids in a fixed order (`GHOST_ORDER = { cartilage: 1, ligaments: 2, muscles: 3 }`, bones 0). `sceneView` / `applyLayerView` (`src/scene/isolation.ts`) compute, per layer, a `LayerShow` of `{ solid: Set | null, rest: "ghost" | "hidden" }`. Depth peel and Hide remove structures (hidden, not ghosted) so the layer underneath can be clicked.

**Picking.** One ray is tested against the solid batch of every layer that has one drawn (three-mesh-bvh per geometry); the nearest hit wins (`nearestPickable`, `CameraRig.tsx`). Ghosts and hidden structures are never pickable. Tiny-object hit proxies apply to every layer. `resolveClick` turns a picked part into its muscle first.

### Every place that names the layers or kinds (what a new layer would touch)

**Runtime (`src/`):**
- `state/url.ts`: `LAYERS`, `TISSUE_LAYERS`, `LAYER_CODE`/`CODE_LAYER` for the URL, the muscles-only depth suffix, `DEFAULT_LAYER_SETTING`.
- `state/store.ts`: `layerOnAt`, `layerLoad`, and a literal `["cartilage", "ligaments", "muscles"]` loop at line 264.
- `state/selection.ts`: `isMuscleKind`, and `loadSoftContent("muscles")` for attached muscles.
- `layers/softIds.ts`: `SoftKind`, `PartType`, `isTendinous`.
- `layers/LayerScenes.tsx`: `LAYER_NAMES`, `GHOST_ORDER`, the per-layer material colours, `MAX_PARTS` for muscles only, `wantsPatches`.
- `layers/colours.ts`: `LAYER_COLOURS`.
- `scene/layerRegistry.ts`: the batch store keyed by `TissueLayer`.
- `scene/isolation.ts`: `Record<Layer, LayerShow>`, peel rules for muscles.
- `scene/labels.ts`: `focusLayerOf` has a literal `["muscles", "ligaments", "cartilage", "bones"]`.
- `scene/bench.ts`: `BENCH_TISSUE`.
- `scene/debugLayers.ts`, `DebugLayers.tsx`: the M6 codes `m`/`l`/`c`/`a`.
- `content/softRegistry.ts`: `LAYER_LABELS`, duplicated in `ui/LayersPanel.tsx`.
- `content/softSchema.ts`: `schemaForKind`, `CARTILAGE_KINDS`, `LAYER_FOLDERS`, `SOFT_BODY_WORDS`.
- `content/softTiers.ts`: `SoftLayerName`, `layerOfKind`, and the per-kind tier rules.
- `content/softRoles.ts`, `derive.ts`: muscle-only.
- `content/softPanel.ts`: `KIND_LABELS`, `PART_LABELS`, the `softSections` switch.
- `content/softContentLoader.ts`: `importers`.
- `content/softTree.ts`: `SOFT_ROOTS`, cartilage kind labels, one builder per root.
- `content/groups.ts`: `groupLayer`.
- `content/announce.ts`: `NOUNS` and `ORDER` per kind.
- `content/muscleDepth*.ts`.
- `ui/LayersPanel.tsx`: the rows, and the depth control for muscles only.
- `ui/Legend.tsx`: `LAYER_KEY`.
- `ui/InfoPanel.tsx`: section views per kind.
- `ui/Labels.tsx`: the muscle grouping.
- `camera/CameraRig.tsx`: cursor stops and the muscle part level.

**Build and scripts:**
- `scripts/blender/build_soft_tissue.py`: `LAYERS`, triangle budgets, `MIN_TRIS`, `AO_MIN_SPREAD`.
- `scripts/mapping/generate_soft_ids.py`: `LAYER_ORDER`, layer and kind assignment rules.
- `scripts/mapping/classify_soft_tissue.py`: `BUDGET_HIGH`, the collections it reads.
- `scripts/lib/model-checks.ts`: `SOFT_LAYERS`, `LAYER_BUDGETS`.
- `scripts/lib/content-files.ts`, `content-plugin.ts`: `SOFT_LAYERS`, the virtual modules per layer.
- `scripts/lib/soft-ids-plugin.ts`, `soft-tree-data.ts`.
- `vite-env.d.ts`: the module declarations.

**Tests:** `tests/colourVision.test.ts` (every colour pair), `tests/layers.test.ts`, `sceneView.test.ts`, and the e2e specs that count nodes per layer.

**What is already generic and reusable:** `batchLayer`, outlines, the LOD plan, hashed URLs with progress, the cross-layer picker, `LayerShow`/`sceneView`, the URL `layers=` format (one code letter per layer), lazy chunk per layer, the manifest format, `check-models`' bounds check, and the Blender pipeline steps in `pipeline_lib.py`. **What is not:**
- every per-layer table above is a literal
- the bones are a special case everywhere (`"bones"` vs `TISSUE_LAYERS`)
- kind-specific behaviour (parts, depth, patches, tiers, panel sections) is `if kind === …` scattered across about 15 files

A plug-in design would need a per-layer descriptor holding: code, label, colour, ghost order, kinds, schema, tier rules, panel sections, tree builder, budgets.

---

## 4. How relationships work today

Each relationship has its **own data shape and its own implementation**. There is no shared "relationship type" or generic graph. The only common shape is the precomputed tier list, `{ t1: string[]; t2: string[] | null }`.

| Relationship | Data (real shape) | Where the rule lives |
| --- | --- | --- |
| Bone ↔ bone articulation | `content/articulations.json`, 357 pairs: `{"a":"frontal_bone","b":"parietal_bone_left","joint":"coronal_suture_left","name":"Coronal suture"}` | `src/content/relations.ts` (`tier1`, `visibleAt`) |
| Bone region (bone tier 2) | `content/regions.json`: `{"frontal_bone": ["occipital_bone", …]}` | `relations.ts` |
| Functional joint | `content/joints.json`, 47: `{"id":"shoulder_girdle_left","name":"Joints of the shoulder girdle","side":"left","articulations":["sternoclavicular_joint_left","acromioclavicular_joint_left"]}` | `derive.ts` `pairsOf`/`sameJoint`, `softTiers.ts` `jointScope` |
| Origin / insertion | Front matter: `origin: []`, `insertion: [{ structure: ulna_left, landmark: olecranon }]`; or `{ soft: "…" }` for a non-object; a part may say `inherit` | `softTiers.ts` (tier 1), `softRoles.ts` (`MuscleRoles = { o: {p,f}, i: {p,f}, ant }`: patches `p` and whole-tint fallbacks `f`) |
| Action | `actions: [{ joint: elbow_joint_left, movement: extension, role: prime }]`; `movements.json` lists the 24 allowed movements and `antagonistPairs` | `derive.ts` `actionsOf` (a part inherits its parent's) |
| Synergists / antagonists | **Derived, never written**: same joint and movement with role prime/assist = synergist; opposite movement (from `antagonistPairs`) = antagonist; `synergistOverrides: { add, remove }` per muscle | `src/content/derive.ts` (`synergistsOf`, `antagonistsOf`), compiled into the muscles chunk |
| Ligament → bones, joint | `connects: [femur_left, tibia_left]`, `joint: knee_joint_left \| null` | `softTiers.ts`: t1 = `connects`, t2 = everything at the same joint |
| Cartilage → structures, joint | `attachedTo: [tibia_left, tibial_collateral_ligament_deep_part_left]`, `joint` | Same as ligaments |
| Bone → muscles | Derived from the muscles' attachments (`boneMuscleLists`, `attachedMuscles`); the old hand-written `muscleAttachments` strings are a frozen migration record (`content/attachment-migration.json`) | `compile.ts`, `softRelations.ts` `attachedTo`, `reverse` maps |

**The tier rules:**
- **Build time** (`buildSoftTiers`, `src/content/softTiers.ts`): muscle t1 = its parts plus the structures in its attachments; t2 = its synergists plus their attachments. Ligament and cartilage t1 = `connects`/`attachedTo`; t2 = the joint's structures.
- **Shipped:** the results go out per layer in the lazy content chunks as `tiers` and `reverse`.
- **Runtime:** `relatedAt(id, tier, modes)` (`src/scene/isolation.ts`) merges the bone rules and the soft lists, then filters by the layers that are showing.

Adding organs means adding new relationship kinds: supplies, drains, innervates, contains, part-of-system. Today each would be another hand-written field, another derive step and another branch in `softTiers.ts`.

---

## 5. Content and schema

**Schemas** (`src/content/softSchema.ts`; zod; scripts and tests only, never in the main chunk):

```ts
export const attachmentSchema = z.union([
  z.strictObject({ structure: snake, landmark: snake.optional() }),
  z.strictObject({ soft: text }),
]);
export const actionSchema = z.strictObject({ joint: snake, movement: snake, role: z.enum(ROLES) });
export const muscleSchema = z.strictObject({ id: snake, kind: z.literal("muscle"), name: text, latin: text,
  commonName: text.nullable(), side, region: z.array(snake).min(1), compartment: snake.nullable(),
  parts: z.array(snake), origin: z.array(attachmentSchema), insertion: z.array(attachmentSchema),
  actions: z.array(actionSchema), functions: z.array(text).min(1).optional(), innervation: text,
  clinicalNote: text.nullable(), synergistOverrides: overridesSchema.optional(), reviewed: z.boolean() });
export const musclePartSchema = z.strictObject({ id, kind: z.literal("muscle_part"), partType: z.enum(PART_TYPES),
  parent: snake.nullable(), alsoServes: z.array(snake), name, latin, commonName?, side,
  origin: inheritable, insertion: inheritable, actions, functions?, innervation?, clinicalNote?, reviewed });
export const ligamentSchema = z.strictObject({ id, kind: z.literal("ligament"), name, latin, commonName, side,
  joint: snake.nullable(), connects: z.array(snake).min(1), functions: z.array(text).min(1), clinicalNote, reviewed });
export const cartilageSchema = z.strictObject({ id, kind: z.enum(["cartilage", "disc", "meniscus"]), name, latin,
  commonName?, side, joint: snake.nullable(), attachedTo: z.array(snake).min(1), functions, clinicalNote, reviewed });
```

**Real examples** (front matter abridged; body 40–80 words):

```yaml
# content/muscles/triceps_brachii_left.md
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
```yaml
# content/ligaments/anterior_cruciate_ligament_left.md
kind: ligament
commonName: ACL
joint: knee_joint_left
connects: [femur_left, tibia_left]
functions:
  - Limits anterior translation of the tibia on the femur
  - Resists hyperextension and rotation of the knee
```
```yaml
# content/cartilage/medial_meniscus_left.md
kind: meniscus
joint: knee_joint_left
attachedTo: [tibia_left, tibial_collateral_ligament_deep_part_left]
functions: [Deepens the articular surface …, Spreads load …, Adds to the stability of the knee]
```

**Panel sections per kind.** `softSections(fm, …)` (`src/content/softPanel.ts`) switches on `fm.kind`:
- `muscle` and `muscle_part` → `MuscleSections`: Parts / Part of, Origin, Insertion (inherited from the muscle when `inherit`), Actions, Synergists, Antagonists, Innervation, Clinical note.
- `ligament` → `{ kind: "ligament", joint, links: connects, functions }`, rendered as "Joint" and "Connects".
- `cartilage`, `disc`, `meniscus` → the same shape as ligaments, rendered as "Attached to".

`InfoPanel.tsx` renders by `sections.kind`. Bones use the separate M4 model (`src/content/panel.ts`). Files: 238 bone, 537 muscle and part, 302 ligament, 61 cartilage (left and midline written, right mirrored).

**Chunk sizes** (gzip -9, built from the AN commit):

| Chunk | kB |
| --- | --- |
| Muscles content (`virtual:skeleton-soft-content-muscles`) | 127.1 |
| Ligaments content | 41.8 |
| Cartilage content | 8.5 |
| Bone content | 42.1 |
| Soft search index | 36.8 |
| Bone search index | 9.1 |
| Soft tree | 12.1 |
| Soft-tissue ID table | 11.0 |
| `LayerScenes` | 3.0 |
| Manifests: muscles / attachments / ligaments / cartilage / bones | 44.4 / 59.2 / 24.8 / 6.9 / 21.0 |

---

## 6. Performance

The user asked to skip new measurements in this session, so this section collects what earlier sessions recorded.

**Triangles and files** (`assets/build/manifest*.json`; `public/models/`):

| Layer | High triangles | Low triangles | High file | Low file |
| --- | --- | --- | --- | --- |
| Bones | 499,981 | 149,913 | 2.59 MB | 0.91 MB |
| Muscles | 799,750 | 229,800 | 4.62 MB | 1.61 MB |
| Ligaments | 119,938 | 39,934 | 0.85 MB | 0.44 MB |
| Cartilage | 79,965 | 29,976 | 0.44 MB | 0.20 MB |
| **All four layers** | **1,499,634** (budget 1.5 M) | **449,623** (budget 450 k) | 8.50 MB | 3.16 MB |
| Attachment patches (only at a muscle's tier 1–2) | 149,676 | 49,772 | 1.29 MB | 0.79 MB |

The budgets are met to the triangle: the build decimates to them. Loading the patches at a muscle tier puts the loaded total over 1.5 M, although isolation means only a small part is drawn.

**Other measurements:**

| Measure | Value | Source |
| --- | --- | --- |
| Draw calls, all layers solid | 4 | M7, container |
| Draw calls, muscles ghosted over bones | 2 | M7 |
| Draw calls, all on + long head at tier 2 + antagonists | 9 (8 at tier 1); budget < 20 | M9 AG |
| FPS, all solid, PC (high) / iPhone (low) | 75.2 / 58.8: at vsync both | User on `/m7/`, 2026-11-20 |
| FPS, muscles ghosted, PC / iPhone | 75.2 / 58.8 (1.30 M / 380 k triangles): at vsync | Same |
| FPS, muscle tier 2 with antagonists | **Unmeasured** (AO's third bench link) | |
| Skeleton load, real device | PC low 360 ms, high 483 ms; iPhone low 176 ms | User's `?debug`, M7 |
| A layer's low LOD after turning it on, real device | **Unmeasured** | |
| The same in the container (Fast 4G, 4× CPU, SwiftShader) | Muscles 7.1–12.6 s per run; download alone about 1.9 s unthrottled, about 8.5 s at Fast 4G | M7–M9 `perf-load` |
| Click → highlight for soft structures | **Unmeasured** | |
| Label layout, all layers on (SwiftShader, 4× CPU) | Median 7.6 ms, max 27.8 ms (M5 bones only: 2.4 / 12) | M10 AK |
| Main chunk (index + modulepreloads, gzip -9) | **470.4 kB**: M9 468.1, M8 460.8, M6 458.4 | M10 AN |
| Bundle growth over M5 (spec ≤ +150 kB) | **Unmeasured** with the agreed method (planned for AR against `71f04d0`). STATUS.md's M5 figure (about 450 kB) used another method; on that rough basis the growth is about 20 kB. | |

Combinations of layers beyond "all solid" and "muscles ghosted" have not been benched.

---

## 7. UX at this scale (everything on)

- **Layers panel:** two presets, four rows of On / Ghost / Off, progress and Retry, and the depth control under Muscles. It fits now, but it is a fixed list of rows. **It won't scale to 9–10 layers** without grouping (systems → layers) or collapsing.
- **Depth peel:** muscles only, three stops, from 209 depth keys (67 superficial, 62 intermediate, 80 deep). Nothing comparable exists for other layers, though organs will need it (body wall, then viscera).
- **Hide:** per structure (a muscle hides all its parts); `X` from the panel or the Tab cursor; the "N hidden · Show all" chip; `Shift+X`. The URL keeps 100 IDs.
- **Search:** two prebuilt indexes merged by score: bones 9 kB, soft-tissue 37 kB, the second fetched on the first keystroke. Bone words now also match muscles: M9's suite had to drop a test that "femur" gives exactly 2 results (femoris). With organs, vessels and nerves, generic words ("artery", "nerve", "left") will flood results, so ranking and filtering by system will be needed.
- **Tree:** three soft roots (Muscles by region → compartment → muscle → parts; Ligaments by joint; Cartilage by kind), lazily loaded (12 kB). The tree is long. The Tab cursor walks 234 bones plus about 800 soft stops in one sequence.
- **Labels:** one label per muscle. With everything on, layout takes a median 7.6 ms (max 27.8 ms) under SwiftShader at 4× CPU, about 3× the bone-only cost. Only the biggest few hundred candidates can ever win space. Phone layout cost is unmeasured.
- **Colours:** the categorical palette is used up. The seven region colours and three tints are Okabe–Ito and collide under colour-vision deficiency, which is why region colours pause while tints show (AL). New systems (arteries red, veins blue, nerves yellow, lymph green: the textbook convention) will collide with muscle red, the insertion blue and the origin yellow.
- **Already crowded or slow:**
  - the muscles layer's first load (a 1.6 MB low file; 7–12 s in the container, unmeasured on devices)
  - the Tab cursor's length
  - search ranking with mixed kinds
  - the legend when tints and region colours both apply

---

## 8. Workflow review (`docs/WORKFLOW.md`)

**Sessions per milestone:** M6 4 (P–S), M7 4 (T–W), M8 7 (X–AD), M9 6 (AE–AJ), M10 4 done of 8 planned (AK–AN; AO skipped by the user). Every finished session ended green and wrote `docs/HANDOFF.md`. Gates got their own sessions: M6 counts, M7 bench, the M8 user checkpoints.

| Fan-out | Result |
| --- | --- |
| M8 AC: ligament and cartilage content, `content-writer` × 10 batches in waves of 4, 196 items | **Worked.** All 10 batches came back complete with 0 skipped. One validation error was deliberate. The main session fixed 2 factual or style points after reading at least 2 files per batch. |
| M8 Y–AB: muscle content | Written serially by the main session, before the workflow was adopted |
| M9 AI: synonyms | **Fan-out declined.** 77 structures, each needing 1–2 well-known terms, so one edit was cheaper than briefing batches. |
| M9 AJ: full e2e through `verifier` | Worked on the second try: the first attempt lost its preview server after 21 tests |
| M10 AM / AN: e2e | Run in the background by the main session instead (81 and 75 tests, 15–18 min each) |
| This session: 5 × `mesh-auditor`, one per collection | **Worked.** 38–48 k tokens and 70–100 s each (about 220 k subagent tokens in all). One batch hit a crash in the shared script (undecodable label text) and patched a copy itself. Every batch's totals matched the raw rows when checked. |

**Usage:** recorded only for this session's fan-out. M8 AC's cost was not written down.

**What I'd change:**
1. Record subagent tokens per fan-out in the plan.
2. For audits, put the measuring script in the repo and make it robust first. All five auditors ran the same 5-second Blender job and then each re-derived the same statistics, so one main-session run plus one analysis script would have cost a fraction. Subagents pay off for judgement per item (classification, prose), not for counting.
3. Keep Playwright runs to one at a time: they share port 4173. The verifier's value is keeping logs out of context, but a background run with a grep for failures did the same at lower cost.
4. Size content sessions by item count up front. The M8 muscle sessions predate the workflow and were large.
5. For the next phase, plan **mapping as a fan-out per system**: hundreds of vessel and nerve names need judgement per item.

---

## 9. Audit of the remaining Z-Anatomy collections

Full results: `assets/audit/REPORT-body-systems.md`. Raw per-object rows and the batch summaries: `assets/audit/body-systems.json`. Same pinned `Startup.blend` (`71919ee`), evaluated world-space geometry (curves through their bevelled mesh), one `mesh-auditor` per collection.

| | 5 Cardiovascular | 6 Lymphoid | 7 Nervous & sense organs | 8 Visceral | 9 Regions |
| --- | --- | --- | --- | --- | --- |
| Objects | 757 (654 curve, 60 mesh, 43 text) | 276 (220 mesh, 56 text) | 842 (460 mesh, 249 curve, 133 text) | 479 (254 mesh, 44 curve, 181 text) | 343 (299 mesh, 44 text) |
| With faces | 676 | 164 | 583 | **121** | 257 |
| Triangles | **3.84 M** (3.65 M curves) | 0.13 M | **2.41 M** (1.15 M curves) | 0.72 M | 0.14 M |
| Separate or merged | Separate: one bevelled curve per named vessel segment | Separate node groups | Separate: gyri, nuclei, tracts; one curve per nerve branch | Separate organs, lobes, segments | Separate skin patches |
| 5 largest (triangles) | Central retinal artery R/L 207,360 each; R superior intercostal vein 62,784; basilar venous plexus 56,192; L superior intercostal vein 50,976 | Thymus L 9,188 / R 6,452; intrapulmonary nodes 3,864; paracolic 2,856; juxta-intestinal 2,520 | White matter of telencephalon L/R 135,288 each; zonular fibres R 68,288; intercostal nerves R/L 51,552 each | Pleura 112,288; greater omentum 77,968; pancreatic duct 55,824; jejunum 27,648; descending colon 24,744 | Hairs of head 16,563; dorsal digits of hand R/L 4,260; palmar digits R/L 3,836 |
| Left/right separate | Yes (258/258; 51 use a "Left/Right" prefix instead of a suffix) | Yes (54/54) | Yes (266/267) | Only paired glands and gonads; lobes and segments single | Yes (127/127) |
| Naming | English TA-style; needs a side rule table | English, clean | English, small quirks (`*`, `'` copies) | English, exact names, segment codes "(II)", "(BVI)" | English, clean |
| Sub-parts | 4 chambers, 4 papillary muscles, 11 valve leaflets, coronaries, aortic segments; **no whole heart, no pericardium** | 2 thymus lobes, spleen (1 mesh), tonsils, ~100 node groups; **no lymphatic vessels or thoracic duct** | Gyri and sulci per lobe, basal ganglia, ~25 nuclei, cerebellar lobules, ventricles, meninges, ~30 tracts, cranial nerves I–XII, eye and inner ear parts | 5 lung lobes (no whole lung), 19 segmental bronchi, **liver as 8 segments plus a whole liver (overlapping)**, colon parts, kidney and pelvis, endocrine glands | Auricle parts, hair, nails |
| Sex-specific | Male vessels only | None | None | **Male only**: testis, epididymis, ductus deferens, seminal gland, ejaculatory duct, prostate, penis (3 parts) | Mammary *region* patches only |
| Mesh problems | 701 non-manifold objects (open tube ends); retinal arteries over-tessellated | 1 (a title mesh) | 509 non-manifold (spinal dura 8,818 edges) | 61 of 121 non-manifold; liver 47 loose vertices; organ/segment and organ/mucosa overlaps | 85 non-manifold |
| Overlap with built layers | None by shared data or matching bounds | None | None (ossicles are in the skeleton; extraocular muscles not found) | None | None; the patches sit over the (absent) skin |

**What collection 9 is: not anatomy.** It holds surface-anatomy region patches (thin solidified shells such as "Anterior region of thigh"), hair and nails, and the parts of the auricle. **Not in the file anywhere:** skin, ileum, rectum, pericardium, whole heart, whole lung, lymphatic vessels, and any female reproductive organ or breast tissue. Total for collections 5–9: about **7.2 M triangles**, nearly 5× the whole musculoskeletal build. 70 % of it is bevelled curves that can be re-tessellated. Left sides are negative-scale linked duplicates throughout, as in collection 1, so the existing pipeline handles them.

---

## 10. Known bugs, shortcuts and loose ends

**Content**
- All 900 soft-tissue files and 238 bone files have `reviewed: false`. Text was drafted from standard references and not checked line by line.
- `content/QUESTIONS.md` has **139 entries** (3 marked answered in the text):

  | Area | Entries |
  | --- | --- |
  | Bones | 36 (articulations 16, regions 9, text 11) |
  | Muscles | 75 (mapping 14, patches 5, depth 7, attachment migration 3, the four regional writing batches 43, origins/insertions/antagonists 3) |
  | Ligaments | 13 (mapping 4, content 9) |
  | Cartilage | 6 |
  | Joints (shared) | 4 |
  | Sidebar and search | 4 |
  | Colours | 1 |

  M10's next number is 140.
- The patches disagree with the content in 185 cases (never drawn). 1,373 attachments are tinted whole. 846 synergist/antagonist overlaps are listed in `REPORT-patches.md` and not reviewed (QUESTIONS 132–134).
- 6 old `muscleAttachments` strings never matched a muscle (answered in QUESTIONS). 12 source patches exist on one side only and are not mirrored.
- Landmark positions, TA2 IDs and articulation `surfaces` still don't exist (from M5).

**Behaviour**
- "Show attached muscles" before the muscles' content has loaded announces "attached muscles loading" and is not re-announced when the counts arrive.
- Joint and row highlights set the live region directly. A pointer resting on a panel row can replace the last message (AM).
- The Tab cursor outlines only a muscle's first part (a muscle has no mesh of its own), as a pointer hover does.
- The `R`/`E` keys work only from the canvas or page body, not while focus is in the panel.

**Performance and the build**
- Real-device layer load time, FPS at a muscle tier with antagonists, and soft click → highlight are unmeasured (AO and AP not run).
- The container cannot measure layer load meaningfully, because of the software GPU.
- Bundle growth against M5 has not been measured with the agreed method.
- Vite still warns about extensionless imports (from M5).

**Process**
- `STATUS.md` was brought up to date in session AQ. M10 is unmerged, and `/m10/` is undeployed and unfrozen (session AR).
- The per-browser `?bench` table (M5 step 12) is still empty.
- Playwright is not in CI. Only Chromium is automated. No VoiceOver pass has been done.

---

## Risks for the full-body phase

- **Triangle budget.** Collections 5–9 hold about 7.2 M triangles against a 1.5 M desktop and 450 k phone budget for everything. Vessels and nerves (4.8 M as curves) must be re-tessellated from their splines (fewer bevel segments, adaptive resolution), not just decimated. Otherwise the phone budget is out of reach even with musculoskeletal layers off.
- **Layer architecture.** Adding a layer means editing about 40 files of literal tables. Without a per-layer descriptor and registry first, each new system multiplies that cost and risk. Do the refactor before the first new system.
- **Draw calls and ghosts.** Two batches per layer plus outlines means 9 or more layers approach the < 20 draw-call budget before tints and patches. The ghost path (sorted, `depthWrite: false`) was only benched with muscles over bones.
- **Colour.** The categorical palette is already exhausted under colour-vision deficiency. The textbook vessel and nerve colours clash with muscle red and the tints. A colour model per system (and maybe texture or pattern cues) is needed.
- **Relationships.** Supply, drainage, innervation, containment and system membership have no common model. Building each as its own field, derive step and tier branch (as for muscles) won't scale. A typed relationship graph should come before content.
- **Source gaps.** There is no skin, rectum, ileum, pericardium, whole heart or lymphatic vessels, and the model is male only. The female reproductive system and breast must come from another source, or the scope must say so. Mixing sources risks scale and alignment mismatches.
- **Mapping effort.** About 2,000 named objects, many curves split into segments, side prefixes vs suffixes, and overlapping whole/part meshes (liver and its segments, stomach and mucosa) all need rules. Plan mapping as a fan-out per system with explicit whole-vs-part policies.
- **Interaction scale.** Search, the tree, the Tab cursor and labels already strain at 1,138 IDs. At 3,000+ they need filtering by system, a cursor scoped by layer, and label candidates thinned before projection.
