// Field schemas shared by the soft-tissue layers' front matter (musculoskeletal
// spec §4): IDs, text, sides, attachments and actions. Each layer's own schemas
// are in its content half (`src/systems/<system>/<layer>/content.ts`, M11 plan
// decision 2); `softSchema.ts` gathers them. Scripts and tests only, never the
// main chunk.

import { z } from "zod";

export const snake = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "must be snake_case");
export const text = z.string().trim().min(1);
export const side = z.enum(["left", "right", "midline"]);

export const ROLES = ["prime", "assist", "stabiliser"] as const;

/** Spec §4.2: on an existing structure (optionally at a landmark), or free text for a non-object. */
export const attachmentSchema = z.union([
  z.strictObject({ structure: snake, landmark: snake.optional() }),
  z.strictObject({ soft: text }),
]);
export type Attachment = z.infer<typeof attachmentSchema>;

/** Spec §4.3. `joint` is a pair joint from articulations.json or a functional joint (plan decision 2). */
export const actionSchema = z.strictObject({ joint: snake, movement: snake, role: z.enum(ROLES) });
export type Action = z.infer<typeof actionSchema>;

export const overridesSchema = z.strictObject({ add: z.array(snake), remove: z.array(snake) });

/** A part's origin or insertion: its muscle's, or its own. */
export const inheritable = z.union([z.literal("inherit"), z.array(attachmentSchema)]);
