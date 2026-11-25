// The ligaments layer's authoring half: front matter schema (spec §4.4), summary length, edges and checks.
import { z } from "zod";
import { side, snake, text } from "../../../content/softFields";
import type { Edge } from "../../../graph/types";
import { defineLayerContent } from "../../contentTypes";
import { jointStructureCheck } from "../jointValidate";

/** Ligaments that may have `joint: null` (M8 plan decision 3), without side. */
export const LIGAMENT_NO_JOINT: ReadonlySet<string> = new Set([
  "inguinal_ligament",
  "interosseous_membrane_leg",
  "interosseous_membrane_forearm",
  "obturator_membrane",
  "sacrospinous_ligament",
  "sacrotuberous_ligament",
  "superior_transverse_scapular_ligament",
  "inferior_transverse_scapular_ligament",
  "coraco_acromial_ligament",
  "stylohyoid_ligament",
  "pterygospinous_ligament",
  "sphenomandibular_ligament",
  "nuchal_ligament",
  "external_intercostal_membrane",
  "internal_intercostal_membrane",
]);

/** Spec §4.4; `joint: null` only for the allow-listed ligaments (M8 plan decision 3). */
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

/** `connects`, in order, and `member_of_joint` (M12 plan decision 1). */
export const ligamentEdges = (fm: LigamentFm): Edge[] => [
  ...fm.connects.map((to) => ({ from: fm.id, type: "connects", to })),
  ...(fm.joint ? [{ from: fm.id, type: "member_of_joint", to: fm.joint }] : []),
];

export const ligamentsContent = defineLayerContent({
  folder: "ligaments",
  idsFile: "content/soft-ids.json",
  kinds: {
    ligament: { schema: ligamentSchema, bodyWords: { min: 40, max: 80 }, edges: ligamentEdges, validate: jointStructureCheck("connects", LIGAMENT_NO_JOINT) },
  },
  listedKeys: [...LIGAMENT_NO_JOINT],
});
