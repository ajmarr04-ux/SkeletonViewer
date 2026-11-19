# Skeleton Viewer — Build Spec

A browser-based 3D atlas of the complete adult human skeleton. Users orbit, pan and zoom around the model, click any bone (or tooth) to isolate it and read about it, and expand the isolation to show its neighbouring bones in their true anatomical positions.

This file is the source of truth for the build. Work through the phases in order, and check off the acceptance criteria for each phase before starting the next.

---

## 1. Context and constraints

- **Project type:** personal, non-commercial. It will be given as a gift to friends and family who have medical training. There are no accounts, payments or analytics.
- **Audience:** readers with medical knowledge. Clinical terminology is fine. Each entry still opens with a short plain summary.
- **Platform:** a static web app that runs in a browser tab. There is no backend. Everything ships as files that can be served from any static host.
- **Scope:** bones and teeth only. There are no muscles, ligaments, organs, vessels or nerves. Articular cartilage is out of scope unless phase 5 shows that joints are unreadable without it.
- **Selectable objects:** 206 bones plus 32 permanent teeth, for 238 objects in total. Left and right bones are separate objects.

### Non-goals (do not build)
- Animated joint motion or range-of-motion simulation
- Variants of the skeleton by sex, age or pathology
- Accounts, quizzes, user annotations or classroom features
- Native apps, VR or AR

---

## 2. Tech stack

| Concern | Choice |
| --- | --- |
| Build | Vite + TypeScript (strict) |
| UI | React 18+ |
| 3D | three.js (WebGL 2) via `@react-three/fiber` and `@react-three/drei` |
| Camera | `camera-controls` |
| Picking | `three-mesh-bvh` (accelerated raycasting) |
| Draw-call reduction | `THREE.BatchedMesh` (one draw call; per-object visibility and colour) |
| Selection outline | `postprocessing` OutlineEffect (or the equivalent drei/r3f postprocessing) |
| State | `zustand`, mirrored to the URL query string |
| Content | Markdown with YAML front matter, plus JSON for relationships, compiled at build time |
| Search | `minisearch` (or similar), with the index built at build time |
| Tests | Vitest (unit tests and data validation) and Playwright (end-to-end smoke tests) |
| Model format | glTF 2.0 binary (`.glb`) with Meshopt compression (`gltfpack`) |

Do not add a backend, a database or a login.

---

## 3. Project structure

```
/
├─ SPEC.md                    ← this file
├─ public/
│  └─ models/
│     ├─ skeleton-high.glb    ← desktop LOD (~500k tris, <15 MB)
│     └─ skeleton-low.glb     ← mobile LOD  (~150k tris, <6 MB)
├─ content/
│  ├─ bones/<id>.md           ← one file per bone/tooth (front matter + body)
│  ├─ articulations.json      ← joint table
│  ├─ regions.json            ← curated tier-2 region sets
│  └─ hierarchy.json          ← axial/appendicular/dentition tree
├─ scripts/
│  ├─ validate-content.ts     ← build-time integrity checks (see §9)
│  └─ build-search-index.ts
├─ src/
│  ├─ scene/                  ← Canvas, model loading, BatchedMesh, picking, outline, ghost material
│  ├─ camera/                 ← camera-controls wrapper, presets, framing
│  ├─ state/                  ← zustand store + URL sync
│  ├─ ui/                     ← InfoPanel, Sidebar (search + tree), Toolbar, Breadcrumb
│  ├─ content/                ← typed loaders for compiled content
│  └─ main.tsx
└─ tests/
```

---

## 4. 3D assets

### Source
This is a non-commercial project, so a model under a share-alike licence (CC BY-SA) is acceptable. In order of preference:

1. **Z-Anatomy** (CC BY-SA 4.0): https://github.com/Z-Anatomy/Models-of-human-anatomy. This is a cleaned Blender atlas built on BodyParts3D.
2. **Open 3D Model** (CC BY-SA): https://anatomytool.org/node/63903. It includes the skeleton as `.blend`, `.obj` and `.glb`.
3. **BodyParts3D** (CC BY 4.0): https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html. These are the raw MRI-derived meshes and need more cleanup.

**Teeth:** first check that the chosen source has a separate mesh for each of the 32 teeth. If it doesn't, take the teeth from BodyParts3D. If neither source has them separated, stop and report back. Don't split the jaw meshes by hand without asking.

### Pipeline (do it in Blender, scripted with Python where possible)
1. Split the model so each bone or tooth is its own object, with left and right separate (238 objects).
2. Fix non-manifold geometry, flipped normals and overlapping duplicates.
3. Name every object by its **stable ID** (see §5), never by its display name.
4. Set each object's origin to its centroid. All objects share one coordinate space: anatomical position, metres, Y up, facing +Z.
5. Bake ambient occlusion into vertex colours.
6. Export two LODs and compress them with `gltfpack -cc` (Meshopt).
7. Write the attribution text to `public/ATTRIBUTION.md` and show it in the app (see §7).

