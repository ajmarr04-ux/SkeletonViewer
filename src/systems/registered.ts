// The registered systems and layers, in order (SPEC-platform §3.2). Kept apart
// from the lookups in `registry.ts` so a test build can swap this one list
// (`vite build --mode fixture` resolves it to tests/fixtures/systems/registry.ts,
// M11 plan decision 8) and every lookup follows. Main chunk: data only.

import { bones } from "./musculoskeletal/bones/layer";
import { cartilage } from "./musculoskeletal/cartilage/layer";
import { ligaments } from "./musculoskeletal/ligaments/layer";
import { muscles } from "./musculoskeletal/muscles/layer";
import { musculoskeletal } from "./musculoskeletal/system";
import type { LayerDescriptor, SystemDescriptor } from "./types";

/** Systems, in Layers-panel order. */
export const SYSTEMS = [musculoskeletal] as const satisfies readonly SystemDescriptor[];

/** Layers, in Layers-panel and URL order. */
export const REGISTRY = [bones, cartilage, ligaments, muscles] as const satisfies readonly LayerDescriptor[];
