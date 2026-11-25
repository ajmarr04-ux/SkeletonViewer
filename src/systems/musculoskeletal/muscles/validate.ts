// The muscles layer's cross-file checks (musculoskeletal spec §10; M8 plan
// decisions 1 to 8), moved from src/content/softValidate.ts onto the layer's
// content half (M12 plan decision 13): each muscle's and part's references,
// attachments and actions; every muscle (with its parts) has an origin and an
// insertion; content/muscle-hierarchy.json. Authoring half only.

import type { Attachment } from "../../../content/softFields";
import { muscleHierarchySchema, type MuscleHierarchyNode } from "../../../content/softSchema";
import { zodLines } from "../../../content/validate";
import type { EntryCheck, IdRow, LayerCheck } from "../../contentTypes";
import type { MuscleFm, MusclePartFm } from "./content";

const sideFree = (id: string) => id.replace(/_(left|right)$/, "");
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

function checkAttachments(ctx: EntryCheck, field: string, list: Attachment[] | "inherit"): string[] {
  if (list === "inherit") return [];
  const { where } = ctx;
  const out: string[] = [];
  list.forEach((a, i) => {
    if (!("structure" in a)) return;
    const f = `${field}[${i}]`;
    out.push(...ctx.ref(f, a.structure));
    if (a.structure === ctx.entry.id) out.push(`${where}: ${f} attaches the structure to itself`);
    if (a.landmark !== undefined && ctx.known(a.structure)) {
      const lm = ctx.landmarksOf(a.structure);
      if (!ctx.eager(a.structure)) out.push(`${where}: ${f} landmark ${a.landmark}: only bones have landmarks`);
      else if (!lm) out.push(`${where}: ${f} landmark ${a.landmark}: ${a.structure} has no content file`);
      else if (!lm.has(a.landmark)) out.push(`${where}: ${f} ${a.structure} has no landmark ${a.landmark} (add it to the bone file)`);
    }
  });
  return out;
}

function checkActions(ctx: EntryCheck, d: MuscleFm | MusclePartFm): string[] {
  const { where, entry } = ctx;
  const out: string[] = [];
  d.actions.forEach((a, i) => {
    const f = `actions[${i}]`;
    if (!ctx.isJoint(a.joint)) out.push(`${where}: ${f} joint ${a.joint} is in neither articulations.json nor joints.json`);
    else if ((entry.side === "left" && a.joint.endsWith("_right")) || (entry.side === "right" && a.joint.endsWith("_left")))
      out.push(`${where}: ${f} joint ${a.joint} is on the other side`);
    if (ctx.movements.size && !ctx.movements.has(a.movement)) out.push(`${where}: ${f} movement ${a.movement} is not in movements.json`);
  });
  const dup = d.actions.find((a, i) => d.actions.findIndex((b) => b.joint === a.joint && b.movement === a.movement) !== i);
  if (dup) out.push(`${where}: the action ${dup.joint} · ${dup.movement} is listed twice`);
  return out;
}

export function validateMuscle(d: MuscleFm, ctx: EntryCheck): string[] {
  const { where, entry: e } = ctx;
  const out: string[] = [];
  if (!sameSet(d.parts, e.parts ?? [])) out.push(`${where}: parts are [${d.parts.join(", ")}]; soft-ids.json says [${(e.parts ?? []).join(", ")}]`);
  out.push(...checkAttachments(ctx, "origin", d.origin), ...checkAttachments(ctx, "insertion", d.insertion), ...checkActions(ctx, d));
  if (d.actions.length === 0 && !d.functions) out.push(`${where}: actions is empty, so functions is required (spec §4.3)`);
  if (d.synergistOverrides) {
    for (const x of [...d.synergistOverrides.add, ...d.synergistOverrides.remove]) out.push(...ctx.ref("synergistOverrides", x));
    const key = sideFree(d.id);
    const noted = ctx.questions.split("\n").some((l) => l.includes("synergistOverrides") && l.includes(key));
    if (!noted) out.push(`${where}: synergistOverrides needs a QUESTIONS.md entry naming synergistOverrides and ${key}`);
  }
  return out;
}

export function validateMusclePart(d: MusclePartFm, ctx: EntryCheck): string[] {
  const { where, entry: e } = ctx;
  const out: string[] = [];
  if (d.parent !== (e.parent ?? null)) out.push(`${where}: parent is ${d.parent}; soft-ids.json says ${e.parent ?? null}`);
  if (d.partType !== e.partType) out.push(`${where}: partType is ${d.partType}; soft-ids.json says ${e.partType}`);
  if (!sameSet(d.alsoServes, e.alsoServes ?? [])) out.push(`${where}: alsoServes is [${d.alsoServes.join(", ")}]; soft-ids.json says [${(e.alsoServes ?? []).join(", ")}]`);
  if (d.parent !== null) {
    const p = ctx.row(d.parent);
    if (!p || p.kind !== "muscle") out.push(`${where}: parent ${d.parent} is not a muscle`);
    else if (!(p.parts ?? []).includes(d.id)) out.push(`${where}: ${d.parent} doesn't list ${d.id} as a part`);
  } else {
    for (const f of ["origin", "insertion"] as const) if (d[f] === "inherit") out.push(`${where}: a part without a muscle can't inherit its ${f}`);
  }
  for (const x of d.alsoServes) if (ctx.row(x)?.kind !== "muscle") out.push(`${where}: alsoServes ${x} is not a muscle`);
  out.push(...checkAttachments(ctx, "origin", d.origin), ...checkAttachments(ctx, "insertion", d.insertion), ...checkActions(ctx, d));
  return out;
}