Do **not** move or re-pose any bone. Isolation depends on every object keeping its exact world position.

---

## 5. Data model

### Stable IDs
- Use `snake_case`, with a side suffix where the bone is paired: `femur_left`, `hip_bone_right`, `sacrum`, `malleus_left`.
- Teeth use FDI two-digit notation: `tooth_11` through `tooth_48`. The first digit is the quadrant (1 = upper right, 2 = upper left, 3 = lower left, 4 = lower right). The second digit is the position from the midline (1 to 8).

### Bone/tooth content file — `content/bones/<id>.md`

```markdown
---
id: femur_left
name: Femur
latin: Os femoris
commonName: Thigh bone
side: left            # left | right | midline
kind: bone            # bone | tooth
region: [appendicular, lower_limb, thigh]
type: long            # long | short | flat | irregular | sesamoid | tooth
toothType: null       # incisor | canine | premolar | molar  (teeth only)
ta2: null             # Terminologia Anatomica 2 ID — fill only from a real reference, else null
functions:
  - Bears body weight in standing and gait
  - Lever arm for hip and knee movement
  - Attachment for hip and thigh musculature
landmarks:
  - { id: femur_head, name: Head, position: null }
  - { id: femur_neck, name: Neck, position: null }
  - { id: greater_trochanter, name: Greater trochanter, position: null }
  - { id: lesser_trochanter, name: Lesser trochanter, position: null }
  - { id: linea_aspera, name: Linea aspera, position: null }
  - { id: medial_condyle, name: Medial condyle, position: null }
  - { id: lateral_condyle, name: Lateral condyle, position: null }
muscleAttachments: [Gluteus medius, Gluteus minimus, Iliopsoas, Adductor group, Vastus lateralis/medialis/intermedius, Gastrocnemius]
clinicalNote: Femoral neck fractures are common in older adults with osteoporosis.
reviewed: false
---
The femur (thigh bone) is the longest, largest, and strongest bone in the human body, extending from the hip to the knee. It supports body weight, enables walking and standing, and serves as an attachment site for major leg and hip muscles.
```

Rules:
- The body is a summary of 40 to 80 words. Precise anatomical terms are fine.
- Leave landmark `position` as `null` unless it can be derived from the mesh (for example, the vertex nearest a known extreme) or a human supplies it. **Never invent coordinates.**
- Leave `ta2` as `null` unless it can be taken from a real reference. **Never invent IDs.**
- Paired bones share their text. Generate the right-side file from the left, or use a shared base file with a side override.
- `reviewed: false` on every entry until a human checks it. The panel shows a "Draft — not yet reviewed" note when it is false.

### `content/articulations.json`
```json
[
  { "a": "femur_left", "b": "hip_bone_left", "joint": "hip_joint_left", "name": "Hip joint",
    "surfaces": { "femur_left": "femur_head", "hip_bone_left": "acetabulum" } },
  { "a": "femur_left", "b": "tibia_left", "joint": "knee_joint_left", "name": "Knee joint (tibiofemoral)" },
  { "a": "femur_left", "b": "patella_left", "joint": "patellofemoral_joint_left", "name": "Patellofemoral joint" }
]
```
Tier 1 is generated from this table. Each tooth articulates with its alveolar bone (maxilla or mandible) at a gomphosis; record that here as well.

### `content/regions.json`
Each bone has a curated tier-2 set (the bones added on top of tier 1):
```json
{ "femur_left": ["sacrum", "coccyx", "hip_bone_right", "fibula_left"] }
```

### `content/hierarchy.json`
A tree with three top-level groups:
- **Axial:** skull (cranial, facial, ossicles, hyoid), vertebral column, thorax
- **Appendicular:** pectoral girdle, upper limbs, pelvic girdle, lower limbs
- **Dentition:** upper/lower → left/right → incisors, canines, premolars, molars → individual teeth

---

## 6. Interaction model

Four nested states. Each action moves one level deeper or one level back.

```
Full skeleton
   │ click a bone                ▲ Esc / Back / click empty space
   ▼                             │
Bone isolated (tier 0) ◄── click another bone: switch focus (stay at tier 0)
   │ "Show related"              ▲ Esc / Back
   ▼                             │
Joints (tier 1)  ── double-click a related bone ──► new focus at tier 0
   │ "Expand region"             ▲ Esc / Back
   ▼                             │
Region (tier 2)  ── double-click a related bone ──► new focus at tier 0
```

