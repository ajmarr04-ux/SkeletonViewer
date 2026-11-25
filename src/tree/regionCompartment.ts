// Builder `regionCompartment` (M12 plan decision 10): a hierarchy file of
// nodes and structure IDs (left or midline), both sides listed, parts under
// their structure. A part with no parent (it serves several: the linea alba)
// goes where the first structure it serves is.
import type { RegionCompartmentTreeSpec } from "../systems/types";
import type { Leaves, TreeInputs } from "./leaves";
import type { SoftTreeItem, SoftTreeNode } from "./types";

type HierarchyNode = { key: string; label: string; children: (HierarchyNode | string)[] };

export function regionCompartment(spec: RegionCompartmentTreeSpec, layer: string, childKind: string | undefined, inp: TreeInputs, l: Leaves): SoftTreeNode {
  const orphans = new Map<string, string[]>();
  for (const e of inp.entries) {
    if (e.layer !== layer || e.kind !== childKind || e.parent || e.side === "right") continue;
    const first = e.alsoServes?.[0]?.replace(/_right$/, "_left");
    if (first) orphans.set(first, [...(orphans.get(first) ?? []), e.id]);
  }
  const node = (n: HierarchyNode, path: string): SoftTreeNode => {
    const key = `${path}.${n.key}`;
    const children: SoftTreeItem[] = [];
    for (const c of n.children) {
      if (typeof c !== "string") children.push(node(c, key));
      else if (l.byId.has(c)) children.push(...l.pair(c).map(l.leaf));
    }
    for (const c of n.children) if (typeof c === "string") for (const o of orphans.get(c) ?? []) children.push(...l.pair(o).map(l.leaf));
    const inner = n.children.some((c) => typeof c !== "string");
    return { key, label: n.label, name: inner ? spec.innerName(n.label) : n.label, children };
  };
  const top = inp.readJson(spec.file) as HierarchyNode[];
  return { key: layer, label: spec.root.label, name: spec.root.name, children: top.map((n) => node(n, layer)) };
}
