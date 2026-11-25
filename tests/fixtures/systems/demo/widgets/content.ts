// The fixture layer's authoring half: an ID table and a minimal schema per kind.
// No content files: the layer has no `contentChunk`, so its panel is the placeholder.
import { z } from "zod";
import { defineLayerContent } from "../../../../../src/systems/contentTypes";

const schema = (kind: string) => z.strictObject({ id: z.string(), kind: z.literal(kind), name: z.string(), reviewed: z.boolean() });

export const widgetsContent = defineLayerContent({
  folder: "widgets",
  idsFile: "tests/fixtures/systems/demo/widgets/ids.json",
  kinds: {
    gear: { schema: schema("gear"), bodyWords: { min: 1, max: 40 } },
    spring: { schema: schema("spring"), bodyWords: { min: 1, max: 40 } },
    lever: { schema: schema("lever"), bodyWords: { min: 1, max: 40 } },
  },
});
