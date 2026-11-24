# Anatomy Viewer — Platform Spec (M11–M15)

This phase adds **no new anatomy**. It turns the finished musculoskeletal viewer into an engine that new body systems (organs, nerves, vessels, lymph nodes) can plug into without editing dozens of files. When it is done, the app must look and behave exactly as it did at the end of M10, apart from the new features listed here.

It extends `SPEC (2).md` and `SPEC-musculoskeletal.md`. `STATUS-M10.md` describes the starting point; section numbers below refer to it as "STATUS §n". Work by `docs/WORKFLOW.md`.

**Before M11 starts:** M10 is wrapped up and merged to `main`, `/m10/` is frozen, and `STATUS.md` is updated.

---

## 1. Goals and non-goals

### Goals
1. **Systems as plug-ins.** A new layer is added by writing one descriptor folder and one registry line, not by editing about 40 files (STATUS §3).
2. **One relationship model.** Every relationship (articulation, attachment, action, connection, later supply, drainage, innervation) is a typed edge in one graph. "Show related" tiers are declarative rules over that graph (STATUS §4).
3. **Panels, tree, announcements and search entries come from descriptors**, not `if (kind === …)` branches.
4. **Region focus:** pick a body region and see only what lies in it, on every layer. Loading and budgets work per region, so large future systems fit on a phone.
5. **Scale-ready UX:** grouped Layers panel, search filtered by system, a tree loaded per system, labels and keyboard cursor that stay usable at 3,000+ structures.
6. **A colour model that survives more systems** under colour-vision deficiency.
7. **A config-driven asset pipeline**, plus a measured spike on rebuilding vessel and nerve curves, so the next spec has real triangle numbers.

### Non-goals
- No organs, nerves, vessels or lymph nodes in the shipped app. (The M15 spike builds sample files for measurement only.)
- No cross-sections or clipping planes (they come with organs).
- No second asset source (skin, female organs).
- No content rewriting. Content changes only where a format migration requires it, and the words stay the same.

---

## 2. Hard rules for the whole phase

1. **No regression.** Every existing unit and e2e test passes, unchanged except where this spec renames an API. When a test must change, the plan says why.
2. **Golden snapshots before refactors.** Before M11 and M12 touch anything, record:
   - `tests/golden/tiers.json`: for every one of the 1,138 IDs, the exact tier-1 and tier-2 sets with all layers On.
   - `tests/golden/panels.json`: the rendered section titles and link IDs for every ID's info panel.
   - `tests/golden/urls.json`: 40 representative URLs (one per layer, kind and tier, groups, hidden, depth, colour) with the resulting store state.
   - `tests/golden/search.json`: the top 10 results for 60 representative queries.

   After each refactor these must match exactly, or every difference must be listed in the plan with the user's approval.
3. **Old URLs keep working.** Every URL the app produced at M10 must open the same view after the platform.
4. **Performance parity** with all-new features off: same triangles, draw calls, FPS (`?bench`), skeleton load, and main chunk within +30 kB gzipped of M10's 470.4 kB.
5. **Subagents:** this phase is architecture, so plan on **none**. Sessions are design sessions (strong model) or routine sessions (Sonnet); say which in the session table.

---

## 3. Core concepts

### 3.1 System, layer, kind
- A **system** is a group of layers shown together in the Layers panel: `musculoskeletal` now; `organs`, `nervous`, `cardiovascular`, `lymphatic` later.
- A **layer** is something the user turns On / Ghost / Off: `bones`, `cartilage`, `ligaments`, `muscles` now.
- A **kind** is a type of structure: `bone`, `tooth`, `muscle`, `muscle_part`, `ligament`, `cartilage`, `disc`, `meniscus` now.
- Each kind belongs to exactly one layer; each layer to one system.

### 3.2 Descriptors
Everything about a layer and its kinds lives in one folder: `src/systems/<system>/<layer>/`. A descriptor is **plain data plus small pure functions**, typed by `LayerDescriptor` and `KindDescriptor`:

