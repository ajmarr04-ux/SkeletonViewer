// Validation of content/muscle-depth.json (spec §10 "a muscle has no depth"),
// for `npm run validate-content`. Kept apart from `muscleDepth.ts` so zod
// stays out of the viewer's main chunk.

import type { ZodError } from "zod";
import { kindNoun, type KindId } from "../systems/registry";
import { depthOf, hasDepth, sideFree, type DepthEntry } from "./muscleDepth";
import { muscleDepthSchema, type MuscleDepthTable } from "./schema";

/**
 * `content/muscle-depth.json`: the schema; every muscle (and every part without
 * a muscle, such as the linea alba) has a depth; keys are real muscle or part
 * IDs without a side; a part's entry must differ from its muscle's (else it is
 * redundant).
 */
export function validateMuscleDepth(raw: unknown, entries: readonly DepthEntry[]): string[] {
  const res = muscleDepthSchema.safeParse(raw);
  if (!res.success) return zodErrors(res.error);
  const table: MuscleDepthTable = res.data;
  const errors: string[] = [];
  const muscular = entries.filter((e) => hasDepth(e.kind));
  const keys = new Set(muscular.map((e) => sideFree(e.id)));
  for (const key of Object.keys(table)) {
    if (/_(left|right)$/.test(key)) errors.push(`muscle-depth.json ${key}: write the key without the side`);
    else if (!keys.has(key)) errors.push(`muscle-depth.json ${key}: no such muscle or part in content/soft-ids.json`);
  }
  const seen = new Set<string>();
  for (const e of muscular) {
    const key = sideFree(e.id);
    if (seen.has(key)) continue;
    seen.add(key);
    if (depthOf(e, table) === undefined) errors.push(`muscle-depth.json: ${kindNoun(e.kind as KindId)} ${key} has no depth`);
    if (e.parent && table[key] !== undefined && table[key] === table[sideFree(e.parent)]) {
      errors.push(`muscle-depth.json ${key}: same depth as its muscle; leave it out`);
    }
  }
  return errors;
}

function zodErrors(e: ZodError): string[] {
  return e.issues.map((i) => `muscle-depth.json ${i.path.join(".")}: ${i.message}`);
}
