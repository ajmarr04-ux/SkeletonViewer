// The search indexes' input, read from disk: ids.json, the compiled content and
// content/synonyms.json for the bones (Milestone 5); the soft-tissue table, the
// soft content's front matter, the soft tree and the group synonyms for the
// soft-tissue index (M9 plan decision 12). Shared by the Vite plugin and `npm run search-index`.
import { compileContent } from "../../src/content/compile";
import { oppositeOf } from "../../src/content/placeholder";
import { buildSearchData, searchDocuments, softSearchDocuments, type SearchData } from "../../src/content/search";
import { splitSynonyms, type SynonymsFile } from "../../src/content/schema";
import { compileAllSoftFromDisk, readContentFiles, readIds, readJson, readSoftIds } from "./content-files";
import { readSoftTree } from "./soft-tree-data";

const synonyms = () => splitSynonyms(readJson("content/synonyms.json") as SynonymsFile);

export function readSearchDocuments() {
  return searchDocuments(readIds(), compileContent(readContentFiles()), synonyms().ids, oppositeOf);
}

export const readSearchData = (): SearchData => buildSearchData(readSearchDocuments());

export function readSoftSearchDocuments() {
  const soft = compileAllSoftFromDisk();
  const fm = (id: string) => {
    for (const layer of Object.values(soft)) {
      const e = layer.entries[id];
      if (e) return e.fm as { latin?: string | null; commonName?: string | null };
    }
    return undefined;
  };
  const { ids, groups } = synonyms();
  return softSearchDocuments(readSoftIds() as Parameters<typeof softSearchDocuments>[0], fm, ids, groups, readSoftTree());
}

export const readSoftSearchData = (): SearchData => buildSearchData(readSoftSearchDocuments());
