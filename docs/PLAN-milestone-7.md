# Milestone 7 Plan: Layers and rendering (Musculoskeletal spec, M7)

Source of truth: `SPEC-musculoskeletal.md` §5.5 (picking, Hide), §6 (layers, depth, colours), §8 (rendering), §9 (performance budgets) and §11 (M7). Where that spec is silent, `SPEC (2).md` and `STATUS.md` still apply. Ground rules throughout: no mesh is moved, re-posed or re-scaled (instance matrices are the glTF world matrices, as for bones); no anatomy is invented; anything uncertain goes in `content/QUESTIONS.md`; **with every new layer off, the app must load, look and perform exactly as M6 does** (spec §13).

## Goal

Make the muscles, ligaments and cartilage built in M6 into real, user-facing layers: a **Layers** panel with On / Ghost / Off per layer and two presets, state in the URL and `localStorage`, layer files fetched lazily the first time a layer is turned on (low LOD, then high), one solid and one ghost `BatchedMesh` per layer within the 20-draw-call budget, a muscle **depth control** that peels superficial muscles away, a per-structure **Hide** (`X`, `hid=`, "N hidden · Show all"), and **picking across layers** with hit proxies for small structures. The milestone ends with `?bench` results (all layers solid; muscles ghosted over bones) on the user's PC and iPhone recorded here, and a hosted copy at `/m7/`.

Out of scope here (later milestones): content files, schemas, `movements.json`, `muscle-hierarchy.json` and the `muscleAttachments` migration (M8); nested muscle → part selection, tiers 1 and 2 for the new kinds, origin/insertion highlighting with the patches, the bone → muscle cross-links, the info panel sections, sidebar roots and search for the new kinds (M9); labels, legend chips, colour-vision polish of the new kinds and the final performance pass (M10). The bones layer keeps every M5/M6 behaviour.

## Progress

