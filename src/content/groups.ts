// Groups (Milestone 5, plan decision 5): every inner node of
// content/hierarchy.json, plus one group per tooth type across all four
// quadrants ("Molars, upper and lower"). A group can be isolated as a whole
// from the tree, the legend, or a `grp=` link. Labels only: no anatomy is
// added here (spec §12).

import hierarchy from "../../content/hierarchy.json";
import ids from "../../content/ids.json";
import { groupTrail } from "./labels";
import type { HierarchyNode } from "./schema";

export type Group = {
  key: string;
  /** The tree's label ("Molars", "Left"). */
  label: string;
  /** A name that stands on its own ("Molars, upper right", "Carpals, left"). */
  name: string;
  /** Breadcrumb under "Skeleton" ("Teeth › Upper right › Molars"). */
  trail: string[];
  /** Every object in the group, in tree order (wisdom teeth included). */
  members: string[];
  parent: string | null;
};

type IdEntry = { id: string; group: string[]; kind: string; meshAvailable: boolean };
const ENTRIES = ids as IdEntry[];

/** Labels that only qualify their parent ("Left", "Upper"), so a group's name joins them on. */
const QUALIFIERS = new Set(["left", "right", "upper", "lower"]);
const SKIPPED = new Set(["axial", "appendicular"]);

/** The tooth-type groups: key → [tree label, name, last group segment]. */
export const TOOTH_TYPE_GROUPS = [
  ["dentition.type.incisors", "All incisors", "Incisors, upper and lower", "incisors"],
  ["dentition.type.canines", "All canines", "Canines, upper and lower", "canines"],
  ["dentition.type.premolars", "All premolars", "Premolars, upper and lower", "premolars"],
  ["dentition.type.molars", "All molars", "Molars, upper and lower", "molars"],
] as const;

function nameOf(labels: string[]): string {
  const base: string[] = [];
  const qual: string[] = [];
  for (const l of labels) (QUALIFIERS.has(l.toLowerCase()) ? qual : base).push(l);
  const head = base[base.length - 1] ?? labels[labels.length - 1] ?? "";
  return qual.length ? `${head}, ${qual.map((q) => q.toLowerCase()).join(" ")}` : head;
}

function build(): Map<string, Group> {
  const out = new Map<string, Group>();
  const walk = (n: HierarchyNode, parent: string | null, labels: string[]): string[] => {
    const here = SKIPPED.has(n.key) ? labels : [...labels, n.label];
    const members: string[] = [];
    const trail = groupTrail(n.key.split("."));
    const g: Group = { key: n.key, label: n.label, name: nameOf(here.length ? here : [n.label]), trail: trail.length ? trail : [n.label], members, parent };
    out.set(n.key, g);
    for (const c of n.children) {
      if (typeof c === "string") members.push(c);
      else members.push(...walk(c, n.key, here));
    }
    return members;
  };
  for (const top of hierarchy as HierarchyNode[]) walk(top, null, []);
  for (const [key, label, name, segment] of TOOTH_TYPE_GROUPS) {
    out.set(key, {
      key,
      label,
      name,
      trail: ["Teeth", label],
      members: ENTRIES.filter((e) => e.kind === "tooth" && e.group[e.group.length - 1] === segment).map((e) => e.id),
      parent: "dentition",
    });
  }
  return out;
}

export const GROUPS: ReadonlyMap<string, Group> = build();

export const isGroupKey = (key: string): boolean => GROUPS.has(key);
export const groupOf = (key: string): Group | undefined => GROUPS.get(key);

const MESHED = new Set(ENTRIES.filter((e) => e.meshAvailable).map((e) => e.id));

/** Members with a 3D model, and all members. */
export function groupCounts(key: string): { shown: number; total: number } {
  const g = GROUPS.get(key);
  if (!g) return { shown: 0, total: 0 };
  return { shown: g.members.filter((id) => MESHED.has(id)).length, total: g.members.length };
}

/**
 * What a screen reader hears when a group is isolated (plan decision 5):
 * "Molars, upper and lower: 12 shown, 12 of 16 have a 3D model." With `back`
 * (returning from one of its members) it starts "Back to".
 */
export function groupAnnouncement(key: string, back = false): string {
  const g = GROUPS.get(key);
  if (!g) return "Full skeleton";
  const { shown, total } = groupCounts(key);
  const missing = shown < total ? `, ${shown} of ${total} have a 3D model` : "";
  return `${back ? "Back to " : ""}${g.name}: ${shown} shown${missing}.`;
}

const PARENT_OF_LEAF = new Map<string, string>();
for (const g of GROUPS.values()) {
  if (g.key.startsWith("dentition.type.")) continue;
  const node = (function find(nodes: (HierarchyNode | string)[]): HierarchyNode | undefined {
    for (const n of nodes) {
      if (typeof n === "string") continue;
      if (n.key === g.key) return n;
      const f = find(n.children);
      if (f) return f;
    }
    return undefined;
  })(hierarchy as HierarchyNode[]);
  for (const c of node?.children ?? []) if (typeof c === "string") PARENT_OF_LEAF.set(c, g.key);
}

/** The tree branch an object sits in, top down (group keys); empty for an unknown ID. */
export function ancestorsOf(id: string): string[] {
  const out: string[] = [];
  let k: string | null | undefined = PARENT_OF_LEAF.get(id);
  while (k) {
    out.unshift(k);
    k = GROUPS.get(k)?.parent;
  }
  return out;
}

/** The ancestors of a group, top down, without the group itself. */
export function groupAncestors(key: string): string[] {
  const out: string[] = [];
  let k = GROUPS.get(key)?.parent ?? null;
  while (k) {
    out.unshift(k);
    k = GROUPS.get(k)?.parent ?? null;
  }
  return out;
}

/**
 * Which breadcrumb labels can isolate a group: crumb i links to the group among
 * `ancestors` whose own trail is the first i + 1 crumbs. Null for plain text.
 */
export function crumbGroups(trail: readonly string[], ancestors: readonly string[]): (string | null)[] {
  return trail.map((_, i) => {
    const want = trail.slice(0, i + 1).join("\u0000");
    return ancestors.find((k) => GROUPS.get(k)?.trail.join("\u0000") === want) ?? null;
  });
}
