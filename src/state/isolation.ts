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

export type Tier = 0 | 1 | 2;
export type Isolation = { sel: string | null; tier: Tier };

export const FULL_SKELETON: Isolation = { sel: null, tier: 0 };

export type IsolationAction =
  | { type: "select"; id: string }
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

/** Depth of a state: 0 for the full skeleton, 1 for tier 0, 2 for tier 1, 3 for tier 2. */
export function levelOf(s: Isolation): number {
  return s.sel === null ? 0 : s.tier + 1;
}

export function isolationStep(s: Isolation, a: IsolationAction): { state: Isolation; history: HistoryStep } {
  switch (a.type) {
    case "select": {
      if (s.sel === a.id) return { state: s, history: "none" };
      const state: Isolation = { sel: a.id, tier: 0 };
      if (s.sel === null) return { state, history: "push" };
      // A switch of focus at tier 0 stays at that level; from tier 1 or 2 it is a new focus at tier 0 (a new entry).
      return { state, history: s.tier === 0 ? "replace" : "push" };
    }
    case "switchSide":
      // The same level on the other side (plan decision 8): replace the entry.
      if (s.sel === null) return isolationStep(s, { type: "select", id: a.id });
      if (s.sel === a.id) return { state: s, history: "none" };
      return { state: { sel: a.id, tier: s.tier }, history: "replace" };
    case "related":
      if (s.sel === null || s.tier !== 0) return { state: s, history: "none" };
      return { state: { sel: s.sel, tier: 1 }, history: "push" };
    case "region":
      if (s.sel === null || s.tier !== 1) return { state: s, history: "none" };
      return { state: { sel: s.sel, tier: 2 }, history: "push" };
    case "back":
      if (s.sel === null) return { state: s, history: "none" };
      if (s.tier === 0) return { state: FULL_SKELETON, history: "pop" };
      return { state: { sel: s.sel, tier: (s.tier - 1) as Tier }, history: "pop" };
  }
}