```ts
type LayerDescriptor = {
  id: string;                     // "muscles"
  system: string;                 // "musculoskeletal"
  code: string;                   // one URL letter, stable forever ("m")
  label: string;                  // "Muscles"
  ghostOrder: number;             // draw order among ghost batches
  colour: ColourSpec;             // §7
  models: ModelSpec;              // files, LODs, chunking (§6.3)
  contentChunk: string;           // virtual module name
  defaultSetting: "on" | "ghost" | "off";
  depth?: DepthSpec;              // optional peel control (muscles today)
  overlays?: OverlaySpec[];       // e.g. attachment patches
  tree: TreeSpec;                 // how the sidebar root is built
  kinds: KindDescriptor[];
};

type KindDescriptor = {
  id: string;                     // "muscle_part"
  noun: { one: string; many: string };   // for announcements
  schema: ZodSchema;              // content front matter
  bodyWords: [number, number];
  parentOf?: { childKind: string; selection: "nested" };  // muscle → part
  tiers: TierRule;                // §4.3
  panel: PanelSection[];          // §5
  searchFields: string[];
  labelPriority: number;
};
```

`src/systems/registry.ts` lists the layer descriptors in order. That list is the **only** place layer or kind names appear outside their own folders. A test enforces this (§10).

### 3.3 Bones are not special
Bones and teeth become an ordinary layer under `musculoskeletal`, with their own descriptor. The M4 bone panel model (`src/content/panel.ts`) and the separate bone tree, search index and tier code move onto the shared mechanisms. Behaviour stays identical (golden snapshots).

---

## 4. Relationship graph

### 4.1 Edges
```ts
type Edge = { from: string; type: EdgeType; to: string; meta?: Record<string, string> };
```
Edges are **compiled** at build time from the authoring formats, which stay as they are. Authors keep writing `origin`, `insertion`, `connects` and so on in front matter. Edges are never hand-written as a separate file, except where an authoring file already is one (`articulations.json`).

### 4.2 Edge types (registry: `src/graph/edgeTypes.ts`)
Each type has a forward label, an inverse label, and whether it is symmetric:

| Type | Inverse label | Symmetric | Compiled from |
| --- | --- | --- | --- |
| `articulates_with` | — | yes | `articulations.json` (meta: joint ID) |
| `member_of_joint` | "has structure" | no | `joints.json`, ligament/cartilage `joint` |
| `part_of` | "has part" | no | muscle `parts`, part `parent`, `alsoServes` (meta: `also`) |
| `originates_on` / `inserts_on` | "origin of" / "insertion of" | no | `origin`, `insertion` (meta: landmark) |
| `connects` | "connected by" | no | ligament `connects` |
| `attached_to` | "has attached" | no | cartilage `attachedTo` |
| `acts_on` | "acted on by" | no | `actions` (meta: movement, role) |
| `region_neighbour` | — | no | bone `regions.json` |
| `synergist_of`, `antagonist_of` | — | yes | **derived** by rule from `acts_on` (§4.4) |

Future systems add types such as `supplies`, `drains`, `innervates`, `branch_of`, `continues_as` and `located_in`, each in their own descriptor folder. The engine needs no change to add one.

### 4.3 Tier rules as data
A tier rule is a small list of graph steps, evaluated by one engine (`src/graph/query.ts`):

```ts
// muscle
tiers: {
  t1: [{ self: true }, { follow: "has part" }, { follow: ["originates_on", "inserts_on"], from: "self+parts" }],
  t2: [{ tier: "t1" }, { follow: "synergist_of" }, { follow: ["originates_on", "inserts_on"], from: "previous" }],
}
```

- Steps: `self`, `follow` (one or more edge types or inverse labels), `from` (`self`, `self+parts`, `previous`), `tier` (include another tier), and `filter` (by kind or layer).
- The engine applies the existing rule that **Off layers add nothing** (STATUS §1) after evaluation.
- **Acceptance:** every one of the 1,138 IDs gives exactly `tests/golden/tiers.json`.

### 4.4 Derived edges
`synergist_of` and `antagonist_of` keep today's rules (`src/content/derive.ts`), re-expressed over `acts_on` edges, including `synergistOverrides` and functional joints. They are computed at build time and shipped in the layer's content chunk, as now.

### 4.5 Shipping the graph
- Each layer's content chunk carries the edges **whose `from` is in that layer**, plus a reverse index.
- A small always-loaded index (IDs → layer, kind, name) lets the panel show a link name before the target's layer loads, replacing `registerSoftIds` (STATUS §3).
- The panel and tiers ask the graph, never a layer-specific module.

