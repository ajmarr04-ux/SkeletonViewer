// The sidebar's tree (plan step 2): content/hierarchy.json as rows, plus the
// tooth-type groups under Teeth ("All molars"), then the soft-tissue roots
// Muscles, Ligaments and Cartilage (M9 plan decision 11), whose rows come
// from the soft tree's lazy chunk once it has loaded. Pure: which rows are
// visible for a set of open groups, and where each tree key goes (WAI-ARIA
// tree pattern). The component is src/ui/Sidebar.tsx.

import hierarchy from "../../content/hierarchy.json";
import { GROUPS, TOOTH_TYPE_GROUPS, groupOf, softTree } from "./groups";
import { SOFT_ROOTS, isSoftNode, type SoftTreeData, type SoftTreeItem, type SoftTreeLeaf } from "./softTree";
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
  /** Members, for groups (all of them, wisdom teeth included); null for a soft root before its tree loads. */
  count: number | null;
  /**
   * A muscle with parts (M9): a leaf that selects, and also opens to show its parts.
   * Its key is the muscle's ID, so the open set holds it like a group key.
   */
  expandable?: boolean;
  /** Soft-tissue rows: something is drawn for it (bones: the app knows from ids.json). */
  drawn?: boolean;
  /** Soft-tissue rows (M9). */
  soft?: boolean;
};

/** A row that opens and closes: a group, or a muscle with parts. */
export const openable = (r: Pick<TreeRow, "kind" | "expandable">): boolean => r.kind === "group" || r.expandable === true;

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

/** The keys of the top-level bone groups (open at first). */
export const TOP_KEYS: readonly string[] = ROOTS.map((n) => n.row.key);
/** The soft-tissue roots' keys (closed at first: opening one loads the soft tree). */
export const SOFT_ROOT_KEYS: readonly string[] = SOFT_ROOTS.map((r) => r.key);

function softLeaf(l: SoftTreeLeaf, level: number, parent: string): Node {
  const children = (l.parts ?? []).map((p): Node => ({ row: { key: p.id, kind: "leaf", label: p.label, level: level + 1, parent: l.id, count: 0, drawn: p.drawn, soft: true }, children: [] }));
  const row: Node["row"] = { key: l.id, kind: "leaf", label: l.label, level, parent, count: 0, drawn: l.drawn, soft: true };
  if (children.length) row.expandable = true;
  return { row, children };
}
function softItem(i: SoftTreeItem, level: number, parent: string): Node {
  if (!isSoftNode(i)) return softLeaf(i, level, parent);
  return {
    row: { key: i.key, kind: "group", label: i.label, level, parent, count: groupOf(i.key)?.members.length ?? null, soft: true },
    children: i.children.map((c) => softItem(c, level + 1, i.key)),
  };
}
/** The soft roots: the three rows alone until the tree has loaded, then with their children. */
function softRoots(data: SoftTreeData | null): Node[] {
  return SOFT_ROOTS.map((r, i) => {
    const n = data?.roots[i];
    return {
      row: { key: r.key, kind: "group", label: r.label, level: 1, parent: null, count: n ? (groupOf(r.key)?.members.length ?? null) : null, soft: true },
      children: n ? n.children.map((c) => softItem(c, 2, r.key)) : [],
    };
  });
}
let softCache: { data: SoftTreeData | null; nodes: Node[] } = { data: null, nodes: softRoots(null) };
function softNodes(): Node[] {
  const data = softTree();
  if (softCache.data !== data) softCache = { data, nodes: softRoots(data) };
  return softCache.nodes;
}

/** The rows shown when the groups in `open` are open, in order. */
export function visibleRows(open: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = [];
  const walk = (nodes: Node[]) =>
    nodes.forEach((n, i) => {
      out.push({ ...n.row, pos: i + 1, size: nodes.length });
      if (openable(n.row) && open.has(n.row.key)) walk(n.children);
    });
  walk([...ROOTS, ...softNodes()]);
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
      if (!openable(row)) return { kind: "none" };
      return open.has(row.key) ? focus(rows[i + 1]) : { kind: "open", key: row.key };
    case "ArrowLeft":
      if (openable(row) && open.has(row.key)) return { kind: "close", key: row.key };
      return row.parent ? { kind: "focus", key: row.parent } : { kind: "none" };
    case "*":
      return { kind: "openSiblings", keys: rows.filter((r) => r.parent === row.parent && openable(r)).map((r) => r.key) };
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
