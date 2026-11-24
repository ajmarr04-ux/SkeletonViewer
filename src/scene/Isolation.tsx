import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { hasMesh, layerOfId } from "../state/selection";
import { useViewer } from "../state/store";
import type { BatchedSkeleton } from "./batchSkeleton";
import { Color } from "three";
import { applyBaseColours, applyLayerView, boneAccent, drawnColourMode, isPickableIn, PLAIN, viewOf, visibleCount, type BaseTint, type SceneView } from "./isolation";
import { subscribeSoftTiers } from "../content/softRelations";
import { useLayerBatches, usePatchBatch, type LayerBatches, type PatchBatch } from "./layerRegistry";
import { TISSUE_LAYERS, type TissueLayer } from "../state/url";
import { tintFor } from "./material";
import { TINT_COLOURS, TINT_ROLES, type TintRole } from "./tints";
import { REGIONS, regionColour, regionOf, type ColourMode, type Region } from "./regionColours";
import { OUTLINE, setOutlineColour, setOutlineTarget, setOutlineViewport, type Outline } from "./outline";

/** Everything drawn for one LOD: solid batch, ghost batch and the two outlines. */
export type SkeletonScene = {
  skeleton: BatchedSkeleton;
  ghost: BatchedSkeleton;
  outlines: { selected: Outline; hover: Outline };
  /** Insertion-coloured outlines for tinted origins that are also insertions (M9, `MAX_BOTH_OUTLINES`). */
  both: Outline[];
};

/** The bones' instance colours for the tints (each tint over the ivory material). */
let boneTints: Record<TintRole, Color> | null = null;
const boneTint = (): Record<TintRole, Color> =>
  (boneTints ??= Object.fromEntries(TINT_ROLES.map((r) => [r, tintFor(TINT_COLOURS[r])])) as Record<TintRole, Color>);

let regionTints: Map<Region, Color> | null = null;

/** The instance colours for colour-by-region: each region's colour divided by the ivory material. */
function regionBase(): BaseTint {
  regionTints ??= new Map(REGIONS.map((r) => [r.region, tintFor(regionColour(r.region))]));
  const white = new Color(1, 1, 1);
  return (id) => {
    const r = regionOf(id);
    return (r && regionTints!.get(r)) || white;
  };
}

/** The base colour of each object in a colour mode. */
export function baseTintFor(mode: ColourMode): BaseTint {
  return mode === "region" ? regionBase() : PLAIN;
}

/** What the debug overlay shows about isolation (and the e2e tests read). */
export type IsolationStats = {
  /** Bones drawn solid and as ghosts. */
  solid: number;
  ghost: number;
  focus: string | null;
  outlineSelected: string | null;
  /** Every structure with a selection outline (a selected muscle's parts each have one), sorted. */
  outlinesSelected: string[];
  /** The structures drawn with the accent (`SceneView.focusIds`). */
  focusIds: string[];
  outlineHover: string | null;
  /** Bones of the joint highlighted from the panel (plan step 7). */
  joint: string[];
  /** Pointer up → first frame drawn with the new highlight, ms (spec §8). */
  highlightMs: number | null;
  /** The colour mode the instance colours were last written for. */
  colour: ColourMode;
  /** Solid and ghost counts of each loaded soft-tissue layer (M7). */
  layers: Partial<Record<TissueLayer, { solid: number; ghost: number }>>;
  /** Structures hidden one by one (`hid=`). */
  hidden: number;
  /** Structures drawn in a tint, by role, sorted (M9). */
  tints: Partial<Record<TintRole, string[]>>;
  /** Attachment patches drawn now, by role, sorted (empty until the patch file has loaded). */
  patches: { origin: string[]; insertion: string[] };
  /** Structures with the origin-and-insertion outline, sorted. */
  both: string[];
};

function tintStats(v: SceneView | null): IsolationStats["tints"] {
  const out: IsolationStats["tints"] = {};
  if (!v) return out;
  for (const [id, role] of v.tints) (out[role] ??= []).push(id);
  for (const list of Object.values(out)) list.sort();
  return out;
}

/** The current view from the store (isolation, joint, layers, hidden structures). */
export const currentView = (): SceneView => viewOf(useViewer.getState(), hasMesh);

/**
 * Keeps the scene in step with the store: visibility of every layer's solid
 * and ghost batches, the accent colour, the ghost opacity and the outlines
 * (on whichever layer holds the focus or the hovered structure). Draws
 * nothing itself; the meshes are `<primitive>`s in the Viewer and in
 * `LayerScenes`.
 */
