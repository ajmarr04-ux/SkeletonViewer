// The soft-tissue content model (musculoskeletal spec §4; M8 plan decisions 1
// to 8) as zod schemas: the front matter of content/muscles/<id>.md (muscles
// and parts), content/ligaments/<id>.md and content/cartilage/<id>.md, and the
// vocabulary files movements.json, joints.json and muscle-hierarchy.json.
// Used by the scripts, the content compiler and the tests; never by the main
// chunk.

import { z } from "zod";
import { PART_TYPES, type PartType } from "../systems/registry";

const snake = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "must be snake_case");
const text = z.string().trim().min(1);
const side = z.enum(["left", "right", "midline"]);

export const ROLES = ["prime", "assist", "stabiliser"] as const;
export const CARTILAGE_KINDS = ["cartilage", "disc", "meniscus"] as const;

/** Spec §4.2: on an existing structure (optionally at a landmark), or free text for a non-object. */
export const attachmentSchema = z.union([
  z.strictObject({ structure: snake, landmark: snake.optional() }),
  z.strictObject({ soft: text }),
]);
export type Attachment = z.infer<typeof attachmentSchema>;

/** Spec §4.3. `joint` is a pair joint from articulations.json or a functional joint (plan decision 2). */
export const actionSchema = z.strictObject({ joint: snake, movement: snake, role: z.enum(ROLES) });
export type Action = z.infer<typeof actionSchema>;

const overridesSchema = z.strictObject({ add: z.array(snake), remove: z.array(snake) });

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

const inheritable = z.union([z.literal("inherit"), z.array(attachmentSchema)]);

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

/** Spec §4.4; `joint: null` only for the allow-listed ligaments (plan decision 3). */
export const ligamentSchema = z.strictObject({
  id: snake,
  kind: z.literal("ligament"),
  name: text,
  latin: text,
  commonName: text.nullable(),
  side,
  joint: snake.nullable(),
  connects: z.array(snake).min(1),
  functions: z.array(text).min(1),
  clinicalNote: text.nullable(),
  reviewed: z.boolean(),
});
export type LigamentFm = z.infer<typeof ligamentSchema>;

/** Spec §4.5. */
export const cartilageSchema = z.strictObject({
  id: snake,
  kind: z.enum(CARTILAGE_KINDS),
  name: text,
  latin: text,
  commonName: text.nullable().optional(),
  side,
  joint: snake.nullable(),
  attachedTo: z.array(snake).min(1),
  functions: z.array(text).min(1),
  clinicalNote: text.nullable(),
  reviewed: z.boolean(),
});
export type CartilageFm = z.infer<typeof cartilageSchema>;

export type SoftFm = MuscleFm | MusclePartFm | LigamentFm | CartilageFm;

/** The schema for a kind from content/soft-ids.json. */
export function schemaForKind(kind: string): z.ZodType<SoftFm> | null {
  switch (kind) {
    case "muscle":
      return muscleSchema;
    case "muscle_part":
      return musclePartSchema;
    case "ligament":
      return ligamentSchema;
    case "cartilage":
    case "disc":
    case "meniscus":
      return cartilageSchema;
    default:
      return null;
  }
}

/** Summary lengths in words (spec §4.1, §4.2; plan decision 5). */
export const SOFT_BODY_WORDS: Record<string, { min: number; max: number }> = {
  muscle: { min: 40, max: 80 },
  muscle_part: { min: 20, max: 60 },
  ligament: { min: 40, max: 80 },
  cartilage: { min: 40, max: 80 },
  disc: { min: 40, max: 80 },
  meniscus: { min: 40, max: 80 },
};

/** The content folder for each layer (plan decision 1). */
export const LAYER_FOLDERS = { muscles: "muscles", ligaments: "ligaments", cartilage: "cartilage" } as const;
export type SoftLayer = keyof typeof LAYER_FOLDERS;

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
