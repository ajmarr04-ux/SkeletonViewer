// Groups (Milestone 5, plan decision 5): every inner node of
// content/hierarchy.json, plus the eager layer's type groups (the tooth types,
// "Molars, upper and lower"), built by the `hierarchy` tree builder from the
// eager layer's `TreeSpec` (M12 plan decision 10). A group can be isolated as a
// whole from the tree, the legend, or a `grp=` link. Labels only: no anatomy is
// added here (spec §12).

import hierarchy from "../../content/hierarchy.json";
import ids from "../../content/ids.json";
import { groupTrail } from "./labels";
import { displayName } from "./names";
import { EAGER_TREE, NESTED_LAYER, TREE_ROOTS, type LazyLayerId } from "../systems/registry";
import { hierarchyGroups, hierarchyParents, type HierarchyNode } from "../tree/hierarchy";
import { isSoftNode, nodeMembers, type SoftTreeData, type SoftTreeNode } from "../tree/types";
import { softContentOf } from "./softContentLoader";
import { softEntry } from "./softRegistry";

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

const ROOTS = hierarchy as HierarchyNode[];
const NO_TREE = { builder: "hierarchy", qualifiers: [], skipInNames: [] } as const;

/** The eager layer's type groups (the tooth types): key → tree label, in order. */
export const TYPE_GROUPS: readonly { key: string; label: string; parent: string }[] =
  EAGER_TREE?.typeGroups?.groups.map((g) => ({ key: g.key, label: g.label, parent: EAGER_TREE!.typeGroups!.parent })) ?? [];

export const GROUPS: ReadonlyMap<string, Group> = hierarchyGroups(EAGER_TREE ?? NO_TREE, ROOTS, ENTRIES, groupTrail);

/** `grp=attached:<bone>` (M9 plan decision 10). */
export const ATTACHED_PREFIX = "attached:";
export const attachedKey = (bone: string): string => `${ATTACHED_PREFIX}${bone}`;
/** The bone of an `attached:<bone>` key (a bone or tooth in ids.json), else null. */
export function attachedBoneOf(key: string): string | null {
  if (!key.startsWith(ATTACHED_PREFIX)) return null;
  const bone = key.slice(ATTACHED_PREFIX.length);
  return BY_ID.has(bone) ? bone : null;
}

/**
 * The muscles and parts attached to a structure (spec §5.4: "Show attached
 * muscles"), as declared in their origins and insertions (the nested layer's
 * `derived.attached`); null until that layer's content has loaded.
 */
export function attachedTo(structure: string): { origins: readonly string[]; insertions: readonly string[] } | null {
  const c = softContentOf(NESTED_LAYER);
  if (!c) return null;
  return c.derived?.attached[structure] ?? { origins: [], insertions: [] };
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
/** Soft structures with something drawn (from the soft tree's chunk). */
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
  for (const s of data.sets) {
    const root = TREE_ROOTS.find((r) => r.key === s.root);
    if (root) SOFT_GROUPS.set(s.key, { key: s.key, label: s.label, name: s.label, trail: [root.label, s.label], members: s.members, parent: root.key, layer: root.key });
  }
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

const PARENT_OF_LEAF = hierarchyParents(ROOTS);

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