export function Isolation({ scene, onStats }: { scene: SkeletonScene | null; onStats?: (s: IsolationStats) => void }) {
  const gl = useThree((s) => s.gl);
  const r3fScene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const highlightMs = useRef<number | null>(null);
  const statsRef = useRef(onStats);
  statsRef.current = onStats;
  const tissue = useLayerBatches();

  // Outline width in CSS pixels whatever the canvas size and pixel ratio.
  useEffect(() => {
    const outlines = [
      ...(scene ? [...Object.values(scene.outlines), ...scene.both] : []),
      ...Object.values(tissue).flatMap((b) => (b ? [...Object.values(b.outlines), ...b.moreSelected] : [])),
    ];
    for (const o of outlines) setOutlineViewport(o, size.width, size.height, dpr);
  }, [scene, tissue, size.width, size.height, dpr]);

  // Compile the ghost and outline programs now, while loading, not on the first click.
  useEffect(() => {
    if (!scene) return;
    const hidden = [scene.ghost.mesh, scene.outlines.selected.mesh, scene.outlines.hover.mesh].filter((m) => !m.visible);
    for (const m of hidden) m.visible = true;
    const done = gl.compileAsync(r3fScene, camera).catch(() => {});
    for (const m of hidden) m.visible = false;
    void done;
  }, [scene, gl, r3fScene, camera]);

  useEffect(() => {
    if (!scene) return;
    let focus: string | null = null;
    let focusIds: readonly string[] = [];
    let joint: readonly string[] = [];
    let tinted: readonly string[] = [];
    let view: SceneView | null = null;
    let colour: ColourMode = "bone";
    let patchBatch: PatchBatch | null = null;
    const drawnPatches = { origin: [] as string[], insertion: [] as string[] };
    /** The tissue batches the view was last applied to: new ones (a layer loaded, a LOD swap) get every colour afresh. */
    const applied = new Set<LayerBatches>();
    const counts: IsolationStats["layers"] = {};
    const apply = () => {
      const st = useViewer.getState();
      view = viewOf(st, hasMesh);
      const focusChanged = view.focus !== focus;
      const mode = drawnColourMode(st.colourMode, view);
      const base = baseTintFor(mode);
      if (mode !== colour) {
        // Colour-by-region on or off (or paused for the tints): every instance gets its new base colour, then the accent goes back on.
        applyBaseColours(scene.skeleton, base);
        colour = mode;
      }
      const previous = [...focusIds, ...joint, ...tinted];
      applyLayerView("bones", scene.skeleton, scene.ghost, view, previous, base, boneAccent(), boneTint());
      const batches = useLayerBatches.getState();
      for (const layer of TISSUE_LAYERS) {
        const b = batches[layer];
        if (!b) continue;
        const fresh = !applied.has(b);
        if (fresh) {
          applyBaseColours(b.solid, b.base);
          applied.add(b);
        }
        counts[layer] = applyLayerView(layer, b.solid, b.ghost, view, previous, b.base, b.accent, b.tint);
        b.ghost.mesh.material.opacity = st.ghostOpacity;
      }
      for (const b of applied) if (!Object.values(batches).includes(b)) applied.delete(b);
      applyPatches(view);
      focus = view.focus;
      focusIds = view.focusIds;
      joint = view.joint;
      tinted = [...view.tints.keys()];
      const ghostMaterial = scene.ghost.mesh.material as { opacity: number };
      ghostMaterial.opacity = st.ghostOpacity;
      // Outlines: on whichever layer's batch holds the target, off on the others.
      const hoverLayer = st.hovered === null ? null : layerOfId(st.hovered);
      const hover =
        view.jointPartner ??
        (st.hovered !== null && !view.focusIds.includes(st.hovered) && hoverLayer !== null && isPickableIn(view, hoverLayer, st.hovered) ? st.hovered : null);
      const hoverColour = view.jointPartner !== null ? OUTLINE.joint.colour : OUTLINE.hover.colour;
      const targets: { outlines: SkeletonScene["outlines"]; more: readonly Outline[]; batch: BatchedSkeleton }[] = [
        { outlines: scene.outlines, more: [], batch: scene.skeleton },
      ];
      for (const layer of TISSUE_LAYERS) {
        const b = batches[layer];
        if (b) targets.push({ outlines: b.outlines, more: b.moreSelected, batch: b.solid });
      }
      for (const t of targets) {
        const has = (id: string | null) => (id !== null && t.batch.instanceOf.has(id) ? id : null);
        // One hull per focused structure in this batch: a muscle's parts each get one (spec §8).
        const mine = view.focusIds.filter((id) => t.batch.instanceOf.has(id));
        setOutlineTarget(t.outlines.selected, t.batch, mine[0] ?? null);
        t.more.forEach((o, i) => setOutlineTarget(o, t.batch, mine[i + 1] ?? null));
        setOutlineColour(t.outlines.hover, hoverColour);
        setOutlineTarget(t.outlines.hover, t.batch, has(hover));
      }
      const both = view.both.filter((id) => scene.skeleton.instanceOf.has(id));
      scene.both.forEach((o, i) => setOutlineTarget(o, scene.skeleton, both[i] ?? null));
      // Click → highlight (spec §8): from the pointer-up to the end of the next draw of the focus's solid batch.
      const inputAt = st.inputAt;
      if (focusChanged && inputAt !== null) {
        st.markInput(null);
        const first = view.focusIds[0];
        const mesh = targets.find((t) => first !== undefined && t.batch.instanceOf.has(first))?.batch.mesh ?? scene.skeleton.mesh;
        mesh.onAfterRender = () => {
          mesh.onAfterRender = () => {};
          highlightMs.current = performance.now() - inputAt;
          report();
        };
      }
      report();
    };
    /** The patches wanted by the view, in their role's colour; the batch is switched off with none. */
    const applyPatches = (v: SceneView) => {
      drawnPatches.origin = [];
      drawnPatches.insertion = [];
      const pb = usePatchBatch.getState().batch;
      if (pb !== patchBatch && patchBatch) patchBatch.solid.mesh.visible = false;
      patchBatch = pb;
      if (!pb) return;
      pb.solid.boneIds.forEach((id, i) => {
        const role = v.patches.get(id);
        const on = role !== undefined;
        if (on) {
          drawnPatches[role].push(id);
          pb.solid.mesh.setColorAt(i, pb.tint[role]);
        }
        if (pb.solid.mesh.getVisibleAt(i) !== on) pb.solid.mesh.setVisibleAt(i, on);
      });
      pb.solid.mesh.visible = drawnPatches.origin.length + drawnPatches.insertion.length > 0;
    };
    const outlineTarget = (key: "selected" | "hover") => {
      if (scene.outlines[key].target) return scene.outlines[key].target;
      for (const b of Object.values(useLayerBatches.getState())) if (b?.outlines[key].target) return b.outlines[key].target;
      return null;
    };
    const allSelectedOutlines = () => {
      const out: string[] = [];
      const add = (t: string | null) => t !== null && out.push(t);
      add(scene.outlines.selected.target);
      for (const b of Object.values(useLayerBatches.getState())) {
        if (!b) continue;
        add(b.outlines.selected.target);
        b.moreSelected.forEach((o) => add(o.target));
      }
      return out.sort();
    };
    const report = () => {
      statsRef.current?.({
        solid: visibleCount(scene.skeleton),
        ghost: visibleCount(scene.ghost),
        focus,
        outlineSelected: outlineTarget("selected"),
        outlinesSelected: allSelectedOutlines(),
        focusIds: [...focusIds],
        outlineHover: outlineTarget("hover"),
        joint: [...joint],
        highlightMs: highlightMs.current,
        colour,
        layers: { ...counts },
        hidden: useViewer.getState().hidden.size,
        tints: tintStats(view),
        patches: { origin: [...drawnPatches.origin].sort(), insertion: [...drawnPatches.insertion].sort() },
        both: scene.both.flatMap((o) => (o.target ? [o.target] : [])).sort(),
      });
    };
    apply();
    const unsubscribeLayers = useLayerBatches.subscribe(apply);
    const unsubscribePatches = usePatchBatch.subscribe(apply);
    // A layer's tier sets arriving can change a related set on screen (M9 plan decision 3).
    const unsubscribeTiers = subscribeSoftTiers(apply);
    const unsubscribe = useViewer.subscribe((s, prev) => {
      if (
        s.sel !== prev.sel ||
        s.tier !== prev.tier ||
        s.grp !== prev.grp ||
        s.antagonists !== prev.antagonists ||
        s.ghostMode !== prev.ghostMode ||
        s.ghostOpacity !== prev.ghostOpacity ||
        s.hovered !== prev.hovered ||
        s.joint !== prev.joint ||
        s.colourMode !== prev.colourMode ||
        s.layers !== prev.layers ||
        s.hidden !== prev.hidden ||
        s.muscleDepth !== prev.muscleDepth
      ) {
        apply();
      }
    });
    return () => {
      unsubscribe();
      unsubscribeLayers();
      unsubscribePatches();
      unsubscribeTiers();
    };
  }, [scene]);

  return null;
}
