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

export type Tier = 0 | 1 | 2;
export type Isolation = { sel: string | null; tier: Tier; grp: string | null };

export const FULL_SKELETON: Isolation = { sel: null, tier: 0, grp: null };

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

/** Depth of a state: 0 for the full skeleton, 1 for tier 0 or a group, 2 for tier 1, 3 for tier 2. */
export function levelOf(s: Isolation): number {
  if (s.sel === null) return s.grp === null ? 0 : 1;
  return s.tier + 1;
}

export function isolationStep(s: Isolation, a: IsolationAction): { state: Isolation; history: HistoryStep } {
  switch (a.type) {
    case "select": {
      if (s.sel === a.id) return { state: s, history: "none" };
      const state: Isolation = { sel: a.id, tier: 0, grp: null };
      if (s.sel === null) return { state, history: "push" };
      // A switch of focus at tier 0 stays at that level; from tier 1 or 2 it is a new focus at tier 0 (a new entry).
      return { state, history: s.tier === 0 ? "replace" : "push" };
    }
    case "switchSide":
      // The same level on the other side (plan decision 8): replace the entry.
      if (s.sel === null) return isolationStep(s, { type: "select", id: a.id });
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
      if (s.tier === 0) return { state: FULL_SKELETON, history: "pop" };
      return { state: { sel: s.sel, tier: (s.tier - 1) as Tier, grp: null }, history: "pop" };
  }
}
