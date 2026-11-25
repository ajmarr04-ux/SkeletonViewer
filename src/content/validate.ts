// Content validation shared by every layer, as pure functions:
// content/synonyms.json, and the zod issue lines every validator prints. Each
// layer's own rules are in its content half (M12 plan decision 13): the bones'
// in src/systems/musculoskeletal/bones/validate.ts, the lazy layers' run by
// src/content/softValidate.ts.

import type { ZodError } from "zod";
import { synonymsSchema } from "./schema";
import { SYNONYM_SETS, type EagerKind } from "../systems/registry";

export type IdEntry = { id: string; name: string; kind: EagerKind; side: "left" | "right" | "midline"; group: string[]; meshAvailable: boolean };

export type SoftSynonymTargets = { ids: readonly { id: string; side: string; kind: string }[]; groupKeys: ReadonlySet<string> };

export const zodLines = (where: string, e: ZodError): string[] =>
  e.issues.map((i) => `${where}${i.path.length ? ` ${i.path.join(".")}` : ""}: ${i.message}`);

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
      if (!SYNONYM_SETS.prefix || !key.startsWith(SYNONYM_SETS.prefix)) errors.push(`${where}: a set's key starts with ${SYNONYM_SETS.prefix}`);
      if (soft.groupKeys.has(key)) errors.push(`${where}: already a group in the tree`);
      for (const m of g.members ?? []) {
        const e = byId.get(m);
        if (!e || e.kind !== SYNONYM_SETS.memberKind) errors.push(`${where}: ${m} is not a ${SYNONYM_SETS.noun} in content/soft-ids.json`);
        else if (e.side === "right") errors.push(`${where}: ${m}: list the left ${SYNONYM_SETS.noun} (the right is added)`);
      }
    } else if (!soft.groupKeys.has(key)) errors.push(`${where}: no such group in the soft tree`);
    checkTerms(where, g.terms);
  }
  return errors;
}