---

## 5. Descriptor-driven UI

### 5.1 Info panel
`PanelSection` is data:

```ts
type PanelSection =
  | { title: string; field: string; render: "text" | "list" }
  | { title: string; edges: string | string[]; render: "links" | "grouped-links"; groupBy?: "type" | "meta.role" }
  | { title: string; render: "actions-table" }          // joint · movement · role
  | { title: string; render: "custom"; component: string };  // escape hatch, at most 2 uses in the whole app
```

`InfoPanel.tsx` renders sections in descriptor order. The muscle, ligament, cartilage and bone panels are rebuilt this way. **Acceptance:** `tests/golden/panels.json` matches.

### 5.2 Sidebar tree
Each layer's `TreeSpec` names a builder (by region and compartment, by joint, by kind, or the bone hierarchy file). Roots are grouped by system and **each system's tree loads lazily** the first time its group is expanded.

### 5.3 Announcements and labels
Screen-reader nouns and ordering come from `KindDescriptor.noun` and layer order. Label priority comes from `labelPriority` plus on-screen size, replacing the literal lists in `labels.ts`.

---

## 6. Regions

### 6.1 Region definitions — `content/regions/regions.json`
A two-level tree. The first level is coarse, the second is the unit the phone uses:

| Coarse | Fine (examples) |
| --- | --- |
| Head | cranium, face, orbit, ear, oral cavity |
| Neck | anterior neck, posterior neck |
| Thorax | thoracic wall, mediastinum, pleural cavities (left/right) |
| Abdomen | abdominal wall, upper abdomen, lower abdomen |
| Pelvis and perineum | pelvis, perineum |
| Back | cervical, thoracic, lumbar, sacral |
| Upper limb (left/right) | shoulder, arm, elbow, forearm, wrist and hand |
| Lower limb (left/right) | hip and gluteal, thigh, knee, leg, ankle and foot |

Each fine region is a **volume**: one or more oriented boxes or capsules in the shared coordinate space, written by hand in the file and checked visually with `?debug&regions`. The exact list may change in M13's first session; record the final list in the plan.

### 6.2 Membership: `located_in` edges, computed
- At build time, for every mesh and every fine region, compute the **share of its vertices inside the volume**. A structure is `located_in` every region where the share is **≥ 15%** (tunable), or in its single best region if none reaches that.
- Long structures (femur, sartorius, later the great saphenous vein) belong to several regions. That's correct.
- `content/regions/overrides.json` can add or remove memberships by hand. Each override needs a one-line reason.
- Wisdom teeth and other IDs with no mesh inherit membership from their parent or their tier-1 neighbours.

### 6.3 Region-aware loading
`ModelSpec.chunking` is `"single"` (one file per LOD, as now) or `"region"`:
- **`region`:** the build writes one file per coarse region per LOD. Each structure goes in the file of the coarse region holding most of its vertices, so it is stored once. The loader fetches only the chunks containing members of the regions in view.
- The four musculoskeletal layers **stay `single`**. Region chunking is built and tested now with a **fixture layer** (§10), ready for the vessel and nerve systems.

### 6.4 Region focus (UI)
- A **Region** control in the toolbar opens a body map and a list. Choosing a region hides every structure not `located_in` it (hidden, not ghosted, so the view is clean), then frames the camera on the region's volume.
- **The usual flow:** pick a region, then choose layers. Region and isolation combine: isolating a structure inside a region focus isolates within that region. Back steps out of the isolation first, then out of the region.
- The breadcrumb starts with the region: `Forearm (left) › Muscles › Flexor carpi radialis`.
- URL: `reg=<region id>`, pushed to history like isolation levels.
- On phones (the existing `chooseLod` device class), the app **starts in region mode** when the visible triangle total of the requested layers exceeds the phone budget (§6.5). On desktop, whole-body view stays the default.

### 6.5 Budget governor
A single module tracks the triangles of everything loaded and visible:
1. If the visible total would exceed the device budget, switch the heaviest layers to low LOD.
2. If it still exceeds the budget, keep the current view and show a non-blocking prompt: "This view is heavy for this device. Focus on a region?" with the region picker.
3. Never silently drop a layer the user turned on.

Budgets stay as they are (desktop 1.5M, phone 450k). The next spec will set budgets for new systems.