/** Every muscle (with its parts) has an origin and an insertion (spec §10), then the muscle hierarchy (plan decision 8). */
export function validateMuscleLayer(ctx: LayerCheck): string[] {
  return [...checkFamilies(ctx), ...checkHierarchy(ctx)];
}

function checkFamilies(ctx: LayerCheck): string[] {
  const out: string[] = [];
  const parsed = ctx.parsed as ReadonlyMap<string, MuscleFm | MusclePartFm>;
  let familiesSkipped = 0;
  for (const e of ctx.rows) {
    const isFamily = e.kind === "muscle" || (e.kind === "muscle_part" && !e.parent);
    if (!isFamily) continue;
    const members = [e.id, ...(e.parts ?? [])];
    if (members.some((m) => !parsed.has(m))) {
      if (members.some((m) => parsed.has(m))) familiesSkipped++;
      continue;
    }
    const head = parsed.get(e.id)!;
    const parts = (e.parts ?? []).map((p) => parsed.get(p) as MusclePartFm);
    for (const f of ["origin", "insertion"] as const) {
      const own = head[f];
      const ok = (own !== "inherit" && own.length > 0) || parts.some((p) => p[f] !== "inherit" && p[f].length > 0);
      if (!ok) out.push(`${e.id}: no ${f} on the muscle or any of its parts (spec §10)`);
      if (own !== "inherit" && own.length === 0) for (const p of parts) if (p[f] === "inherit") out.push(`${p.id}: inherits the ${f} of ${e.id}, which is empty`);
    }
  }
  if (familiesSkipped && !ctx.allowMissing) out.push(`${familiesSkipped} muscle(s) have some but not all of their part files`);
  return out;
}

function checkHierarchy(ctx: LayerCheck): string[] {
  const { allowMissing } = ctx;
  const parsed = ctx.parsed as ReadonlyMap<string, { kind: string; side: string }>;
  const soft = new Map<string, IdRow>(ctx.rows.map((e) => [e.id, e]));
  const out: string[] = [];
  const res = muscleHierarchySchema.safeParse(ctx.input.muscleHierarchy);
  if (!res.success) return zodLines("muscle-hierarchy.json", res.error);
  const keys = new Set<string>();
  const pathOf = new Map<string, string[]>();
  const walk = (n: MuscleHierarchyNode, path: string[]) => {
    if (keys.has(n.key)) out.push(`muscle-hierarchy.json: node key ${n.key} is used twice`);
    keys.add(n.key);
    if (n.children.length === 0 && !allowMissing) out.push(`muscle-hierarchy.json: ${n.key} has no muscles`);
    const here = [...path, n.key];
    for (const c of n.children) {
      if (typeof c !== "string") walk(c, here);
      else if (pathOf.has(c)) out.push(`muscle-hierarchy.json: ${c} appears twice`);
      else pathOf.set(c, here);
    }
  };
  res.data.forEach((n) => walk(n, []));
  for (const [id, path] of pathOf) {
    const e = soft.get(id);
    if (!e || e.kind !== "muscle") out.push(`muscle-hierarchy.json: ${id} is not a muscle in soft-ids.json`);
    else if (e.side === "right") out.push(`muscle-hierarchy.json: ${id}: list the left side only`);
    else if (!parsed.has(id)) {
      if (!allowMissing) out.push(`muscle-hierarchy.json: ${id} has no content file`);
    } else {
      const d = parsed.get(id) as MuscleFm;
      const want = d.compartment === null ? d.region : [...d.region, d.compartment];
      if (want.join(" › ") !== path.join(" › ")) out.push(`content/muscles/${id}.md: region/compartment ${want.join(" › ")} doesn't match its place in muscle-hierarchy.json (${path.join(" › ")})`);
    }
  }
  for (const e of ctx.rows) {
    if (e.kind !== "muscle" || e.side === "right" || pathOf.has(e.id)) continue;
    if (parsed.has(e.id)) out.push(`muscle-hierarchy.json: ${e.id} is missing`);
    else if (!allowMissing) out.push(`muscle-hierarchy.json: ${e.id} is missing`);
  }
  // Right-side muscles must sit where their left twin does.
  for (const [id, d] of parsed) {
    if (d.kind !== "muscle" || d.side !== "right") continue;
    const left = ctx.opposite(id);
    const l = left ? parsed.get(left) : undefined;
    if (l && l.kind === "muscle") {
      const r = d as MuscleFm;
      const lm = l as MuscleFm;
      if (lm.region.join() !== r.region.join() || lm.compartment !== r.compartment) out.push(`content/muscles/${id}.md: region/compartment differ from ${left}`);
    }
  }
  return out;
}
