// The search indexes, loaded on demand (plan decision 2): the bone index and
// minisearch itself are their own chunks, fetched when the sidebar first opens
// or the search field gets focus. The soft-tissue index (M9 plan decision 12)
// is a second chunk, fetched when the search field gets its first keystroke.
import type { Searcher } from "./search";

let pending: Promise<Searcher> | null = null;
let pendingSoft: Promise<Searcher> | null = null;

export function loadSearch(): Promise<Searcher> {
  pending ??= Promise.all([import("virtual:skeleton-search"), import("./search")]).then(([data, search]) => search.loadSearcher(data.default));
  return pending;
}

export function loadSoftSearch(): Promise<Searcher> {
  pendingSoft ??= Promise.all([import("virtual:skeleton-search-soft"), import("./search")]).then(([data, search]) => search.loadSearcher(data.default));
  return pendingSoft;
}
