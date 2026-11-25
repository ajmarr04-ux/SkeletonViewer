// The registry's authoring half (M11 plan decision 2): each layer's content
// half, keyed by layer ID. For the content scripts, the content compiler and
// the Vite plugins; never imported by the main chunk (it pulls in zod and every
// schema). tests/registry.test.ts checks it covers exactly the registry's layers
// and kinds.

import type { z } from "zod";
import { compileGraph, type CompiledGraph, type EdgeRule, type EdgeSource } from "../graph/compile";
import type { Edge, GraphNode } from "../graph/types";
import type { EntryCheck, GraphContext, KindContent, LayerContent, SystemContent } from "./contentTypes";
import { musculoskeletalContent } from "./musculoskeletal/content";
import { bonesContent } from "./musculoskeletal/bones/content";
import { cartilageContent } from "./musculoskeletal/cartilage/content";
import { ligamentsContent } from "./musculoskeletal/ligaments/content";
import { musclesContent } from "./musculoskeletal/muscles/content";
import { DEPTH_LAYER, EDGE_TYPES, REGISTRY, type LayerId } from "./registry";

export const CONTENT_REGISTRY = {
  bones: bonesContent,
  cartilage: cartilageContent,
  ligaments: ligamentsContent,
  muscles: musclesContent,
} as const satisfies Record<LayerId, LayerContent>;

export const layerContent = (layer: LayerId): LayerContent => CONTENT_REGISTRY[layer];

/** The layer's content folder name (`content/<folder>/`). */
export const contentFolder = (layer: LayerId): string => layerContent(layer).folder;

const KINDS = new Map<string, KindContent>(Object.values(CONTENT_REGISTRY).flatMap((c: LayerContent) => Object.entries(c.kinds)));

/** The front matter schema for a kind, or null for a kind no layer has. */
export const schemaForKind = <T = unknown>(kind: string): z.ZodType<T> | null => (KINDS.get(kind)?.schema as z.ZodType<T> | undefined) ?? null;

/** The summary's length in words for a kind. */
export const bodyWordsOf = (kind: string): { min: number; max: number } | undefined => KINDS.get(kind)?.bodyWords;

/** A kind's cross-file check of one parsed entry (M12 plan decision 13), or undefined for a kind with none. */
export const entryCheckOf = (kind: string): ((fm: unknown, ctx: EntryCheck) => readonly string[]) | undefined =>
  KINDS.get(kind)?.validate as ((fm: unknown, ctx: EntryCheck) => readonly string[]) | undefined;

/** The depth layer's table (`content/muscle-depth.json`), relative to the repository root. */
export const DEPTH_FILE: string = layerContent(DEPTH_LAYER).depthFile!;

// --- The relationship graph from the authoring files (M12 plan decision 1) ---

/** Each system's authoring half, in system order. */
export const SYSTEM_CONTENT: readonly SystemContent[] = [musculoskeletalContent];

export type ContentGraphInput = {
  /** Parsed front matter by ID (any layers; a layer's extractors run on its own kinds). */
  fm: Readonly<Record<string, unknown>>;
  /** Every structure ID with its kind (the ID tables). */
  structures: readonly { id: string; kind: string }[];
  readJson: (rel: string) => unknown;
};

/**
 * Compile the graph: the systems' sources, then every entry's extracted edges
 * (layers in registry order, kinds in descriptor order, IDs sorted), then the
 * layers' rules (registry order) and the systems' rules. Pure apart from `readJson`.
 */
export function compileContentGraph(input: ContentGraphInput): CompiledGraph & { joints: GraphNode[] } {
  const kinds = new Map(input.structures.map((s) => [s.id, s.kind]));
  const base: GraphContext = { readJson: input.readJson, kindOf: (id) => kinds.get(id), fm: input.fm, nodes: input.structures.map((s) => s.id) };
  const joints = SYSTEM_CONTENT.flatMap((s) => s.nodes?.(base) ?? []);
  const ctx: GraphContext = { ...base, nodes: [...base.nodes, ...joints.map((j) => j.id)] };
  const sources: EdgeSource[] = SYSTEM_CONTENT.flatMap((s) => s.sources?.(ctx) ?? []);
  const ids = Object.keys(input.fm).sort();
  for (const l of REGISTRY) {
    const lc = layerContent(l.id);
    for (const k of l.kinds) {
      const extract = lc.kinds[k.id]?.edges as ((fm: unknown) => readonly Edge[]) | undefined;
      if (!extract) continue;
      for (const id of ids) if ((input.fm[id] as { kind?: string }).kind === k.id) sources.push({ where: `content/${lc.folder}/${id}.md`, edges: extract(input.fm[id]) });
    }
  }
  const rules: EdgeRule[] = [
    ...REGISTRY.flatMap((l) => (layerContent(l.id).rules ?? []).map((r) => ({ where: `${l.id} rules`, derive: (e: readonly Edge[]) => r(e, ctx) }))),
    ...SYSTEM_CONTENT.flatMap((s) => (s.rules ?? []).map((r) => ({ where: `${s.id} rules`, derive: (e: readonly Edge[]) => r(e, ctx) }))),
  ];
  return { ...compileGraph({ nodes: ctx.nodes, types: EDGE_TYPES, sources, rules }), joints };
}
