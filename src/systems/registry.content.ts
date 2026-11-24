// The registry's authoring half (M11 plan decision 2): each layer's content
// half, keyed by layer ID. For the content scripts, the content compiler and
// the Vite plugins; never imported by the main chunk (it pulls in zod and every
// schema). tests/registry.test.ts checks it covers exactly the registry's layers
// and kinds.

import type { z } from "zod";
import type { KindContent, LayerContent } from "./contentTypes";
import { bonesContent } from "./musculoskeletal/bones/content";
import { cartilageContent } from "./musculoskeletal/cartilage/content";
import { ligamentsContent } from "./musculoskeletal/ligaments/content";
import { musclesContent } from "./musculoskeletal/muscles/content";
import { DEPTH_LAYER, type LayerId } from "./registry";

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

/** The depth layer's table (`content/muscle-depth.json`), relative to the repository root. */
export const DEPTH_FILE: string = layerContent(DEPTH_LAYER).depthFile!;
