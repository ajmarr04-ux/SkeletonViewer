// Builder `hierarchy` (M12 plan decision 10; Milestone 5 plan decision 5): the
// eager layer's groups, one per inner node of its hierarchy file, plus the
// spec's type groups under one node ("Molars, upper and lower"). Main chunk:
// the bone tree is there from the first frame. Generic: names no layer or kind.
import type { HierarchyTreeSpec } from "../systems/types";

export type HierarchyNode = { key: string; label: string; children: (HierarchyNode | string)[] };
export type HierarchyEntry = { id: string; kind: string; group: readonly string[] };

export type HierarchyGroup = {
  key: string;
  label: string;
  name: string;
  trail: string[];
  members: string[];
  parent: string | null;
};

/** A group's name from the labels down to it: the last place, then its qualifiers ("Carpals, left"). */
function nameOf(spec: HierarchyTreeSpec, labels: string[]): string {
  const base: string[] = [];
  const qual: string[] = [];
  for (const l of labels) (spec.qualifiers.includes(l.toLowerCase()) ? qual : base).push(l);
  const head = base[base.length - 1] ?? labels[labels.length - 1] ?? "";
  return qual.length ? `${head}, ${qual.map((q) => q.toLowerCase()).join(" ")}` : head;
}

/** Every group of the hierarchy and the type groups, in tree order; `trailOf` is the breadcrumb of a node's key path. */
export function hierarchyGroups(
  spec: HierarchyTreeSpec,
  roots: readonly HierarchyNode[],
  entries: readonly HierarchyEntry[],
  trailOf: (path: string[]) => string[],
): Map<string, HierarchyGroup> {
  const out = new Map<string, HierarchyGroup>();
  const walk = (n: HierarchyNode, parent: string | null, labels: string[]): string[] => {
    const here = spec.skipInNames.includes(n.key) ? labels : [...labels, n.label];
    const members: string[] = [];
    const trail = trailOf(n.key.split("."));
    out.set(n.key, { key: n.key, label: n.label, name: nameOf(spec, here.length ? here : [n.label]), trail: trail.length ? trail : [n.label], members, parent });
    for (const c of n.children) {
      if (typeof c === "string") members.push(c);
      else members.push(...walk(c, n.key, here));
    }
    return members;
  };
  for (const top of roots) walk(top, null, []);
  const t = spec.typeGroups;
  if (t) {
    const under = out.get(t.parent);
    for (const g of t.groups)
      out.set(g.key, {
        key: g.key,
        label: g.label,
        name: g.name,
        trail: [...(under?.trail ?? []), g.label],
        members: entries.filter((e) => e.kind === t.kind && e.group[e.group.length - 1] === g.segment).map((e) => e.id),
        parent: t.parent,
      });
  }
  return out;
}

/** Leaf → the node it is listed under (type groups aside). */
export function hierarchyParents(roots: readonly HierarchyNode[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (n: HierarchyNode) => {
    for (const c of n.children) {
      if (typeof c === "string") out.set(c, n.key);
      else walk(c);
    }
  };
  roots.forEach(walk);
  return out;
}
