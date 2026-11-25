import { useEffect } from "react";
import { hasMesh } from "../state/selection";
import { useViewer } from "../state/store";
import { allInstanceBounds, type BatchedSkeleton } from "./batchSkeleton";
import { beginExplode, boneBox, endExplode, explodeOffsets, setExplode, type BoneBox, type ExplodeRun } from "./explode";
import type { SkeletonScene } from "./Isolation";
import { EAGER_ONLY, isolationView, relatedAt } from "./isolation";
import { setOutlineTarget } from "./outline";

/** Box centre and radius of every bone, worked out once per batch (on the first explode). */
const boxes = new WeakMap<BatchedSkeleton, Map<string, BoneBox>>();
function boxesOf(sk: BatchedSkeleton): Map<string, BoneBox> {
  let m = boxes.get(sk);
  if (!m) {
    m = new Map([...allInstanceBounds(sk)].map(([id, b]) => [id, boneBox(b)]));
    boxes.set(sk, m);
  }
  return m;
}

/** The tier-1 bones that move for the current selection, or null if Explode doesn't apply. */
export function explodeMovers(sel: string | null, tier: number): { focus: string; movers: string[] } | null {
  if (sel === null || tier < 1 || !hasMesh(sel)) return null;
  const movers = relatedAt(sel, 1, EAGER_ONLY).filter(hasMesh);
  return movers.length ? { focus: sel, movers } : null;
}

/**
 * Applies the Explode slider (plan step 8) to the solid batch: saves the
 * moving bones' matrices on the first move, places them for each slider value,
 * and writes the saved matrices back once the value returns to 0 (or the
 * selection or LOD changes). `onRestored` runs after each restore, so `?debug`
 * can re-check every bone's bounds. Draws nothing itself.
 */
export function Explode({ scene, onRestored }: { scene: SkeletonScene | null; onRestored?: () => void }) {
  useEffect(() => {
    if (!scene) return;
    const sk = scene.skeleton;
    let run: ExplodeRun | null = null;
    const restore = () => {
      if (!run) return;
      endExplode(sk, run);
      run = null;
      retargetOutlines();
      onRestored?.();
    };
    // Outlines read their bone's instance matrix when targeted: re-read it after a move.
    const retargetOutlines = () => {
      for (const o of Object.values(scene.outlines)) if (o.target !== null) setOutlineTarget(o, sk, o.target);
    };
    const apply = () => {
      const st = useViewer.getState();
      if (st.explode === 0) return restore();
      if (!run) {
        const m = explodeMovers(st.sel, st.tier);
        if (!m || !isolationView(st.sel, st.tier, st.ghostMode, hasMesh).isolated) return;
        const all = boxesOf(sk);
        const focus = all.get(m.focus);
        if (!focus) return;
        const movers = new Map(m.movers.flatMap((id) => (all.has(id) ? [[id, all.get(id)!] as const] : [])));
        run = beginExplode(sk, explodeOffsets(focus, movers));
      }
      setExplode(sk, run, st.explode);
      retargetOutlines();
    };
    apply();
    const unsubscribe = useViewer.subscribe((s, prev) => {
      if (s.sel !== prev.sel || s.tier !== prev.tier) restore();
      if (s.explode !== prev.explode) apply();
    });
    return () => {
      unsubscribe();
      restore();
    };
  }, [scene, onRestored]);
  return null;
}
