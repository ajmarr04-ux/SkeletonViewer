// The sidebar's soft-tissue roots (M9 plan decision 11, spec §7): Muscles
// (region → compartment → muscle → parts, from content/muscle-hierarchy.json),
// Ligaments (by functional joint, then pair joint; no joint → "Other
// ligaments") and Cartilage (by kind, then joint). Built at build time from the
// files on disk (`virtual:skeleton-soft-tree`, scripts/lib/content-plugin.ts)
// and shipped as one small lazy chunk, loaded the first time a soft root is
// opened (or a soft group is needed). Pure: Vitest builds it from the files.
//
// Group keys are the layer, then the path of keys: `muscles`,
// `muscles.upper_limb.shoulder.rotator_cuff`, `ligaments.elbow_joint_left`,
// `ligaments.knee_joint_left`, `cartilage.meniscus.knee_joint_left`. Labels
// only: no anatomy is added here (spec §12).

export type SoftTreeLeaf = {
  id: string;
  label: string;
  /** Something is drawn for it: its own mesh, or (a muscle with parts) its parts'. */
  drawn: boolean;
  /** A muscle's parts, in table order. */
  parts?: SoftTreeLeaf[];
};

export type SoftTreeNode = {
  key: string;
  /** The tree's label ("Rotator cuff", "Elbow joint (left)"). */
  label: string;
  /** A name that stands on its own ("Muscles of the shoulder", "Ligaments of the elbow joint (left)"). */
  name: string;
  children: SoftTreeItem[];
};

export type SoftTreeItem = SoftTreeNode | SoftTreeLeaf;
export const isSoftNode = (i: SoftTreeItem): i is SoftTreeNode => "key" in i;

/** A group that isn't a tree node: a group synonym's own set ("Quadriceps femoris"), from content/synonyms.json. */
export type SoftSet = { key: string; label: string; members: string[] };

export type SoftTreeData = { roots: SoftTreeNode[]; sets: SoftSet[] };

export const SOFT_ROOTS = [
  { key: "muscles", label: "Muscles", name: "All muscles" },
  { key: "ligaments", label: "Ligaments", name: "All ligaments" },
  { key: "cartilage", label: "Cartilage", name: "All cartilage" },
] as const;
export type SoftRootKey = (typeof SOFT_ROOTS)[number]["key"];

/** Is this a soft-tissue group key (by its form; whether it exists is known once the tree is loaded)? */
export const looksLikeSoftGroup = (key: string): boolean => /^(muscles|ligaments|cartilage)(\.[a-z0-9_]+)*$/.test(key);

/** Cartilage kinds, in tree order, with their labels. */
export const CARTILAGE_KINDS = [
  ["cartilage", "Cartilage and labra"],
  ["disc", "Discs"],
  ["meniscus", "Menisci and articular discs"],
] as const;

