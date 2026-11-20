// What isolation looks like in the scene (spec §6 Isolation): which bones are
// drawn solid, which are ghosts, and which bone carries the accent colour.
// The view is pure; `applyIsolationView` writes it to the two BatchedMeshes.
// Only visibility and colours change. No geometry moves or reloads (spec §12).

import { Color } from "three";
import { groupOf } from "../content/groups";
import { relations } from "../content/relations";
import type { Tier } from "../state/isolation";
import { DEFAULT_LAYERS, LAYERS, type GhostMode, type Layer, type LayerModes, type MuscleDepth } from "../state/url";
import { peeledAt, softEntry } from "../content/softRegistry";
import type { BatchedSkeleton } from "./batchSkeleton";
import { accentTint as makeAccentTint } from "./material";

export type IsolationView = {
  /** True when a bone with a mesh is isolated (a wisdom tooth isolates nothing). */
  isolated: boolean;
  /** The selection when something of it is drawn (a muscle with parts included), or null. */
  focus: string | null;
  /**
   * The structures drawn with the accent colour and the selection outline:
   * `[focus]`, or a selected muscle's parts (spec §5.1); empty with no focus.
   */
  focusIds: readonly string[];
  /** Bones drawn solid (and pickable). Null means all of them. */
  solid: ReadonlySet<string> | null;
  /** Whether the ghost batch is drawn (ghost mode, with something isolated). */
  ghosts: boolean;
  /** Bones of the joint highlighted from the panel (plan step 7), drawn solid and brighter. */
  joint: readonly string[];
  /** The joint's partner (not the focus), which gets the joint outline; or null. */
  jointPartner: string | null;
};

export const FULL_VIEW: IsolationView = { isolated: false, focus: null, focusIds: [], solid: null, ghosts: false, joint: [], jointPartner: null };

