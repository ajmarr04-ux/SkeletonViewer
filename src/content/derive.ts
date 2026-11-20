// Derived relationships (musculoskeletal spec §4.3, §4.6; M8 plan decision 9):
// synergists and antagonists from the muscles' actions, and each bone's
// attached muscles from their origins and insertions. Pure, so the tests can
// run it on fixtures; the content compiler runs it on the real files.

export type DeriveAttachment = { structure: string; landmark?: string } | { soft: string };
export type DeriveAction = { joint: string; movement: string; role: "prime" | "assist" | "stabiliser" };

/** What derivation needs of one muscle or part's front matter. */
export type DeriveMuscle = {
  kind: "muscle" | "muscle_part";
  parent: string | null;
  parts: string[];
  origin: DeriveAttachment[] | "inherit";
  insertion: DeriveAttachment[] | "inherit";
  actions: DeriveAction[];
  synergistOverrides?: { add: string[]; remove: string[] };
};

export type DeriveInput = {
  muscles: Record<string, DeriveMuscle>;
  /** Articulation pair joint IDs (articulations.json). */
  pairJoints: Iterable<string>;
  /** Functional joints (joints.json): ID → member pair joint IDs. */
  functionalJoints: Record<string, readonly string[]>;
  antagonistPairs: readonly (readonly [string, string])[];
};

export type Derived = {
  /** The articulation pairs a joint ID stands for (itself for a pair; empty for an unknown ID). */
  pairsOf(joint: string): ReadonlySet<string>;
  /** Two joint IDs name the same joint when their pairs overlap (plan decision 2). */
  sameJoint(a: string, b: string): boolean;
  /** A muscle's own actions; a part's are its parent's plus its own (its own role wins). */
  actionsOf(id: string): DeriveAction[];
  synergistsOf(id: string): string[];
  antagonistsOf(id: string): string[];
  attachedMuscles(structure: string): { origins: string[]; insertions: string[] };
};

const EMPTY: ReadonlySet<string> = new Set();
const acting = (a: DeriveAction) => a.role !== "stabiliser";

export function derive(input: DeriveInput): Derived {
  const { muscles } = input;
  const pairs = new Set(input.pairJoints);
  const pairsCache = new Map<string, ReadonlySet<string>>();
  const pairsOf = (joint: string): ReadonlySet<string> => {
    let s = pairsCache.get(joint);
    if (!s) {
      const fj = input.functionalJoints[joint];
      s = fj ? new Set(fj) : pairs.has(joint) ? new Set([joint]) : EMPTY;
      pairsCache.set(joint, s);
    }
    return s;
  };
  const sameJoint = (a: string, b: string) => {
    if (a === b) return pairsOf(a).size > 0;
    const pa = pairsOf(a);
    for (const p of pairsOf(b)) if (pa.has(p)) return true;
    return false;
  };
  const opposite = new Map<string, string[]>();
  for (const [a, b] of input.antagonistPairs) {
    opposite.set(a, [...(opposite.get(a) ?? []), b]);
    opposite.set(b, [...(opposite.get(b) ?? []), a]);
  }

  const actionsOf = (id: string): DeriveAction[] => {
    const m = muscles[id];
    if (!m) return [];
    if (m.kind === "muscle" || m.parent === null) return m.actions;
    const own = m.actions;
    const inherited = (muscles[m.parent]?.actions ?? []).filter((a) => !own.some((o) => o.joint === a.joint && o.movement === a.movement));
    return [...inherited, ...own];
  };
  /** The muscle a structure belongs to (itself for a muscle or a part without one). */
  const familyOf = (id: string) => muscles[id]?.parent ?? id;

  /**
   * Structures with a prime/assist action matching `want` (joint overlap and a
   * movement in `moves`). A part that matches only through its parent's actions
   * is left out when the parent is listed (the parent stands for it).
   */
  function matching(id: string, movesFor: (movement: string) => readonly string[]): string[] {
    const mine = actionsOf(id).filter(acting);
    if (mine.length === 0) return [];
    const family = familyOf(id);
    const hits = (actions: DeriveAction[]) =>
      actions.filter(acting).some((y) => mine.some((x) => movesFor(x.movement).includes(y.movement) && sameJoint(x.joint, y.joint)));
    const out = new Set<string>();
    for (const [other, m] of Object.entries(muscles)) {
      if (familyOf(other) === family) continue;
      if (m.kind === "muscle_part" && m.parent !== null) {
        const viaOwn = hits(m.actions);
        if (!viaOwn && (hits(muscles[m.parent]?.actions ?? []) || !hits(actionsOf(other)))) continue;
      } else if (!hits(m.actions)) continue;
      out.add(other);
    }
    return [...out].sort();
  }

  const synergistsOf = (id: string): string[] => {
    const out = new Set(matching(id, (mv) => [mv]));
    const o = muscles[id]?.synergistOverrides;
    if (o) {
      o.add.forEach((x) => out.add(x));
      o.remove.forEach((x) => out.delete(x));
    }
    return [...out].sort();
  };
  const antagonistsOf = (id: string): string[] => matching(id, (mv) => opposite.get(mv) ?? []);

  // Bone (or any structure) → the muscles and parts declaring an attachment on it.
  const attached = new Map<string, { origins: Set<string>; insertions: Set<string> }>();
  const note = (list: DeriveAttachment[] | "inherit", id: string, key: "origins" | "insertions") => {
    if (list === "inherit") return; // the parent lists it
    for (const a of list) {
      if (!("structure" in a)) continue;
      let e = attached.get(a.structure);
      if (!e) attached.set(a.structure, (e = { origins: new Set(), insertions: new Set() }));
      e[key].add(id);
    }
  };
  for (const [id, m] of Object.entries(muscles)) {
    note(m.origin, id, "origins");
    note(m.insertion, id, "insertions");
  }
  const attachedMuscles = (structure: string) => {
    const e = attached.get(structure);
    return { origins: e ? [...e.origins].sort() : [], insertions: e ? [...e.insertions].sort() : [] };
  };

  return { pairsOf, sameJoint, actionsOf, synergistsOf, antagonistsOf, attachedMuscles };
}
