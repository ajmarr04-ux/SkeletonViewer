// The search indexes' input, read from disk (M14 plan decision 4): one index per
// layer, each built by `layerSearchDocuments` from the layer's ID table, its
// compiled content (the bones' compiler for the eager layer, the soft compiler
// for the others), content/synonyms.json and, for the group synonyms, the
// sidebar tree. Shared by the Vite plugin, `npm run search-index` and the tests.
import { compileContent } from "../../src/content/compile";
import { oppositeOf } from "../../src/content/placeholder";
import { buildSearchData, type SearchData, type SearchDoc } from "../../src/content/search";
import { layerSearchDocuments, type SearchLayer, type SearchRow } from "../../src/content/searchDocuments";
import { splitSynonyms, type SynonymsFile } from "../../src/content/schema";
import type { SoftLayerContent } from "../../src/content/softCompile";
import { EAGER_LAYER, LAYER_IDS, LAZY_LAYERS, layerDescriptor, type LayerId, type LazyLayerId } from "../../src/systems/registry";
import type { SoftTreeData } from "../../src/tree/types";
import { compileAllSoftFromDisk, readContentFiles, readIds, readJson, readSoftIds } from "./content-files";
import { readSoftTree } from "./soft-tree-data";

const synonyms = () => splitSynonyms(readJson("content/synonyms.json") as SynonymsFile);

/** A lazy layer's right-side structure → its left twin. */
const leftTwin = (id: string): string => id.replace(/_right$/, "_left");

/** A lazy layer's compiled content as search reads it. */
export const softField =
  (content: SoftLayerContent) =>
  (id: string, name: "latin" | "commonName"): string | null | undefined =>
    (content.entries[id]?.fm as Record<string, string | null | undefined> | undefined)?.[name];

/** A lazy layer's documents from its compiled content, rows and the tree (the fixture's widgets use this too). */
export function lazySearchDocuments(layer: SearchLayer, rows: readonly SearchRow[], content: SoftLayerContent, tree: SoftTreeData): SearchDoc[] {
  const { ids, groups } = synonyms();
  return layerSearchDocuments(layer, { rows, field: softField(content), synonyms: ids, opposite: leftTwin, groups, tree });
}

/** Every layer's documents, by layer (the soft content and the tree compiled once). */
export function readAllSearchDocuments(): Record<LayerId, SearchDoc[]> {
  const bones = compileContent(readContentFiles());
  const out = {
    [EAGER_LAYER]: layerSearchDocuments(layerDescriptor(EAGER_LAYER), {
      rows: readIds(),
      field: (id, name) => (name === "latin" ? bones[id]?.latin : bones[id]?.common),
      synonyms: synonyms().ids,
      opposite: oppositeOf,
    }),
  } as Record<LayerId, SearchDoc[]>;
  const soft = compileAllSoftFromDisk();
  const tree = readSoftTree();
  const rows = readSoftIds() as unknown as (SearchRow & { layer: string })[];
  for (const l of LAZY_LAYERS)
    out[l] = lazySearchDocuments(
      layerDescriptor(l),
      rows.filter((e) => e.layer === l),
      soft[l as LazyLayerId],
      tree,
    );
  return out;
}

/** Every layer's index data, in registry order. */
export function readAllSearchData(): Record<LayerId, SearchData> {
  const docs = readAllSearchDocuments();
  return Object.fromEntries(LAYER_IDS.map((l) => [l, buildSearchData(docs[l])])) as Record<LayerId, SearchData>;
}

/** The eager layer's documents (the bones' index before M14). */
export const readSearchDocuments = (): SearchDoc[] => readAllSearchDocuments()[EAGER_LAYER];

/** Every lazy layer's documents, one list (the soft-tissue index before M14). */
export function readSoftSearchDocuments(): SearchDoc[] {
  const all = readAllSearchDocuments();
  return LAZY_LAYERS.flatMap((l) => all[l]);
}
