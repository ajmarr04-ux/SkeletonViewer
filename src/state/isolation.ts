// The spec §6 state diagram as a pure reducer. No React, three.js or browser
// history here: the caller turns `history` into pushState / replaceState /
// history.back().
//
//   Full skeleton  ── select ──►  tier 0  ── related ──►  tier 1  ── region ──►  tier 2
//                  ◄── back ────          ◄── back ──────          ◄── back ──────
//
// Clicking another (solid) bone makes it the new focus at tier 0; clicking the
// focus itself changes nothing. Clicking empty space or pressing Esc is `back`.
// The side toggle (`switchSide`) jumps to the other side at the same tier.
//
// Milestone 5 (plan decision 5) adds group isolation: `group` isolates a whole
// group from the tree (a level of its own, like tier 0). Selection and group are
// exclusive: choosing a member of the group makes it the focus at tier 0 (a new
// entry, so Back returns to the group).
//
// Milestone 9 (plan decisions 1 and 2) adds the part level (spec §5.1). A
// muscle part sits one level below its muscle: muscle → its part is a push,
// part → a sibling part a replace, and Back from a part at tier 0 goes to its
// muscle. Selecting a part from anywhere else goes *via* its muscle (the
// caller pushes the muscle's entry first), so browser Back always walks
// part → muscle → wherever you were. The reducer learns parents through
// `parentOf`, so it stays pure; `resolveClick` is the first-click-selects-
// the-whole-muscle rule, applied by the caller to picks only.

export type Tier = 0 | 1 | 2;
export type Isolation = { sel: string | null; tier: Tier; grp: string | null };

export const FULL_SKELETON: Isolation = { sel: null, tier: 0, grp: null };

/** A muscle part's muscle, else null (bones, muscles, ligaments, cartilage). */
export type ParentOf = (id: string) => string | null;
export const NO_PARENT: ParentOf = () => null;

/**
 * What a click (or tap, or Enter on the Tab cursor) on `picked` selects (spec
 * §5.1): a part of a muscle selects the whole muscle, unless that muscle or one
 * of its parts is already the selection, in which case it selects the part.
 * Everything else selects itself. Links, tree rows and search results select
 * exactly what they name and don't come through here.
 */
export function resolveClick(picked: string, sel: string | null, parentOf: ParentOf): string {
  const parent = parentOf(picked);
  if (parent === null) return picked;
  if (sel !== null && (sel === parent || parentOf(sel) === parent)) return picked;
  return parent;
}

export type IsolationAction =
  | { type: "select"; id: string }
  | { type: "group"; key: string }
  | { type: "switchSide"; id: string }
  | { type: "related" }
  | { type: "region" }
  | { type: "back" };

/**
 * What the change does to the browser history:
 * - `push`: a new entry (pushState): a deeper level, or a new focus from tier 1 or 2;
 * - `pop`: one level back (history.back() when the app pushed the entry, else replaceState);
 * - `replace`: same level, different focus (replaceState);
 * - `none`: nothing changed.
 */
export type HistoryStep = "push" | "pop" | "replace" | "none";

/**
 * A step's result. With `via`, the caller first applies `history` to `via`
 * (the selected part's muscle) and then pushes `state` on top of it.
 */
export type IsolationResult = { state: Isolation; history: HistoryStep; via?: Isolation };

/**
 * Depth of a state: 0 for the full skeleton, 1 for tier 0 or a group, 2 for
 * tier 1, 3 for tier 2; a muscle part counts one more than its muscle.
 */
export function levelOf(s: Isolation, parentOf: ParentOf = NO_PARENT): number {
  if (s.sel === null) return s.grp === null ? 0 : 1;
  return s.tier + 1 + (parentOf(s.sel) === null ? 0 : 1);
}

export function isolationStep(s: Isolation, a: IsolationAction, parentOf: ParentOf = NO_PARENT): IsolationResult {
  switch (a.type) {
    case "select": {
      if (s.sel === a.id) return { state: s, history: "none" };
      const state: Isolation = { sel: a.id, tier: 0, grp: null };
      const parent = parentOf(a.id);
      if (parent !== null && s.tier === 0 && s.sel !== null) {
        // Down from the muscle to its part, or across to a sibling part (spec §5.1 rules 2 and 3).
        if (s.sel === parent) return { state, history: "push" };
        if (parentOf(s.sel) === parent) return { state, history: "replace" };
      }
      // Up from a part to its own muscle (a "Part of" link): the same as Back.
      if (s.sel !== null && s.tier === 0 && parentOf(s.sel) === a.id) return { state, history: "pop" };
      const history: HistoryStep = s.sel === null ? "push" : s.tier === 0 ? "replace" : "push";
      // A switch of focus at tier 0 stays at that level; from tier 1 or 2 it is a new focus at tier 0 (a new entry).
      // A part from anywhere else goes via its muscle, so Back walks part → muscle → here.
      if (parent !== null) return { state, history, via: { sel: parent, tier: 0, grp: null } };
      return { state, history };
    }
    case "switchSide":
      // The same level on the other side (plan decision 8): replace the entry.
      if (s.sel === null) return isolationStep(s, { type: "select", id: a.id }, parentOf);
      if (s.sel === a.id) return { state: s, history: "none" };
      return { state: { sel: a.id, tier: s.tier, grp: null }, history: "replace" };
    case "group": {
      if (s.sel === null && s.grp === a.key) return { state: s, history: "none" };
      const state: Isolation = { sel: null, tier: 0, grp: a.key };
      // Another group from a group stays at that level; from anywhere else it is a new entry.
      return { state, history: s.sel === null && s.grp !== null ? "replace" : "push" };
    }
    case "related":
      if (s.sel === null || s.tier !== 0) return { state: s, history: "none" };
      return { state: { sel: s.sel, tier: 1, grp: null }, history: "push" };
    case "region":
      if (s.sel === null || s.tier !== 1) return { state: s, history: "none" };
      return { state: { sel: s.sel, tier: 2, grp: null }, history: "push" };
    case "back":
      if (s.sel === null) return s.grp === null ? { state: s, history: "none" } : { state: FULL_SKELETON, history: "pop" };
      if (s.tier === 0) {
        const parent = parentOf(s.sel);
        return { state: parent === null ? FULL_SKELETON : { sel: parent, tier: 0, grp: null }, history: "pop" };
      }
      return { state: { sel: s.sel, tier: (s.tier - 1) as Tier, grp: null }, history: "pop" };
  }
}
