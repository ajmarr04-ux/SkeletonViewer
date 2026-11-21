// Origins, insertions and antagonists for the tints (musculoskeletal spec
// §5.2–5.3; M9 plan decisions 6 and 7). Pure, run by the content compiler and
// by `npm run content:patch-check`; the result ships in the muscles layer's
// lazy content chunk.
//
// The content decides (decision 6): an attachment patch (M6,
// `soft-to-id.json` `attachments`) is drawn as an origin (or insertion) of the
// selected muscle or part only if the patch serves that structure (or, for a
// muscle, one of its parts; for a part, its muscle) **and** the content names
// the patch's structure in that role. Where the content names a structure and
// no agreeing patch exists, the whole structure is tinted instead (fallback).

import type { Attachment, SoftFm } from "./softSchema";

/** One patch as `soft-to-id.json` maps it. */
export type Patch = { structures: readonly string[]; end: "origin" | "insertion"; on: string | null };
export type Role = "origin" | "insertion";

/** One end of a muscle or part: patches drawn (`[patch ID, structure it lies on]`) and structures tinted whole. */
export type RoleSet = { p: [string, string][]; f: string[] };
/** A muscle's or part's tints: origin, insertion, and its antagonists (expanded to parts, synergists left out). */
export type MuscleRoles = { o: RoleSet; i: RoleSet; ant: string[] };

export type RolesInput = {
  /** Front matter of every soft structure (all layers; only muscles and parts are read). */
  fm: Record<string, SoftFm>;
  patches: Record<string, Patch>;
  synergists: Record<string, readonly string[]>;
  antagonists: Record<string, readonly string[]>;
};

const structuresIn = (list: readonly Attachment[] | "inherit"): string[] =>
  list === "inherit" ? [] : list.flatMap((a) => ("structure" in a ? [a.structure] : []));
const uniq = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

/** Helpers over the front matter shared by the roles and the agreement report. */
export function muscleModel(fm: Record<string, SoftFm>) {
  const partsOf = (id: string): string[] => {
    const f = fm[id];
    return f && f.kind === "muscle" ? f.parts : [];
  };
  const parentOf = (id: string): string | null => {
    const f = fm[id];
    return f && f.kind === "muscle_part" ? f.parent : null;
  };
  const isMuscle = (id: string) => fm[id]?.kind === "muscle" || fm[id]?.kind === "muscle_part";
  /** The structures a muscle or part names itself in one role ("inherit" names none). */
  const own = (id: string, role: Role): string[] => {
    const f = fm[id];
    if (!f || (f.kind !== "muscle" && f.kind !== "muscle_part")) return [];
    return structuresIn(role === "origin" ? f.origin : f.insertion);
  };
  /**
   * The structures in a role as the selection sees them (as `softTiers.ts`):
   * a muscle with its parts' own; a part with its muscle's where it inherits.
   */
  const effective = (id: string, role: Role): string[] => {
    const f = fm[id];
    if (!f) return [];
    if (f.kind === "muscle") return uniq([...own(id, role), ...f.parts.flatMap((p) => own(p, role))]);
    if (f.kind === "muscle_part") {
      const list = role === "origin" ? f.origin : f.insertion;
      return uniq(list === "inherit" ? (f.parent ? own(f.parent, role) : []) : structuresIn(list));
    }
    return [];
  };
  /** Whose patches count for a structure: itself, a muscle's parts, a part's muscle. */
  const servers = (id: string): Set<string> => {
    const p = parentOf(id);
    return new Set([id, ...partsOf(id), ...(p ? [p] : [])]);
  };
  return { partsOf, parentOf, isMuscle, own, effective, servers };
}

export function buildMuscleRoles(input: RolesInput): Record<string, MuscleRoles> {
  const { fm, patches } = input;
  const m = muscleModel(fm);
  const expand = (id: string): string[] => {
    const parts = m.partsOf(id);
    return parts.length > 0 ? parts : [id];
  };
  const patchList = Object.entries(patches).sort(([a], [b]) => a.localeCompare(b));
  const roleSet = (id: string, role: Role): RoleSet => {
    const named = m.effective(id, role);
    const serves = m.servers(id);
    const p: [string, string][] = [];
    const covered = new Set<string>();
    for (const [pid, patch] of patchList) {
      if (patch.end !== role || patch.on === null || !named.includes(patch.on)) continue;
      if (!patch.structures.some((s) => serves.has(s))) continue;
      p.push([pid, patch.on]);
      covered.add(patch.on);
    }
    return { p, f: named.filter((s) => !covered.has(s)).flatMap(expand) };
  };
  const out: Record<string, MuscleRoles> = {};
  for (const id of Object.keys(fm).sort()) {
    if (!m.isMuscle(id)) continue;
    const syn = new Set((input.synergists[id] ?? []).flatMap((s) => [s, ...m.partsOf(s)]));
    // A part of an antagonist muscle that is itself a synergist stays a synergist too.
    const ant = (input.antagonists[id] ?? []).filter((a) => !syn.has(a)).flatMap(expand).filter((a) => !syn.has(a));
    out[id] = { o: roleSet(id, "origin"), i: roleSet(id, "insertion"), ant: uniq(ant) };
  }
  return out;
}

/** A structure both synergist and antagonist of a muscle (decision 7: shown as a synergist). */
export function bothSynergistAndAntagonist(input: Pick<RolesInput, "synergists" | "antagonists">): [string, string][] {
  const out: [string, string][] = [];
  for (const [id, ants] of Object.entries(input.antagonists)) {
    const syn = new Set(input.synergists[id] ?? []);
    for (const a of ants) if (syn.has(a)) out.push([id, a]);
  }
  return out.sort((a, b) => a.join().localeCompare(b.join()));
}

export type Disagreement =
  | { kind: "patch-without-content"; patch: string; structures: readonly string[]; end: Role; on: string | null }
  | { kind: "content-without-patch"; id: string; role: Role; structure: string };

/**
 * Every disagreement between the patches and the content (decision 6), for
 * `REPORT-patches.md`: a patch none of whose structures names its bone in its
 * role (or that serves no structure), and a structure a muscle or part names
 * itself (not inherited) that no patch of its own covers (drawn as a whole-bone tint).
 */
export function patchAgreement(fm: Record<string, SoftFm>, patches: Record<string, Patch>): Disagreement[] {
  const m = muscleModel(fm);
  const out: Disagreement[] = [];
  const entries = Object.entries(patches).sort(([a], [b]) => a.localeCompare(b));
  for (const [pid, p] of entries) {
    // Exactly the rule `buildMuscleRoles` draws by: some muscle or part it serves (or whose part or muscle it serves) names its bone in its role.
    const candidates = new Set(p.structures.flatMap((s) => [s, ...m.partsOf(s), ...(m.parentOf(s) ? [m.parentOf(s)!] : [])]));
    const ok = p.on !== null && [...candidates].some((s) => m.isMuscle(s) && m.effective(s, p.end).includes(p.on!));
    if (!ok) out.push({ kind: "patch-without-content", patch: pid, structures: p.structures, end: p.end, on: p.on });
  }
  for (const id of Object.keys(fm).sort()) {
    if (!m.isMuscle(id)) continue;
    const serves = m.servers(id);
    for (const role of ["origin", "insertion"] as const) {
      for (const s of uniq(m.own(id, role))) {
        const covered = entries.some(([, p]) => p.end === role && p.on === s && p.structures.some((x) => serves.has(x)));
        if (!covered) out.push({ kind: "content-without-patch", id, role, structure: s });
      }
    }
  }
  return out;
}
