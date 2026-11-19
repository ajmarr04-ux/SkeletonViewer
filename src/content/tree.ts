// The sidebar's tree (plan step 2): content/hierarchy.json as rows, plus the
// tooth-type groups under Teeth ("All molars"). Pure: which rows are visible
// for a set of open groups, and where each tree key goes (WAI-ARIA tree
// pattern). The component is src/ui/Sidebar.tsx.

import hierarchy from "../../content/hierarchy.json";
import { GROUPS, TOOTH_TYPE_GROUPS } from "./groups";
import { displayName } from "./names";
import type { HierarchyNode } from "./schema";

/**
 * - `group`: an inner node; opens and closes, and can be isolated;
 * - `type`: a tooth-type group ("All molars"); no children shown, can be isolated;
 * - `leaf`: an object; selecting it is the same as clicking the bone.
 */
export type RowKind = "group" | "type" | "leaf";

export type TreeRow = {
  /** Group key, or the object's ID for a leaf. */
  key: string;
  kind: RowKind;
  label: string;
  /** 1 for the top level (aria-level). */
  level: number;
  parent: string | null;
  /** Position among its siblings, from 1, and their number (aria-posinset / aria-setsize). */
  pos: number;
  size: number;
  /** Members, for groups (all of them, wisdom teeth included). */
  count: number;
};

type Node = { row: Omit<TreeRow, "pos" | "size">; children: Node[] };

function build(): Node[] {
  const make = (n: HierarchyNode | string, level: number, parent: string | null): Node => {
    if (typeof n === "string") return { row: { key: n, kind: "leaf", label: displayName(n), level, parent, count: 0 }, children: [] };
    const g = GROUPS.get(n.key)!;
    const children = n.children.map((c) => make(c, level + 1, n.key));
    if (n.key === "dentition")
      for (const [key, label] of TOOTH_TYPE_GROUPS)
        children.push({ row: { key, kind: "type", label, level: level + 1, parent: n.key, count: GROUPS.get(key)!.members.length }, children: [] });
    return { row: { key: n.key, kind: "group", label: n.label, level, parent, count: g.members.length }, children };
  };
  return (hierarchy as HierarchyNode[]).map((n) => make(n, 1, null));
}

const ROOTS = build();

/** The keys of the top-level groups. */
export const TOP_KEYS: readonly string[] = ROOTS.map((n) => n.row.key);

/** The rows shown when the groups in `open` are open, in order. */
export function visibleRows(open: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = [];
  const walk = (nodes: Node[]) =>
    nodes.forEach((n, i) => {
      out.push({ ...n.row, pos: i + 1, size: nodes.length });
      if (n.row.kind === "group" && open.has(n.row.key)) walk(n.children);
    });
  walk(ROOTS);
  return out;
}

export type TreeMove =
  | { kind: "focus"; key: string }
  | { kind: "open"; key: string }
  | { kind: "close"; key: string }
  | { kind: "openSiblings"; keys: string[] }
  | { kind: "none" };

/**
 * Where a key goes in the tree (WAI-ARIA tree view): Up / Down, Right opens a
 * closed group or moves into an open one, Left closes an open group or moves
 * to the parent, Home / End, `*` opens every sibling group.
 */
export function treeKey(rows: readonly TreeRow[], open: ReadonlySet<string>, current: string, key: string): TreeMove {
  const i = rows.findIndex((r) => r.key === current);
  if (i < 0) return rows[0] ? { kind: "focus", key: rows[0].key } : { kind: "none" };
  const row = rows[i]!;
  const focus = (r: TreeRow | undefined): TreeMove => (r ? { kind: "focus", key: r.key } : { kind: "none" });
  switch (key) {
    case "ArrowDown":
      return focus(rows[i + 1]);
    case "ArrowUp":
      return focus(rows[i - 1]);
    case "Home":
      return focus(rows[0]);
    case "End":
      return focus(rows[rows.length - 1]);
    case "ArrowRight":
      if (row.kind !== "group") return { kind: "none" };
      return open.has(row.key) ? focus(rows[i + 1]) : { kind: "open", key: row.key };
    case "ArrowLeft":
      if (row.kind === "group" && open.has(row.key)) return { kind: "close", key: row.key };
      return row.parent ? { kind: "focus", key: row.parent } : { kind: "none" };
    case "*":
      return { kind: "openSiblings", keys: rows.filter((r) => r.parent === row.parent && r.kind === "group").map((r) => r.key) };
    default:
      return { kind: "none" };
  }
}

/**
 * Type-ahead: the next row after `current` (wrapping) whose label starts with
 * `prefix`. With `fromCurrent` (a longer prefix being typed) the current row counts too.
 */
export function typeAhead(rows: readonly TreeRow[], current: string, prefix: string, fromCurrent = false): string | null {
  const p = prefix.toLowerCase();
  const i = rows.findIndex((r) => r.key === current);
  for (let k = fromCurrent ? 0 : 1; k <= rows.length; k++) {
    const r = rows[(i + k) % rows.length]!;
    if (r.label.toLowerCase().startsWith(p)) return r.key;
  }
  return null;
}
