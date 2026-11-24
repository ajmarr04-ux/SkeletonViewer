// The ligaments layer's authoring half: front matter schema (spec §4.4) and summary length.
import { z } from "zod";
import { side, snake, text } from "../../../content/softFields";
import { defineLayerContent } from "../../contentTypes";

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

export const ligamentsContent = defineLayerContent({
  folder: "ligaments",
  idsFile: "content/soft-ids.json",
  kinds: { ligament: { schema: ligamentSchema, bodyWords: { min: 40, max: 80 } } },
});