---

## 7. Colour model

The palette is already used up under colour-vision deficiency, and textbook system colours (arteries red, veins blue, nerves yellow, lymph green) clash with muscle red and the origin, insertion and antagonist tints (STATUS §7). So split the jobs:

1. **Hue identifies the layer.** Each `LayerDescriptor.colour` has a base colour and an optional shade for subkinds (tendons). The colour-vision test (`tests/colourVision.test.ts`) is rewritten to read every layer colour from the registry and check every pair of layers that can be visible together.
2. **Relation roles get a second cue, not just a hue.** Origin, insertion, antagonist, and later supply and drainage are drawn with a **pattern** (a screen-space stripe or dot shader on the batch, via a per-instance attribute) plus a tint. The legend shows the pattern. Role tints then only need to differ from each other, not from every layer colour.
3. **Context dimming.** With a focus structure selected, structures of *other* layers in the related set are drawn slightly desaturated, so the focus layer's colours carry the meaning.
4. **Region colours** stay bones-only, with the existing pause rule.
5. **Reserve for future systems:** pick and record (not ship) proposed base colours for arteries, veins, nerves, lymph nodes and organs. They must pass the registry-driven colour-vision test against the current layers, in desaturated and full form. That table goes into the plan for the next spec.

---

## 8. Search, tree and keyboard at scale

- **Search per system:** one lazy index per layer, loaded the first time the layer is on or a query is typed, merged by score.
- **Filter chips** under the search box: All, plus one per system with any layer loaded. Selecting a chip limits the results to that system.
- **Ranking:**
  - Exact name match first, then common-name and synonym matches, then partial matches.
  - Within each band, structures in the current region come before others, then visible layers before hidden ones.
  - Generic words ("left", "right", "muscle", "ligament", and later "artery", "nerve") don't score alone. They only filter or reorder results that match another word.
- **Keyboard cursor:** the Tab cursor walks **visible structures in the current region** and in the focus layer first, then the others. With no region it keeps today's order. Add `[` and `]` to jump between layers.
- **Labels:** candidates are thinned **before** projection, using region membership, layer visibility and `labelPriority`, so layout cost stays near the bones-only figure.
- **Layers panel:** layers grouped under collapsible system headers, each with a group On / Ghost / Off. Presets come from the registry ("Skeleton", "Full musculoskeletal").

---

## 9. Asset pipeline

### 9.1 Config per layer
Replace the hard-coded tables in `build_soft_tissue.py`, `generate_soft_ids.py`, `classify_soft_tissue.py` and `model-checks.ts` (STATUS §3) with one config per layer, `src/systems/<system>/<layer>/build.json`:
- source collections
- triangle budgets per LOD
- `MIN_TRIS`
- AO settings
- chunking
- overlay files

`build-models.sh` loops over the registry. **Acceptance:** rebuilding the four existing layers from config gives files whose node names, bounds (within 0.01 mm) and triangle counts match M10's, and a diff in `check-models` shows no change.

### 9.2 Curve rebuild spike (measure only)
Collections 5 and 7 hold vessels and nerves as bevelled curves, 4.8M triangles in total (STATUS §9). Before the next spec sets budgets, measure what rebuilding them costs:
1. Write `scripts/blender/rebuild_curves.py`, which re-tessellates curves with a chosen bevel resolution (sides around the tube) and adaptive length resolution (fewer segments on straight runs), and caps over-tessellated objects such as the central retinal arteries.
2. Run it on **one region's worth** of each: the left upper limb's arteries, veins and nerves.
3. Report, for three settings (e.g. 6, 8 and 12 sides):
   - triangles
   - file size (Meshopt)
   - a screenshot pair against the source at the same camera
   - the projected whole-body totals for collections 5 and 7
4. Write the results to `assets/audit/REPORT-curve-spike.md`. **Ship nothing**; the files stay out of `public/`.

---

## 10. Validation and tests

