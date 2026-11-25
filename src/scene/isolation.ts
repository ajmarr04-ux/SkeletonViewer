// What isolation looks like in the scene (spec §6 Isolation): which bones are
// drawn solid, which are ghosts, and which bone carries the accent colour.
// The view is pure; `applyIsolationView` writes it to the two BatchedMeshes.
// Only visibility and colours change. No geometry moves or reloads (spec §12).

import { Color } from "three";
import idsJson from "../../content/ids.json";
import { groupOf } from "../content/groups";
import { rolesOf, tiers, type TintRoles } from "../content/appGraph";
import type { TintEnd as Role } from "../systems/types";
import type { TintRole } from "./tints";
import type { ColourMode } from "./regionColours";
import type { Tier } from "../state/isolation";
import { type GhostMode, type Layer, type LayerModes, type MuscleDepth } from "../state/url";
import { DEFAULT_MODES, EAGER_LAYER, LAYER_IDS } from "../systems/registry";
import { peeledAt, softEntry, softLayerOf } from "../content/softRegistry";
import type { BatchedSkeleton } from "./batchSkeleton";
import { usePatchBatch } from "./layerRegistry";
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
  /** Structures drawn in a tint instead of their own colour (M9: `withTints`). */
  tints?: ReadonlyMap<string, TintRole>;
  /** Attachment patches wanted (patch ID → role and the structure it lies on); drawn if that structure is (`sceneView`). */
  patches?: ReadonlyMap<string, { role: Role; on: string }>;
  /** Tinted origin that is also an insertion (no patch): gets the insertion-coloured outline too (spec §5.3). */
  both?: readonly string[];
};

export const FULL_VIEW: IsolationView = { isolated: false, focus: null, focusIds: [], solid: null, ghosts: false, joint: [], jointPartner: null };

/** A structure's parts (a muscle with parts), else none. */
export type PartsOf = (id: string) => readonly string[];
const softParts: PartsOf = (id) => softEntry(id)?.parts ?? [];
const softParent = (id: string): string | null => softEntry(id)?.parent ?? null;

const BONES = new Set((idsJson as { id: string }[]).map((e) => e.id));
/** The layer a structure is drawn in: the eager layer for bones (and teeth), its soft-tissue layer, else null. */
const layerOfAny = (id: string): Layer | null => (BONES.has(id) ? EAGER_LAYER : softLayerOf(id));

/**
 * What a selection adds at a tier (not itself), following the layers that are
 * showing (M9 plan decision 3): only structures in a layer that is On or
 * Ghost. The kinds' tier rules over the app's graph (M12 plan decisions 5, 6):
 * a bone gets the bones it articulates with (tier 1) and its region set (tier
 * 2), plus the soft structures related to it or to those bones; a soft
 * structure its own rules. A structure with no tier 2 (a ligament or
 * cartilage with no joint) shows its tier 1 there. With only the bones layer
 * on, a bone's additions are exactly M8's.
 */
/** Only the eager layer showing: a bone's tier 1 is then the bones it articulates with (and a tooth's neighbours), M8's tier 1. */
export const EAGER_ONLY: LayerModes = Object.fromEntries(LAYER_IDS.map((l) => [l, l === EAGER_LAYER ? "on" : "off"])) as LayerModes;

export function relatedAt(id: string, tier: Tier, modes: LayerModes = DEFAULT_MODES): string[] {
  if (tier === 0) return [];
  const engine = tiers();
  return [...(engine.related(id, `t${tier}`, modes) ?? (tier === 2 ? engine.related(id, "t1", modes) : null) ?? [])];
}

/**
 * The view for a selection (spec §6). Tier 0 isolates the selection alone
 * (a muscle as its parts, a part with its siblings); tiers 1 and 2 add
 * `relatedAt`, which follows the layer modes (M9 plan decision 3). Objects
 * without a mesh are left out: a wisdom tooth isolates nothing at tier 0, and
 * at tiers 1 and 2 shows its related bones with no focus. `modes` defaults to
 * only the bones layer on (M8's view).
 */
