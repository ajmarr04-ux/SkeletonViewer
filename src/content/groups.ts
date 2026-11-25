// Groups (Milestone 5, plan decision 5): every inner node of
// content/hierarchy.json, plus one group per tooth type across all four
// quadrants ("Molars, upper and lower"). A group can be isolated as a whole
// from the tree, the legend, or a `grp=` link. Labels only: no anatomy is
// added here (spec §12).

import hierarchy from "../../content/hierarchy.json";
import ids from "../../content/ids.json";
import { groupTrail } from "./labels";
import { displayName } from "./names";
import type { HierarchyNode } from "./schema";
import { NESTED_LAYER, type LazyLayerId } from "../systems/registry";
import { attachedTo } from "./softRelations";
import { softEntry } from "./softRegistry";
import { SOFT_ROOTS, isSoftNode, nodeMembers, type SoftTreeData, type SoftTreeNode } from "./softTree";

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
  /**
   * "Show attached muscles" (spec §5.4; M9 plan decision 10): the bone and the
   * muscles and parts with an origin or insertion on it. `loading` until the
   * muscles' content has loaded (the members are then the bone alone).
   */
  attached?: { bone: string; origins: readonly string[]; insertions: readonly string[]; loading: boolean };
  /** A soft-tissue group (M9 plan decision 11): the layer its members are drawn in. */
  layer?: LazyLayerId;
};

type IdEntry = { id: string; name: string; group: string[]; kind: string; meshAvailable: boolean };
const ENTRIES = ids as IdEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

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

/** `grp=attached:<bone>` (M9 plan decision 10). */
export const ATTACHED_PREFIX = "attached:";
export const attachedKey = (bone: string): string => `${ATTACHED_PREFIX}${bone}`;
/** The bone of an `attached:<bone>` key (a bone or tooth in ids.json), else null. */
export function attachedBoneOf(key: string): string | null {
  if (!key.startsWith(ATTACHED_PREFIX)) return null;
  const bone = key.slice(ATTACHED_PREFIX.length);
  return BY_ID.has(bone) ? bone : null;
}

/** The attached-muscles group of a bone, built from what the muscles' content declares (once loaded). */
function attachedGroup(key: string, bone: string): Group {
  const e = BY_ID.get(bone)!;
  const a = attachedTo(bone);
  const origins = a?.origins ?? [];
  const insertions = a?.insertions ?? [];
  return {
    key,
    label: "Attached muscles",
    name: `Muscles attached to ${displayName(bone)}`,
    trail: [...groupTrail(e.group), e.name, "Attached muscles"],
    members: [bone, ...new Set([...origins, ...insertions])],
    parent: null,
    attached: { bone, origins, insertions, loading: a === null },
  };
}

// --- Soft-tissue groups (M9 plan decision 11): every inner node of the soft
// tree, plus the group synonyms' own sets. Registered when the soft tree's lazy
// chunk loads (src/content/softTreeLoader.ts); unknown until then.
const SOFT_GROUPS = new Map<string, Group>();
/** Structure → the soft group it sits in (a part → its muscle's group). */
const SOFT_PARENT = new Map<string, string>();
/** Soft structures with something drawn (from the tree, so counts are right before the ID table loads). */
const SOFT_DRAWN = new Set<string>();
let softTreeData: SoftTreeData | null = null;
const softListeners = new Set<() => void>();
let softVersion = 0;

