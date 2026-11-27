// Vite plugin: serves the compiled content (src/content/compile.ts) as the
// virtual module `virtual:skeleton-content`, each layer's prebuilt search index
// (src/content/search.ts; one per layer since M14 plan decision 4) as its
// content half's `searchChunk` (`virtual:skeleton-search-<layer>`), with
// `virtual:skeleton-search-importers`, and each soft-tissue layer's content
// (M8 plan decision 11) as the descriptor's `contentChunk`
// (`virtual:skeleton-soft-content-<layer>`), with
// `virtual:skeleton-layer-importers`; both importer modules are generated from
// the registry (M11 AV): one static `import()` per layer, which Vite needs to
// split them. The app
// imports them dynamically, so each becomes its own chunk, loaded after the
// first frame (or when the sidebar first needs it). Nothing is written to disk,
// so there is no generated file to keep in step.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";
import { compileContent } from "../../src/content/compile";
import { LAYER_IDS, LAZY_LAYERS, NESTED_LAYER, TREE_SYSTEMS, layerDescriptor, type LayerId } from "../../src/systems/registry";
import { layerContent } from "../../src/systems/registry.content";
import { bonesDir, compileAllSoftFromDisk, readContentFiles, readEagerContentEdges, readEagerEdges, root, softDir } from "./content-files";
import { readAllSearchData } from "./search-data";
import type { SearchData } from "../../src/content/search";
import { readSoftTree, systemTree } from "./soft-tree-data";

const CONTENT = "virtual:skeleton-content";
const RESOLVED_CONTENT = "\0" + CONTENT;
/** public/ATTRIBUTION.md as HTML, compiled here (plan decision 11): no markdown or fetch at runtime. */
const ATTRIBUTION = "virtual:skeleton-attribution";
const RESOLVED_ATTRIBUTION = "\0" + ATTRIBUTION;
const attributionFile = join(root, "public/ATTRIBUTION.md");

/** The attribution page's HTML: the trusted, committed ATTRIBUTION.md; links open in a new tab. */
export function attributionHtml(markdown: string = readFileSync(attributionFile, "utf8")): string {
  const html = marked.parse(markdown, { async: false, gfm: true });
  return html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
}
const synonymsFile = join(root, "content/synonyms.json");
/** The eager layer's edges (M12 plan decision 3), in the main chunk: imported by src/content/indexData.ts. */
const GRAPH = "virtual:skeleton-graph";
/** One lazy tree chunk per system (M14 plan decision 6; one soft tree chunk before). */
const treeSystems = TREE_SYSTEMS.flatMap((s) => (s.chunk === null ? [] : [{ id: s.id, chunk: s.chunk }]));
const softExtra = new Map<string, () => unknown>([
  ...treeSystems.map((s): [string, () => unknown] => ["\0" + s.chunk, () => systemTree(s.id, readSoftTree())]),
  ["\0" + GRAPH, readEagerEdges],
]);
/** `{ <system>: () => import("virtual:skeleton-tree-<system>"), … }` for src/content/softTreeLoader.ts. */
const TREE_IMPORTERS = "virtual:skeleton-tree-importers";
const RESOLVED_TREE_IMPORTERS = "\0" + TREE_IMPORTERS;
export const treeImportersModule = (systems: readonly { id: string; chunk: string }[] = treeSystems): string =>
  `export default {\n${systems.map((s) => `  ${JSON.stringify(s.id)}: () => import(${JSON.stringify(s.chunk)}),\n`).join("")}};\n`;
/** Each lazy layer's content chunk, by resolved ID. */
const softModules = new Map(LAZY_LAYERS.map((l) => ["\0" + layerDescriptor(l).contentChunk!, l]));
/** `{ <layer>: () => import("<contentChunk>"), … }` for src/content/softContentLoader.ts. */
const IMPORTERS = "virtual:skeleton-layer-importers";
const RESOLVED_IMPORTERS = "\0" + IMPORTERS;
export const importersModule = (layers: readonly { id: string; contentChunk?: string }[] = LAZY_LAYERS.map(layerDescriptor)): string =>
  `export default {\n${layers
    .filter((l) => l.contentChunk !== undefined)
    .map((l) => `  ${JSON.stringify(l.id)}: () => import(${JSON.stringify(l.contentChunk)}),\n`)
    .join("")}};\n`;