type RawSoft = {
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
type MuscleNode = { key: string; label: string; children: (MuscleNode | string)[] };
type FunctionalJoint = { id: string; name: string; articulations: string[] };

export type SoftTreeInputs = {
  softIds: readonly RawSoft[];
  muscleHierarchy: readonly MuscleNode[];
  /** Each ligament's and cartilage's `joint` from its content file (null: none). */
  jointOf: Readonly<Record<string, string | null>>;
  functionalJoints: readonly FunctionalJoint[];
  /** Joint ID → name (articulations.json and joints.json, as the panel's `joints`). */
  jointNames: Readonly<Record<string, string>>;
  /** Group synonyms that define their own set (content/synonyms.json `groups`, entries with `members`). */
  sets?: readonly SoftSet[];
};

const sideOf = (id: string): "left" | "right" | null => (id.endsWith("_left") ? "left" : id.endsWith("_right") ? "right" : null);
const withSide = (name: string, side: string | null): string => (side === null || side === "midline" ? name : `${name} (${side})`);
const words = (id: string): string => {
  const s = id.replace(/_(left|right)$/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "Long head of triceps brachii" under "Triceps brachii" → "Long head" (as the breadcrumb's part crumb). */
function partLabel(name: string, muscle: string): string {
  const tail = ` of ${muscle}`;
  return name.toLowerCase().endsWith(tail.toLowerCase()) && name.length > tail.length ? name.slice(0, -tail.length) : name;
}

export function buildSoftTree(inp: SoftTreeInputs): SoftTreeData {
  const byId = new Map(inp.softIds.map((e) => [e.id, e]));
  const order = new Map(inp.softIds.map((e, i) => [e.id, i]));
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
  /** A left ID and its right twin (if the table has it); a midline ID alone. */
  const pair = (id: string): string[] => {
    const right = id.endsWith("_left") ? id.replace(/_left$/, "_right") : null;
    return right && byId.get(right)?.side === "right" ? [id, right] : [id];
  };

  // --- Muscles: the hierarchy, both sides, parts under their muscle; a part with no muscle
  // (linea alba) goes where the first muscle it serves is.
  const orphans = new Map<string, string[]>();
  for (const e of inp.softIds) {
    if (e.kind !== "muscle_part" || e.parent || e.side === "right") continue;
    const first = e.alsoServes?.[0]?.replace(/_right$/, "_left");
    if (first) orphans.set(first, [...(orphans.get(first) ?? []), e.id]);
  }
  const muscleNode = (n: MuscleNode, path: string, labels: string[]): SoftTreeNode => {
    const key = `${path}.${n.key}`;
    const children: SoftTreeItem[] = [];
    for (const c of n.children) {
      if (typeof c !== "string") children.push(muscleNode(c, key, [...labels, n.label]));
      else if (byId.has(c)) children.push(...pair(c).map(leaf));
    }
    for (const c of n.children) if (typeof c === "string") for (const o of orphans.get(c) ?? []) children.push(...pair(o).map(leaf));
    const inner = n.children.some((c) => typeof c !== "string");
    return { key, label: n.label, name: inner ? `Muscles of the ${n.label.toLowerCase()}` : n.label, children };
  };
  const muscles: SoftTreeNode = { ...SOFT_ROOTS[0], children: inp.muscleHierarchy.map((n) => muscleNode(n, "muscles", [])) };

  // --- Ligaments: functional joint → pair joint. A pair joint in more than one functional
  // joint goes under the smallest (the PIP joints are in "PIP joints 2–5" and "Interphalangeal joints").
  const fjOf = new Map<string, FunctionalJoint>();
  for (const fj of [...inp.functionalJoints].sort((a, b) => a.articulations.length - b.articulations.length))
    for (const a of fj.articulations) if (!fjOf.has(a)) fjOf.set(a, fj);
  const fjIds = new Set(inp.functionalJoints.map((j) => j.id));
  const jointLabel = (j: string): string => withSide(inp.jointNames[j] ?? words(j), sideOf(j));
  const byTable = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);

  const ligamentIds = inp.softIds.filter((e) => e.layer === "ligaments").map((e) => e.id);
  const top = new Map<string, { direct: string[]; pairs: Map<string, string[]> }>();
  const other: string[] = [];
  for (const id of ligamentIds) {
    const j = inp.jointOf[id] ?? null;
    if (j === null) {
      other.push(id);
      continue;
    }
    const fj = fjIds.has(j) ? j : (fjOf.get(j)?.id ?? null);
    const head = fj ?? j;
    const t = top.get(head) ?? { direct: [] as string[], pairs: new Map<string, string[]>() };
    top.set(head, t);
    if (fj === null || fj === j) t.direct.push(id);
    else t.pairs.set(j, [...(t.pairs.get(j) ?? []), id]);
  }
  const ligamentChildren: SoftTreeItem[] = [...top.entries()]
    .map(([head, t]): SoftTreeNode => {
      const key = `ligaments.${head}`;
      const label = jointLabel(head);
      // A pair joint with one ligament needs no level of its own.
      const items: { at: string; item: SoftTreeItem }[] = t.direct.map((id) => ({ at: id, item: leaf(id) }));
      for (const [pj, ids] of t.pairs) {
        ids.sort(byTable);
        if (ids.length === 1) items.push({ at: ids[0]!, item: leaf(ids[0]!) });
        else {
          const l = jointLabel(pj);
          items.push({ at: ids[0]!, item: { key: `${key}.${pj}`, label: l, name: `Ligaments of the ${lower(l)}`, children: ids.map(leaf) } });
        }
      }
      items.sort((a, b) => byTable(a.at, b.at));
      return { key, label, name: `Ligaments of the ${lower(label)}`, children: items.map((i) => i.item) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  if (other.length) ligamentChildren.push({ key: "ligaments.other", label: "Other ligaments", name: "Other ligaments", children: other.sort(byTable).map(leaf) });
  const ligaments: SoftTreeNode = { ...SOFT_ROOTS[1], children: ligamentChildren };

  // --- Cartilage: kind → joint; a joint with one structure needs no level of its own.
  const cartilageChildren: SoftTreeNode[] = [];
  for (const [kind, kindLabel] of CARTILAGE_KINDS) {
    const ids = inp.softIds.filter((e) => e.layer === "cartilage" && e.kind === kind).map((e) => e.id);
    if (!ids.length) continue;
    const key = `cartilage.${kind}`;
    const byJoint = new Map<string, string[]>();
    for (const id of ids) {
      const j = inp.jointOf[id];
      if (j) byJoint.set(j, [...(byJoint.get(j) ?? []), id]);
    }
    const children: SoftTreeItem[] = [];
    const done = new Set<string>();
    for (const id of ids) {
      if (done.has(id)) continue;
      const j = inp.jointOf[id];
      const group = j ? byJoint.get(j)! : [id];
      if (group.length === 1) children.push(leaf(id));
      else {
        const l = jointLabel(j!);
        children.push({ key: `${key}.${j}`, label: l, name: `${kindLabel}: ${l}`, children: group.map(leaf) });
      }
      group.forEach((g) => done.add(g));
    }
    cartilageChildren.push({ key, label: kindLabel, name: kindLabel, children });
  }
  const cartilage: SoftTreeNode = { ...SOFT_ROOTS[2], children: cartilageChildren };

  // Sets: members as written (left IDs), plus their right twins.
  const sets = (inp.sets ?? []).map((s) => ({ key: s.key, label: s.label, members: s.members.flatMap((m) => pair(m)) }));
  return { roots: [muscles, ligaments, cartilage], sets };
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Every structure under a node (leaves; a muscle counts once, not its parts), in tree order. */
export function nodeMembers(n: SoftTreeNode): string[] {
  return n.children.flatMap((c) => (isSoftNode(c) ? nodeMembers(c) : [c.id]));
}
