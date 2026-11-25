// Content validation (spec §9, plan step 1) as pure functions, so each rule can
// be tested on small fixtures. scripts/validate-content.ts reads the files and
// prints the result.

import type { ZodError } from "zod";
import { mirrorFile, splitFrontMatter } from "./frontmatter";
import { buildRelations } from "./relations";
import {
  BODY_WORDS,
  articulationsSchema,
  frontMatterSchema,
  hierarchySchema,
  regionsSchema,
  synonymsSchema,
  wordCount,
  type Articulation,
  type FrontMatter,
  type HierarchyNode,
} from "./schema";
import type { EagerKind } from "../systems/registry";

export type IdEntry = { id: string; name: string; kind: EagerKind; side: "left" | "right" | "midline"; group: string[]; meshAvailable: boolean };

export type ContentInput = {
  ids: IdEntry[];
  /** Content files by file name without `.md` (content/bones/<name>.md). */
  files: Map<string, string>;
  /** Node names in each model file (e.g. { high: [...], low: [...] }). */
  meshes: Record<string, string[]>;
  articulations: unknown;
  regions: unknown;
  hierarchy: unknown;
  /** The opposite side's ID (paired objects), else null. */
  opposite: (id: string) => string | null;
  /** content/synonyms.json (Milestone 5); not checked when absent. */
  synonyms?: unknown;
  /** What soft-tissue synonyms may name (M9 plan decision 12): the soft-tissue table and the soft tree's group keys. */
  softSynonyms?: SoftSynonymTargets;
};
export type SoftSynonymTargets = { ids: readonly { id: string; side: string; kind: string }[]; groupKeys: ReadonlySet<string> };
export type ContentOptions = { allowMissingContent?: boolean };
export type ContentReport = { errors: string[]; warnings: string[]; files: number };

/** Objects with no bony articulation (spec §9): the hyoid only. */
export const NO_ARTICULATION_ALLOWLIST = new Set(["hyoid_bone"]);
/** The spec's object counts (§1, §9). */
export const EXPECTED = { total: 238, bones: 206, teeth: 32 } as const;

const zodLines = (where: string, e: ZodError): string[] =>
  e.issues.map((i) => `${where}${i.path.length ? ` ${i.path.join(".")}` : ""}: ${i.message}`);