/** A structure's parts (a muscle with parts), else none. */
export type PartsOf = (id: string) => readonly string[];
const softParts: PartsOf = (id) => softEntry(id)?.parts ?? [];
const softParent = (id: string): string | null => softEntry(id)?.parent ?? null;

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
  partsOf: PartsOf = softParts,
  parentOf: (id: string) => string | null = softParent,
): IsolationView {
  if (sel === null) return grp === null ? FULL_VIEW : groupView(grp, ghostMode, hasMesh);
  // A muscle with parts is drawn as its parts (spec §5.1 rule 1); a selected part keeps its siblings solid,
  // in the muscle colour (rule 2).
  const focusIds = hasMesh(sel) ? [sel] : partsOf(sel).filter(hasMesh);
  const parent = parentOf(sel);
  const siblings = parent === null ? [] : partsOf(parent);
  const solid = new Set([...relations.visibleAt(sel, tier), ...focusIds, ...siblings].filter(hasMesh));
  if (solid.size === 0) return FULL_VIEW;
  const focus = focusIds.length > 0 ? sel : null;
  return { isolated: true, focus, focusIds, solid, ghosts: ghostMode === "ghost", joint: [], jointPartner: null };
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
  return { isolated: true, focus: null, focusIds: [], solid, ghosts: ghostMode === "ghost", joint: [], jointPartner: null };
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

/** How one layer's structures are drawn (M7 plan decisions 6 and 8). */
export type LayerShow = {
  /** Drawn solid (and pickable). Null means every structure of the layer. */
  solid: ReadonlySet<string> | null;
  /** What happens to the rest: drawn in the layer's ghost batch, or not at all. */
  rest: "ghost" | "hidden";
};

/** Where a structure ends up: its layer's solid batch, its ghost batch, or nowhere. */
export type Shown = "solid" | "ghost" | "hidden";

/**
 * The isolation view made layer-aware (M7 plan decision 8): one `LayerShow`
 * per layer, the structures hidden one by one (`hid=`, and from session V the
 * depth peel), and the tints M9 fills (origin, insertion, antagonist).
 */
export type SceneView = {
  isolated: boolean;
  focus: string | null;
  /** Drawn with the accent and the selection outline (see `IsolationView.focusIds`). */
  focusIds: readonly string[];
  layers: Record<Layer, LayerShow>;
  hidden: ReadonlySet<string>;
  joint: readonly string[];
  jointPartner: string | null;
  /** Extra colours by structure (M9). Empty in M7. */
  tints: ReadonlyMap<string, string>;
};

const NO_IDS: ReadonlySet<string> = new Set();
const NO_TINTS: ReadonlyMap<string, string> = new Map();

/**
 * Combine the isolation with the layer modes and the hidden structures (M7
 * plan decision 6):
 * - nothing isolated: a layer that is On is all solid, Ghost all ghost, Off all hidden;
 * - something isolated: what isolation keeps solid is solid **whatever its
 *   layer's mode** (isolation overrides the layer toggles, spec §5.2); the rest
 *   is a ghost if its layer is Ghost, or if the layer is On and isolation ghosts
 *   (ghost mode); otherwise hidden.
 * Hidden structures (`hidden`) are never drawn, except the focus itself and the
 * bones of a highlighted joint (see `shownIn`).
 *
 * With only the bones layer on and nothing hidden, the bones' `LayerShow` is
 * exactly M6's view: `solid` as isolation gives it, `rest` ghost or hidden.
 */
export function sceneView(iso: IsolationView, modes: LayerModes, hidden: ReadonlySet<string> = NO_IDS): SceneView {
  const layers = {} as Record<Layer, LayerShow>;
  for (const layer of LAYERS) {
    const mode = modes[layer];
    if (iso.solid === null) {
      layers[layer] = mode === "on" ? { solid: null, rest: "hidden" } : { solid: NO_IDS, rest: mode === "ghost" ? "ghost" : "hidden" };
    } else {
      const rest = mode === "ghost" || (mode === "on" && iso.ghosts) ? "ghost" : "hidden";
      layers[layer] = { solid: iso.solid, rest };
    }
  }
  return { isolated: iso.isolated, focus: iso.focus, focusIds: iso.focusIds, layers, hidden, joint: iso.joint, jointPartner: iso.jointPartner, tints: NO_TINTS };
}

/** Where one structure of `layer` is drawn in a view. */
export function shownIn(view: SceneView, layer: Layer, id: string): Shown {
  if (view.focusIds.includes(id) || view.joint.includes(id)) return "solid";
  if (view.hidden.has(id)) return "hidden";
  const show = view.layers[layer];
  if (show.solid === null || show.solid.has(id)) return "solid";
  return show.rest;
}

/** Can this structure be picked (clicked, tapped, hovered)? Only solid ones can (spec §5.5). */
export const isPickableIn = (view: SceneView, layer: Layer, id: string): boolean => shownIn(view, layer, id) === "solid";

/**
 * The whole view from the store's fields: isolation, joint, layer modes and
 * hidden structures. `hasMesh` covers bones, teeth and (once loaded) soft tissue.
 */
export function viewOf(
  st: {
    sel: string | null;
    tier: Tier;
    ghostMode: GhostMode;
    grp: string | null;
    joint: { a: string; b: string } | null;
    layers: LayerModes;
    hidden: ReadonlySet<string>;
    muscleDepth?: MuscleDepth;
  },
  hasMesh: (id: string) => boolean,
  peel: (stop: MuscleDepth) => ReadonlySet<string> = peeledAt,
): SceneView {
  const iso = withJoint(isolationView(st.sel, st.tier, st.ghostMode, hasMesh, st.grp), st.joint, hasMesh);
  return sceneView(iso, st.layers, withPeeled(st.hidden, peel(st.muscleDepth ?? 0)));
}

/** Hidden structures plus the muscles peeled by the depth control (cached for the same two sets). */
let lastUnion: { a: ReadonlySet<string>; b: ReadonlySet<string>; out: ReadonlySet<string> } | null = null;
function withPeeled(hidden: ReadonlySet<string>, peeledSet: ReadonlySet<string>): ReadonlySet<string> {
  if (peeledSet.size === 0) return hidden;
  if (hidden.size === 0) return peeledSet;
  if (lastUnion && lastUnion.a === hidden && lastUnion.b === peeledSet) return lastUnion.out;
  const out = new Set([...hidden, ...peeledSet]);
  lastUnion = { a: hidden, b: peeledSet, out };
  return out;
}

/** Can this bone be picked (clicked, tapped, hovered)? Ghosts and hidden bones cannot. */
export function isPickable(view: IsolationView, id: string): boolean {
  return view.solid === null || view.solid.has(id);
}

const WHITE = new Color(1, 1, 1);
let accentTint: Color | null = null;

/** An object's own instance colour: white (plain bone), or its region tint (colour-by-region). */
export type BaseTint = (id: string) => Color;
export const PLAIN: BaseTint = () => WHITE;

/** Write every instance's base colour (on a colour-mode change); `applyIsolationView` then adds the accent. */
export function applyBaseColours(solid: BatchedSkeleton, base: BaseTint): void {
  solid.boneIds.forEach((id, i) => solid.mesh.setColorAt(i, base(id)));
}

/** Gain on a bone's tint while its joint is highlighted: brighter, same hue. */
export const JOINT_GAIN = 1.3;
const _tint = new Color();

/**
 * Apply an isolation view to the bones (M6's form, kept for its callers and
 * tests): the bones layer On, nothing hidden. See `applyLayerView`.
 */
export function applyIsolationView(
  solid: BatchedSkeleton,
  ghost: BatchedSkeleton | null,
  view: IsolationView,
  previousFocus: string | null,
  previousJoint: readonly string[] = [],
  base: BaseTint = PLAIN,
): void {
  accentTint ??= makeAccentTint();
  const previous = previousFocus === null ? previousJoint : [previousFocus, ...previousJoint];
  applyLayerView("bones", solid, ghost, sceneView(view, DEFAULT_LAYERS), previous, base, accentTint);
}

/** The bones' accent instance colour (pale blue on ivory). */
export function boneAccent(): Color {
  accentTint ??= makeAccentTint();
  return accentTint;
}

/**
 * Apply a view to one layer's two batches (M7 plan decision 8): each structure
 * goes to the solid batch, the ghost batch or neither (`shownIn`); a batch with
 * nothing to draw is switched off, so it costs no draw call. The focus gets
 * `accent`, a highlighted joint's bones their tint times `JOINT_GAIN`, and the
 * structures in `previous` (the last focus and joint) go back to their base
 * colour. Only visibility and colours change; nothing moves (spec §12).
 */
export function applyLayerView(
  layer: Layer,
  solid: BatchedSkeleton,
  ghost: BatchedSkeleton | null,
  view: SceneView,
  previous: readonly string[],
  base: BaseTint,
  accent: Color,
): { solid: number; ghost: number } {
  let nSolid = 0;
  let nGhost = 0;
  solid.boneIds.forEach((id, i) => {
    const where = shownIn(view, layer, id);
    const s = where === "solid";
    if (s) nSolid++;
    if (solid.mesh.getVisibleAt(i) !== s) solid.mesh.setVisibleAt(i, s);
    if (ghost) {
      const g = where === "ghost";
      if (g) nGhost++;
      const gi = ghost.instanceOf.get(id);
      if (gi !== undefined && ghost.mesh.getVisibleAt(gi) !== g) ghost.mesh.setVisibleAt(gi, g);
    }
  });
  solid.mesh.visible = nSolid > 0;
  if (ghost) ghost.mesh.visible = nGhost > 0;
  for (const id of previous) {
    if (view.focusIds.includes(id) || view.joint.includes(id)) continue;
    const i = solid.instanceOf.get(id);
    if (i !== undefined) solid.mesh.setColorAt(i, base(id));
  }
  for (const id of view.focusIds) {
    const i = solid.instanceOf.get(id);
    if (i !== undefined) solid.mesh.setColorAt(i, accent);
  }
  for (const id of view.joint) {
    const i = solid.instanceOf.get(id);
    if (i === undefined) continue;
    _tint.copy(view.focusIds.includes(id) ? accent : base(id)).multiplyScalar(JOINT_GAIN);
    solid.mesh.setColorAt(i, _tint);
  }
  return { solid: nSolid, ghost: nGhost };
}

/** Count of instances drawn by a batch (for the debug overlay and tests). */
export function visibleCount(s: BatchedSkeleton): number {
  if (!s.mesh.visible) return 0;
  let n = 0;
  for (let i = 0; i < s.boneIds.length; i++) if (s.mesh.getVisibleAt(i)) n++;
  return n;
}
