// The muscles layer's edges (SPEC-platform §4.2, §4.4; M12 plan decisions 4
// and 6). Extractors: a muscle's or part's front matter → `part_of`,
// `originates_on` / `inserts_on` (meta `landmark`) and `acts_on` (to the joint,
// meta `movement`, `role`). Rules, run on the compiled edges: a part's
// `inherit` becomes its muscle's attachments with meta `inherited`; then
// `synergist_of` and `antagonist_of`, the M8 rule (was src/content/derive.ts)
// re-expressed over `acts_on`, `part_of` and the joints' `member_of_joint`
// edges, with `synergistOverrides` from the front matter. `derivedLists` reads
// the content chunk's synergists, antagonists and attached muscles back off
// the edges. Authoring half: scripts, the Vite plugins and tests only.

import type { Edge } from "../../../graph/types";
import type { Attachment } from "../../../content/softFields";
import type { SoftDerived } from "../../../content/softCompile";
import type { GraphContext } from "../../contentTypes";
import type { MuscleFm, MusclePartFm } from "./content";

type Role = "prime" | "assist" | "stabiliser";
type Act = { joint: string; movement: string; role: Role };

const INHERITED = "inherited";
const isInherited = (e: Edge) => e.meta?.[INHERITED] === "true";
const ATTACH = ["originates_on", "inserts_on"] as const;

function attachments(from: string, type: (typeof ATTACH)[number], list: readonly Attachment[] | "inherit"): Edge[] {
  if (list === "inherit") return [];
  return list.flatMap((a) => ("structure" in a ? [{ from, type, to: a.structure, ...(a.landmark ? { meta: { landmark: a.landmark } } : {}) }] : []));
}
const actions = (from: string, list: readonly Act[]): Edge[] => list.map((a) => ({ from, type: "acts_on", to: a.joint, meta: { movement: a.movement, role: a.role } }));

export const muscleEdges = (fm: MuscleFm): Edge[] => [
  ...fm.parts.map((p) => ({ from: p, type: "part_of", to: fm.id })),
  ...attachments(fm.id, "originates_on", fm.origin),
  ...attachments(fm.id, "inserts_on", fm.insertion),
  ...actions(fm.id, fm.actions),
];

export const musclePartEdges = (fm: MusclePartFm): Edge[] => [
  ...(fm.parent ? [{ from: fm.id, type: "part_of", to: fm.parent }] : []),
  ...fm.alsoServes.map((m) => ({ from: fm.id, type: "part_of", to: m, meta: { also: "true" } })),
  ...attachments(fm.id, "originates_on", fm.origin),
  ...attachments(fm.id, "inserts_on", fm.insertion),
  ...actions(fm.id, fm.actions),
];

/** The muscles and parts compiled in this run, by ID (sorted). */
function family(ctx: GraphContext): { kind: "muscle" | "muscle_part"; id: string; fm: MuscleFm | MusclePartFm }[] {
  return Object.keys(ctx.fm)
    .sort()
    .flatMap((id) => {
      const fm = ctx.fm[id] as MuscleFm | MusclePartFm;
      return fm.kind === "muscle" || fm.kind === "muscle_part" ? [{ kind: fm.kind, id, fm }] : [];
    });
}

/** The muscle a part belongs to (`part_of` without `also`). */
function parents(edges: readonly Edge[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of edges) if (e.type === "part_of" && !e.meta?.also && !out.has(e.from)) out.set(e.from, e.to);
  return out;
}

/** A part's `inherit`: its muscle's own origins or insertions, as its own edges with meta `inherited` (plan decision 6). */
export function inheritAttachments(edges: readonly Edge[], ctx: GraphContext): Edge[] {
  const parent = parents(edges);
  const own = new Map<string, Edge[]>();
  for (const e of edges) if ((ATTACH as readonly string[]).includes(e.type) && !isInherited(e)) (own.get(`${e.from} ${e.type}`) ?? own.set(`${e.from} ${e.type}`, []).get(`${e.from} ${e.type}`)!).push(e);
  const out: Edge[] = [];
  for (const { id, fm } of family(ctx)) {
    if (fm.kind !== "muscle_part") continue;
    const p = parent.get(id);
    if (!p) continue;
    for (const [type, list] of [["originates_on", fm.origin], ["inserts_on", fm.insertion]] as const)
      if (list === "inherit") for (const e of own.get(`${p} ${type}`) ?? []) out.push({ from: id, type, to: e.to, meta: { ...e.meta, [INHERITED]: "true" } });
  }
  return out;
}

/**
 * Synergists and antagonists (musculoskeletal spec §4.3; M8 plan decision 9):
 * two structures of different muscles with a prime or assist action on the
 * same joint (overlapping articulation pairs), with the same movement or the
 * paired one (`movements.json`). A part acts as its muscle plus its own
 * actions; a part that matches only through its muscle's actions is left out
 * (the muscle stands for it). Synergist overrides apply last.
 */