### Camera
| Action | Mouse | Trackpad | Touch | Keyboard |
| --- | --- | --- | --- | --- |
| Orbit | Left-drag | One-finger drag (click held) | One-finger drag | Arrow keys |
| Pan | Right-drag / Shift + left-drag | Two-finger drag | Two-finger drag | Shift + arrows |
| Zoom (toward cursor) | Wheel | Pinch | Pinch | `+` / `-` |
| Re-centre on a bone | Double-click | Double-tap | Double-tap | `F` frames the selection |
| Reset | Home button | Home button | Home button | `H` |

- Orbit pivots around a focus point. Re-centring eases the camera over about 400 ms.
- Clamp zoom: the minimum distance is set by the smallest visible object, and the maximum is about 3× the full skeleton's bounding sphere.
- Clamp vertical orbit just short of the poles, so the view never flips.
- Use damping on every move. When `prefers-reduced-motion` is set, use instant cuts.
- Preset views: anterior, posterior, left, right, superior, inferior.

### Selection
- Hover (desktop only): show a thin outline, then a name tooltip after about 150 ms.
- Click selects the object. If the pointer moves more than 5 px between down and up, treat it as a camera drag, not a click.
- Tiny objects (ossicles, distal phalanges, sesamoids, teeth) get enlarged invisible hit proxies so they can be tapped on a phone.
- Paired bones: the info panel has a toggle that jumps to the opposite side.

### Isolation
- By default, objects outside the isolation are **ghosted**: a translucent, depth-sorted second material. A toggle hides them completely instead, and a slider controls ghost opacity.
- The focus object gets the accent colour and an outline. Related objects keep the normal bone colour.
- Isolation only changes visibility and materials. **No geometry moves or reloads.**
- Joints are not separate objects. When the user hovers a joint name in the panel, highlight both contact surfaces using the `surfaces` landmarks; until those have positions, highlight both bones.
- The optional **Explode** slider is off by default. It pushes tier-1 bones apart along each joint's axis, and they snap back when it is released.

### Worked example: femur
| Tier | Visible |
| --- | --- |
| 0 | Femur |
| 1 | + hip bone, patella, tibia |
| 2 | + sacrum, coccyx, opposite hip bone, fibula |

The fibula is in tier 2, not tier 1, because it does not articulate with the femur.

### Teeth
- Each of the 32 teeth can be selected on its own.
- From a selected tooth, "Show related" displays its alveolar bone (maxilla or mandible) and its neighbouring teeth in the same arch. "Expand region" displays the full skull plus both dental arches.
- The hierarchy tree lets the user isolate a whole tooth type at once (for example, all molars, or all upper incisors).

---

## 7. UI

| Area | Desktop | Phone |
| --- | --- | --- |
| 3D viewport | Full window | Full screen |
| Sidebar (search + hierarchy tree) | Left, collapsible | Search icon → full-screen sheet |
| Info panel | Right, ~360 px | Bottom sheet: peek (name) / half (summary) / full |
| Toolbar | Floating bottom-centre | Floating bottom, icons only |
| Breadcrumb | Top-left: `Skeleton › Lower limb › Femur` | Top, single line |

### Name display (everywhere a name is shown as a title)
The English name goes on the first line. The Latin name goes on the line below it, *in italics* and in a smaller, secondary colour:

> **Femur**
> *Os femoris*

### Info panel sections, in order
1. Name (English, with Latin underneath), common name, side toggle
2. A badge row: region, bone type (or tooth type), and a "Draft — not yet reviewed" note if `reviewed` is false
3. Summary
4. Functions
5. Articulations: each one links to its bone and highlights the joint on hover
6. Key landmarks: toggling them shows pinned 3D labels for any landmark with a position
7. Major muscle attachments
8. Clinical note
9. Buttons: Show related / Expand region / Back

### Toolbar
Home, preset views, Show related, labels toggle, ghost/hide toggle, colour-by-region toggle (with a legend), screenshot (PNG with the attribution stamped in a corner), share link.

### Other
- **Search:** autocomplete across English names, Latin names, common names and synonyms ("kneecap", "collarbone", "wisdom tooth"). Choosing a result selects the object and frames it.
- **Labels:** floating names on visible objects, laid out so they never overlap.
- **Attribution:** a page listing the model source, its licence and its authors.
- **WebGL 2 missing:** show a static fallback image and a message.

### URL state
`?sel=femur_left&tier=1&cam=<px,py,pz,tx,ty,tz>&ghost=1`. Every change of state updates the URL with `replaceState`. A change of isolation level uses `pushState`, so the browser's Back button steps back one level.

---

## 8. Performance budgets

