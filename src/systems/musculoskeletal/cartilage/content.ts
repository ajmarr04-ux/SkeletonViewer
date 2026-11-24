// The cartilage layer's authoring half: front matter schema (spec §4.5) and summary lengths.
import { z } from "zod";
import { side, snake, text } from "../../../content/softFields";
import { defineLayerContent } from "../../contentTypes";
import { cartilage } from "./layer";

type CartilageKind = (typeof cartilage.kinds)[number]["id"];
/** The layer's kinds (cartilage, disc, meniscus), from its descriptor. */
const KINDS = cartilage.kinds.map((k) => k.id) as [CartilageKind, ...CartilageKind[]];

/** Spec §4.5. */
export const cartilageSchema = z.strictObject({
  id: snake,
  kind: z.enum(KINDS),
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

const words = { min: 40, max: 80 } as const;
export const cartilageContent = defineLayerContent({
  folder: "cartilage",
  kinds: {
    cartilage: { schema: cartilageSchema, bodyWords: words },
    disc: { schema: cartilageSchema, bodyWords: words },
    meniscus: { schema: cartilageSchema, bodyWords: words },
  },
});
