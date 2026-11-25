// Builder `byKind` (M12 plan decision 10): kind (in the spec's order) → joint,
// from each structure's joint field; a joint with one structure needs no level
// of its own.
import type { ByKindTreeSpec } from "../systems/types";
import type { Leaves, TreeInputs } from "./leaves";
import type { SoftTreeItem, SoftTreeNode } from "./types";

export function byKind(spec: ByKindTreeSpec, layer: string, inp: TreeInputs, l: Leaves): SoftTreeNode {
  const out: SoftTreeNode[] = [];
  const jointOf = (id: string) => (inp.field(id, spec.field) as string | null | undefined) ?? null;
  for (const { kind, label: kindLabel } of spec.kinds) {
    const ids = inp.entries.filter((e) => e.layer === layer && e.kind === kind).map((e) => e.id);
    if (!ids.length) continue;
    const key = `${layer}.${kind}`;
    const byJ = new Map<string, string[]>();
    for (const id of ids) {
      const j = jointOf(id);
      if (j) byJ.set(j, [...(byJ.get(j) ?? []), id]);
    }
    const children: SoftTreeItem[] = [];
    const done = new Set<string>();
    for (const id of ids) {
      if (done.has(id)) continue;
      const j = jointOf(id);
      const group = j ? byJ.get(j)! : [id];
      if (group.length === 1) children.push(l.leaf(id));
      else {
        const jl = l.jointLabel(j!);
        children.push({ key: `${key}.${j}`, label: jl, name: spec.nodeName(kindLabel, jl), children: group.map(l.leaf) });
      }
      group.forEach((g) => done.add(g));
    }
    out.push({ key, label: kindLabel, name: kindLabel, children });
  }
  return { key: layer, label: spec.root.label, name: spec.root.name, children: out };
}
