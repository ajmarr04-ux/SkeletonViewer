// The fixture layer's authoring half: an ID table, a schema per kind and the
// edges each widget's front matter declares (M12 plan decision 14). The files
// are `content/<id>.md` next to this one (never under the repository's content/,
// which the fixture doesn't touch); the fixture build compiles them into the
// layer's content chunk (../../vite.ts).
import { z } from "zod";
import type { Edge } from "../../../../../src/graph/types";
import { defineLayerContent } from "../../../../../src/systems/contentTypes";

/** The widgets' content folder, relative to the repository root. */
export const WIDGETS_DIR = "tests/fixtures/systems/demo/widgets/content";

const widgetId = z.string().regex(/^widget_[a-z]+_\d+$/);
const schema = (kind: string) =>
  z.strictObject({
    id: widgetId,
    kind: z.literal(kind),
    name: z.string(),
    latin: z.null(),
    commonName: z.string().nullable(),
    /** The assembly it belongs to (the tree's level under its kind), or null. */
    assembly: z.string().nullable(),
    meshesWith: z.array(widgetId),
    drives: z.array(widgetId),
    reviewed: z.boolean(),
  });
export type WidgetFm = z.infer<ReturnType<typeof schema>>;

/** `meshesWith` → `meshes_with` (symmetric), `drives` → `drives`, as written. */
export const widgetEdges = (fm: WidgetFm): Edge[] => [
  ...fm.meshesWith.map((to) => ({ from: fm.id, type: "meshes_with", to })),
  ...fm.drives.map((to) => ({ from: fm.id, type: "drives", to })),
];

const kind = (k: string) => ({ schema: schema(k), bodyWords: { min: 1, max: 40 }, edges: widgetEdges });

export const widgetsContent = defineLayerContent({
  folder: "widgets",
  searchChunk: "virtual:skeleton-search-widgets",
  idsFile: "tests/fixtures/systems/demo/widgets/ids.json",
  kinds: { gear: kind("gear"), spring: kind("spring"), lever: kind("lever") },
});
