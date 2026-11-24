// The authoring half of a layer descriptor (M11 plan decision 2): what the
// content scripts, the content compiler and the Vite plugins need to read and
// check a layer's files. Imports zod, so only `registry.content.ts` and the
// layers' `content.ts` files import this; never the main chunk.

import type { z } from "zod";

/** A kind's front matter schema and summary length (spec §4; M8 plan decision 5). */
export type KindContent = {
  schema: z.ZodType;
  /** Words in the summary (the body below the front matter). */
  bodyWords: { readonly min: number; readonly max: number };
};

export type LayerContent = {
  /** `content/<folder>/<id>.md`. */
  folder: string;
  /** One entry per kind of the layer's descriptor (checked by tests/registry.test.ts). */
  kinds: Readonly<Record<string, KindContent>>;
  /** A lazy layer's generated ID table (`[{ id, name, kind, layer, side, meshAvailable, … }]`, relative to the repository root); entries of other layers in the same file are left to those layers. */
  idsFile?: string;
  /** The layer's depth table (`content/…`), for the layer whose descriptor has `depth`. */
  depthFile?: string;
};

export const defineLayerContent = <const D extends LayerContent>(d: D): D => d;
