// The soft-tissue content model (musculoskeletal spec §4; M8 plan decisions 1
// to 8) as zod schemas: the vocabulary files movements.json, joints.json and
// muscle-hierarchy.json, and (re-exported from each layer's content half,
// M11 plan decision 2) the structures' front matter.
// Used by the scripts, the content compiler and the tests; never by the main
// chunk.

import { z } from "zod";
import type { CartilageFm } from "../systems/musculoskeletal/cartilage/content";
import type { LigamentFm } from "../systems/musculoskeletal/ligaments/content";
import type { MuscleFm, MusclePartFm } from "../systems/musculoskeletal/muscles/content";
import { side, snake, text } from "./softFields";

// The layers' own schemas live in their content halves (M11 plan decision 2).
export type { Action, Attachment } from "./softFields";
export type { CartilageFm, LigamentFm, MuscleFm, MusclePartFm };

export type SoftFm = MuscleFm | MusclePartFm | LigamentFm | CartilageFm;

/** content/movements.json (spec §4.3). */
export const movementsSchema = z.strictObject({
  movements: z.array(snake).min(1),
  antagonistPairs: z.array(z.tuple([snake, snake])),
});
export type Movements = z.infer<typeof movementsSchema>;

/** content/joints.json (plan decision 2): a named set of existing articulation pairs. */
export const functionalJointSchema = z.strictObject({
  id: snake,
  name: text,
  side,
  articulations: z.array(snake).min(2),
});
export const jointsSchema = z.array(functionalJointSchema);
export type FunctionalJoint = z.infer<typeof functionalJointSchema>;

/** content/muscle-hierarchy.json (plan decision 8): regions and compartments; leaves are muscle IDs. */
export type MuscleHierarchyNode = { key: string; label: string; children: (MuscleHierarchyNode | string)[] };
export const muscleHierarchyNodeSchema: z.ZodType<MuscleHierarchyNode> = z.lazy(() =>
  z.strictObject({ key: snake, label: text, children: z.array(z.union([snake, muscleHierarchyNodeSchema])) }),
);
export const muscleHierarchySchema = z.array(muscleHierarchyNodeSchema);