export function validateContent(input: ContentInput, opts: ContentOptions = {}): ContentReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(input.ids.map((e) => [e.id, e]));
  const known = (id: string) => byId.has(id);

  // --- The ID list itself (spec §1: 206 bones and 32 teeth) ---
  const bones = input.ids.filter((e) => e.kind === "bone").length;
  const teeth = input.ids.filter((e) => e.kind === "tooth").length;
  if (input.ids.length !== EXPECTED.total || bones !== EXPECTED.bones || teeth !== EXPECTED.teeth)
    errors.push(`ids.json: ${input.ids.length} objects (${bones} bones, ${teeth} teeth); expected 238 (206 bones, 32 teeth)`);

  // --- Content files ---
  const fm = new Map<string, FrontMatter>();
  for (const [name, text] of input.files) {
    const where = `content/bones/${name}.md`;
    const entry = byId.get(name);
    if (!entry) {
      errors.push(`${where}: no such ID in content/ids.json`);
      continue;
    }
    let parsed;
    try {
      parsed = splitFrontMatter(text);
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      continue;
    }
    if (parsed.data && typeof parsed.data === "object" && "muscleAttachments" in parsed.data) {
      // Musculoskeletal spec §10: the bones' muscle lists are derived from the muscles' origins and insertions.
      errors.push(`${where}: muscleAttachments was removed in Milestone 8 (the list is derived from the muscle files)`);
      continue;
    }
    const res = frontMatterSchema.safeParse(parsed.data);
    if (!res.success) {
      errors.push(...zodLines(where, res.error));
      continue;
    }
    const d = res.data;
    if (d.id !== name) errors.push(`${where}: id is ${d.id}, but the file is named ${name}`);
    if (d.side !== entry.side) errors.push(`${where}: side is ${d.side}; ids.json says ${entry.side}`);
    if (d.kind !== entry.kind) errors.push(`${where}: kind is ${d.kind}; ids.json says ${entry.kind}`);
    if (d.region[0] !== entry.group[0]) errors.push(`${where}: region starts with ${d.region[0]}; ids.json's group starts with ${entry.group[0]}`);
    const words = wordCount(parsed.body);
    if (words < BODY_WORDS.min || words > BODY_WORDS.max) errors.push(`${where}: summary is ${words} words (spec: ${BODY_WORDS.min} to ${BODY_WORDS.max})`);
    fm.set(name, d);
  }
  // Right-side files are generated from the left (plan decision 2).
  for (const [name, text] of input.files) {
    const e = byId.get(name);
    if (!e || e.side !== "right") continue;
    const left = input.opposite(name);
    const leftText = left ? input.files.get(left) : undefined;
    if (!left || leftText === undefined) {
      errors.push(`content/bones/${name}.md: right-side file without its left-side file${left ? ` (${left}.md)` : ""}`);
      continue;
    }
    let expected: string | null = null;
    try {
      expected = mirrorFile(leftText, left, input.opposite);
    } catch {
      /* the left file's own error is already reported */
    }
    if (expected !== null && expected !== text)
      errors.push(`content/bones/${name}.md: differs from the mirror of ${left}.md (edit the left file and run npm run content:mirror)`);
  }
  if (!opts.allowMissingContent) {
    const missing = input.ids.filter((e) => !input.files.has(e.id)).map((e) => e.id);
    if (missing.length) errors.push(`${missing.length} object(s) without a content file: ${missing.join(", ")}`);
  }

  // --- Meshes ↔ content (plan decision 1) ---
  for (const [lod, names] of Object.entries(input.meshes)) {
    for (const n of names) {
      const e = byId.get(n);
      if (!e) errors.push(`${lod} model: mesh ${n} is not in content/ids.json`);
      else if (!e.meshAvailable) errors.push(`${lod} model: mesh ${n} is marked meshAvailable: false`);
      else if (!opts.allowMissingContent && !input.files.has(n)) errors.push(`${lod} model: mesh ${n} has no content file`);
    }
    const present = new Set(names);
    for (const e of input.ids) if (e.meshAvailable && !present.has(e.id)) errors.push(`${lod} model: no mesh for ${e.id}`);
  }

  // --- Articulations ---
  const arts = articulationsSchema.safeParse(input.articulations);
  let articulations: Articulation[] = [];
  if (!arts.success) errors.push(...zodLines("articulations.json", arts.error));
  else {
    articulations = arts.data;
    const pairs = new Set<string>();
    const joints = new Set<string>();
    const seen = new Set<string>();
    articulations.forEach((a, i) => {
      const where = `articulations.json [${i}] ${a.joint}`;
      for (const id of [a.a, a.b]) if (!known(id)) errors.push(`${where}: unknown ID ${id}`);
      if (a.a === a.b) errors.push(`${where}: an object can't articulate with itself`);
      const key = [a.a, a.b].sort().join("|");
      if (pairs.has(key)) errors.push(`${where}: the pair ${a.a}–${a.b} is stored twice (store each pair once)`);
      pairs.add(key);
      if (joints.has(a.joint)) errors.push(`${where}: joint ID ${a.joint} is used twice`);
      joints.add(a.joint);
      seen.add(a.a).add(a.b);
      for (const [obj, landmark] of Object.entries(a.surfaces ?? {})) {
        if (obj !== a.a && obj !== a.b) errors.push(`${where}: surfaces names ${obj}, which isn't in this pair`);
        const f = fm.get(obj);
        if (f && !f.landmarks.some((l) => l.id === landmark)) errors.push(`${where}: ${obj} has no landmark ${landmark}`);
        if (!f && !opts.allowMissingContent) errors.push(`${where}: surfaces names ${obj}, which has no content file`);
      }
    });
    for (const e of input.ids) {
      const allowed = NO_ARTICULATION_ALLOWLIST.has(e.id);
      if (!seen.has(e.id) && !allowed) errors.push(`articulations.json: ${e.id} has no articulation`);
      if (seen.has(e.id) && allowed) warnings.push(`articulations.json: ${e.id} is on the no-articulation allowlist but has one`);
    }
  }

  // --- Regions ---
  const regs = regionsSchema.safeParse(input.regions);
  if (!regs.success) errors.push(...zodLines("regions.json", regs.error));
  else {
    const rel = buildRelations(articulations, regs.data);
    for (const id of Object.keys(regs.data)) if (!known(id)) errors.push(`regions.json: unknown ID ${id}`);
    for (const e of input.ids) {
      const set = regs.data[e.id];
      if (!set) {
        errors.push(`regions.json: no entry for ${e.id}`);
        continue;
      }
      const t1 = new Set(rel.tier1(e.id));
      const dup = set.filter((x, i) => set.indexOf(x) !== i);
      if (dup.length) errors.push(`regions.json ${e.id}: listed twice: ${[...new Set(dup)].join(", ")}`);
      for (const x of set) {
        if (!known(x)) errors.push(`regions.json ${e.id}: unknown ID ${x}`);
        else if (x === e.id) errors.push(`regions.json ${e.id}: lists itself`);
        else if (t1.has(x)) warnings.push(`regions.json ${e.id}: ${x} is already in tier 1`);
      }
    }
  }

  // --- Hierarchy ---
  const hier = hierarchySchema.safeParse(input.hierarchy);
  if (!hier.success) errors.push(...zodLines("hierarchy.json", hier.error));
  else {
    const tops = hier.data.map((n) => n.key);
    if (tops.join(",") !== "axial,appendicular,dentition")
      errors.push(`hierarchy.json: top-level groups are ${tops.join(", ")}; expected axial, appendicular, dentition`);
    const count = new Map<string, number>();
    const keys = new Set<string>();
    const walk = (n: HierarchyNode) => {
      if (keys.has(n.key)) errors.push(`hierarchy.json: node key ${n.key} is used twice`);
      keys.add(n.key);
      for (const c of n.children) {
        if (typeof c === "string") count.set(c, (count.get(c) ?? 0) + 1);
        else walk(c);
      }
    };
    hier.data.forEach(walk);
    for (const [id, n] of count) {
      if (!known(id)) errors.push(`hierarchy.json: unknown ID ${id}`);
      else if (n > 1) errors.push(`hierarchy.json: ${id} appears ${n} times`);
    }
    for (const e of input.ids) if (!count.has(e.id)) errors.push(`hierarchy.json: ${e.id} is missing`);
    // Teeth must sit under dentition, everything else under its own group.
    for (const top of hier.data) {
      const leaves: string[] = [];
      const collect = (n: HierarchyNode) => n.children.forEach((c) => (typeof c === "string" ? leaves.push(c) : collect(c)));
      collect(top);
      for (const id of leaves) {
        const e = byId.get(id);
        if (e && e.group[0] !== top.key) errors.push(`hierarchy.json: ${id} is under ${top.key}; ids.json puts it under ${e.group[0]}`);
      }
    }
  }

  if (input.synonyms !== undefined) errors.push(...validateSynonyms(input.synonyms, input.ids, input.softSynonyms));

  return { errors, warnings, files: input.files.size };
}