/** Each layer's search index chunk (M14 plan decision 4), for the layers with a content half here (the fixture's widgets serve their own, tests/fixtures/systems/vite.ts). */
const searchChunks = LAYER_IDS.flatMap((l) => {
  const c = layerContent(l) as ReturnType<typeof layerContent> | undefined;
  return c ? [{ id: l, searchChunk: c.searchChunk }] : [];
});
/** By resolved ID. */
const searchModules = new Map(searchChunks.map((l) => ["\0" + l.searchChunk, l.id]));
/** `{ <layer>: () => import("<searchChunk>"), … }` for src/content/searchLoader.ts, in registry order. */
const SEARCH_IMPORTERS = "virtual:skeleton-search-importers";
const RESOLVED_SEARCH_IMPORTERS = "\0" + SEARCH_IMPORTERS;
export const searchImportersModule = (layers: readonly { id: string; searchChunk: string }[] = searchChunks): string =>
  `export default {\n${layers.map((l) => `  ${JSON.stringify(l.id)}: () => import(${JSON.stringify(l.searchChunk)}),\n`).join("")}};\n`;
/** Every layer's index, built once per build (or per content edit in dev): they share the soft compile. */
let searchData: Record<LayerId, SearchData> | null = null;
const searchDataOf = (layer: LayerId): SearchData => (searchData ??= readAllSearchData())[layer];

/** Files the soft-tissue chunks are built from, besides the content folders. */
const softDeps = ["content/soft-ids.json", "content/articulations.json", "content/regions.json", "content/joints.json", "content/movements.json", "assets/mapping/soft-to-id.json"].map((f) => join(root, f));

export function contentPlugin(): Plugin {
  return {
    name: "skeleton-content",
    resolveId: (id) =>
      id === CONTENT
        ? RESOLVED_CONTENT
        : id === ATTRIBUTION
          ? RESOLVED_ATTRIBUTION
          : id === IMPORTERS || id === SEARCH_IMPORTERS || id === TREE_IMPORTERS || softModules.has("\0" + id) || softExtra.has("\0" + id) || searchModules.has("\0" + id)
            ? "\0" + id
            : null,
    buildStart() {
      searchData = null;
    },
    load(id) {
      if (id === RESOLVED_IMPORTERS) return importersModule();
      if (id === RESOLVED_SEARCH_IMPORTERS) return searchImportersModule();
      if (id === RESOLVED_TREE_IMPORTERS) return treeImportersModule();
      const searchLayer = searchModules.get(id);
      if (searchLayer) {
        this.addWatchFile(bonesDir);
        LAZY_LAYERS.forEach((l) => this.addWatchFile(softDir(l)));
        softDeps.forEach((f) => this.addWatchFile(f));
        this.addWatchFile(synonymsFile);
        this.addWatchFile(join(root, "content/muscle-hierarchy.json"));
        return `export default ${JSON.stringify(searchDataOf(searchLayer))};`;
      }
      const extra = softExtra.get(id);
      if (extra) {
        LAZY_LAYERS.forEach((l) => this.addWatchFile(softDir(l)));
        softDeps.forEach((f) => this.addWatchFile(f));
        this.addWatchFile(synonymsFile);
        this.addWatchFile(join(root, "content/muscle-hierarchy.json"));
        return `export default ${JSON.stringify(extra())};`;
      }
      const layer = softModules.get(id);
      if (layer) {
        const dir = softDir(layer);
        this.addWatchFile(dir);
        softDeps.forEach((f) => this.addWatchFile(f));
        LAZY_LAYERS.forEach((l) => this.addWatchFile(softDir(l))); // the edges read every layer
        return `export default ${JSON.stringify(compileAllSoftFromDisk()[layer])};`;
      }
      if (id === RESOLVED_ATTRIBUTION) {
        this.addWatchFile(attributionFile);
        return `export default ${JSON.stringify(attributionHtml())};`;
      }
      if (id !== RESOLVED_CONTENT) return null;
      this.addWatchFile(bonesDir);
      const files = readContentFiles();
      for (const name of files.keys()) this.addWatchFile(`${bonesDir}/${name}.md`);
      // The bones' attached muscles are edges from the muscles layer's files (M8 session AD; M12 BD).
      this.addWatchFile(softDir(NESTED_LAYER));
      softDeps.forEach((f) => this.addWatchFile(f));
      return `export default ${JSON.stringify(compileContent(files))};\nexport const edges = ${JSON.stringify(readEagerContentEdges())};`;
    },
    configureServer(server) {
      // A content edit reloads the page with the recompiled modules.
      server.watcher.add(bonesDir);
      server.watcher.add(synonymsFile);
      LAZY_LAYERS.forEach((l) => server.watcher.add(softDir(l)));
      const reload = (file: string) => {
        const soft = LAZY_LAYERS.some((l) => file.startsWith(softDir(l))) || softDeps.includes(file);
        if (!file.startsWith(bonesDir) && file !== synonymsFile && !soft) return;
        searchData = null;
        for (const r of [RESOLVED_CONTENT, ...searchModules.keys(), ...softModules.keys(), ...softExtra.keys()]) {
          const mod = server.moduleGraph.getModuleById(r);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload).on("add", reload).on("unlink", reload);
    },
  };
}
