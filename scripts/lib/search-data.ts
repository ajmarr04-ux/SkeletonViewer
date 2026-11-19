// The search index's input, read from disk: ids.json, the compiled content and
// content/synonyms.json. Shared by the Vite plugin and `npm run search-index`.
import { compileContent } from "../../src/content/compile";
import { oppositeOf } from "../../src/content/placeholder";
import { buildSearchData, searchDocuments, type SearchData } from "../../src/content/search";
import type { Synonyms } from "../../src/content/schema";
import { readContentFiles, readIds, readJson } from "./content-files";

export function readSearchDocuments() {
  return searchDocuments(readIds(), compileContent(readContentFiles()), readJson("content/synonyms.json") as Synonyms, oppositeOf);
}

export const readSearchData = (): SearchData => buildSearchData(readSearchDocuments());
