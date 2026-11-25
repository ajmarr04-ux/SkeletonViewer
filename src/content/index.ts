// The always-loaded ID index (M12 plan decision 7, SPEC-platform §4.5): every
// structure of every layer, and the graph's non-structure nodes (the joints),
// known from the first frame. Replaces M7's lazy soft-tissue table and its
// "unknown until the table loads" state.
//
// Two halves, both in the main chunk:
// - the eager layer's structures, content/ids.json (imported here, so the
//   build scripts that name bones through `names.ts` see them too);
// - everything else, `virtual:skeleton-index` (scripts/lib/index-plugin.ts),
//   handed over once by src/content/indexData.ts, which the app's entry
//   (src/main.tsx) and Vitest's setup file import before anything else. The
//   build scripts and Vite plugins never import it: there the lazy layers are
//   unknown, as they were before M12.

import ids from "../../content/ids.json";
import type { GraphNode } from "../graph/types";
import type { SoftId } from "../layers/softIds";
import type { LayerId, LazyLayerId } from "../systems/registry";

/**
 * `virtual:skeleton-index`: the eager layer's ID, the lazy layers' entries in
 * their files' order, and the joint nodes. (The eager layer comes with the data
 * so this module imports nothing from the registry at run time: Vitest's setup
 * file loads it before a test can swap the registry's list.)
 */
export type IndexData = { eager: LayerId; entries: SoftId[]; nodes: GraphNode[] };

type EagerEntry = { id: string; meshAvailable: boolean };
const EAGER = ids as EagerEntry[];
const KNOWN = new Set(EAGER.map((e) => e.id));
const WITH_MESH = new Set(EAGER.filter((e) => e.meshAvailable).map((e) => e.id));

let eagerLayer: LayerId | null = null;
let lazy = new Map<string, SoftId>();
let lazyOrder: readonly SoftId[] = [];
let nodes = new Map<string, GraphNode>();

/** Called once by src/content/indexData.ts. */
export function setIndex(data: IndexData): void {
  eagerLayer = data.eager;
  lazy = new Map(data.entries.map((e) => [e.id, e]));
  lazyOrder = data.entries;
  nodes = new Map(data.nodes.map((n) => [n.id, n]));
}

/** A lazy layer's structure (`SoftId`), or undefined. */
export const lazyEntry = (id: string): SoftId | undefined => lazy.get(id);
/** Every lazy layer's structure, in the ID files' order. */
export const lazyEntries = (): readonly SoftId[] => lazyOrder;
/** An eager-layer structure (a bone or tooth). */
export const isEagerId = (id: string): boolean => KNOWN.has(id);
/** A node of the graph that isn't a structure (a joint): its kind of node and name. */
export const indexNode = (id: string): GraphNode | undefined => nodes.get(id);

/** Any structure of any layer (not a joint node). */
export const isKnownId = (id: string): boolean => KNOWN.has(id) || lazy.has(id);
/** False for the four wisdom teeth, the parent muscles and the structures the source lacks. */
export const hasMesh = (id: string): boolean => WITH_MESH.has(id) || lazy.get(id)?.mesh === true;
/** The layer a structure is drawn in, or null if unknown. */
export const layerOfId = (id: string): LayerId | null => (KNOWN.has(id) ? eagerLayer : (lazy.get(id)?.layer ?? null));
/** The lazy layer a structure is drawn in, or null for an unknown or eager ID. */
export const lazyLayerOf = (id: string): LazyLayerId | null => lazy.get(id)?.layer ?? null;
