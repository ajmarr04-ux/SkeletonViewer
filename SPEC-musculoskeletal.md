# Skeleton Viewer — Musculoskeletal Expansion Spec (M6–M10)

This spec adds muscles, tendons, ligaments and cartilage to the finished skeleton viewer. It **extends** `SPEC (2).md` and the build described in `STATUS.md`; where this file is silent, those two still apply. Where it conflicts with them, this file wins for the new layers and leaves existing bone behaviour unchanged unless it says otherwise.

Work through milestones M6 to M10 in order, with a hosted `/m<N>/` snapshot for each (set `deploy/pages.json` `current` first, as before). Record plans and decisions in `docs/PLAN-milestone-<N>.md`, as before.

---

## 1. Scope

### In scope
| Layer | Contents |
| --- | --- |
| **Muscles** | All skeletal muscles in Z-Anatomy `4: Muscular system`, **split into anatomical parts** (heads, bellies, named portions) where the anatomy has them |
| **Tendons** | Named tendons and aponeuroses, treated as parts of their muscle (e.g. calcaneal tendon → gastrocnemius/soleus; bicipital aponeurosis → biceps brachii) |
| **Ligaments** | Ligaments from `3: Joints` |
| **Cartilage** | Articular cartilage, costal cartilages, intervertebral discs, menisci and articular discs (knee, TMJ, sternoclavicular, acromioclavicular, wrist), pubic symphysis disc |

### Deferred (do not build; keep the data model open for them)
- Joint capsules, synovial membranes, bursae, fascia, retinacula
- Nasal, laryngeal and auricular cartilage (see §12 open questions)
- Any animation, posing or range-of-motion display. **The skeleton stays in anatomical position.**
- Nerves, vessels, organs

### Unchanged
- Bones: 234 meshes / 238 IDs, content, articulations, regions and every existing behaviour.
- The first view still shows the **bones layer only**, with load times no worse than M5.

---

## 2. Source and asset pipeline

### Source
Same pinned Z-Anatomy `Startup.blend` (commit `71919ee`), same coordinate space, same licence (CC BY-SA 4.0 over BodyParts3D CC BY-SA 2.1 JP). `public/ATTRIBUTION.md` needs no new source, only a line saying which collections are now used.

| Collection | Use |
| --- | --- |
| `4: Muscular system` | Muscles, muscle parts, tendons |
| `3: Joints` | Ligaments, discs, menisci/articular discs, the 2 cartilage meshes. **Capsules and membranes: map but exclude** |
| `1: Skeletal system` | The named cartilage meshes (costal; nasal/laryngeal stay excluded) |
| `2: Muscular insertions` | Audit only in M6. If these are attachment-area patches on bone surfaces, they drive the origin/insertion highlights (§5.3). If not, ignore them |

