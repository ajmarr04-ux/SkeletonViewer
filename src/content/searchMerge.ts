// Merging the search indexes' results (M9 plan decision 12; M14 plan decision
// 1: by the ranking's facts, never by score), and search's last tie-break.
// Free of minisearch, but in the search chunk (search.ts imports it): the
// sidebar reaches it through searchLoader.ts once a searcher has loaded.
import ids from "../../content/ids.json";
import { LAYER_IDS } from "../systems/registry";
import { lazyEntries, layerOfId } from "./index";
import { rankHits, type RankContext } from "./searchRank";
import type { Searcher } from "./search";

let order: ((id: string) => number) | null = null;

/**
 * Search's last tie-break: the layers in registry order, each in its ID file's
 * order (anatomical: "Costal cartilage of rib 2" after rib 1, discs from C2 down),
 * not `indexRank`'s sorted IDs.
 */
export function searchOrder(): (id: string) => number {
  if (!order) {
    const entries = [...(ids as { id: string }[]), ...lazyEntries()];
    const layer = (id: string) => LAYER_IDS.indexOf(layerOfId(id)!);
    const sorted = entries.map((e, i) => ({ id: e.id, i, l: layer(e.id) })).sort((a, b) => a.l - b.l || a.i - b.i);
    const rank = new Map(sorted.map((e, i) => [e.id, i]));
    order = (id) => rank.get(id) ?? Infinity;
  }
  return order;
}

/** The results of several searchers as one ranked list; `searchOrder` is the last tie-break unless the context gives one. */
export function mergeSearchers(...searchers: Searcher[]): Searcher {
  return (query, limit = 20, context?: RankContext) => {
    const ctx = { rank: searchOrder(), ...context };
    return rankHits(
      searchers.flatMap((s) => s(query, Infinity, ctx)),
      ctx,
    ).slice(0, limit);
  };
}