const SIDE_WORD = /\b(left|right)\b/i;

/**
 * content/synonyms.json (plan decision 1): known IDs only, no right-side keys
 * (pairs are written under the left ID), no empty or repeated terms, and no
 * side words (the side comes from the object, and the left key's terms are
 * reused for the right). Since M9 (plan decision 12) the IDs may be soft-tissue
 * structures, and `groups` maps soft group keys to terms; an entry with `label`
 * and `members` defines its own set (a key under `muscles.sets.`, members left
 * or midline muscles).
 */
export function validateSynonyms(raw: unknown, ids: IdEntry[], soft: SoftSynonymTargets = { ids: [], groupKeys: new Set() }): string[] {
  const res = synonymsSchema.safeParse(raw);
  if (!res.success) return zodLines("synonyms.json", res.error);
  const errors: string[] = [];
  const byId = new Map<string, { side: string; kind: string }>(ids.map((e) => [e.id, e]));
  for (const e of soft.ids) byId.set(e.id, e);
  const checkTerms = (where: string, terms: readonly string[]) => {
    const seen = new Set<string>();
    for (const t of terms) {
      const norm = t.trim().toLowerCase();
      if (norm === "") errors.push(`${where}: empty term`);
      else if (seen.has(norm)) errors.push(`${where}: "${t}" is listed twice`);
      else if (SIDE_WORD.test(norm)) errors.push(`${where}: "${t}" names a side`);
      seen.add(norm);
    }
  };
  const { groups, ...terms } = res.data;
  for (const [id, list] of Object.entries(terms)) {
    const where = `synonyms.json ${id}`;
    const e = byId.get(id);
    if (!e) {
      errors.push(`${where}: no such ID in content/ids.json or content/soft-ids.json`);
      continue;
    }
    if (e.side === "right") errors.push(`${where}: write paired terms under the left ID`);
    checkTerms(where, list);
  }
  for (const [key, g] of Object.entries(groups ?? {})) {
    const where = `synonyms.json groups ${key}`;
    const own = g.members !== undefined || g.label !== undefined;
    if (own) {
      if (!g.members || !g.label) errors.push(`${where}: a set needs both label and members`);
      if (!key.startsWith("muscles.sets.")) errors.push(`${where}: a set's key starts with muscles.sets.`);
      if (soft.groupKeys.has(key)) errors.push(`${where}: already a group in the tree`);
      for (const m of g.members ?? []) {
        const e = byId.get(m);
        if (!e || e.kind !== "muscle") errors.push(`${where}: ${m} is not a muscle in content/soft-ids.json`);
        else if (e.side === "right") errors.push(`${where}: ${m}: list the left muscle (the right is added)`);
      }
    } else if (!soft.groupKeys.has(key)) errors.push(`${where}: no such group in the soft tree`);
    checkTerms(where, g.terms);
  }
  return errors;
}
