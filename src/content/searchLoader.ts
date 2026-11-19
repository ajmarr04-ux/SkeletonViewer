// The search index, loaded on demand (plan decision 2): the index and
// minisearch itself are their own chunks, fetched when the sidebar first opens
// or the search field gets focus.
import type { Searcher } from "./search";

let pending: Promise<Searcher> | null = null;

export function loadSearch(): Promise<Searcher> {
  pending ??= Promise.all([import("virtual:skeleton-search"), import("./search")]).then(([data, search]) => search.loadSearcher(data.default));
  return pending;
}
