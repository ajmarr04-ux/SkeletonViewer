// The search index, loaded on demand (plan decision 2): its own chunk, fetched
// when the sidebar first opens or the search field gets focus.
import { loadSearcher, type Searcher } from "./search";

let pending: Promise<Searcher> | null = null;

export function loadSearch(): Promise<Searcher> {
  pending ??= import("virtual:skeleton-search").then((m) => loadSearcher(m.default));
  return pending;
}
