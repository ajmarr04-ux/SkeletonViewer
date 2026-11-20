// Tier sets for the soft-tissue kinds (musculoskeletal spec §5.2; M9 plan
// decisions 3 and 4). Pure, run by the content compiler on every layer's
// front matter at once (a ligament's tier 2 names cartilage, and the other way
// round), and shipped in each layer's lazy content chunk. The main chunk
// registers them (`softRelations.ts`) and filters them by the layers showing.
//
// - Muscle / part. Tier 1: a muscle's parts (a muscle with parts is drawn as
//   them) + every structure named in its origin and insertion (a muscle also
//   collects its parts' own; a part inherits its muscle's where it says
//   `inherit`). Tier 2: + its derived synergists and their tier-1 structures.
//   `{ soft: … }` attachments add nothing.
// - Ligament. Tier 1: + `connects`. Tier 2: + every ligament and cartilage
//   whose joint is in the same functional joint; none with `joint: null`.
// - Cartilage / disc / meniscus. Tier 1: + `attachedTo`. Tier 2: as ligaments.
// - Reverse: for each structure named above (bones above all), the structures
//   of this layer that name it, so a bone's related set can gain them.

import type { Attachment, SoftFm } from "./softSchema";

/** One structure's tier additions: tier 1 (not the structure itself), then tier 2 on top of tier 1. Null `t2`: no tier 2. */
export type SoftTierEntry = { t1: string[]; t2: string[] | null };
export type SoftTierData = {
  tiers: Record<string, SoftTierEntry>;
  /** Structure → the structures of this layer related to it at tier 1 (a muscle with parts as its parts). */
  reverse: Record<string, string[]>;
};

export type SoftTierInput = {
  /** Every soft-tissue structure's front matter, all layers. */
  fm: Record<string, SoftFm>;
  /** Derived synergists by muscle or part (the muscles layer's `derived.synergists`). */
  synergists: Record<string, readonly string[]>;
  pairJoints: Iterable<string>;
  /** Functional joints (joints.json): ID → member pair joint IDs. */
  functionalJoints: Record<string, readonly string[]>;
};

export type SoftLayerName = "muscles" | "ligaments" | "cartilage";
export const layerOfKind = (kind: SoftFm["kind"]): SoftLayerName =>
  kind === "muscle" || kind === "muscle_part" ? "muscles" : kind === "ligament" ? "ligaments" : "cartilage";

/**
 * The functional joint a joint ID belongs to, as a set of pair joints: a
 * functional joint's own pairs; for a pair, the pairs of every functional
 * joint that contains it (itself when none does); empty for an unknown ID.
 * Two joint IDs are the same joint for tier 2 when these sets overlap.
 */
export function jointScope(pairJoints: Iterable<string>, functionalJoints: Record<string, readonly string[]>): (joint: string) => ReadonlySet<string> {
  const pairs = new Set(pairJoints);
  const containing = new Map<string, string[]>();
  for (const [fj, members] of Object.entries(functionalJoints)) for (const p of members) containing.set(p, [...(containing.get(p) ?? []), fj]);
  const cache = new Map<string, ReadonlySet<string>>();
  return (joint) => {
    let s = cache.get(joint);
    if (!s) {
      const fj = functionalJoints[joint];
      if (fj) s = new Set(fj);
      else if (pairs.has(joint)) s = new Set([joint, ...(containing.get(joint) ?? []).flatMap((f) => functionalJoints[f] ?? [])]);
      else s = new Set();
      cache.set(joint, s);
    }
    return s;
  };
}

const structuresIn = (list: readonly Attachment[] | "inherit"): string[] =>
  list === "inherit" ? [] : list.flatMap((a) => ("structure" in a ? [a.structure] : []));