export function isolationView(
  sel: string | null,
  tier: Tier,
  ghostMode: GhostMode,
  hasMesh: (id: string) => boolean,
  grp: string | null = null,
  partsOf: PartsOf = softParts,
  parentOf: (id: string) => string | null = softParent,
  modes: LayerModes = DEFAULT_MODES,
): IsolationView {
  if (sel === null) return grp === null ? FULL_VIEW : groupView(grp, ghostMode, hasMesh, partsOf);
  // A muscle with parts is drawn as its parts (spec §5.1 rule 1); a selected part keeps its siblings solid,
  // in the muscle colour (rule 2).
  const focusIds = hasMesh(sel) ? [sel] : partsOf(sel).filter(hasMesh);
  const parent = parentOf(sel);
  const siblings = parent === null ? [] : partsOf(parent);
  const solid = new Set([sel, ...relatedAt(sel, tier, modes), ...focusIds, ...siblings].filter(hasMesh));
  if (solid.size === 0) return FULL_VIEW;
  const focus = focusIds.length > 0 ? sel : null;
  return { isolated: true, focus, focusIds, solid, ghosts: ghostMode === "ghost", joint: [], jointPartner: null };
}

/**
 * A group isolation (plan decision 5): its members with a mesh drawn solid,
 * with no focus (normal bone colour, no outline); the rest ghosted or hidden as
 * at tier 0.
 */
export function groupView(grp: string, ghostMode: GhostMode, hasMesh: (id: string) => boolean, partsOf: PartsOf = softParts): IsolationView {
  const g = groupOf(grp);
  // A muscle with parts (an attached-muscles group, M9) is drawn as its parts.
  const solid = new Set((g?.members ?? []).flatMap((id) => (hasMesh(id) ? [id] : partsOf(id).filter(hasMesh))));
  if (solid.size === 0) return FULL_VIEW;
  return { isolated: true, focus: null, focusIds: [], solid, ghosts: ghostMode === "ghost", joint: [], jointPartner: null };
}

/**
 * The view with an articulation highlighted (spec §6, plan decision 9): both
 * bones are drawn solid (a ghost or hidden partner is shown for as long as the
 * highlight lasts) and brighter; the partner gets the joint outline. Objects
 * without a mesh are skipped. Nothing moves.
 */
export function withJoint(view: IsolationView, joint: { a: string; b: string } | null, hasMesh: (id: string) => boolean, partsOf: PartsOf = softParts): IsolationView {
  if (joint === null) return view;
  // The partner may be a muscle with parts (a bone panel's attached-muscle row, M9): its parts are highlighted.
  const partners = hasMesh(joint.b) ? [joint.b] : partsOf(joint.b).filter(hasMesh);
  const bones = [...(hasMesh(joint.a) ? [joint.a] : []), ...partners];
  if (bones.length === 0) return view;
  const solid = view.solid === null ? null : new Set([...view.solid, ...bones]);
  const partner = partners[0] ?? null;
  return { ...view, solid, joint: bones, jointPartner: partner };
}

/**
 * Origins, insertions and antagonists (spec §5.2–5.3; M9 plan decisions 6–8),
 * for a muscle or part at tier 1 or 2. The content decides: the agreeing
 * patches are wanted (drawn where the structure they lie on is drawn); every
 * structure the content names with no agreeing patch is tinted whole, in the
 * origin or insertion colour (one that is both: origin, plus an outline). At
 * tier 2 with `ant`, the antagonists are added solid in their tint (only those
 * in a layer that is showing). The focus is never tinted. Anything else: unchanged.
 */
