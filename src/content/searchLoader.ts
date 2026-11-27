// The search indexes, loaded on demand (plan decision 2): the bone index and
// minisearch itself are their own chunks, fetched when the sidebar first opens
// or the search field gets focus. The soft-tissue index (M9 plan decision 12)
// is a second chunk, fetched when the search field gets its first keystroke.
// The merge and the ranking (M14 plan decision 1) are in the search chunk too.
import type { Searcher } from "./search";

let pending: Promise<Searcher> | null = null;
let pendingSoft: Promise<Searcher> | null = null;
let mod: typeof import("./search") | null = null;
const searchModule = () => import("./search").then((m) => (mod = m));

export function loadSearch(): Promise<Searcher> {
  pending ??= Promise.all([import("virtual:skeleton-search"), searchModule()]).then(([data, search]) => search.loadSearcher(data.default));
  return pending;
}

export function loadSoftSearch(): Promise<Searcher> {
  pendingSoft ??= Promise.all([import("virtual:skeleton-search-soft"), searchModule()]).then(([data, search]) => search.loadSearcher(data.default));
  return pendingSoft;
}

/** The searchers' results as one ranked list (`mergeSearchers`, searchMerge.ts). Only for searchers these loaders gave, so the search chunk is loaded. */
export const mergeSearchers =
  (...searchers: Searcher[]): Searcher =>
  (query, limit, context) =>
    mod!.mergeSearchers(...searchers)(query, limit, context);
