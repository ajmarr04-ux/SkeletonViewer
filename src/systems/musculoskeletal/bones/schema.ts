// The bones layer's front matter and relationship files (spec §5) as zod
// schemas: content/bones/<id>.md, articulations.json, regions.json and
// hierarchy.json. Moved from src/content/schema.ts (M12 plan decision 13).
// Authoring half: validation, the compiler and the scripts; never the main chunk.

import { z } from "zod";

const snake = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "must be snake_case");
const text = z.string().trim().min(1);

export const BONE_TYPES = ["long", "short", "flat", "irregular", "sesamoid", "tooth"] as const;
export const TOOTH_TYPES = ["incisor", "canine", "premolar", "molar"] as const;

export const landmarkSchema = z.strictObject({
  id: snake,
  name: text,
  /** Null unless derived from the mesh or supplied by a human (spec §5): never invented. */
  position: z.tuple([z.number(), z.number(), z.number()]).nullable(),
});

export const frontMatterSchema = z
  .strictObject({
    id: snake,
    name: text,
    latin: text,
    commonName: text.nullable(),
    side: z.enum(["left", "right", "midline"]),
    kind: z.enum(["bone", "tooth"]),
    region: z.array(snake).min(1),
    type: z.enum(BONE_TYPES),
    toothType: z.enum(TOOTH_TYPES).nullable(),
    /** Terminologia Anatomica 2 ID, only from a real reference (spec §5). */
    ta2: z.string().regex(/^\d+$/, "TA2 IDs are numbers").nullable(),
    functions: z.array(text).min(1),
    landmarks: z.array(landmarkSchema),
    clinicalNote: text.nullable(),
    reviewed: z.boolean(),
  })
  .superRefine((fm, ctx) => {
    if (fm.kind === "tooth") {
      if (fm.type !== "tooth") ctx.addIssue({ code: "custom", path: ["type"], message: "teeth have type: tooth" });
      if (fm.toothType === null) ctx.addIssue({ code: "custom", path: ["toothType"], message: "teeth need a toothType" });
    } else {
      if (fm.type === "tooth") ctx.addIssue({ code: "custom", path: ["type"], message: "bones can't have type: tooth" });
      if (fm.toothType !== null) ctx.addIssue({ code: "custom", path: ["toothType"], message: "toothType is null for bones" });
    }
    const lm = fm.landmarks.map((l) => l.id);
    const dup = lm.find((l, i) => lm.indexOf(l) !== i);
    if (dup) ctx.addIssue({ code: "custom", path: ["landmarks"], message: `duplicate landmark id ${dup}` });
  });
export type FrontMatter = z.infer<typeof frontMatterSchema>;

export const articulationSchema = z.strictObject({
  a: snake,
  b: snake,
  joint: snake,
  name: text,
  /** Contact surfaces: object ID → landmark ID in that object's file. */
  surfaces: z.record(snake, snake).optional(),
});
export const articulationsSchema = z.array(articulationSchema);
export type Articulation = z.infer<typeof articulationSchema>;

export const regionsSchema = z.record(snake, z.array(snake));
export type Regions = z.infer<typeof regionsSchema>;

export type HierarchyNode = { key: string; label: string; children: (HierarchyNode | string)[] };
export const hierarchyNodeSchema: z.ZodType<HierarchyNode> = z.lazy(() =>
  z.strictObject({ key: z.string().min(1), label: text, children: z.array(z.union([snake, hierarchyNodeSchema])).min(1) }),
);
export const hierarchySchema = z.array(hierarchyNodeSchema);

/** Body length rule (spec §5): a 40 to 80 word summary. */
export const BODY_WORDS = { min: 40, max: 80 } as const;