### Pipeline (extend `scripts/blender/`, same rules as the bone build)
1. **Audit** (`audit_source.py` → `assets/audit/REPORT-soft-tissue.md` + JSON): per collection, list every mesh with faces, its name, triangle count, bounds, side (from name and from centroid x), manifold status, and whether it looks like a whole structure, a part, or a modelling fragment.
2. **Map** (`assets/mapping/soft-to-id.json`): stable ID → source object names, plus `missing`, `excluded` (with reason) and `merged` (fragments that are one anatomical structure). Many source names are Latin only; the mapping supplies the English name.
3. **Parts vs fragments.** A source split that matches a real anatomical division (long head of triceps) becomes a **part**. A split that exists only for modelling reasons is **merged**. When unsure, keep it separate and add it to `content/QUESTIONS.md`.
4. **Clean**: same as bones (normals, duplicates, non-manifold where fixable; record what isn't).
5. **Never move, re-pose or re-scale** any mesh. Check bounds against the manifest within 1 mm, as `check-models` does today.
6. **Bake AO per structure**, as for bones.
7. **Export one file per layer per LOD**, Meshopt-compressed like the bones:
   - `muscles-high.glb`, `muscles-low.glb`
   - `ligaments-high.glb`, `ligaments-low.glb`
   - `cartilage-high.glb`, `cartilage-low.glb`
   - One named node per **selectable leaf** (a part, or a muscle with no parts). Parent muscles have no mesh of their own; they are the union of their parts.
8. Extend `check-models` to all six files.

**Stop and report** (don't work around it) if: muscles are not separated left/right, a major muscle is missing, or parts can't be matched to anatomy for a large share of muscles.

---

## 3. Object model

### Kinds
```ts
type Kind =
  | "bone" | "tooth"                          // existing
  | "muscle" | "muscle_part"                  // muscle_part includes tendon/aponeurosis parts
  | "ligament"
  | "cartilage" | "disc" | "meniscus";         // meniscus covers articular discs too
type Layer = "bones" | "muscles" | "ligaments" | "cartilage";
// bones: bone, tooth · muscles: muscle, muscle_part · ligaments: ligament · cartilage: cartilage, disc, meniscus
```

### IDs
Same conventions: `snake_case`, side suffix last.
- Muscle: `triceps_brachii_left`
- Part: `triceps_brachii_long_head_left`, `gastrocnemius_medial_head_left`, `calcaneal_tendon_left`
- Ligament: `anterior_cruciate_ligament_left`, `anterior_longitudinal_ligament`
- Cartilage/disc/meniscus: `costal_cartilage_3_left`, `intervertebral_disc_l4_l5`, `medial_meniscus_left`, `articular_cartilage_femur_distal_left`

### Hierarchy of selectable things
```
Muscle (selectable, no own mesh if it has parts)
 └─ Part (selectable leaf with a mesh): head / belly / portion / tendon / aponeurosis
```
- A muscle with no anatomical divisions is a single leaf with its own mesh.
- A tendon shared by two muscles (calcaneal tendon) belongs to **one** parent in the data (`parent`), and lists the other under `alsoServes`.
- A midline aponeurosis shared by both sides (the linea alba) is a part with **no parent** (`parent: null`), listing the muscles it serves on both sides under `alsoServes`. (Added in M6 by the user's decision of 2026-11-20; `content/QUESTIONS.md` 40.)

---

## 4. Content data

New folders, same Markdown + YAML front matter, same 40–80-word body, same `reviewed: false` rule, same left-side-written / `content:mirror` approach, same zod validation.

```
content/
  muscles/<id>.md        muscles AND parts
  ligaments/<id>.md
  cartilage/<id>.md      cartilage, discs, menisci
  movements.json         movement vocabulary + antagonist pairs
  muscle-hierarchy.json  region → compartment → muscle → parts
  muscle-depth.json      depth layer per muscle (see §6.2)
```

### 4.1 Muscle — `content/muscles/triceps_brachii_left.md`
```markdown
---
id: triceps_brachii_left
kind: muscle
name: Triceps brachii
latin: Musculus triceps brachii
commonName: Triceps
side: left
region: [upper_limb, arm]
compartment: arm_posterior
parts: [triceps_brachii_long_head_left, triceps_brachii_lateral_head_left, triceps_brachii_medial_head_left]
origin: []            # empty when every part declares its own
insertion:
  - { structure: ulna_left, landmark: olecranon }
actions:
  - { joint: elbow_joint_left, movement: extension, role: prime }
innervation: Radial nerve (C6–C8)
clinicalNote: null
reviewed: false
---
Summary text, 40–80 words.
```

### 4.2 Part — `content/muscles/triceps_brachii_long_head_left.md`
```markdown
---
id: triceps_brachii_long_head_left
kind: muscle_part
partType: head        # head | belly | portion | tendon | aponeurosis
parent: triceps_brachii_left
alsoServes: []
name: Long head of triceps brachii
latin: Caput longum musculi tricipitis brachii
side: left
origin:
  - { structure: scapula_left, landmark: infraglenoid_tubercle }
insertion: inherit    # "inherit" = use the parent's insertion
actions:              # only actions that differ from or add to the parent
  - { joint: shoulder_joint_left, movement: extension, role: assist }
  - { joint: shoulder_joint_left, movement: adduction, role: assist }
reviewed: false
---
Shorter body allowed for parts: 20–60 words.
```

**Attachment entries:**
```ts
type Attachment = {
  structure: string;          // an existing ID (bone, cartilage, ligament, other muscle's part)
  landmark?: string;          // landmark ID on that structure, if one exists
} | {
  soft: string;               // free text for non-object attachments: "fascia lata", "skin of the face", "linea alba"
};
```

### 4.3 Actions and movements
`content/movements.json` is a closed vocabulary. Validation rejects any movement not in it.
```json
{
  "movements": ["flexion", "extension", "abduction", "adduction", "medial_rotation", "lateral_rotation",
                "pronation", "supination", "dorsiflexion", "plantarflexion", "inversion", "eversion",
                "elevation", "depression", "protraction", "retraction", "upward_rotation", "downward_rotation",
                "lateral_flexion", "rotation", "opposition", "reposition", "circumduction", "stabilisation"],
  "antagonistPairs": [["flexion", "extension"], ["abduction", "adduction"], ["medial_rotation", "lateral_rotation"],
                      ["pronation", "supination"], ["dorsiflexion", "plantarflexion"], ["inversion", "eversion"],
                      ["elevation", "depression"], ["protraction", "retraction"], ["upward_rotation", "downward_rotation"],
                      ["opposition", "reposition"]]
}
```
- `joint` must be a joint ID from `articulations.json`. Muscles acting on non-synovial structures (facial muscles, diaphragm, tongue) use `actions: []` and describe the function in a `functions: string[]` field instead (optional for all muscles, required when `actions` is empty).
- `role`: `prime | assist | stabiliser`.

**Synergists and antagonists are derived, not hand-written:**
- **Synergists of X** = other muscles (or parts) with an action on the **same joint** and the **same movement** as one of X's prime/assist actions.
- **Antagonists of X** = muscles with an action on the same joint and the **paired** movement.
- An optional `synergistOverrides: { add: [], remove: [] }` field exists for anatomical exceptions; each use needs a `QUESTIONS.md` entry.

### 4.4 Ligament — `content/ligaments/<id>.md`
```yaml
id: anterior_cruciate_ligament_left
kind: ligament
name: Anterior cruciate ligament
latin: Ligamentum cruciatum anterius
commonName: ACL
side: left
joint: knee_joint_left           # joint ID from articulations.json
connects: [femur_left, tibia_left]
functions: [Limits anterior translation of the tibia on the femur, Resists hyperextension and rotation]
clinicalNote: ...
reviewed: false
```

### 4.5 Cartilage, disc, meniscus — `content/cartilage/<id>.md`
```yaml
id: medial_meniscus_left
kind: meniscus
name: Medial meniscus
latin: Meniscus medialis
side: left
joint: knee_joint_left           # or null for costal cartilage
attachedTo: [tibia_left]         # the structures it sits on or joins
functions: [...]
clinicalNote: ...
reviewed: false
```

### 4.6 Changes to bone content
- `muscleAttachments: string[]` in bone files is **replaced by derived data**: the compiler builds each bone's list of attached muscles from every muscle/part `origin` and `insertion`.
- **Migration (M8):** a script matches every existing `muscleAttachments` string to a muscle ID. Any string that matches nothing is listed in the PR/plan notes and in `QUESTIONS.md`. Only when every string is accounted for, remove the field from the 136 hand-written bone files (mirror regenerates the rest) and from the schema.
- Bone `landmarks` remain the target of `Attachment.landmark`. Add landmarks to bone files where muscles need them (names only; `position` stays `null` unless derived from mesh data, per the existing rule).

### 4.7 Names
Every title shows English on the first line and Latin underneath in italics, as for bones. Parts show "Part of *Triceps brachii*" under the Latin name.

---

## 5. Selection, isolation and relationships

The existing reducer (`src/state/isolation.ts`) and view logic (`src/scene/isolation.ts`) are generalised to all kinds. Bone behaviour stays exactly as it is.

### 5.1 Nested selection (muscles)
1. **First click on any part of a muscle selects the whole muscle**: all its parts get the focus colour and outline, and the panel shows the muscle.
2. **Clicking a part of the already-selected muscle selects that part.** The other parts drop to normal muscle colour (still solid); the panel shows the part.
3. **Clicking a different part of the same muscle** while a part is selected switches to that part.
4. The breadcrumb shows `Muscles › Upper limb › Triceps brachii › Long head`. Clicking a crumb, or **Esc**, goes up one level (part → muscle → tier/full), consistent with the existing Back rules. The muscle → part step is a `push` in history so the browser Back button walks it.
5. In the sidebar tree, muscles expand to show their parts; selecting a row behaves like the equivalent click.
6. Muscles without parts behave like bones: one click selects them.

### 5.2 Tiers per kind

| Kind | Tier 0 | Tier 1 — "Show related" | Tier 2 — "Expand" |
| --- | --- | --- | --- |
| Bone, tooth | unchanged | unchanged | unchanged |
| Muscle / part | The muscle (or part) | **Attachments**: + its origin and insertion bones (and any attachment structures that are objects) | **Functional group**: + derived synergists (and their attachment bones) |
| Ligament | The ligament | + the bones it connects | + the joint's other ligaments, cartilage and discs/menisci |
| Cartilage / disc / meniscus | The structure | + the bones it sits on or joins | + the joint's ligaments and other cartilage |

- Tier 2 for muscles also has a **"Show antagonists"** toggle (off by default). Antagonists render in a distinct tint (one categorical colour, with a legend chip) so they're never confused with synergists.
- Labels: "Show related" becomes "Show attachments" for muscles; "Expand" becomes "Show functional group".
- A **part** at tier 1 uses its own origin plus its (inherited) insertion; at tier 2, its synergists are derived from its own and inherited actions.
- **Isolation overrides layer toggles**: anything a tier needs is shown even if its layer is off (e.g. a muscle's bones show at tier 1 with the bones layer hidden).

### 5.3 Origin and insertion highlighting
At muscle tier 1:
- **If M6's audit shows `2: Muscular insertions` gives usable attachment patches**, render them as overlay meshes on the bones: origin in one colour, insertion in another, with legend chips "Origin" / "Insertion".
- **Otherwise (fallback):** tint the whole origin bone(s) and insertion bone(s) with those two colours. Bones that are both (rare) use the origin colour plus an outline.
- Hovering an attachment row in the panel highlights that bone (existing joint-hover behaviour).

### 5.4 Bone → muscle cross-link
- In a bone's panel, **Attached muscles** becomes a list of links grouped as *Origins* and *Insertions*, derived (§4.6). Clicking one selects that muscle.
- A new bone action, **"Show attached muscles"**, isolates the bone plus every muscle with an attachment on it, using the existing group mechanism (`grp=attached:femur_left`). It works when the muscles layer is off (isolation overrides layers).

### 5.5 Picking across layers
- The pick returns the nearest **visible, solid** structure along the ray, across all layers. Ghosts and hidden structures are not pickable (unchanged rule).
- Small-object hit proxies (`pickWithProxies`) apply to new structures under the same 2 cm radius rule.
- **Peeling a structure (new):** a "Hide" button in the panel and the `X` key hide the selected structure (or muscle) and step selection back. A toolbar chip shows "N hidden · Show all". Hidden structures are stored in the URL (`hid=`, comma-separated IDs, capped; overflow is dropped with a toast).

---

## 6. Layers and depth

### 6.1 Layers panel
A **Layers** button in the toolbar (also in the "More" menu on narrow screens) opens a panel:

| Layer | Control | Default |
| --- | --- | --- |
| Bones | On / Ghost / Off | On |
| Cartilage | On / Ghost / Off | Off |
| Ligaments | On / Ghost / Off | Off |
| Muscles | On / Ghost / Off, plus the depth control (§6.2) | Off |

- **Ghost** shows the layer translucent and unpickable, which gives the "see the bones through the muscles" view.
- Layer state is in the URL (`layers=b:on,c:off,l:off,m:ghost`) and in `localStorage` like the colour setting.
- A layer's files are fetched the **first time it is turned on** (low LOD first, then high, mirroring the bone loader). Show a small progress indicator in the layer row.
- Two presets above the toggles: **Skeleton** (bones only) and **Full musculoskeletal** (all on).

### 6.2 Muscle depth (the "peel")
- Every muscle gets a depth in `content/muscle-depth.json`: `1 = superficial`, `2 = intermediate`, `3 = deep`, assigned per region by anatomical convention. Muscles that genuinely span layers take the depth of their most superficial portion. Parts may override.
- In the Muscles row, a 4-stop **depth control**: *All* · *Hide superficial* · *Hide superficial + intermediate* · *Deep only*.
- Peeled muscles are hidden (not ghosted) so the next layer is clickable.
- Depth plus per-structure Hide (§5.5) cover both "peel by layer" and "peel one at a time".

### 6.3 Colours
| Layer | Colour |
| --- | --- |
| Bones | unchanged (ivory, region colours when on) |
| Muscles | muted red, with slightly lighter tendons/aponeuroses (`partType` tendon/aponeurosis) |
| Ligaments | pale grey-white, distinct from bone |
| Cartilage | pale blue-grey |
| Focus, outline, hover | unchanged accent |
| Origin / insertion / antagonist tints | three new categorical colours, chosen to pass the existing ΔE2000 ≥ 8 deuteranopia/protanopia check against each other, the focus accent and the layer colours |

Colour-by-region continues to apply to **bones only** in this milestone set.

---

## 7. UI changes

- **Info panel** gains kind-specific sections, in this order after the summary:
  - Muscle/part: Parts (links) or "Part of …", Origin, Insertion, Actions (joint · movement · role), Synergists (derived, links), Antagonists (derived, links), Innervation, Clinical note.
  - Ligament: Joint, Connects (links), Functions, Clinical note.
  - Cartilage/disc/meniscus: Joint, Attached to (links), Functions, Clinical note.
  - Bone: Attached muscles grouped Origins / Insertions (§5.4).
- **Sidebar** gains top-level roots **Muscles**, **Ligaments**, **Cartilage** beside the existing three. Muscles: region → compartment → muscle → parts. Ligaments: by joint. Cartilage: by type then joint. Every inner node keeps the existing "Isolate" group action.
- **Search** indexes all new structures (English, Latin, common names, synonyms such as "ACL", "rotator cuff", "hamstrings"). Add group synonyms that resolve to a group isolation: "rotator cuff", "hamstrings", "quadriceps", "erector spinae".
- **Labels**: the existing priority layout covers all visible structures; at equal size, the focus layer's labels win.
- **Breadcrumb** supports the muscle → part level.
- **Legend** shows layer colours when more than one layer is on, and the origin/insertion/antagonist chips when in use.

---

## 8. Rendering

- One **solid `BatchedMesh` and one ghost `BatchedMesh` per layer**, built the same way as the bone batches (`batchSkeleton.ts` generalised). The bone batches are unchanged.
- **Draw-call budget: < 20** with every layer on and a selection active (4 layers × 2 + outlines).
- Outlines: the inverted-hull approach extends to multiple instances (a whole muscle's parts). If the per-outline single draw call can't cover several parts across one batch, add one hull per selected part and keep the total within budget.
- **Ghost cost**: many translucent muscles overlapping is the main performance risk. Measure it in M7. If the ghost-muscle layer misses the frame-rate budget on the iPhone, ghost muscles render with depth pre-pass or lower opacity, or Ghost is disabled for muscles on low-LOD devices with a note in Settings.
- `isolationView` becomes layer-aware: it returns, per layer, the solid, ghost, hidden and focus sets, plus tint maps (origin/insertion/antagonist).

---

## 9. Performance budgets

Existing bone budgets stay as they are and must not regress with all new layers **off**.

| Metric | Desktop (all layers on) | Phone (all layers on) |
| --- | --- | --- |
| Triangles, total | ≤ 1.5M | ≤ 450k |
| — muscles | ~800k | ~230k |
| — ligaments + cartilage | ~200k | ~70k |
| A layer's low LOD visible after turning it on | ≤ 3 s | ≤ 5 s (Fast 4G profile) |
| FPS orbiting, all layers solid | 60 (vsync) | ≥ 30, target 60 |
| FPS orbiting, muscles ghosted over bones | ≥ 45 | ≥ 30 |
| Click → highlight | < 50 ms | < 100 ms |
| Draw calls | < 20 | < 20 |

- The triangle split is a starting point; M6's audit may move it. Record any change in the M6 plan.
- Measure with the existing `?bench` and `perf-load` tools, extended with `?layers=` presets. Add the results to `STATUS.md` §6.
- The JS bundle must not grow more than 150 KB gzipped; new content and search data load as lazy chunks per layer.

---

## 10. Validation (extend `validate-content`)

Fail the build if:
- Any mesh node in the six new `.glb` files has no content file, or any content file whose `meshAvailable` is true has no mesh.
- A `muscle_part` has a missing or wrong-kind `parent`, or a muscle lists a part that doesn't name it as `parent`.
- A muscle (taking its parts together) has no origin or no insertion. `soft` attachments count.
- Any `structure`, `joint`, `connects`, `attachedTo`, `alsoServes` or `landmark` reference doesn't exist.
- A movement isn't in `movements.json`.
- A muscle has `actions: []` without `functions`.
- A muscle has no depth in `muscle-depth.json`.
- Left/right mirrors drift (existing rule, extended to the new folders).
- After the M8 migration: any bone still has a `muscleAttachments` field.

Keep the derived-data checks as Vitest tests: e.g. synergists of `biceps_brachii_left` include `brachialis_left` (elbow flexion); antagonists include `triceps_brachii_left`; `femur_left` attached-muscle origins include the vasti.

---

## 11. Milestones

### M6 — Audit, mapping and assets
- [ ] Soft-tissue audit report and JSON for collections 2, 3, 4 and the cartilage in 1.
- [ ] `soft-to-id.json` with every mesh mapped, merged or excluded (with reasons).
- [ ] Decision recorded on `2: Muscular insertions` (patches usable or not).
- [ ] Six layer files exported, compressed, under budget, passing `check-models`.
- [ ] A debug view (`?debug&layers=all`) shows every layer in place with no visible misalignment against the bones.
- [ ] **Report back** with counts per kind (muscles, parts, tendons, ligaments, cartilage, discs, menisci) before writing content.

### M7 — Layers and rendering
- [ ] Layers panel, presets, URL and `localStorage` state, lazy layer loading.
- [ ] Per-layer batches, ghost mode per layer, muscle depth control, per-structure Hide.
- [ ] Picking across layers; hit proxies for small structures.
- [ ] Bench results (all solid; muscles ghosted) on PC and iPhone recorded in the plan.

### M8 — Data model and content
- [ ] Schemas, `movements.json`, `muscle-hierarchy.json`, `muscle-depth.json`.
- [ ] All muscle, part, ligament and cartilage content drafted (left and midline written; right mirrored), `reviewed: false`.
- [ ] `muscleAttachments` migration done and the field removed.
- [ ] `validate-content` passes; derived synergist/antagonist tests pass.
- [ ] Uncertain choices added to `QUESTIONS.md` under new headings per layer.

### M9 — Interaction
- [ ] Nested muscle → part selection with breadcrumb and history.
- [ ] Tiers per kind (§5.2), antagonist toggle, origin/insertion highlighting (patches or fallback).
- [ ] Bone panel attached-muscle links and "Show attached muscles".
- [ ] Info panel sections per kind; sidebar roots; search and group synonyms.
- [ ] Playwright: full skeleton → turn on muscles → click triceps → click long head → Show attachments (scapula + ulna tinted) → Show functional group → Back ×4 → full view.

### M10 — Polish and measurement
- [ ] Labels, legend chips and colours pass the existing colour-vision check.
- [ ] Keyboard and screen-reader announcements cover the new kinds, layers and the part level.
- [ ] Performance budgets met (or misses documented with the fallback taken).
- [ ] `STATUS.md` updated (new sections for layers; §6 and §7 tables extended).

---

## 12. Open questions (answer in `QUESTIONS.md`; defaults apply until then)

| Question | Default until answered |
| --- | --- |
| Include muscles of the larynx, pharynx, soft palate, tongue, middle ear and eye? | **Include** whatever the source has as skeletal muscle; nothing extra is modelled |
| Include nasal, laryngeal and auricular cartilage? | Exclude (deferred with capsules etc.) |
| How to place structures whose depth varies along their length (e.g. latissimus dorsi)? | Depth of the most superficial portion |
| Should colour-by-region extend to muscles? | No, bones only for now |
| Wisdom teeth still have no mesh | Unchanged |

---

## 13. Working rules for Claude Code

Everything in `SPEC (2).md` §12 and `CLAUDE.md` still applies. In addition:

- **Don't regress the skeleton.** With all new layers off, load time, FPS, draw calls and every existing test must match M5.
- **Never invent anatomy.** Attachments, actions, innervation, depth and landmark positions come from standard references; if unsure, leave it out or mark it, and add a `QUESTIONS.md` entry. Synergists and antagonists are only ever derived from `actions`.
- **Parts follow anatomy, not the source's mesh splits.** When the two disagree, the mapping records the merge or the doubt.
- **Report back after M6** with real counts and any audit surprises before starting content.
- Keep content in `content/`, editable without touching code; keep the new layers' content and search data in lazy chunks.
