// Content schemas shared by every layer (spec §5): the summary's word count,
// content/synonyms.json and the depth table. The bones' own front matter and
// relationship files are in their content half
// (src/systems/musculoskeletal/bones/schema.ts, M12 plan decision 13).

import { z } from "zod";

const snake = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "must be snake_case");

/** Words in a summary (the body below the front matter); each kind sets its own range. */
export function wordCount(markdown: string): number {
  const plain = markdown.replace(/[*_`#>[\]()]/g, " ");
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Extra search terms (Milestone 5, plan decision 1): ID → terms. Paired objects
 * are written once, under the left ID, and apply to both sides. Since M9 (plan
 * decision 12) the IDs may be soft-tissue structures too, and the reserved key
 * `groups` holds group synonyms: a soft group key (`muscles.…`) → its terms;
 * an entry with `label` and `members` (left or midline muscle IDs) defines a
 * set of its own, for a group the hierarchy doesn't have ("quadriceps").
 */
export const groupSynonymSchema = z.strictObject({
  terms: z.array(z.string()).min(1),
  label: z.string().min(1).optional(),
  members: z.array(snake).min(1).optional(),
});
export type GroupSynonym = z.infer<typeof groupSynonymSchema>;
export const synonymsSchema = z
  .object({ groups: z.record(z.string(), groupSynonymSchema).optional() })
  .catchall(z.array(z.string()));
export type Synonyms = Record<string, string[]>;
export type SynonymsFile = { groups?: Record<string, GroupSynonym> } & Record<string, unknown>;

/** The ID terms and the group synonyms of content/synonyms.json. */
export function splitSynonyms(raw: SynonymsFile): { ids: Synonyms; groups: Record<string, GroupSynonym> } {
  const { groups, ...ids } = raw;
  return { ids: ids as Synonyms, groups: groups ?? {} };
}

/**
 * Muscle depth (musculoskeletal spec §6.2; brought into M7, plan decision 9):
 * side-free muscle or part ID → 1 superficial, 2 intermediate, 3 deep.
 */
export const muscleDepthSchema = z.record(snake, z.union([z.literal(1), z.literal(2), z.literal(3)]));
export type MuscleDepthTable = z.infer<typeof muscleDepthSchema>;
