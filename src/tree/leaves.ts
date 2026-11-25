// Shared by the lazy layers' tree builders: leaves (with their parts), left/right
// pairs and labels. Generic: names no layer or kind.
import type { SoftTreeLeaf } from "./types";

/** One row of the lazy layers' ID table (content/soft-ids.json and its like), as the builders read it. */
export type TreeEntry = {
  id: string;
  name: string;
  kind: string;
  layer: string;
  side: "left" | "right" | "midline";
  meshAvailable: boolean;
  parent?: string | null;
  parts?: string[];
  alsoServes?: string[];
};

export type FunctionalJoint = { id: string; name: string; articulations: string[] };

/** What every builder may read (scripts/lib/soft-tree-data.ts reads it from disk). */
export type TreeInputs = {
  /** Every lazy layer's entries, in table order. */
  entries: readonly TreeEntry[];
  /** A repo file (the specs name their hierarchy files). */
  readJson(path: string): unknown;
  /** A structure's front-matter field (null when unwritten or absent). */
  field(id: string, name: string): unknown;
  functionalJoints: readonly FunctionalJoint[];
  /** Joint ID → name (articulation pairs and functional joints, as the panel's). */
  jointNames: Readonly<Record<string, string>>;
};

export const sideOf = (id: string): "left" | "right" | null => (id.endsWith("_left") ? "left" : id.endsWith("_right") ? "right" : null);
export const withSide = (name: string, side: string | null): string => (side === null || side === "midline" ? name : `${name} (${side})`);
export const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
const words = (id: string): string => {
  const s = id.replace(/_(left|right)$/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "Long head of triceps brachii" under "Triceps brachii" → "Long head" (as the breadcrumb's part crumb). */
function partLabel(name: string, parent: string): string {
  const tail = ` of ${parent}`;
  return name.toLowerCase().endsWith(tail.toLowerCase()) && name.length > tail.length ? name.slice(0, -tail.length) : name;
}

export type Leaves = {
  byId: ReadonlyMap<string, TreeEntry>;
  leaf(id: string): SoftTreeLeaf;
  /** A left ID and its right twin (if the table has it); a midline ID alone. */
  pair(id: string): string[];
  /** Table order. */
  byTable(a: string, b: string): number;
  /** A joint's label with its side ("Knee joint (left)"). */
  jointLabel(j: string): string;
};

export function leaves(inp: TreeInputs): Leaves {
  const byId = new Map(inp.entries.map((e) => [e.id, e]));
  const order = new Map(inp.entries.map((e, i) => [e.id, i]));
  const leaf = (id: string): SoftTreeLeaf => {
    const e = byId.get(id)!;
    const parts = (e.parts ?? []).filter((p) => byId.has(p)).map((p) => {
      const pe = byId.get(p)!;
      return { id: p, label: partLabel(pe.name, e.name), drawn: pe.meshAvailable };
    });
    const out: SoftTreeLeaf = { id, label: withSide(e.name, e.side), drawn: e.meshAvailable || parts.some((p) => p.drawn) };
    if (parts.length) out.parts = parts;
    return out;
  };
  const pair = (id: string): string[] => {
    const right = id.endsWith("_left") ? id.replace(/_left$/, "_right") : null;
    return right && byId.get(right)?.side === "right" ? [id, right] : [id];
  };
  return {
    byId,
    leaf,
    pair,
    byTable: (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
    jointLabel: (j) => withSide(inp.jointNames[j] ?? words(j), sideOf(j)),
  };
}
