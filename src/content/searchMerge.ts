// Merging the bone and soft-tissue search results (M9 plan decision 12). Its
// own module, free of minisearch, so the sidebar in the main chunk can use it.
import type { Searcher } from "./search";

/** The results of several searchers as one list, best score first; on a tie the earlier searcher's come first. */
export function mergeSearchers(...searchers: Searcher[]): Searcher {
  return (query, limit = 20) =>
    searchers
      .flatMap((s) => s(query, limit))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
}
