import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { hasMesh, layerOfId } from "../state/selection";
import { useViewer } from "../state/store";
import type { BatchedSkeleton } from "./batchSkeleton";
import { Color } from "three";
import { applyBaseColours, applyLayerView, boneAccent, isPickableIn, PLAIN, viewOf, visibleCount, type BaseTint, type SceneView } from "./isolation";
import { useLayerBatches, type LayerBatches } from "./layerRegistry";
import { TISSUE_LAYERS, type TissueLayer } from "../state/url";
import { tintFor } from "./material";
import { REGIONS, regionColour, regionOf, type ColourMode, type Region } from "./regionColours";
import { OUTLINE, setOutlineColour, setOutlineTarget, setOutlineViewport, type Outline } from "./outline";

/** Everything drawn for one LOD: solid batch, ghost batch and the two outlines. */
export type SkeletonScene = {
  skeleton: BatchedSkeleton;
  ghost: BatchedSkeleton;
  outlines: { selected: Outline; hover: Outline };
};

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
};

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
    const outlines = [...(scene ? Object.values(scene.outlines) : []), ...Object.values(tissue).flatMap((b) => (b ? Object.values(b.outlines) : []))];
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
    let joint: readonly string[] = [];
    let colour: ColourMode = "bone";
    /** The tissue batches the view was last applied to: new ones (a layer loaded, a LOD swap) get every colour afresh. */
    const applied = new Set<LayerBatches>();
    const counts: IsolationStats["layers"] = {};
    const apply = () => {
      const st = useViewer.getState();
      const view = viewOf(st, hasMesh);
      const focusChanged = view.focus !== focus;
      const base = baseTintFor(st.colourMode);
      if (st.colourMode !== colour) {
        // Colour-by-region on or off: every instance gets its new base colour, then the accent goes back on.
        applyBaseColours(scene.skeleton, base);
        colour = st.colourMode;
      }
      const previous = focus === null ? joint : [focus, ...joint];
      applyLayerView("bones", scene.skeleton, scene.ghost, view, previous, base, boneAccent());
      const batches = useLayerBatches.getState();
      for (const layer of TISSUE_LAYERS) {
        const b = batches[layer];
        if (!b) continue;
        const fresh = !applied.has(b);
        if (fresh) {
          applyBaseColours(b.solid, b.base);
          applied.add(b);
        }
        counts[layer] = applyLayerView(layer, b.solid, b.ghost, view, previous, b.base, b.accent);
        b.ghost.mesh.material.opacity = st.ghostOpacity;
      }
      for (const b of applied) if (!Object.values(batches).includes(b)) applied.delete(b);
      focus = view.focus;
      joint = view.joint;
      const ghostMaterial = scene.ghost.mesh.material as { opacity: number };
      ghostMaterial.opacity = st.ghostOpacity;
      // Outlines: on whichever layer's batch holds the target, off on the others.
      const hoverLayer = st.hovered === null ? null : layerOfId(st.hovered);
      const hover =
        view.jointPartner ??
        (st.hovered !== null && st.hovered !== view.focus && hoverLayer !== null && isPickableIn(view, hoverLayer, st.hovered) ? st.hovered : null);
      const hoverColour = view.jointPartner !== null ? OUTLINE.joint.colour : OUTLINE.hover.colour;
      const targets: { outlines: SkeletonScene["outlines"]; batch: BatchedSkeleton }[] = [{ outlines: scene.outlines, batch: scene.skeleton }];
      for (const layer of TISSUE_LAYERS) {
        const b = batches[layer];
        if (b) targets.push({ outlines: b.outlines, batch: b.solid });
      }
      for (const t of targets) {
        const has = (id: string | null) => (id !== null && t.batch.instanceOf.has(id) ? id : null);
        setOutlineTarget(t.outlines.selected, t.batch, has(view.focus));
        setOutlineColour(t.outlines.hover, hoverColour);
        setOutlineTarget(t.outlines.hover, t.batch, has(hover));
      }
      // Click → highlight (spec §8): from the pointer-up to the end of the next draw of the focus's solid batch.
      const inputAt = st.inputAt;
      if (focusChanged && inputAt !== null) {
        st.markInput(null);
        const mesh = targets.find((t) => view.focus !== null && t.batch.instanceOf.has(view.focus))?.batch.mesh ?? scene.skeleton.mesh;
        mesh.onAfterRender = () => {
          mesh.onAfterRender = () => {};
          highlightMs.current = performance.now() - inputAt;
          report();
        };
      }
      report();
    };
    const outlineTarget = (key: "selected" | "hover") => {
      if (scene.outlines[key].target) return scene.outlines[key].target;
      for (const b of Object.values(useLayerBatches.getState())) if (b?.outlines[key].target) return b.outlines[key].target;
      return null;
    };
    const report = () => {
      statsRef.current?.({
        solid: visibleCount(scene.skeleton),
        ghost: visibleCount(scene.ghost),
        focus,
        outlineSelected: outlineTarget("selected"),
        outlineHover: outlineTarget("hover"),
        joint: [...joint],
        highlightMs: highlightMs.current,
        colour,
        layers: { ...counts },
        hidden: useViewer.getState().hidden.size,
      });
    };
    apply();
    const unsubscribeLayers = useLayerBatches.subscribe(apply);
    const unsubscribe = useViewer.subscribe((s, prev) => {
      if (
        s.sel !== prev.sel ||
        s.tier !== prev.tier ||
        s.grp !== prev.grp ||
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
    };
  }, [scene]);

  return null;
}
