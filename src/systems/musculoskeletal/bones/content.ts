// The bones layer's authoring half. Its validation and compiler stay on their
// M10 code (`src/content/validate.ts`, `compile.ts`) until M12 (M11 plan decision 3).
import { BODY_WORDS, frontMatterSchema } from "../../../content/schema";
import { adjacentTeeth } from "./teeth";
import type { Edge } from "../../../graph/types";
import { defineLayerContent, type GraphContext } from "../../contentTypes";

/** `adjacent_tooth` (M12 plan decision 2): each tooth's neighbours in its arch, in the panel's order (mesial first). */
export const adjacentToothEdges = (_: readonly Edge[], ctx: GraphContext): Edge[] =>
  ctx.nodes.filter((id) => ctx.kindOf(id) === "tooth").flatMap((id) => adjacentTeeth(id).map((to) => ({ from: id, type: "adjacent_tooth", to })));

export const bonesContent = defineLayerContent({
  folder: "bones",
  kinds: {
    bone: { schema: frontMatterSchema, bodyWords: BODY_WORDS },
    tooth: { schema: frontMatterSchema, bodyWords: BODY_WORDS },
  },
  rules: [adjacentToothEdges],
});
