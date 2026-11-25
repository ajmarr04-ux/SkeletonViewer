// Runs every lazy layer's tree builder (M12 plan decision 10), in the roots'
// sidebar order, at build time (scripts/lib/soft-tree-data.ts). The builder
// comes from the layer's `TreeSpec`; nothing here names a layer or kind.
import { REGISTRY } from "../systems/registry";
import type { LayerDescriptor, TreeSpec } from "../systems/types";
import { byJoint } from "./byJoint";
import { byKind } from "./byKind";
import { leaves, type TreeInputs } from "./leaves";
import { regionCompartment } from "./regionCompartment";
import type { SoftSet, SoftTreeData, SoftTreeNode } from "./types";

type RootSpec = Exclude<TreeSpec, { builder: "hierarchy" }>;
const hasRoot = (l: LayerDescriptor): l is LayerDescriptor & { tree: RootSpec } => !!l.tree && l.tree.builder !== "hierarchy";

/** Every lazy layer's root, built; `sets` (synonym groups with members, left IDs) join the root whose spec holds them, right twins added. */
export function buildSoftTrees(inp: TreeInputs, sets: readonly SoftSet[] = [], registry: readonly LayerDescriptor[] = REGISTRY): SoftTreeData {
  const l = leaves(inp);
  const layers = registry.filter(hasRoot).sort((a, b) => a.tree.root.order - b.tree.root.order);
  const roots = layers.map((layer): SoftTreeNode => {
    const spec = layer.tree;
    switch (spec.builder) {
      case "regionCompartment":
        return regionCompartment(spec, layer.id, layer.kinds.find((k) => k.parentOf)?.parentOf?.childKind, inp, l);
      case "byJoint":
        return byJoint(spec, layer.id, inp, l);
      case "byKind":
        return byKind(spec, layer.id, inp, l);
    }
  });
  const setsRoot = layers.find((x) => x.tree.builder === "regionCompartment" && x.tree.sets)?.id;
  return { roots, sets: setsRoot === undefined ? [] : sets.map((s) => ({ key: s.key, label: s.label, members: s.members.flatMap((m) => l.pair(m)), root: setsRoot })) };
}
