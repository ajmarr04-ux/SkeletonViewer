// The widgets' content chunk, sidebar root and search index, compiled from the
// files next to this one by the app's own generic code (M12 plan decision 14):
// the soft compiler with the layer's content half, the graph compiler with the
// demo system's registry, the shipping rule, the `byKind` tree builder and (M14
// plan decision 4) the search document builder with the kinds' `searchFields`. Node only
// (reads the disk): the fixture build (../../vite.ts) and tests/fixture.test.ts.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildSearchData, type SearchData } from "../../../../../src/content/search";
import type { SearchRow } from "../../../../../src/content/searchDocuments";
import { compileSoftLayer, type SoftLayerContent } from "../../../../../src/content/softCompile";
import { lazySearchDocuments } from "../../../../../scripts/lib/search-data";
import { encodeEdges } from "../../../../../src/graph/codec";
import { shipEdges } from "../../../../../src/graph/ship";
import type { CompiledGraph } from "../../../../../src/graph/compile";
import { EAGER_LAYER, type LazyLayerId } from "../../../../../src/systems/registry";
import { compileContentGraph } from "../../../../../src/systems/registry.content";
import { buildSoftTrees } from "../../../../../src/tree/build";
import type { TreeEntry } from "../../../../../src/tree/leaves";
import type { SoftTreeNode } from "../../../../../src/tree/types";
import { DEMO_GRAPH_REGISTRY } from "../../registry.content";
import { WIDGETS_DIR, widgetsContent } from "./content";
import ids from "./ids.json" with { type: "json" };
import { widgets } from "./layer";

const root = join(import.meta.dirname, "../../../../..");
const W = "widgets" as LazyLayerId;
const rows = ids as TreeEntry[];
const structures = rows.map((r) => ({ id: r.id, kind: r.kind }));
const noJson = (rel: string): never => {
  throw new Error(`the demo system reads no JSON file (${rel})`);
};

/** `content/<id>.md` by ID. */
export function readWidgetFiles(): Map<string, string> {
  const dir = join(root, WIDGETS_DIR);
  return new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => [f.slice(0, -3), readFileSync(join(dir, f), "utf8")]),
  );
}

/** The demo graph over some widgets' front matter (by ID). */
export const widgetGraph = (fm: Readonly<Record<string, unknown>>): CompiledGraph => compileContentGraph({ fm, structures, readJson: noJson }, DEMO_GRAPH_REGISTRY);

/** The layer's content chunk: its entries and the edges it ships (all of them: every edge is between widgets). Throws on a refused edge. */
export function compileWidgets(files: Map<string, string> = readWidgetFiles()): SoftLayerContent {
  const kinds = new Map(structures.map((s) => [s.id, s.kind]));
  const content = compileSoftLayer(W, files, { kindOf: (id) => kinds.get(id), pairJoints: [], functionalJoints: {}, graph: widgetGraph }, widgetsContent);
  const g = widgetGraph(Object.fromEntries(Object.entries(content.entries).map(([id, e]) => [id, e.fm])));
  if (g.errors.length > 0) throw new Error(`widgets: ${g.errors.join("; ")}`);
  const shipped = shipEdges(g.edges, { eager: EAGER_LAYER, lazy: [W], layerOf: (id) => (kinds.has(id) ? W : undefined), isSymmetric: (t) => DEMO_GRAPH_REGISTRY.types.some((x) => x.id === t && x.symmetric) });
  return { ...content, edges: encodeEdges(shipped[W] ?? []) };
}

/** The layer's sidebar root, from its `byKind` spec. */
export function widgetsTree(content: SoftLayerContent = compileWidgets()): SoftTreeNode {
  const fm = (id: string) => content.entries[id]?.fm as Record<string, unknown> | undefined;
  return buildSoftTrees({ entries: rows, readJson: noJson, field: (id, name) => fm(id)?.[name] ?? null, functionalJoints: [], jointNames: {} }, [], [widgets]).roots[0]!;
}

/** The layer's search index (its `searchChunk`): one document per widget, from its kind's `searchFields`. */
export function widgetsSearch(content: SoftLayerContent = compileWidgets()): SearchData {
  return buildSearchData(lazySearchDocuments(widgets, ids as SearchRow[], content, { roots: [widgetsTree(content)], sets: [] }));
}
