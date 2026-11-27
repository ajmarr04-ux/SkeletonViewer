// The muscles layer's authoring half: front matter schemas for muscles and
// parts (spec §4.1, §4.2), summary lengths, edges, checks and the depth table.
import { z } from "zod";
import { actionSchema, attachmentSchema, inheritable, overridesSchema, side, snake, text } from "../../../content/softFields";
import { defineLayerContent } from "../../contentTypes";
import { PART_TYPES, type PartType } from "../../registry";
import type { Patch } from "../../types";
import { derivedLists, inheritAttachments, muscleEdges, musclePartEdges, synergistsAndAntagonists } from "./derive";
import { validateMuscle, validateMuscleLayer, validateMusclePart } from "./validate";

/** Spec §4.1. */
export const muscleSchema = z.strictObject({
  id: snake,
  kind: z.literal("muscle"),
  name: text,
  latin: text,
  commonName: text.nullable(),
  side,
  /** Region path in muscle-hierarchy.json, outermost first (e.g. [upper_limb, arm]). */
  region: z.array(snake).min(1),
  /** The compartment node under the region path, or null for a muscle sitting directly under it. */
  compartment: snake.nullable(),
  parts: z.array(snake),
  /** Empty when every part declares its own (spec §4.1). */
  origin: z.array(attachmentSchema),
  insertion: z.array(attachmentSchema),
  actions: z.array(actionSchema),
  /** Required when `actions` is empty (spec §4.3). */
  functions: z.array(text).min(1).optional(),
  innervation: text,
  clinicalNote: text.nullable(),
  synergistOverrides: overridesSchema.optional(),
  reviewed: z.boolean(),
});
export type MuscleFm = z.infer<typeof muscleSchema>;

/** Spec §4.2. `actions` are only those that differ from or add to the parent's. */
export const musclePartSchema = z.strictObject({
  id: snake,
  kind: z.literal("muscle_part"),
  partType: z.enum(PART_TYPES as [PartType, ...PartType[]]),
  /** Null only for a part without a muscle (the linea alba). */
  parent: snake.nullable(),
  alsoServes: z.array(snake),
  name: text,
  latin: text,
  commonName: text.nullable().optional(),
  side,
  origin: inheritable,
  insertion: inheritable,
  actions: z.array(actionSchema),
  functions: z.array(text).min(1).optional(),
  /** Only where it differs from the parent's (e.g. the heads of pectoralis major). */
  innervation: text.optional(),
  clinicalNote: text.nullable().optional(),
  reviewed: z.boolean(),
});
export type MusclePartFm = z.infer<typeof musclePartSchema>;

export const musclesContent = defineLayerContent({
  folder: "muscles",
  searchChunk: "virtual:skeleton-search-muscles",
  idsFile: "content/soft-ids.json",
  kinds: {
    // Summary lengths in words (M8 plan decision 5).
    muscle: { schema: muscleSchema, bodyWords: { min: 40, max: 80 }, edges: muscleEdges, validate: validateMuscle },
    muscle_part: { schema: musclePartSchema, bodyWords: { min: 20, max: 60 }, edges: musclePartEdges, validate: validateMusclePart },
  },
  // Every muscle has an origin and an insertion; content/muscle-hierarchy.json (M12 plan decision 13).
  validate: validateMuscleLayer,
  // Derived edges (M12 plan decision 4): a part's inherited attachments, then synergists and antagonists.
  rules: [inheritAttachments, synergistsAndAntagonists],
  /** The content chunk's `derived` lists, read off the edges. */
  derivedLists,
  // The attachment patches (M6) as soft-to-id.json maps them.
  patches: (readJson) => {
    const raw = readJson("assets/mapping/soft-to-id.json") as { attachments: Record<string, { structures: string[]; end: Patch["end"]; on?: string | null }> };
    return Object.fromEntries(Object.entries(raw.attachments).map(([id, p]) => [id, { structures: p.structures, end: p.end, on: p.on ?? null }]));
  },
  // Side-free key → 1/2/3 (M7 session V).
  depthFile: "content/muscle-depth.json",
});
