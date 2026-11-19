// Write content/hierarchy.json (spec §5) from the group paths in content/ids.json.
//   npx tsx scripts/content/build-hierarchy.ts     (npm run content:hierarchy)
// Axial → skull (cranial, facial, ossicles, hyoid), vertebral column, thorax;
// appendicular → pectoral girdle, upper limbs, pelvic girdle, lower limbs (each
// limb split into left and right); dentition → upper/lower → left/right → type.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { GROUP_LABELS } from "../../src/content/labels";
import type { HierarchyNode } from "../../src/content/schema";
import { readIds, root } from "../lib/content-files";

const EXTRA: Record<string, string> = {
  axial: "Axial skeleton",
  appendicular: "Appendicular skeleton",
  upper_limb: "Upper limbs",
  lower_limb: "Lower limbs",
  upper: "Upper",
  lower: "Lower",
  left: "Left",
  right: "Right",
};
const label = (seg: string) => EXTRA[seg] ?? GROUP_LABELS[seg] ?? seg;

const roots: HierarchyNode[] = [];
for (const e of readIds()) {
  const path = [...e.group];
  // Limbs: split by side under "Upper limbs" / "Lower limbs".
  if (path[0] === "appendicular" && (path[1] === "upper_limb" || path[1] === "lower_limb")) path.splice(2, 0, e.side);
  let children: (HierarchyNode | string)[] = roots;
  path.forEach((seg, i) => {
    const key = path.slice(0, i + 1).join(".");
    let node = children.find((c): c is HierarchyNode => typeof c !== "string" && c.key === key);
    if (!node) children.push((node = { key, label: label(seg), children: [] }));
    children = node.children;
  });
  children.push(e.id);
}
const order = ["axial", "appendicular", "dentition"];
roots.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
writeFileSync(join(root, "content/hierarchy.json"), JSON.stringify(roots, null, 1) + "\n");
console.log(`content:hierarchy: ${roots.length} top-level groups written`);
