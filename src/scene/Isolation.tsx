import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { hasMesh } from "../state/selection";
import { useViewer } from "../state/store";
import type { BatchedSkeleton } from "./batchSkeleton";
import { Color } from "three";
import { applyBaseColours, applyIsolationView, isPickable, isolationView, withBonesLayer, PLAIN, visibleCount, withJoint, type BaseTint } from "./isolation";
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
};

/**
 * Keeps the scene in step with the store: visibility of the solid and ghost
 * batches, the accent colour, the ghost opacity and the two outlines. Draws
 * nothing itself; the meshes are `<primitive>`s in the Viewer.
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

  // Outline width in CSS pixels whatever the canvas size and pixel ratio.
  useEffect(() => {
    if (!scene) return;
    for (const o of Object.values(scene.outlines)) setOutlineViewport(o, size.width, size.height, dpr);
  }, [scene, size.width, size.height, dpr]);

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
    const apply = () => {
      const st = useViewer.getState();
      const view = withJoint(withBonesLayer(isolationView(st.sel, st.tier, st.ghostMode, hasMesh, st.grp), st.layers.bones), st.joint, hasMesh);
      const focusChanged = view.focus !== focus;
      const base = baseTintFor(st.colourMode);
      if (st.colourMode !== colour) {
        // Colour-by-region on or off: every instance gets its new base colour, then the accent goes back on.
        applyBaseColours(scene.skeleton, base);
        colour = st.colourMode;
      }
      applyIsolationView(scene.skeleton, scene.ghost, view, focus, joint, base);
      focus = view.focus;
      joint = view.joint;
      const ghostMaterial = scene.ghost.mesh.material as { opacity: number };
      ghostMaterial.opacity = st.ghostOpacity;
      setOutlineTarget(scene.outlines.selected, scene.skeleton, view.focus);
      // The hover outline shows the joint's partner while a joint is highlighted, else the pointer's bone.
      const hover =
        view.jointPartner ?? (st.hovered !== null && st.hovered !== view.focus && isPickable(view, st.hovered) ? st.hovered : null);
      setOutlineColour(scene.outlines.hover, view.jointPartner !== null ? OUTLINE.joint.colour : OUTLINE.hover.colour);
      setOutlineTarget(scene.outlines.hover, scene.skeleton, hover);
      // Click → highlight (spec §8): from the pointer-up to the end of the next draw of the solid batch.
      const inputAt = st.inputAt;
      if (focusChanged && inputAt !== null) {
        st.markInput(null);
        const mesh = scene.skeleton.mesh;
        mesh.onAfterRender = () => {
          mesh.onAfterRender = () => {};
          highlightMs.current = performance.now() - inputAt;
          report();
        };
      }
      report();
    };
    const report = () => {
      statsRef.current?.({
        solid: visibleCount(scene.skeleton),
        ghost: visibleCount(scene.ghost),
        focus,
        outlineSelected: scene.outlines.selected.target,
        outlineHover: scene.outlines.hover.target,
        joint: [...joint],
        highlightMs: highlightMs.current,
        colour,
      });
    };
    apply();
    return useViewer.subscribe((s, prev) => {
      if (
        s.sel !== prev.sel ||
        s.tier !== prev.tier ||
        s.grp !== prev.grp ||
        s.ghostMode !== prev.ghostMode ||
        s.ghostOpacity !== prev.ghostOpacity ||
        s.hovered !== prev.hovered ||
        s.joint !== prev.joint ||
        s.colourMode !== prev.colourMode ||
        s.layers.bones !== prev.layers.bones
      ) {
        apply();
      }
    });
  }, [scene]);

  return null;
}
