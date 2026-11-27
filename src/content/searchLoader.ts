// The search indexes, loaded on demand: one chunk per layer (M14 plan decision
// 4), named by its content half's `searchChunk` and imported through
// `virtual:skeleton-search-importers` (generated from the registry), with
// minisearch, the merge and the ranking in the search chunk. The sidebar asks
// for the eager layer's index when it opens or the field gets focus (Milestone 5
// plan decision 2), for a lazy layer's while that layer isn't Off, and for
// every layer's once a query is typed.
import importers from "virtual:skeleton-search-importers";
import { EAGER_LAYER, LAYER_IDS, type LayerId } from "../systems/registry";
import type { Searcher } from "./search";

const pending = new Map<LayerId, Promise<Searcher>>();
let mod: typeof import("./search") | null = null;
const searchModule = () => import("./search").then((m) => (mod = m));

/** A layer's searcher (fetched once). */
export function loadLayerSearch(layer: LayerId): Promise<Searcher> {
  let p = pending.get(layer);
  if (!p) {
    const load = importers[layer];
    if (!load) throw new Error(`no search index for layer ${layer}`);
    p = Promise.all([load(), searchModule()]).then(([data, search]) => search.loadSearcher(data.default));
    pending.set(layer, p);
  }
  return p;
}

/** The eager layer's searcher: the one the sidebar fetches first. */
export const loadSearch = (): Promise<Searcher> => loadLayerSearch(EAGER_LAYER);

/** Every layer's searcher, in registry order. */
export const loadAllSearch = (): Promise<Searcher[]> => Promise.all(LAYER_IDS.map(loadLayerSearch));

/** The searchers' results as one ranked list (`mergeSearchers`, searchMerge.ts). Only for searchers these loaders gave, so the search chunk is loaded. */
export const mergeSearchers =
  (...searchers: Searcher[]): Searcher =>
  (query, limit, context) =>
    mod!.mergeSearchers(...searchers)(query, limit, context);
