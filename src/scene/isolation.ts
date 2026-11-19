// What isolation looks like in the scene (spec §6 Isolation): which bones are
// drawn solid, which are ghosts, and which bone carries the accent colour.
// The view is pure; `applyIsolationView` writes it to the two BatchedMeshes.
// Only visibility and colours change. No geometry moves or reloads (spec §12).

import { Color } from "three";
import type { Tier } from "../state/isolation";
import type { GhostMode } from "../state/url";
import type { BatchedSkeleton } from "./batchSkeleton";
import { accentTint as makeAccentTint } from "./material";

export type IsolationView = {
  /** True when a bone with a mesh is isolated (a wisdom tooth isolates nothing). */
  isolated: boolean;
  /** The bone with the accent colour and the selection outline, or null. */
  focus: string | null;
  /** Bones drawn solid (and pickable). Null means all of them. */
  solid: ReadonlySet<string> | null;
  /** Whether the ghost batch is drawn (ghost mode, with something isolated). */
  ghosts: boolean;
};

export const FULL_VIEW: IsolationView = { isolated: false, focus: null, solid: null, ghosts: false };

/**
 * The view for a selection. Tier 0 isolates the selected bone alone; tiers 1
 * and 2 (Milestone 4) will add related bones and the region to `solid`.
 */
export function isolationView(sel: string | null, _tier: Tier, ghostMode: GhostMode, hasMesh: (id: string) => boolean): IsolationView {
  if (sel === null || !hasMesh(sel)) return FULL_VIEW;
  return { isolated: true, focus: sel, solid: new Set([sel]), ghosts: ghostMode === "ghost" };
}

/** Can this bone be picked (clicked, tapped, hovered)? Ghosts and hidden bones cannot. */
export function isPickable(view: IsolationView, id: string): boolean {
  return view.solid === null || view.solid.has(id);
}

const WHITE = new Color(1, 1, 1);
let accentTint: Color | null = null;

/**
 * Apply a view: solid batch shows `solid`, the ghost batch shows the rest
 * (only drawn when `ghosts`), and the focus bone gets the accent tint.
 * `previousFocus` is reset to white. Cheap: a few hundred flag writes at most.
 */
export function applyIsolationView(solid: BatchedSkeleton, ghost: BatchedSkeleton | null, view: IsolationView, previousFocus: string | null): void {
  accentTint ??= makeAccentTint();
  solid.boneIds.forEach((id, i) => {
    const show = view.solid === null || view.solid.has(id);
    if (solid.mesh.getVisibleAt(i) !== show) solid.mesh.setVisibleAt(i, show);
  });
  if (ghost) {
    ghost.mesh.visible = view.ghosts;
    ghost.boneIds.forEach((id, i) => {
      const show = view.solid !== null && !view.solid.has(id);
      if (ghost.mesh.getVisibleAt(i) !== show) ghost.mesh.setVisibleAt(i, show);
    });
  }
  if (previousFocus !== null && previousFocus !== view.focus) {
    const i = solid.instanceOf.get(previousFocus);
    if (i !== undefined) solid.mesh.setColorAt(i, WHITE);
  }
  if (view.focus !== null) {
    const i = solid.instanceOf.get(view.focus);
    if (i !== undefined) solid.mesh.setColorAt(i, accentTint);
  }
}

/** Count of instances drawn by a batch (for the debug overlay and tests). */
export function visibleCount(s: BatchedSkeleton): number {
  if (!s.mesh.visible) return 0;
  let n = 0;
  for (let i = 0; i < s.boneIds.length; i++) if (s.mesh.getVisibleAt(i)) n++;
  return n;
}
