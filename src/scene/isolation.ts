// What isolation looks like in the scene (spec §6 Isolation): which bones are
// drawn solid, which are ghosts, and which bone carries the accent colour.
// The view is pure; `applyIsolationView` writes it to the two BatchedMeshes.
// Only visibility and colours change. No geometry moves or reloads (spec §12).

import { Color } from "three";
import { groupOf } from "../content/groups";
import { relations } from "../content/relations";
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
  /** Bones of the joint highlighted from the panel (plan step 7), drawn solid and brighter. */
  joint: readonly string[];
  /** The joint's partner (not the focus), which gets the joint outline; or null. */
  jointPartner: string | null;
};

export const FULL_VIEW: IsolationView = { isolated: false, focus: null, solid: null, ghosts: false, joint: [], jointPartner: null };

/**
 * The view for a selection (spec §6). Tier 0 isolates the selected bone alone,
 * tier 1 adds the bones it articulates with (and a tooth's neighbours), tier 2
 * adds its region set (`content/relations.ts`). Objects without a mesh are left
 * out: a wisdom tooth isolates nothing at tier 0, and at tiers 1 and 2 shows its
 * related bones with no focus.
 */
export function isolationView(
  sel: string | null,
  tier: Tier,
  ghostMode: GhostMode,
  hasMesh: (id: string) => boolean,
  grp: string | null = null,
): IsolationView {
  if (sel === null) return grp === null ? FULL_VIEW : groupView(grp, ghostMode, hasMesh);
  const solid = new Set(relations.visibleAt(sel, tier).filter(hasMesh));
  if (solid.size === 0) return FULL_VIEW;
  return { isolated: true, focus: hasMesh(sel) ? sel : null, solid, ghosts: ghostMode === "ghost", joint: [], jointPartner: null };
}

/**
 * A group isolation (plan decision 5): its members with a mesh drawn solid,
 * with no focus (normal bone colour, no outline); the rest ghosted or hidden as
 * at tier 0.
 */
export function groupView(grp: string, ghostMode: GhostMode, hasMesh: (id: string) => boolean): IsolationView {
  const g = groupOf(grp);
  const solid = new Set((g?.members ?? []).filter(hasMesh));
  if (solid.size === 0) return FULL_VIEW;
  return { isolated: true, focus: null, solid, ghosts: ghostMode === "ghost", joint: [], jointPartner: null };
}

/**
 * The view with an articulation highlighted (spec §6, plan decision 9): both
 * bones are drawn solid (a ghost or hidden partner is shown for as long as the
 * highlight lasts) and brighter; the partner gets the joint outline. Objects
 * without a mesh are skipped. Nothing moves.
 */
export function withJoint(view: IsolationView, joint: { a: string; b: string } | null, hasMesh: (id: string) => boolean): IsolationView {
  if (joint === null) return view;
  const bones = [joint.a, joint.b].filter(hasMesh);
  if (bones.length === 0) return view;
  const solid = view.solid === null ? null : new Set([...view.solid, ...bones]);
  const partner = hasMesh(joint.b) ? joint.b : null;
  return { ...view, solid, joint: bones, jointPartner: partner };
}

/** Can this bone be picked (clicked, tapped, hovered)? Ghosts and hidden bones cannot. */
export function isPickable(view: IsolationView, id: string): boolean {
  return view.solid === null || view.solid.has(id);
}

const WHITE = new Color(1, 1, 1);
let accentTint: Color | null = null;

/** Gain on a bone's tint while its joint is highlighted: brighter, same hue. */
export const JOINT_GAIN = 1.3;
const _tint = new Color();

/**
 * Apply a view: solid batch shows `solid`, the ghost batch shows the rest
 * (only drawn when `ghosts`), and the focus bone gets the accent tint.
 * `previousFocus` is reset to white. Cheap: a few hundred flag writes at most.
 */
export function applyIsolationView(
  solid: BatchedSkeleton,
  ghost: BatchedSkeleton | null,
  view: IsolationView,
  previousFocus: string | null,
  previousJoint: readonly string[] = [],
): void {
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
  for (const id of previousFocus === null ? previousJoint : [previousFocus, ...previousJoint]) {
    if (id === view.focus || view.joint.includes(id)) continue;
    const i = solid.instanceOf.get(id);
    if (i !== undefined) solid.mesh.setColorAt(i, WHITE);
  }
  if (view.focus !== null) {
    const i = solid.instanceOf.get(view.focus);
    if (i !== undefined) solid.mesh.setColorAt(i, accentTint);
  }
  for (const id of view.joint) {
    const i = solid.instanceOf.get(id);
    if (i === undefined) continue;
    _tint.copy(id === view.focus ? accentTint : WHITE).multiplyScalar(JOINT_GAIN);
    solid.mesh.setColorAt(i, _tint);
  }
}

/** Count of instances drawn by a batch (for the debug overlay and tests). */
export function visibleCount(s: BatchedSkeleton): number {
  if (!s.mesh.visible) return 0;
  let n = 0;
  for (let i = 0; i < s.boneIds.length; i++) if (s.mesh.getVisibleAt(i)) n++;
  return n;
}