| Session | Steps | Status |
| --- | --- | --- |
| (planning) | 0 (Milestone 6 handover, this plan) | **Done.** See step 0 |
| T | 1 (layer state, URL, `localStorage`), 2 (layer loader and per-layer batches), 3 (Layers panel) | **Done.** See "Session T notes" |
| U | 4 (layer-aware isolation and ghosts), 5 (picking across layers; placeholder panel for the new kinds), 6 (per-structure Hide) | **Done.** See "Session U notes" |
| V | 7 (muscle depth data and control), 8 (interplay with the existing tools) | **Done.** See "Session V notes" |
| W | 9 (bench and load measurements), 10 (tests and no-regression), 11 (hosted copy; the user's bench on PC and iPhone) | Not started |

Triggers: "begin session T", "begin session U", "begin session V" and "begin session W". Each session starts by reading this file and ends with `npx tsc --noEmit`, `npx vitest run`, `npm run check-models`, `npm run validate-content` and `npm run e2e` passing, then a commit, a push to the session branch and a PR to `main`. No Blender work is planned: the layer files from M6 are used as they are (`git diff` on `public/models/` must stay empty).

**User checkpoints**
- **Decision 9 (muscle depth data comes forward from M8).** If the user would rather keep `muscle-depth.json` in M8, session V builds the depth control against a test fixture and ships it disabled ("Depth data arrives in M8"). **Decided 2026-11-20: bring it forward** (the user chose option A).
- **After session W's deploy**: the user runs `?bench` on PC and iPhone with the two layer presets (step 11). If the muscles-ghosted run misses ≥ 30 fps on the iPhone, the spec's fallback is taken (decision 7) before the milestone closes.

## Exit criteria (from the musculoskeletal spec §11, M7)

- [ ] Layers panel, presets, URL and `localStorage` state, lazy layer loading.
- [ ] Per-layer batches, ghost mode per layer, muscle depth control, per-structure Hide.
- [ ] Picking across layers; hit proxies for small structures.
- [ ] Bench results (all solid; muscles ghosted) on PC and iPhone recorded in this plan.
- [ ] Draw calls < 20 with every layer on and a selection active (spec §8), measured in the e2e suite.
- [ ] No regression: with every new layer off, no layer file or layer chunk is requested, the bone files are byte-identical to M5, the main chunk grows by at most 15 kB gzipped over M6 (458.40 kB), `npm run perf-load` stays within run-to-run noise of M6, and the full e2e suite passes.
- [ ] **Hosted copy is live and linked below** (extra requirement for every milestone).

---

## Step 0: Milestone 6 handover (done in the planning session)

- `deploy/pages.json`: `m6` frozen at **`43dce0e`**, the merge of #15. M6 ran past the #13 merge named in `CLAUDE.md`: #14 added the linea alba and rebuilt the muscles layer, #15 gave the debug view content-hashed layer URLs, and the user's confirmation of `/m6/` covered both. `current` set to **7**, so the next deploy builds `/m7/` from `main`.
- `/m6/` was confirmed live by the user on 2026-11-20 (`docs/PLAN-milestone-6.md`). `README.md`: M6 row marked frozen, M7 row added as "In progress".
- `CLAUDE.md`: status and the M7 session triggers.
- **Still open, carried over (needs the user, any time):** the per-browser `?bench` table in `docs/PLAN-milestone-5.md` step 12; the content questions in `content/QUESTIONS.md` (1–62).

## Decisions made in this plan (say if any should change)

These fill gaps the spec leaves open. Each is the smallest choice that fits the spec; the sessions build them as written unless the user says otherwise.

1. **Layer state.** The store gains `layers: Record<Layer, "on" | "ghost" | "off">` (`Layer` = `bones | muscles | ligaments | cartilage`, spec §3), default `{ bones: on, muscles: off, ligaments: off, cartilage: off }`. URL: `layers=b:on,c:off,l:off,m:ghost` (spec §6.1), written only when the state differs from the default, so a default link is unchanged from M6. Precedence is URL, then `localStorage` (`skeleton-viewer:layers`, like the other settings), then the default, as for the colour setting. Parse and serialise are pure helpers in `src/state/url.ts`; unknown keys and values are ignored and the rest kept. Layer changes `replace` the history entry (like `color=`), they are not history steps.
2. **The M6 debug view stays separate.** `?debug&layers=all` (or `m,l,c,a`, no colons) keeps the M6 debug scene exactly as it is, for the attachment patches and the bounds overlay. A value with colons is the user format and drives the real layers. The two never load together: the debug format turns the real layers off. The attachment patches are **not** a user layer in M7; they arrive with origin/insertion highlighting in M9.
3. **Loading.** A layer's files are fetched the first time it is not `off`, following the same LOD plan as the bones (`src/scene/lod.ts`: low first, then high if the device or setting allows it; `?lod=` and the Settings detail apply to every layer). Requests use the content-hashed URLs from M6 (`virtual:skeleton-model-versions`, `…glb?v=<hash>`); the bone files keep their plain URLs. The loader, the layer colours and `soft-ids.json` are one lazy chunk (`src/layers/`), imported the first time any layer turns on. Each layer row shows progress (bytes received against the file size, which the versions plugin also provides). Turning a layer off keeps its batches in memory (hidden), so turning it back on is instant.
4. **Batches.** `batchSkeleton.ts` is generalised into `batchLayer(parts, material, opts)` with the same rules (instance matrix = glTF world matrix, vertices untouched, three-mesh-bvh per geometry). Each layer gets one solid and one ghost batch: with the bones that is **8 batches**, plus the 2 outline draws (selection, hover) = **10 draw calls** with everything on, well under 20. The bone batches and `batchSkeleton`'s behaviour are unchanged (a thin wrapper keeps its name and tests).
5. **Colours** (spec §6.3). One shared material per layer (the bone material's AO remap, `AO_FLOOR`), with the layer colour as the material colour and per-instance colour for the tendons and aponeuroses (`partType` from `soft-ids.json`). Starting values, to be checked: muscles muted red `#a8483f`, tendons and aponeuroses `#c98a7c`, ligaments pale grey-white `#d9dde3`, cartilage pale blue-grey `#a9bccb`. A Vitest test (reusing `regionColours.ts`' CVD simulation and ΔE2000) requires ΔE2000 ≥ 8 under deuteranopia and protanopia between each layer colour, the bone ivory and the focus accent. M6 noted the debug ligament colour is too close to the bone ivory; the ligament colour gets a slightly cool, darker tint if the test fails. Colour-by-region stays bones only (spec §12).
6. **Ghost per layer.** A layer set to Ghost draws its ghost batch only (all its visible instances), with the existing ghost material and opacity, and nothing in it is pickable (spec §6.1). Layer Ghost and isolation ghosts are the same thing on screen: a structure is ghosted if its layer is Ghost or if isolation ghosts it; it is solid only if its layer is On and isolation keeps it solid. Exception (spec §5.2): **isolation overrides layer toggles** for anything isolation shows solid, e.g. a bone group isolated with the bones layer off still shows its bones. Hidden (layer Off, depth-peeled, or Hidden by the user) beats everything except that override for the selected structure itself.
7. **Ghost cost** (spec §8). Ghost batches keep `depthWrite: false` and draw after the solids, sorted per layer (bones' ghost first, then cartilage, ligaments, muscles). Session W measures muscles ghosted over bones. If the iPhone misses ≥ 30 fps, the fallbacks are tried in the spec's order: a depth pre-pass for the muscle ghost batch (one extra draw call), then a lower muscle ghost opacity, and last, Ghost disabled for muscles on low-LOD devices with a note in Settings and the Layers panel. Whichever is taken is recorded here.
8. **Isolation becomes layer-aware** (spec §8). `isolationView` returns, per layer, `solid`, `ghost` and `hidden` sets plus `focus`, and an empty `tints` map that M9 fills (origin, insertion, antagonist). The bone result for a bone selection with only the bones layer on must equal M6's, which existing tests and a new equivalence test check. In M7, a new-kind structure supports **tier 0 only**: "Show related" and "Expand" are disabled for it with the reason "Arrives with muscle content (M9)". Group isolation (`grp=`) stays bones only.
9. **Muscle depth data comes forward from M8** (user checkpoint). The depth control (spec §6.2) needs `content/muscle-depth.json`, which the spec lists under M8. Session V writes it in M7 so the control works on `/m7/`: `{ "<muscle id without side>": 1 | 2 | 3 }` for every muscle (and a part only where it overrides its parent), by anatomical convention per region, from standard references, with the most superficial portion for muscles spanning layers (spec §12). Left and right share an entry. `validate-content` gains the spec §10 rule "a muscle has no depth" now. Every entry the session is unsure of gets a `QUESTIONS.md` entry under a new heading **Muscles: depth**; the file is `reviewed: false` in spirit until the M8 review.
10. **Depth control.** A 4-stop control in the Muscles row (*All*, *Hide superficial*, *Hide superficial + intermediate*, *Deep only*), stored as `depth=0..3` in the store, in `layers=` as `m:on:2` (absent when 0), and in `localStorage` with the layer state. Peeled muscles are **hidden**, not ghosted (spec §6.2). It is enabled whenever the muscles layer is On or Ghost.
11. **Picking across layers** (spec §5.5). One ray, tested against the solid batch of every layer that has one drawn (each `BatchedMesh` already raycasts through three-mesh-bvh); the nearest hit wins. Ghosts and hidden structures are never pickable. Hit proxies (`pickWithProxies`) apply to new structures under the same 2 cm rule: from the M6 manifests that is **240 more** (41 muscles or parts, 184 ligaments, 15 cartilage). Since a proxy is a screen-space disc, a real hit nearer the camera than a proxy's centre still wins (unchanged rule), so a tiny ligament behind a muscle can't steal the tap. The radii come from the layer manifests at build time, in the lazy chunk.
12. **Selecting a new-kind structure in M7** selects the **leaf that was clicked** (a part, or a muscle without parts): the M9 rule "first click selects the whole muscle" needs the nested-selection reducer, which is M9's. The info panel shows a **placeholder** built from `soft-ids.json`: name, kind, layer, side, "Part of *X*" for parts, and "Not written yet" (the M3 placeholder pattern). The tooltip and breadcrumb (`Muscles › <name>`, `Ligaments › …`, `Cartilage › …`) use the same names. `sel=` accepts any ID in `ids.json` or `soft-ids.json`; a new-kind `sel` in a URL turns its layer on if it is off.
13. **Per-structure Hide** (spec §5.5). Store `hidden: Set<string>`, URL `hid=` (comma-separated IDs, capped at 100 IDs; overflow is dropped with a toast, "Only the first 100 hidden structures are kept in the link"). The panel's **Hide** button and the `X` key hide the selected structure (a bone, tooth or new-kind leaf; a muscle with parts hides all its parts, which matters from M9) and step selection back one level as `Esc` does. Hiding is part of that same history step, so browser Back un-hides it. A toolbar chip "N hidden · Show all" appears when N > 0 (in "More" when the toolbar is narrow); Show all is one `replace`. Hidden bones are not drawn at all, ghost or solid.
14. **Existing tools with layers on.**
    - **Explode** stays bones only and is **disabled while any new layer is On or Ghost** ("Turn off the soft-tissue layers to explode"): moving bones away from their muscles would show them misaligned (ground rule).
    - **Labels** take candidates from every structure drawn solid, with names from `soft-ids.json`; the layout is unchanged. Occlusion is not tested (as in M5), so with muscles solid, bone labels are left out unless the bone is isolated. M10 revisits the rules.
    - **Screenshots** capture whatever is drawn; the attribution strip is unchanged (M6 already credits the collections).
    - **Legend** is unchanged in M7 (spec §7: layer colours are M10's).
    - **Joint highlighting** stays a bone feature.
15. **Performance and size targets for M7.** Main chunk ≤ +15 kB gzipped over M6 (the Layers panel, layer state and the generalised isolation and picking are in it; the loader, `soft-ids.json` and the manifests' radii are lazy). `soft-ids.json` is 253 kB raw; the lazy chunk keeps only the fields M7 needs (`id`, `name`, `kind`, `layer`, `side`, `parent`, `parts`, `partType`). The spec §9 table is measured in session W; misses are recorded with the fallback taken (decision 7), and the final pass is M10's.

## Risks found while planning

1. **Overdraw with muscles ghosted** over bones (spec §8). Mitigated by decision 7; measured on real hardware only, since the container renders with SwiftShader.
2. **Phone memory.** All four layers at the low LOD are about 450k triangles (the spec's phone budget), but the high files are 7.9 MB compressed together. The LOD plan already keeps phones on the low files; the Settings "High detail" choice on a phone loads the high layer files too, which session W tries on the user's iPhone.
3. **Proxies.** 240 extra hit discs on a phone could make the ribs or a hand awkward to tap with ligaments on. Session U checks the e2e "tap every object" pattern on a sample with all layers on, and proxies are limited to structures drawn solid.
4. **e2e time.** The suite is already about 19 minutes with software WebGL. The new specs use the low LOD and few layer loads per test.

## Session T notes (steps 1 to 3, done)

What was done, and where it differs from the plan (say if any should change):

- **State and URL.** `src/state/url.ts`: `LAYERS`, `TISSUE_LAYERS`, `parseLayers` / `formatLayers` (user format with the depth on the muscles entry), `parseHidden` (`hid=`, capped at 100) and both in `parseUrlState` / `serialiseUrlState`. `layers` is written only when it isn't the default; a debug-format value (`layers=all`) is kept verbatim unless the layers are set. `src/state/store.ts`: `layers`, `muscleDepth`, `debugLayersView`, `layerLoad` (status, LOD on screen, bytes, error, retry count, first-drawn times), `hidden`. `src/state/selection.ts`: `setLayerSetting`, `setLayerMode`, `setMuscleDepth`, `applyLayerPreset`, `presetOf`; start-up reads the URL, else `localStorage` (then writes it to the URL), else the default; Back and Forward don't change the layers (like the colour setting), but they do carry `hid`, ready for session U. `parseDebugLayers` now leaves any value with a colon to the real layers.
- **Loader and batches** (`src/layers/`, one lazy chunk, 13.4 kB gzipped): `urls.ts` (hashed URLs, moved from `DebugLayers.tsx`, and file sizes, which `virtual:skeleton-model-versions` now also exports), `loadLayer.ts` (streamed fetch with progress, then `partsFromGlb`, split out of `loadSkeleton.ts` and shared with the bones), `softIds.ts` + `virtual:skeleton-soft-ids` (`scripts/lib/soft-ids-plugin.ts`: the table trimmed to the fields M7 uses), `colours.ts`, and `LayerScenes.tsx`: one solid and one ghost `BatchedMesh` per layer (`batchLayer`, the bone batcher under a new name), materials from `createBoneMaterial` / `createGhostMaterial` with a colour argument (one shader program for every layer), tendons and aponeuroses tinted per instance, ghosts ordered by `renderOrder` (bones, cartilage, ligaments, muscles). A layer starts loading once the bones are on screen, follows the bones' LOD plan, and keeps its batches (hidden) when turned off. The batches are published in `useLayerBatches` for session U's picking. With `?debug`, the overlay gets one bounds line per layer from the real batches.
- **Bones layer.** `withBonesLayer` (`src/scene/isolation.ts`) applies the bones layer's Ghost or Off on top of the isolation view (an isolated bone stays solid); used by `Isolation.tsx`, the rig's picking and Tab cursor, and the labels. Session U folds it into the layer-aware `isolationView`.
- **Colours** as decision 5; the ΔE2000 test passes at the first try. Closest pair: accent / cartilage, 8.4 (8.6 and 8.8 under deuteranopia and protanopia). Ligaments against bone are well apart (> 12.8), so M6's concern doesn't arise with the real colour.
- **Panel.** `src/ui/LayersPanel.tsx`: presets (pressed when the layers match), a fieldset of radios per layer, progress bar with percentage, error with Retry, announcements; the depth control is shown disabled ("needs the muscle depth data") until session V. Layers is an overflow tool (in "More" when the toolbar is narrow, as the spec says). With M6's debug format in the URL the panel says so and is disabled.
- **Different from the plan: the vendor code moved into a shared chunk.** Because the lazy layer chunk imports app modules, the bundler now splits three.js, React and the other libraries out of the main chunk: `index` 292.2 kB + `meshoptimizer` (the vendor chunk, named after its first module) 171.1 kB + runtime 0.4 kB gzipped = **463.7 kB**, against 458.4 kB for M6 (+5.3 kB, within the +15 kB budget). `index.html` modulepreloads both, so they download in parallel; the default load still requests no layer file or layer chunk. Session W's `perf-load` run checks that the first skeleton is no slower.
- **Measured here** (`?lod=low`, all layers on, SwiftShader): 4 draw calls (one per layer), cartilage 61 / ligaments 300 / muscles 477 nodes, bounds within 0.004 / 0.019 / 0.285 mm of the manifests; muscles ghosted over bones: 2 draw calls.
- **Tests:** `tests/url.test.ts` (layers and `hid`), `tests/layers.test.ts` (trimmed IDs against the manifests, tendons, file sizes, `withBonesLayer`, presets), `tests/layerColours.test.ts`, `tests/debugLayers.test.ts` (colon values left alone), and `tests/e2e/layers.spec.ts` (6 tests: nothing requested by default, panel → URL → storage, no second download, storage restored and the URL winning, all layers in place with 4 draw calls, bones Ghost and Off, the debug format disabling the panel). The axe popover test now opens Layers too.
- **Toolbar.** Layers sits after Share, before Settings, so the phone's "More" menu keeps the quick actions at the top. Popovers now cap their height (`100dvh − 200px`) and scroll: with Layers inside it, "More" ran off the top of a 390 × 844 phone (`polish.spec.ts` caught it).
- **Checks:** `tsc`, Vitest (351 tests), `check-models`, `validate-content` pass; the full e2e suite ran 116 / 118 on the first pass. The two failures were the phone "More" overflow (fixed above) and `keyboard.spec.ts`' whole-session test hitting its 90 s timeout under load. Both pass on a rerun with the final build, together with `polish`, `layers`, `a11y`, `keyboard` and the phone toolbar test (33 tests). The bone files are unchanged.

## Session U notes (steps 4 to 6, done)

What was done, and where it differs from the plan (say if any should change):

- **Layer-aware view** (`src/scene/isolation.ts`). `isolationView` is unchanged (it says what isolation keeps solid); `sceneView(iso, layers, hidden)` turns it into one `LayerShow` per layer (`solid` set or all, `rest` ghost or hidden), plus `hidden`, `focus`, the joint and an empty `tints` map for M9. `shownIn(view, layer, id)` gives solid / ghost / hidden with the plan's precedence: the focus and a highlighted joint's bones are always solid; then anything hidden is hidden; then isolation's solid set wins over the layer mode (the override, decision 6); the rest is a ghost if its layer is Ghost or the layer is On in ghost mode, else hidden. `viewOf(store)` builds it from the store; `withBonesLayer` is gone. **Equivalence:** a Vitest case checks every bone against M6's rule for 6 selections × 3 tiers × 2 ghost modes, and the M6 tests (`scene-isolation`, `joint`) run through the new code unchanged.
- **Applying it** (`applyLayerView`, `Isolation.tsx`): one pass per layer over its two batches; a batch with nothing to draw is switched off, so it costs no draw call. `Isolation.tsx` now drives every layer (the lazy chunk only builds and registers the batches in `src/scene/layerRegistry.ts`, a small main-chunk store). Each layer has its own selection and hover outlines over its solid batch's buffers; only the one holding the target is drawn. The focus's accent on a soft-tissue structure is the bone accent divided by the layer's colour (M10 revisits the colours). The click → highlight timer follows the focus's batch. **Measured** (`?lod=low`, SwiftShader): every layer on with the left femur selected = **6 draw calls** (the bones' solid batch, the four ghost batches, the selection outline; the three soft-tissue solid batches have nothing to draw and are switched off); the budget is 20.
- **Soft-tissue IDs in the main chunk** (`src/content/softRegistry.ts`): the table stays lazy (`src/layers/softTable.ts`, now its own chunk, 10.8 kB gzipped, separate from `LayerScenes`, 2.5 kB) and registers itself when loaded. Until then every soft ID is "unknown", which is right since nothing of a layer is on screen before its table loads. `isKnownId`, `hasMesh`, `displayName`, `layerOfId` cover both. A `sel=` that isn't a bone loads the table; a real soft ID turns its layer on (if Off), waits for its batches, selects at tier 0 and frames it (or only re-pivots when the link has `cam=`); an unknown ID is dropped from the URL.
- **Picking across layers** (`CameraRig.tsx`, `nearestPickable` in `pick.ts`): one ray against every visible solid batch (bones and each loaded layer), nearest pickable hit wins. Hover uses only batches whose raycasting trees are built; a click builds any missing one. **Different from the plan: the proxy radii come from the loaded batches' boxes** (as the bones' do), not from the manifests at build time: the same 2 cm rule gives the same 240 new tiny structures without shipping manifest data. Proxies only for structures drawn solid. Tab now walks the bones, then the solid soft-tissue structures (table order). `__viewer.bone`, `frameBone` and `instanceColour` work on any layer.
- **Risk 3 (proxies on a phone), measured** at 390 × 844 with touch, framing each object from the front (then the back) and tapping its centre: with bones only, 30 of 47 hand, foot, rib and ossicle bones pick themselves; with the ligaments on, 27. The three extra misses (scaphoid, capitate, a toe phalanx) are hits on a ligament that really lies over the bone (dorsal radiocarpal and intercarpal ligaments), not proxies stealing the tap; the rib misses happen with bones only too (a rib's box centre isn't on the rib). Tiny ligaments, bones + ligaments on: 25 of 46 pick themselves; the rest lie behind a bone or a broader ligament from both sides. With the muscles on, nearly every deep structure is behind a muscle, as it should be. A phone e2e test keeps five small hand bones tappable with the ligaments on.
- **Placeholder panel** (`src/content/softPanel.ts`, `InfoPanel.tsx`): name, kind and side under the title, side toggle for pairs, badges (layer, kind, "Muscle part: head" etc.), "Part of *Biceps brachii*", Summary "Not written yet". Show related and Expand region are disabled with the reason ("Arrives with muscle content (M9)", also written under the buttons); the toolbar's Related button isn't offered for the new kinds, and the reducer actions ignore them. Breadcrumb `Skeleton › Muscles › <name>`; tooltip and announcements ("Linea alba, selected. Isolated.") use the same names. Selecting a parent muscle without a mesh (from a link) shows its panel and isolates nothing, like a wisdom tooth.
- **Hide** (`hideSelected`, `showAllHidden` in `src/state/selection.ts`): the panel's **Hide** button and `X` (in the key map, the canvas's description and `aria-keyshortcuts`). A muscle with parts hides its parts (`hideTargets`). **Different from the plan's wording:** Hide clears the selection to the full view and pushes **one new history entry** with the new `hid=`, so browser Back returns to the structure selected and un-hidden (as the spec wants), and Forward hides it again. For a leaf at tier 0 (every new-kind selection in M7) that is exactly Esc's step; for a bone at tier 1 or 2 it also goes to the full view rather than to a lower tier of a structure that is now hidden. The toolbar chip "N hidden · Show all" keeps its count when the bar is icons only and is in "More" on phones; Show all is one `replace`. Announcements: "Femur (left) hidden. 2 hidden." and "All hidden structures shown."; the 100-ID link cap shows the toast.
- **Debug overlay**: `data-layer-counts` (`muscles:1/476,…`, solid/ghost per loaded layer) and `data-hidden`.
- **Size:** main chunk `index` 294.7 kB + vendor 171.1 kB gzipped (+2.5 kB over session T, **+7.8 kB over M6**, budget +15).
- **Tests:** `tests/sceneView.test.ts` (equivalence with M6, every layer-mode and isolation combination, hidden vs focus and joint, `applyLayerView`, the registry and placeholder, cross-layer nearest hit, a near muscle beating a tiny ligament's proxy); `tests/e2e/layers.spec.ts` +6 (muscle picked over the humerus with panel, breadcrumb and disabled tiers, then unpickable when ghosted; 6 draw calls with every layer on and a selection; `sel=` a ligament turns its layer on; Hide button, `X`, chip, Back, Show all; a `hid=` link with a bone and a ligament; the phone proxy check); `tests/e2e/a11y.spec.ts` (axe on a ligament's panel and the hidden chip).

## Session V notes (steps 7 and 8, done)

What was done, and where it differs from the plan (say if any should change):

- **`content/muscle-depth.json`** (decision 9, brought forward as the user chose): 209 side-free entries, every muscle (205) plus the linea alba, and three part overrides (deep head of flexor pollicis brevis, medial head of triceps, short head of biceps femoris, all 2). Depths by regional convention from the skin over the whole body; spanning muscles take their most superficial portion. Every call I'm unsure of is in `content/QUESTIONS.md` under **Muscles: depth** (63 to 69). To be reviewed with the M8 content.
- **Rules** (`src/content/muscleDepthRules.ts`, in `validate-content`): the schema (1, 2 or 3); every muscle and every part without a muscle has a depth (spec §10); keys are real muscle or part IDs without a side; a part's entry must differ from its muscle's. The lookup and peel rules (`src/content/muscleDepth.ts`) have no zod, so the main chunk stays small (a first build that let zod in through the registry cost 28 kB, caught and split).
- **Data path:** `virtual:skeleton-soft-ids` now carries each muscle's and part's resolved `depth` (a part inherits its muscle's), so the depth arrives with the lazy table; nothing new in the main chunk but the peel code.
- **Peel:** the muscles at a stop are added to the hidden set in `viewOf` (`peeledAt` in `softRegistry.ts`, cached per stop): hidden, not ghosted, never pickable, so the layer below can be clicked; the selected structure is never peeled. Works with the layer On or Ghost.
- **Control** (Layers panel, Muscles row): the four stops as radios, enabled while the muscles are On or Ghost ("Turn the muscles on to peel them by depth" otherwise); `layers=…,m:on:2` and `localStorage` as decided in session T. Announcements: "Superficial muscles hidden: N muscles", "Superficial and intermediate muscles hidden: N muscles", "Deep muscles only: N muscles hidden", "All muscles shown" (a muscle's parts count once).
- **Open: two stops coincide.** With three depths, *Hide superficial + intermediate* and *Deep only* show the same thing (QUESTIONS 69). The four stops are kept as the spec lists them until the user says otherwise.
- **Explode** (decision 14): the slider is disabled with "Turn off the soft-tissue layers to explode" while any soft-tissue layer is On or Ghost, and turning one on resets Explode to 0.
- **Labels** (decision 14): candidates from every layer's solid batch (names from the soft-tissue table). With the muscles On, a bone is labelled only when isolation keeps it solid. The layout is re-run on hide and depth changes too.
- **Checked with layers on:** screenshots (named after a muscle: `skeleton-gluteus-maximus-left.png`); the legend is unchanged and still isolates bone regions; joint highlighting stays a bone feature and works with the muscles on (they ghost with the selection).
- **Size:** main chunk `index` 295.4 kB + vendor 171.1 kB gzipped, **+8.5 kB over M6** (budget +15). The lazy soft-tissue table is 11.1 kB gzipped.
- **Fix to session U:** hover again waits (keeping the pointer position) until every solid batch drawn has its raycasting trees, as M6 did for the bones; session U had dropped the wait, so a hover in the first moments after load was lost (`isolate.spec.ts` caught it).
- **Checks:** `tsc`, Vitest (370 tests), `check-models`, `validate-content` pass. Full e2e: 127 of 128 on the first pass; the one failure was the hover fix above, after which `isolate`, `select`, `layers` and `keyboard` (37 tests) all pass. The model files are unchanged.
- **Tests:** `tests/muscleDepth.test.ts` (the real file passes; every muscle and part resolves; each rule on fixtures; peel per stop; the view hides, never ghosts, and spares the selection; counts and announcements); `tests/e2e/layers.spec.ts` +3 (the depth control end to end: disabled when Off, URL, announcement, a peeled deltoid unpickable, Ghost keeps the peel, storage, All; Explode disabled and labels from the solid layers; a screenshot named after a muscle).

## Session T: layer state, loader and panel (steps 1 to 3)

## Step 1: Layer state, URL and `localStorage` (decisions 1, 2, 10)

- `src/state/url.ts`: `parseLayers` / `formatLayers` (the user format, with the depth suffix), `hid` parse/serialise with the cap; `parseUrlState` and `serialiseUrlState` carry `layers` and `hid`. The debug format (no colons) is recognised and left to the M6 debug view.
- `src/state/store.ts`: `layers`, `depth`, `hidden`, `layerLoad` (per layer: idle, loading with bytes, low, high, error) and their setters; `localStorage` for `layers` and `depth`.
- Vitest: round trips, defaults omitted from the URL, bad values ignored, precedence URL > storage > default, the debug format kept apart, the `hid` cap.

## Step 2: Layer loader and per-layer batches (decisions 3, 4, 5)

- `src/scene/batchSkeleton.ts` → `batchLayer` (generic), with `batchSkeleton` kept as the bones' wrapper. `allInstanceBounds` and the bounds check work per layer.
- `src/layers/` (lazy): `loadLayer(layer, lod)` with hashed URLs and progress, the trimmed soft-ID table, layer materials and instance colours, small-structure radii. Building a layer's batches happens off the first frame where possible (as the bones do), and swapping low for high mirrors `Viewer.tsx`.
- Layer colours and the ΔE2000 test (decision 5).
- `?debug` overlay: one line per loaded layer (LOD, nodes, triangles, largest bounds error against `manifest-<layer>.json`), reusing `debugLayers.ts`' report.

## Step 3: Layers panel (spec §6.1)

- `src/ui/LayersPanel.tsx`: a **Layers** toolbar button (and an item in "More" when narrow) opening a popover with the two presets (**Skeleton**, **Full musculoskeletal**), then one row per layer in the spec's order (Bones, Cartilage, Ligaments, Muscles) with an On / Ghost / Off radio group, a progress indicator while its files load, and an error with Retry if a fetch fails. The Muscles row holds the depth control (step 7; disabled placeholder until then).
- Accessible as the existing popovers are: radio groups with labels, focus management, `aria-live` announcements ("Muscles on", "Muscles loaded"), 200% reflow, axe clean.
- Turning the bones layer Off or Ghost is allowed (that is the "muscles alone" view).

## Session U: isolation, picking and Hide (steps 4 to 6)

## Step 4: Layer-aware isolation and ghosts (decisions 6, 7, 8)

- `src/scene/isolation.ts`: `isolationView` returns the per-layer sets (decision 8), combining layer state, depth peel, `hidden` and the selection, with the override rule. Pure, with Vitest cases for each combination, and an equivalence test against M6's output for bone selections with only bones on.
- `src/scene/Isolation.tsx` applies the view to every layer's two batches (visibility and colours only; no geometry moves).
- Outlines (`src/scene/outline.ts`) work on whichever layer's batch holds the focus or hover; M9 extends them to several parts.
- Draw order and ghost sorting (decision 7).

## Step 5: Picking across layers; placeholder panel (decisions 11, 12)

- `src/scene/pick.ts`: nearest hit across the solid batches; proxies for new small structures; Vitest for the cross-layer choice (nearest wins, ghosts and hidden skipped, a near real hit beats a far proxy).
- `CameraRig.tsx`: hover and click use the new pick; double-tap centres any structure.
- `src/content/placeholder.ts` and `panel.ts`: the new-kind placeholder (decision 12); tooltip and breadcrumb names; "Show related" and "Expand" disabled with the reason for new kinds.
- `sel=` with a new-kind ID turns its layer on and loads it before selecting.

## Step 6: Per-structure Hide (decision 13)

- Store, reducer and history: Hide is part of the back step; Back un-hides.
- Panel **Hide** button, the `X` key (in the key map in `src/camera/input.ts` and the keyboard help), the toolbar chip "N hidden · Show all" (in "More" when narrow), the overflow toast, announcements ("Femur (left) hidden. 3 hidden.").

## Session V: depth and the existing tools (steps 7 and 8)

## Step 7: Muscle depth (decisions 9, 10)

- `content/muscle-depth.json` for every muscle (and part overrides), from standard references; uncertain entries in `QUESTIONS.md` under **Muscles: depth**.
- `src/content/schema.ts` and `validate.ts`: the file's schema; the rule "every muscle in `soft-ids.json` has a depth" (spec §10), entries only for real muscle or part IDs, side-free keys.
- The depth control in the Muscles row; peeled muscles hidden; announcements ("Superficial muscles hidden: 41 muscles").

## Step 8: Interplay with the existing tools (decision 14)

- Explode disabled with layers on; labels from all solid structures; screenshot, legend and joint highlighting checked with layers on.

## Session W: measure, test and ship (steps 9 to 11)

## Step 9: Bench and load measurements (spec §9)

- `?bench` takes the user `layers=` format, waits for every requested layer's LOD before orbiting, and reports triangles drawn and draw calls with the FPS. Two links for the user: **all solid** (`?bench&layers=b:on,c:on,l:on,m:on`) and **muscles ghosted** (`?bench&layers=b:on,c:off,l:off,m:ghost`).
- `scripts/perf-load.ts`: a new measure, "a layer's low LOD visible after turning it on" (budget 3 s desktop, 5 s phone profile, Fast 4G), for the muscles layer (the largest), plus the existing M6 figures with every layer off.
- `STATUS.md` §6 gets the new rows.

## Step 10: Tests and no-regression

- `tests/e2e/layers.spec.ts`: panel and presets; URL and `localStorage` round trip; a layer's files requested only when first turned on (and never with the default URL); Ghost makes a layer unpickable; picking a muscle over a bone; Hide, `X`, the chip, Show all and Back; depth stops; draw calls < 20 with every layer on and a selection active; every node of each loaded layer within 1 mm of its manifest (the real loader, not the debug view).
- `tests/e2e/a11y.spec.ts` and `keyboard.spec.ts` extended to the Layers panel and the Hide chip.
- No regression (exit criterion): bone files unchanged, the main chunk within +15 kB gzipped, `perf-load` with layers off within noise of M6, the full suite passing.

## Step 11: Hosted copy

- After the PR merges, the deploy builds `/m7/` from `main`. Ask the user to open `https://ajmarr04-ux.github.io/SkeletonViewer/m7/`, try the Layers panel, and run the two bench links on PC and iPhone. Record the results in the table below and in `STATUS.md` §6, take the ghost fallback if needed (decision 7), then tick the exit criteria and update `README.md`'s row. Freezing `m7` happens at the start of M8 (Milestone handover in `CLAUDE.md`).

### Bench results (filled in by the user's runs)

| Preset | Device | LOD | Median FPS | 5th pct FPS | Draw calls | Triangles | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All solid | PC | | | | | | |
| All solid | iPhone | | | | | | |
| Muscles ghosted over bones | PC | | | | | | |
| Muscles ghosted over bones | iPhone | | | | | | |

## Hosted copy

- Milestone 7: https://ajmarr04-ux.github.io/SkeletonViewer/m7/ (not yet deployed).
