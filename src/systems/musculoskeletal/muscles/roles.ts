// Origins and insertions for the tints (musculoskeletal spec §5.2–5.3; M9 plan
// decision 6), read off the relationship graph since M12 BC (plan decision 8):
// a muscle's or part's `originates_on` / `inserts_on` edges and the attachments
// overlay's patch list (soft-to-id.json `attachments`, shipped in the muscles
// layer's content chunk). Runtime half: no zod, so the main chunk can run it.
// `npm run content:patch-check` uses the same model for its report.
//
// The content decides: a patch is drawn as an origin (or insertion) of the
// selected muscle or part only if the patch serves that structure (or, for a
// muscle, one of its parts; for a part, its muscle) **and** the content names
// the patch's structure in that role. Where the content names a structure and
// no agreeing patch exists, the whole structure is tinted instead (fallback).
// The antagonists are the kinds' `ant` tier rule (layer.ts).

import type { Graph } from "../../../graph/graph";
import type { Patch, Roles, RoleSet, TintEnd } from "../../types";

const EDGE: Record<TintEnd, string> = { origin: "originates_on", insertion: "inserts_on" };
const PART_OF = "part_of";
/** A part's `alsoServes` link (a `part_of` edge with this meta): not one of the muscle's parts. */
const ALSO = "also";
const INHERITED = "inherited";

const uniq = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

/** The patches sorted by ID (the order they are drawn and listed in), grouped by the structure they lie on. */
export type PatchIndex = { all: readonly [string, Patch][]; byOn: ReadonlyMap<string, readonly [string, Patch][]> };

export function patchIndex(patches: Readonly<Record<string, Patch>>): PatchIndex {
  const all = Object.entries(patches).sort(([a], [b]) => a.localeCompare(b));
  const byOn = new Map<string, [string, Patch][]>();
  for (const e of all) if (e[1].on !== null) (byOn.get(e[1].on) ?? byOn.set(e[1].on, []).get(e[1].on)!).push(e);
  return { all, byOn };
}

/** The graph read as muscles and parts. */
export function muscleModel(graph: Graph) {
  const partsOf = (id: string): string[] =>
    graph
      .in(id, PART_OF)
      .filter((e) => e.meta?.[ALSO] === undefined)
      .map((e) => e.from);
  const parentOf = (id: string): string | null => graph.out(id, PART_OF).find((e) => e.meta?.[ALSO] === undefined)?.to ?? null;
  /** The structures a muscle or part names itself in one role (not inherited). */
  const own = (id: string, role: TintEnd): string[] =>
    graph
      .out(id, EDGE[role])
      .filter((e) => e.meta?.[INHERITED] === undefined)
      .map((e) => e.to);
  /** The structures in a role as the selection sees them: a muscle with its parts' own; a part with its muscle's where it inherits. */
  const effective = (id: string, role: TintEnd): string[] =>
    uniq([...graph.out(id, EDGE[role]).map((e) => e.to), ...partsOf(id).flatMap((p) => own(p, role))]);
  /** Whose patches count for a structure: itself, a muscle's parts, a part's muscle. */
  const servers = (id: string): Set<string> => {
    const p = parentOf(id);
    return new Set([id, ...partsOf(id), ...(p ? [p] : [])]);
  };
  return { partsOf, parentOf, own, effective, servers };
}

/** A muscle's or part's origin and insertion: patches drawn and structures tinted whole. */
export function muscleRoles(graph: Graph, id: string, patches: PatchIndex): Roles {
  const m = muscleModel(graph);
  const expand = (x: string): string[] => {
    const parts = m.partsOf(x);
    return parts.length > 0 ? parts : [x];
  };
  const serves = m.servers(id);
  const roleSet = (role: TintEnd): RoleSet => {
    const named = m.effective(id, role);
    const candidates = named.flatMap((s) => patches.byOn.get(s) ?? []).sort(([a], [b]) => a.localeCompare(b));
    const p: [string, string][] = [];
    const covered = new Set<string>();
    for (const [pid, patch] of candidates) {
      if (patch.end !== role || !patch.structures.some((s) => serves.has(s))) continue;
      p.push([pid, patch.on!]);
      covered.add(patch.on!);
    }
    return { p, f: named.filter((s) => !covered.has(s)).flatMap(expand) };
  };
  return { o: roleSet("origin"), i: roleSet("insertion") };
}

/** A structure both synergist and antagonist of a muscle (M9 decision 7: shown as a synergist). */
/** The synergists and antagonists of each ID, off the graph (sorted, as the content chunk's derived lists hold them). */
export function synergyLists(graph: Graph, ids: readonly string[]): { synergists: Record<string, string[]>; antagonists: Record<string, string[]> } {
  const read = (type: string) => Object.fromEntries(ids.map((id) => [id, uniq(graph.neighbours(id, type))]));
  return { synergists: read("synergist_of"), antagonists: read("antagonist_of") };
}

export function bothSynergistAndAntagonist(lists: { synergists: Readonly<Record<string, readonly string[]>>; antagonists: Readonly<Record<string, readonly string[]>> }): [string, string][] {
  const out: [string, string][] = [];
  for (const [id, ants] of Object.entries(lists.antagonists)) {
    const syn = new Set(lists.synergists[id] ?? []);
    for (const a of ants) if (syn.has(a)) out.push([id, a]);
  }
  return out.sort((a, b) => a.join().localeCompare(b.join()));
}

export type Disagreement =
  | { kind: "patch-without-content"; patch: string; structures: readonly string[]; end: TintEnd; on: string | null }
  | { kind: "content-without-patch"; id: string; role: TintEnd; structure: string };

/**
 * Every disagreement between the patches and the content, for
 * `REPORT-patches.md`: a patch none of whose structures names its bone in its
 * role (or that serves no structure), and a structure a muscle or part names
 * itself (not inherited) that no patch of its own covers (a whole-bone tint).
 * `muscles`: every muscle and part, in ID order.
 */
export function patchAgreement(graph: Graph, muscles: readonly string[], patches: PatchIndex): Disagreement[] {
  const m = muscleModel(graph);
  const isMuscle = new Set(muscles);
  const out: Disagreement[] = [];
  for (const [pid, p] of patches.all) {
    // Exactly the rule `muscleRoles` draws by.
    const candidates = new Set(p.structures.flatMap((s) => [s, ...m.partsOf(s), ...(m.parentOf(s) ? [m.parentOf(s)!] : [])]));
    const ok = p.on !== null && [...candidates].some((s) => isMuscle.has(s) && m.effective(s, p.end).includes(p.on!));
    if (!ok) out.push({ kind: "patch-without-content", patch: pid, structures: p.structures, end: p.end, on: p.on });
  }
  for (const id of muscles) {
    const serves = m.servers(id);
    for (const role of ["origin", "insertion"] as const) {
      for (const s of uniq(m.own(id, role))) {
        const covered = (patches.byOn.get(s) ?? []).some(([, p]) => p.end === role && p.structures.some((x) => serves.has(x)));
        if (!covered) out.push({ kind: "content-without-patch", id, role, structure: s });
      }
    }
  }
  return out;
}