export function withTints(
  iso: IsolationView,
  sel: string | null,
  tier: Tier,
  ant: boolean,
  hasMesh: (id: string) => boolean,
  modes: LayerModes = DEFAULT_MODES,
  roles: (id: string) => TintRoles | undefined = rolesOf,
  patchesFailed = false,
): IsolationView {
  if (sel === null || tier === 0 || iso.solid === null) return iso;
  const r = roles(sel);
  if (!r) return iso;
  const focus = new Set(iso.focusIds);
  const drawn = (x: string) => iso.solid!.has(x) && !focus.has(x);
  const tints = new Map<string, TintRole>();
  const both: string[] = [];
  // With no patch file, the patches' structures are tinted whole too.
  const whole = (set: TintRoles["o"]) => (patchesFailed ? [...set.f, ...set.p.map(([, on]) => on)] : set.f);
  for (const x of whole(r.o)) if (drawn(x)) tints.set(x, "origin");
  for (const x of whole(r.i)) {
    if (!drawn(x)) continue;
    if (tints.get(x) === "origin") both.push(x);
    else tints.set(x, "insertion");
  }
  const patches = new Map<string, { role: Role; on: string }>();
  if (!patchesFailed) for (const [pid, on] of r.o.p) patches.set(pid, { role: "origin", on });
  if (!patchesFailed) for (const [pid, on] of r.i.p) patches.set(pid, { role: "insertion", on });
  let solid = iso.solid;
  if (tier === 2 && ant) {
    const more = r.ant.filter((x) => !focus.has(x) && hasMesh(x) && isShowing(x, modes));
    if (more.length > 0) {
      solid = new Set([...iso.solid, ...more]);
      for (const x of more) tints.set(x, "antagonist");
    }
  }
  return { ...iso, solid, tints, patches, both };
}

/** Is a structure's layer On or Ghost? */
const isShowing = (x: string, modes: LayerModes): boolean => {
  const l = layerOfAny(x);
  return l !== null && modes[l] !== "off";
};

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
  /** Structures drawn in a tint instead of their own colour (origin, insertion, antagonist). */
  tints: ReadonlyMap<string, TintRole>;
  /** Attachment patches drawn, by role: only those whose structure is drawn solid. */
  patches: ReadonlyMap<string, Role>;
  /** Tinted origins that are also insertions (spec §5.3: plus an outline). */
  both: readonly string[];
};

const NO_IDS: ReadonlySet<string> = new Set();
const NO_TINTS: ReadonlyMap<string, TintRole> = new Map();
const NO_PATCHES: ReadonlyMap<string, Role> = new Map();

/**
 * Combine the isolation with the layer modes and the hidden structures (M7
 * plan decision 6):
 * - nothing isolated: a layer that is On is all solid, Ghost all ghost, Off all hidden;
 * - something isolated: what isolation keeps solid is solid whatever its
 *   layer's mode. Since M9 (plan decision 3) the related sets only take
 *   structures from layers that are On or Ghost (`relatedAt`), so in an Off
 *   layer that is only the focus; related structures in a Ghost layer are
 *   solid, like the focus. The rest is a ghost if its layer is Ghost, or if
 *   the layer is On and isolation ghosts (ghost mode); otherwise hidden.
 * Hidden structures (`hidden`) are never drawn, except the focus itself and the
 * bones of a highlighted joint (see `shownIn`).
 *
 * With only the bones layer on and nothing hidden, the bones' `LayerShow` is
 * exactly M6's view: `solid` as isolation gives it, `rest` ghost or hidden.
 */