| Metric | Desktop | Mid-range phone |
| --- | --- | --- |
| First skeleton visible (low LOD) | ≤ 3 s | ≤ 5 s on 4G |
| Full detail loaded | ≤ 8 s | ≤ 12 s |
| Model download | < 15 MB | < 6 MB |
| Triangles | ~500k | ~150k |
| FPS while orbiting | 60 | ≥ 30 |
| Click → highlight | < 50 ms | < 100 ms |
| Draw calls | < 20 | < 20 |

- Load the low LOD first, then stream in the high LOD.
- Choose the starting LOD from screen size, `navigator.deviceMemory` and a short GPU probe. The user can override it in settings.
- Lighting: one soft key light, an environment map and baked AO. No real-time shadows.

**Supported browsers:** the current and previous major versions of Chrome, Edge, Firefox and Safari (macOS and iOS), plus Chrome on Android.

---

## 9. Validation (`scripts/validate-content.ts`, runs in CI and before `build`)

Fail the build if any of these checks fails:
- Every mesh ID in the `.glb` has a matching `content/bones/<id>.md` file, and every content file has a matching mesh.
- There are exactly 238 selectable objects: 206 bones and 32 teeth.
- Every object appears in `articulations.json` at least once. The only exception is the hyoid, which has no bony articulation and must be listed in an explicit allowlist.
- Every object has an entry in `regions.json`.
- Every ID referenced anywhere actually exists.
- Articulations are symmetric. A pair is stored once, and the loader looks it up from either side.
- The front matter matches the TypeScript schema. Use `zod` for this.

---

## 10. Accessibility (WCAG 2.2 AA)

- The hierarchy tree is the accessible twin of the 3D view. Selecting a bone there does exactly what clicking it in the view does. Use `aria-live` to announce the selected bone, the isolation tier and the related bones.
- The camera can be fully controlled from the keyboard, and every control shows a visible focus ring.
- When the canvas has focus, Tab cycles through the visible objects in anatomical order.
- Selection is shown by outline **and** colour, never colour alone. Region colours must stay distinguishable for people with deuteranopia and protanopia.
- `prefers-reduced-motion` turns off damping and eased transitions.
- Panel text has at least 4.5:1 contrast and reflows correctly at 200% zoom.

---

## 11. Build phases

### Phase 1 — Model ready
- [ ] Source chosen. Teeth are confirmed as separate meshes, or the problem has been reported back.
- [ ] 238 objects, named by stable ID, in one shared coordinate space.
- [ ] Both LODs exported and compressed, and each is under its size budget.
- [ ] A bare viewer loads both LODs.

### Phase 2 — Viewer
- [ ] Orbit, pan, zoom, presets and reset work on mouse, trackpad, touch and keyboard.
- [ ] Camera state is synced to the URL.
- [ ] The phone frame-rate budget is met (check with Chrome DevTools mobile emulation and CPU throttling, plus one real device if one is available).

### Phase 3 — Select and isolate
- [ ] Hover, select, drag-versus-click detection and enlarged hit proxies all work.
- [ ] Tier-0 isolation works, with ghost and hide modes.
- [ ] The info panel works with placeholder content.
- [ ] Every object, including the ossicles and teeth, can be selected on a 390 px wide viewport.

### Phase 4 — Related isolation and content
- [ ] `articulations.json`, `regions.json` and `hierarchy.json` are complete.
- [ ] Tiers 1 and 2, joint highlighting and the Explode slider work.
- [ ] All 238 content files are drafted from standard anatomical references, with `reviewed: false`.
- [ ] `validate-content` passes.

### Phase 5 — Polish
- [ ] Search, labels, colour-by-region, screenshots, share links and the attribution page are done.
- [ ] Accessibility checks pass: axe-core reports no violations, and a manual keyboard-only pass succeeds.
- [ ] Performance budgets are met on the supported browsers.
- [ ] A Playwright smoke test passes: load → click femur → Show related → Expand region → Back ×3 → full skeleton.

---

## 12. Working rules for Claude Code

- Finish each phase and tick its checklist before starting the next one. Commit at the end of every phase.
- Run `tsc --noEmit`, `vitest` and `validate-content` before you declare any phase done.
- **Anatomical accuracy comes first.** Don't make up landmark coordinates, TA2 IDs or articulations. If you are unsure whether two bones articulate, leave the pair out and add it to `content/QUESTIONS.md`.
- Keep content (`content/`) separate from code, so a non-developer can edit the text.
- Never translate or re-pose any mesh. Isolation must keep every object's world transform unchanged.
- If an asset problem blocks you (missing teeth, merged bones, broken geometry you can't fix by script), stop and describe it rather than working around it silently.

---

## 13. Open question

- [ ] There is no reviewing anatomist or agreed reference text yet. Until one is chosen, all content stays `reviewed: false`, and the panel shows the draft note.