- **Registry isolation test:** a script greps `src/` and `scripts/` for layer and kind name literals (`"muscles"`, `"muscle_part"` and so on). It fails if any appear outside `src/systems/**`, test fixtures and the golden files.
- **Fixture layer:** `tests/fixtures/systems/demo/` holds a tiny descriptor with 3 kinds, 12 structures, 2 edge types, region chunking and a generated `.glb`. Tests prove that adding it to a test registry makes it appear in the Layers panel, tree, search, panel, tiers and URL **without touching any other file**.
- Golden snapshot tests (§2.2) run in CI.
- The edge compiler validates that every edge endpoint exists, every edge type is registered, and symmetric types are stored once.
- Region checks:
  - every structure with a mesh has at least one `located_in`
  - every override has a reason
  - every region contains at least one structure
- `npm run check` stays the gate; Playwright stays manual, run in the background (WORKFLOW).

---

## 11. Milestones

Each milestone gets a hosted `/m<N>/` snapshot as before.

### M11 — Registry
- [ ] Golden snapshots recorded (§2.2), before any refactor.
- [ ] `LayerDescriptor` / `KindDescriptor` types; descriptors for bones, cartilage, ligaments, muscles; `registry.ts`.
- [ ] Every literal table listed in STATUS §3 replaced by registry lookups, including bones.
- [ ] URL codes from the registry; old URLs verified against `golden/urls.json`.
- [ ] Layers panel grouped by system, from the registry.
- [ ] Registry isolation test and fixture layer passing.
- [ ] Golden snapshots unchanged; bench and main-chunk parity recorded.

### M12 — Relationship graph and descriptor-driven UI
- [ ] Edge types, edge compiler, derived edges, query engine.
- [ ] Tier rules for every kind as data; `golden/tiers.json` matches for all 1,138 IDs.
- [ ] The small always-loaded ID index replaces `registerSoftIds`.
- [ ] Panels, tree builders, announcements and label priority from descriptors; `golden/panels.json` matches.
- [ ] The old relationship modules (`relations.ts`, `softTiers.ts`, `softRelations.ts`, `softPanel.ts` switches) deleted.

### M13 — Regions
- [ ] Region list and volumes; `?debug&regions` view; user checkpoint on the list.
- [ ] Membership computed into `located_in` edges, with overrides and checks.
- [ ] Region focus UI, breadcrumb, URL, history; combined with isolation and Back.
- [ ] Region chunking in the build and loader, proven on the fixture layer.
- [ ] Budget governor; phones start in region mode only when over budget.
- [ ] Keyboard cursor and label thinning scoped by region.

### M14 — Search, colour and scale UX
- [ ] Per-layer search indexes, filter chips, new ranking; `golden/search.json` differences reviewed with the user.
- [ ] Lazy tree per system.
- [ ] Colour model: registry-driven colour-vision test, pattern cue for role tints, context dimming.
- [ ] The proposed future-system colours table, tested.
- [ ] Real-device checks: the user runs `?bench` on PC and iPhone for: all layers solid; a region focus; a muscle tier 2 with antagonists and patterns.

### M15 — Pipeline and curve spike
- [ ] `build.json` per layer; build loops over the registry; rebuild parity with M10's files.
- [ ] `rebuild_curves.py` and the curve spike report.
- [ ] `STATUS.md` rewritten for the platform: what a new system needs (a checklist), the descriptor reference, and the edge type table.
- [ ] A short `docs/ADDING-A-SYSTEM.md`: the step-by-step for the next spec to point at.

---

## 12. Open questions (defaults apply until answered)

| Question | Default |
| --- | --- |
| Region list granularity | The two-level list in §6.1 |
| Region membership threshold | 15% of vertices |
| Should region focus hide or ghost what's outside? | Hide |
| Should phones start in region mode? | Only when over budget (§6.4) |
| Pattern style for role tints | Diagonal stripes for origin, dots for insertion, cross-hatch for antagonist |
| Should the musculoskeletal layers move to region chunking? | No; they fit the budget as single files |

---

## 13. Working rules for Claude Code

Everything in `CLAUDE.md`, `docs/WORKFLOW.md` and the earlier specs' working rules still applies. In addition:

- **Record golden snapshots before you change anything**, and treat any difference as a bug until the user approves it.
- **Refactor in place, in small commits.** Each session leaves `npm run check` green. No long-lived parallel implementations: when a descriptor replaces a literal table, delete the table in the same session.
- **Keep the escape hatches small.** Custom panel components and custom tier steps need a written reason in the plan; if you need a third, stop and ask.
- **Don't build anatomy.** The fixture layer and the curve spike are the only new geometry in this phase, and neither ships.
