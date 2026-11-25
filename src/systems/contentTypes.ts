// The authoring half of a layer descriptor (M11 plan decision 2): what the
// content scripts, the content compiler and the Vite plugins need to read and
// check a layer's files. Imports zod, so only `registry.content.ts` and the
// layers' `content.ts` files import this; never the main chunk.

import type { z } from "zod";
import type { Edge, GraphNode } from "../graph/types";

/**
 * What an edge source or rule may read (M12 plan decision 1): the authoring
 * JSON files, every structure's kind, the front matter compiled in this run
 * (by ID, all layers given) and every node ID.
 */
export type GraphContext = {
  readJson: (rel: string) => unknown;
  kindOf: (id: string) => string | undefined;
  fm: Readonly<Record<string, unknown>>;
  nodes: readonly string[];
};

/** Derived edges (spec §4.4): the edges so far → new ones. */
export type GraphRule = (edges: readonly Edge[], ctx: GraphContext) => readonly Edge[];

/** A kind's front matter schema and summary length (spec §4; M8 plan decision 5). */
export type KindContent = {
  schema: z.ZodType;
  /** Words in the summary (the body below the front matter). */
  bodyWords: { readonly min: number; readonly max: number };
  /** The edges one entry's front matter declares (spec §4.1; parsed by `schema` first). */
  edges?: (fm: never) => readonly Edge[];
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
  /** Rules for derived edges, run after every extracted edge (M12 plan decision 4). */
  rules?: readonly GraphRule[];
  /** The content chunk's derived lists (`SoftDerived`), read off the compiled edges for this layer's IDs; the layers with none ship `derived: null`. */
  derivedLists?: (edges: readonly Edge[], ids: readonly string[]) => unknown;
};

/** A system's authoring half: edges from files that aren't one structure's front matter, the non-structure nodes, rules across its layers. */
export type SystemContent = {
  id: string;
  /** Each source names its file, for the error messages. */
  sources?: (ctx: GraphContext) => readonly { where: string; edges: readonly Edge[] }[];
  nodes?: (ctx: GraphContext) => readonly GraphNode[];
  /** Run after every layer's rules. */
  rules?: readonly GraphRule[];
};

export const defineLayerContent = <const D extends LayerContent>(d: D): D => d;
export const defineSystemContent = <const D extends SystemContent>(d: D): D => d;
