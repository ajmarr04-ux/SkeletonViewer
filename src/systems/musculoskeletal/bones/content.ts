// The bones layer's authoring half. Its validation and compiler stay on their
// M10 code (`src/content/validate.ts`, `compile.ts`) until M12 (M11 plan decision 3).
import { BODY_WORDS, frontMatterSchema } from "../../../content/schema";
import { defineLayerContent } from "../../contentTypes";

export const bonesContent = defineLayerContent({
  folder: "bones",
  kinds: {
    bone: { schema: frontMatterSchema, bodyWords: BODY_WORDS },
    tooth: { schema: frontMatterSchema, bodyWords: BODY_WORDS },
  },
});