export function sceneView(iso: IsolationView, modes: LayerModes, hidden: ReadonlySet<string> = NO_IDS): SceneView {
  const layers = {} as Record<Layer, LayerShow>;
  for (const layer of LAYER_IDS) {
    const mode = modes[layer];
    if (iso.solid === null) {
      layers[layer] = mode === "on" ? { solid: null, rest: "hidden" } : { solid: NO_IDS, rest: mode === "ghost" ? "ghost" : "hidden" };
    } else {
      const rest = mode === "ghost" || (mode === "on" && iso.ghosts) ? "ghost" : "hidden";
      layers[layer] = { solid: iso.solid, rest };
    }
  }
  const view: SceneView = {
    isolated: iso.isolated,
    focus: iso.focus,
    focusIds: iso.focusIds,
    layers,
    hidden,
    joint: iso.joint,
    jointPartner: iso.jointPartner,
    tints: iso.tints ?? NO_TINTS,
    patches: NO_PATCHES,
    both: iso.both ?? [],
  };
  if (iso.patches && iso.patches.size > 0) {
    const patches = new Map<string, Role>();
    for (const [pid, p] of iso.patches) {
      const l = layerOfAny(p.on);
      if (l !== null && shownIn(view, l, p.on) === "solid") patches.set(pid, p.role);
    }
    view.patches = patches;
  }
  return view;
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
    antagonists?: boolean;
    joint: { a: string; b: string } | null;
    layers: LayerModes;
    hidden: ReadonlySet<string>;
    muscleDepth?: MuscleDepth;
  },
  hasMesh: (id: string) => boolean,
  peel: (stop: MuscleDepth) => ReadonlySet<string> = peeledAt,
): SceneView {
  const base = isolationView(st.sel, st.tier, st.ghostMode, hasMesh, st.grp, softParts, softParent, st.layers);
  const tinted = withTints(base, st.sel, st.tier, st.antagonists ?? false, hasMesh, st.layers, rolesOf, usePatchBatch.getState().failed);
  const iso = withJoint(tinted, st.joint, hasMesh);
  return sceneView(iso, st.layers, withPeeled(st.hidden, peel(st.muscleDepth ?? 0)));
}

/**
 * The colour mode the bones are drawn in. Colour-by-region pauses (the bones go
 * back to ivory) while any origin, insertion or antagonist tint or patch is
 * drawn: the tints are Okabe–Ito colours like the regions, and an origin patch
 * on an upper-limb bone (yellow on yellow), an antagonist beside the pectoral
 * girdle or an insertion on a lower-limb bone would not stay apart (M10 plan
 * decision 3, session AL; tests/colourVision.test.ts).
 */
export function drawnColourMode(mode: ColourMode, view: Pick<SceneView, "tints" | "patches">): ColourMode {
  return mode === "region" && (view.tints.size > 0 || view.patches.size > 0) ? "bone" : mode;
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
  applyLayerView(EAGER_LAYER, solid, ghost, sceneView(view, DEFAULT_MODES), previous, base, accentTint);
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
 * colour. With `tint`, structures in `view.tints` get their role's colour (M9);
 * a structure tinted before must be in `previous` to get its colour back.
 * Only visibility and colours change; nothing moves (spec §12).
 */
export function applyLayerView(
  layer: Layer,
  solid: BatchedSkeleton,
  ghost: BatchedSkeleton | null,
  view: SceneView,
  previous: readonly string[],
  base: BaseTint,
  accent: Color,
  tint?: Readonly<Record<TintRole, Color>>,
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
    if (view.focusIds.includes(id) || view.joint.includes(id) || (tint && view.tints.has(id))) continue;
    const i = solid.instanceOf.get(id);
    if (i !== undefined) solid.mesh.setColorAt(i, base(id));
  }
  const own = (id: string): Color => {
    const t = tint && view.tints.get(id);
    return t ? tint[t] : base(id);
  };
  if (tint) {
    for (const [id, role] of view.tints) {
      const i = solid.instanceOf.get(id);
      if (i !== undefined) solid.mesh.setColorAt(i, tint[role]);
    }
  }
  for (const id of view.focusIds) {
    const i = solid.instanceOf.get(id);
    if (i !== undefined) solid.mesh.setColorAt(i, accent);
  }
  for (const id of view.joint) {
    const i = solid.instanceOf.get(id);
    if (i === undefined) continue;
    _tint.copy(view.focusIds.includes(id) ? accent : own(id)).multiplyScalar(JOINT_GAIN);
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