export function buildSoftTiers(input: SoftTierInput): Record<SoftLayerName, SoftTierData> {
  const { fm } = input;
  const partsOf = (id: string): string[] => {
    const f = fm[id];
    return f && f.kind === "muscle" ? f.parts : [];
  };
  /** A muscle with parts stands for its parts (it has no mesh of its own); the ID is kept too. */
  const expand = (id: string): string[] => [id, ...partsOf(id)];

  /** The structures named in a muscle's or part's origin and insertion (a muscle's own and its parts'). */
  const attachmentsOf = (id: string): string[] => {
    const f = fm[id];
    if (!f) return [];
    if (f.kind === "muscle") {
      const own = [...structuresIn(f.origin), ...structuresIn(f.insertion)];
      const parts = f.parts.flatMap((p) => {
        const pf = fm[p];
        return pf && pf.kind === "muscle_part" ? [...structuresIn(pf.origin), ...structuresIn(pf.insertion)] : [];
      });
      return [...own, ...parts];
    }
    if (f.kind === "muscle_part") {
      const parent = f.parent ? fm[f.parent] : undefined;
      const pm = parent && parent.kind === "muscle" ? parent : null;
      const origin = f.origin === "inherit" ? (pm ? structuresIn(pm.origin) : []) : structuresIn(f.origin);
      const insertion = f.insertion === "inherit" ? (pm ? structuresIn(pm.insertion) : []) : structuresIn(f.insertion);
      return [...origin, ...insertion];
    }
    return [];
  };

  const scope = jointScope(input.pairJoints, input.functionalJoints);
  const jointed = Object.entries(fm).flatMap(([id, f]) => ("joint" in f && f.joint !== null ? [{ id, scope: scope(f.joint) }] : []));
  const sameJointAs = (joint: string, self: string): string[] => {
    const mine = scope(joint);
    if (mine.size === 0) return [];
    return jointed.filter((o) => o.id !== self && [...o.scope].some((p) => mine.has(p))).map((o) => o.id);
  };

  const out: Record<SoftLayerName, SoftTierData> = {
    muscles: { tiers: {}, reverse: {} },
    ligaments: { tiers: {}, reverse: {} },
    cartilage: { tiers: {}, reverse: {} },
  };
  const finish = (self: string, t1: Iterable<string>, t2: Iterable<string> | null): SoftTierEntry => {
    const one = new Set(t1);
    one.delete(self);
    if (t2 === null) return { t1: [...one].sort(), t2: null };
    const two = new Set(t2);
    two.delete(self);
    for (const x of one) two.delete(x);
    return { t1: [...one].sort(), t2: [...two].sort() };
  };
  const reverseOf = (layer: SoftLayerName, structure: string, id: string) => {
    const r = out[layer].reverse;
    (r[structure] ??= []).push(id);
  };

  for (const id of Object.keys(fm).sort()) {
    const f = fm[id]!;
    const layer = layerOfKind(f.kind);
    if (f.kind === "muscle" || f.kind === "muscle_part") {
      const t1 = [...partsOf(id), ...attachmentsOf(id).flatMap(expand)];
      const t2 = (input.synergists[id] ?? []).flatMap((s) => [...expand(s), ...attachmentsOf(s).flatMap(expand)]);
      out[layer].tiers[id] = finish(id, t1, t2);
      // Reverse: the structures it declares itself (as derive.ts's attached muscles), a muscle as its parts.
      const declared = new Set([...structuresIn(f.origin), ...structuresIn(f.insertion)]);
      for (const s of declared) for (const x of expand(id)) reverseOf(layer, s, x);
    } else {
      const named = f.kind === "ligament" ? f.connects : f.attachedTo;
      out[layer].tiers[id] = finish(id, named.flatMap(expand), f.joint === null ? null : sameJointAs(f.joint, id).flatMap(expand));
      for (const s of new Set(named)) reverseOf(layer, s, id);
    }
  }
  for (const data of Object.values(out)) for (const k of Object.keys(data.reverse)) data.reverse[k] = [...new Set(data.reverse[k])].sort();
  return out;
}
