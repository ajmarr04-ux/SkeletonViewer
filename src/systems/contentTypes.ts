// The authoring half of a layer descriptor (M11 plan decision 2): what the
// content scripts, the content compiler and the Vite plugins need to read and
// check a layer's files. Imports zod, so only `registry.content.ts` and the
// layers' `content.ts` files import this; never the main chunk.

import type { z } from "zod";
import type { Edge, GraphNode } from "../graph/types";
import type { Patch } from "./types";

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

/** A row of a lazy layer's generated ID table (`idsFile`, e.g. content/soft-ids.json). */
export type IdRow = {
  id: string;
  name: string;
  latin: string | null;
  kind: string;
  layer: string;
  side: "left" | "right" | "midline";
  group: string[];
  meshAvailable: boolean;
  parent?: string | null;
  partType?: string;
  parts?: string[];
  alsoServes?: string[];
  inconstant?: boolean;
};

/**
 * What a kind's cross-file check may read (M12 plan decision 13): the file's
 * place in messages, its ID table row, every row, and the vocabularies the
 * validator has already read. `ref` is the common reference check (the ID
 * exists and isn't on the other side), as error lines.
 */
export type EntryCheck = {
  where: string;
  entry: IdRow;
  row: (id: string) => IdRow | undefined;
  known: (id: string) => boolean;
  ref: (field: string, id: string) => string[];
  /** A joint of articulations.json or joints.json. */
  isJoint: (id: string) => boolean;
  /** Is the ID an eager-layer structure (those have landmarks)? */
  eager: (id: string) => boolean;
  /** The landmark IDs of an eager structure's content file; undefined when it has none. */
  landmarksOf: (id: string) => ReadonlySet<string> | undefined;
  /** content/movements.json's movements (empty when that file didn't parse). */
  movements: ReadonlySet<string>;
  /** content/QUESTIONS.md. */
  questions: string;
};

/** What a layer's checks across its entries may read (M12 plan decision 13). */
export type LayerCheck = {
  /** Every row of the lazy layers' ID tables. */
  rows: readonly IdRow[];
  /** Parsed front matter by ID (valid files only, every lazy layer). */
  parsed: ReadonlyMap<string, unknown>;
  /** Missing files (and the rules that need them) are counted, not failed (M8 plan decision 10). */
  allowMissing: boolean;
  opposite: (id: string) => string | null;
  /** The validator's input by name (the vocabulary files it was given, e.g. `muscleHierarchy`). */
  input: Readonly<Record<string, unknown>>;
};

/** A kind's front matter schema and summary length (spec §4; M8 plan decision 5). */
export type KindContent = {
  schema: z.ZodType;
  /** Words in the summary (the body below the front matter). */
  bodyWords: { readonly min: number; readonly max: number };
  /** The edges one entry's front matter declares (spec §4.1; parsed by `schema` first). */
  edges?: (fm: never) => readonly Edge[];
  /** Cross-file checks of one entry (parsed by `schema` first), as error lines (M12 plan decision 13). */
  validate?: (fm: never, ctx: EntryCheck) => readonly string[];
};

export type LayerContent = {
  /** `content/<folder>/<id>.md`. */
  folder: string;
  /** The layer's search index, a lazy chunk of its own (virtual module name; M14 plan decision 4): `virtual:skeleton-search-<layer>`. */
  searchChunk: string;
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
  /** Checks across the layer's entries (and its vocabulary files), as error lines; run after every file is parsed. */
  validate?: (ctx: LayerCheck) => readonly string[];
  /** Side-free keys the layer's rules name (allow-lists); each must be in its ID table. */
  listedKeys?: readonly string[];
  /** The attachment patches its overlay draws (M9 plan decision 6), shipped in the layer's content chunk for the tints (M12 plan decision 8). */
  patches?: (readJson: (rel: string) => unknown) => Record<string, Patch>;
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