export function synergistsAndAntagonists(edges: readonly Edge[], ctx: GraphContext): Edge[] {
  const pairs = new Set<string>();
  for (const e of edges) if (e.type === "articulates_with" && e.meta?.joint) pairs.add(e.meta.joint);
  const functional = new Map<string, Set<string>>();
  for (const e of edges) if (e.type === "member_of_joint" && pairs.has(e.from)) (functional.get(e.to) ?? functional.set(e.to, new Set()).get(e.to)!).add(e.from);
  const EMPTY: ReadonlySet<string> = new Set();
  const pairsOf = (j: string): ReadonlySet<string> => functional.get(j) ?? (pairs.has(j) ? new Set([j]) : EMPTY);
  const sameJoint = (a: string, b: string) => {
    if (a === b) return pairsOf(a).size > 0;
    const pa = pairsOf(a);
    for (const p of pairsOf(b)) if (pa.has(p)) return true;
    return false;
  };
  const opposite = new Map<string, string[]>();
  for (const [a, b] of (ctx.readJson("content/movements.json") as { antagonistPairs: [string, string][] }).antagonistPairs) {
    opposite.set(a, [...(opposite.get(a) ?? []), b]);
    opposite.set(b, [...(opposite.get(b) ?? []), a]);
  }

  const members = family(ctx);
  const parent = parents(edges);
  const own = new Map<string, Act[]>(members.map((m) => [m.id, []]));
  for (const e of edges) if (e.type === "acts_on") own.get(e.from)?.push({ joint: e.to, movement: e.meta!.movement!, role: e.meta!.role as Role });
  const ownOf = (id: string): Act[] => own.get(id) ?? [];
  const parentOf = (id: string, kind: string) => (kind === "muscle_part" ? (parent.get(id) ?? null) : null);
  const actionsOf = (id: string, kind: string): Act[] => {
    const p = parentOf(id, kind);
    const mine = ownOf(id);
    if (p === null) return mine;
    return [...ownOf(p).filter((a) => !mine.some((o) => o.joint === a.joint && o.movement === a.movement)), ...mine];
  };
  const acting = (a: Act) => a.role !== "stabiliser";

  function matching(id: string, kind: string, movesFor: (movement: string) => readonly string[]): string[] {
    const mine = actionsOf(id, kind).filter(acting);
    if (mine.length === 0) return [];
    const fam = parentOf(id, kind) ?? id;
    const hits = (list: Act[]) => list.filter(acting).some((y) => mine.some((x) => movesFor(x.movement).includes(y.movement) && sameJoint(x.joint, y.joint)));
    const out: string[] = [];
    for (const o of members) {
      const p = parentOf(o.id, o.kind);
      if ((p ?? o.id) === fam) continue;
      if (p !== null) {
        if (!hits(ownOf(o.id)) && (hits(ownOf(p)) || !hits(actionsOf(o.id, o.kind)))) continue;
      } else if (!hits(ownOf(o.id))) continue;
      out.push(o.id);
    }
    return out;
  }

  const out: Edge[] = [];
  for (const { id, kind, fm } of members) {
    const syn = new Set(matching(id, kind, (mv) => [mv]));
    const o = fm.kind === "muscle" ? fm.synergistOverrides : undefined;
    if (o) {
      o.add.forEach((x) => syn.add(x));
      o.remove.forEach((x) => syn.delete(x));
    }
    for (const to of [...syn].sort()) out.push({ from: id, type: "synergist_of", to });
    for (const to of matching(id, kind, (mv) => opposite.get(mv) ?? [])) out.push({ from: id, type: "antagonist_of", to });
  }
  return out;
}

/** The content chunk's derived lists, read off the compiled edges, for the muscles and parts in `ids`. */
export function derivedLists(edges: readonly Edge[], ids: readonly string[]): SoftDerived {
  const mine = new Set(ids);
  const from = (type: string) => {
    const m = new Map<string, string[]>();
    for (const e of edges) if (e.type === type && mine.has(e.from)) (m.get(e.from) ?? m.set(e.from, []).get(e.from)!).push(e.to);
    return m;
  };
  const syn = from("synergist_of");
  const ant = from("antagonist_of");
  const synergists: SoftDerived["synergists"] = {};
  const antagonists: SoftDerived["antagonists"] = {};
  for (const id of ids) {
    synergists[id] = [...new Set(syn.get(id) ?? [])].sort();
    antagonists[id] = [...new Set(ant.get(id) ?? [])].sort();
  }
  const by = new Map<string, { origins: Set<string>; insertions: Set<string> }>();
  for (const e of edges) {
    if (!mine.has(e.from) || isInherited(e)) continue;
    const key = e.type === "originates_on" ? "origins" : e.type === "inserts_on" ? "insertions" : null;
    if (key) (by.get(e.to) ?? by.set(e.to, { origins: new Set(), insertions: new Set() }).get(e.to)!)[key].add(e.from);
  }
  const attached: SoftDerived["attached"] = {};
  for (const s of [...by.keys()].sort()) attached[s] = { origins: [...by.get(s)!.origins].sort(), insertions: [...by.get(s)!.insertions].sort() };
  return { synergists, antagonists, attached };
}
