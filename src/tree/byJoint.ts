// Builder `byJoint` (M12 plan decision 10): functional joint → pair joint, from
// each structure's joint field. A pair joint in more than one functional joint
// goes under the smallest (the PIP joints are in "PIP joints 2–5" and
// "Interphalangeal joints"); a pair joint with one structure needs no level of
// its own; structures without a joint go under the spec's `other` node.
import type { ByJointTreeSpec } from "../systems/types";
import type { FunctionalJoint, Leaves, TreeInputs } from "./leaves";
import type { SoftTreeItem, SoftTreeNode } from "./types";

export function byJoint(spec: ByJointTreeSpec, layer: string, inp: TreeInputs, l: Leaves): SoftTreeNode {
  const fjOf = new Map<string, FunctionalJoint>();
  for (const fj of [...inp.functionalJoints].sort((a, b) => a.articulations.length - b.articulations.length))
    for (const a of fj.articulations) if (!fjOf.has(a)) fjOf.set(a, fj);
  const fjIds = new Set(inp.functionalJoints.map((j) => j.id));

  const top = new Map<string, { direct: string[]; pairs: Map<string, string[]> }>();
  const other: string[] = [];
  for (const e of inp.entries) {
    if (e.layer !== layer) continue;
    const j = (inp.field(e.id, spec.field) as string | null | undefined) ?? null;
    if (j === null) {
      other.push(e.id);
      continue;
    }
    const fj = fjIds.has(j) ? j : (fjOf.get(j)?.id ?? null);
    const head = fj ?? j;
    const t = top.get(head) ?? { direct: [] as string[], pairs: new Map<string, string[]>() };
    top.set(head, t);
    if (fj === null || fj === j) t.direct.push(e.id);
    else t.pairs.set(j, [...(t.pairs.get(j) ?? []), e.id]);
  }
  const children: SoftTreeItem[] = [...top.entries()]
    .map(([head, t]): SoftTreeNode => {
      const key = `${layer}.${head}`;
      const label = l.jointLabel(head);
      const items: { at: string; item: SoftTreeItem }[] = t.direct.map((id) => ({ at: id, item: l.leaf(id) }));
      for (const [pj, ids] of t.pairs) {
        ids.sort(l.byTable);
        if (ids.length === 1) items.push({ at: ids[0]!, item: l.leaf(ids[0]!) });
        else {
          const pl = l.jointLabel(pj);
          items.push({ at: ids[0]!, item: { key: `${key}.${pj}`, label: pl, name: spec.nodeName(pl), children: ids.map(l.leaf) } });
        }
      }
      items.sort((a, b) => l.byTable(a.at, b.at));
      return { key, label, name: spec.nodeName(label), children: items.map((i) => i.item) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  if (other.length) children.push({ key: `${layer}.${spec.other.key}`, label: spec.other.label, name: spec.other.label, children: other.sort(l.byTable).map(l.leaf) });
  return { key: layer, label: spec.root.label, name: spec.root.name, children };
}