/** Called by the soft tree's lazy chunk. Idempotent. */
export function registerSoftTree(data: SoftTreeData): void {
  if (softTreeData) return;
  softTreeData = data;
  const walk = (n: SoftTreeNode, layer: LazyLayerId, parent: string | null, trail: string[]) => {
    const here = [...trail, n.label];
    SOFT_GROUPS.set(n.key, { key: n.key, label: n.label, name: n.name, trail: here, members: nodeMembers(n), parent, layer });
    for (const c of n.children) {
      if (isSoftNode(c)) walk(c, layer, n.key, here);
      else {
        SOFT_PARENT.set(c.id, n.key);
        if (c.drawn) SOFT_DRAWN.add(c.id);
        for (const p of c.parts ?? []) {
          SOFT_PARENT.set(p.id, n.key);
          if (p.drawn) SOFT_DRAWN.add(p.id);
        }
      }
    }
  };
  data.roots.forEach((r) => walk(r, r.key as LazyLayerId, null, []));
  for (const s of data.sets) SOFT_GROUPS.set(s.key, { key: s.key, label: s.label, name: s.label, trail: [SOFT_ROOTS[0].label, s.label], members: s.members, parent: SOFT_ROOTS[0].key, layer: "muscles" });
  softVersion++;
  softListeners.forEach((l) => l());
}
/** The soft tree once loaded, else null. */
export const softTree = (): SoftTreeData | null => softTreeData;
/** For React (useSyncExternalStore): changes when the soft tree registers. */
export const softTreeVersion = (): number => softVersion;
export function subscribeSoftTree(l: () => void): () => void {
  softListeners.add(l);
  return () => softListeners.delete(l);
}
/** For tests: forget the soft tree. */
export function resetSoftTree(): void {
  softTreeData = null;
  SOFT_GROUPS.clear();
  SOFT_PARENT.clear();
  SOFT_DRAWN.clear();
}
/** The layer a group's members are drawn in, if they need one turned on: a soft group's, or the muscles (the layer with parts) for an attached group. */
export function groupLayer(key: string): LazyLayerId | null {
  if (attachedBoneOf(key) !== null) return NESTED_LAYER;
  return SOFT_GROUPS.get(key)?.layer ?? null;
}

export const isGroupKey = (key: string): boolean => GROUPS.has(key) || SOFT_GROUPS.has(key) || attachedBoneOf(key) !== null;
export function groupOf(key: string): Group | undefined {
  const g = GROUPS.get(key) ?? SOFT_GROUPS.get(key);
  if (g) return g;
  const bone = attachedBoneOf(key);
  return bone === null ? undefined : attachedGroup(key, bone);
}

const MESHED = new Set(ENTRIES.filter((e) => e.meshAvailable).map((e) => e.id));
/** Something is drawn for it: a bone with a mesh, a soft structure with one, or a muscle whose parts have. */
const drawn = (id: string): boolean => {
  if (MESHED.has(id) || SOFT_DRAWN.has(id)) return true;
  const s = softEntry(id);
  return s !== undefined && (s.mesh || (s.parts?.length ?? 0) > 0);
};

/** Members with a 3D model, and all members. */
export function groupCounts(key: string): { shown: number; total: number } {
  const g = groupOf(key);
  if (!g) return { shown: 0, total: 0 };
  return { shown: g.members.filter(drawn).length, total: g.members.length };
}

/**
 * What a screen reader hears when a group is isolated (plan decision 5):
 * "Molars, upper and lower: 12 shown, 12 of 16 have a 3D model." With `back`
 * (returning from one of its members) it starts "Back to". An attached-muscles
 * group is worded by `groupIsolationAnnouncement` (`src/content/announce.ts`).
 */
export function groupAnnouncement(key: string, back = false): string {
  const g = groupOf(key);
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
  let k: string | null | undefined = PARENT_OF_LEAF.get(id) ?? SOFT_PARENT.get(id);
  while (k) {
    out.unshift(k);
    k = groupOf(k)?.parent;
  }
  return out;
}

/** The ancestors of a group, top down, without the group itself. */
export function groupAncestors(key: string): string[] {
  const bone = attachedBoneOf(key);
  if (bone !== null) return ancestorsOf(bone);
  const out: string[] = [];
  let k = groupOf(key)?.parent ?? null;
  while (k) {
    out.unshift(k);
    k = groupOf(k)?.parent ?? null;
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
    return ancestors.find((k) => groupOf(k)?.trail.join("\u0000") === want) ?? null;
  });
}
