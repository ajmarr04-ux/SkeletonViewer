// Vite plugin: serves the compiled content (src/content/compile.ts) as the
// virtual module `virtual:skeleton-content`, and the prebuilt search index
// (src/content/search.ts, Milestone 5) as `virtual:skeleton-search`, and each
// soft-tissue layer's content (M8 plan decision 11) as the descriptor's
// `contentChunk` (`virtual:skeleton-soft-content-<layer>`), with
// `virtual:skeleton-layer-importers` generated from the registry (M11 AV): one
// static `import()` per lazy layer, which Vite needs to split them. The app
// imports them dynamically, so each becomes its own chunk, loaded after the
// first frame (or when the sidebar first needs it). Nothing is written to disk,
// so there is no generated file to keep in step.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";
import { compileContent } from "../../src/content/compile";
import { LAZY_LAYERS, NESTED_LAYER, layerDescriptor } from "../../src/systems/registry";
import { bonesDir, compileAllSoftFromDisk, readContentFiles, readEagerContentEdges, readEagerEdges, root, softDir } from "./content-files";
import { readSearchData, readSoftSearchData } from "./search-data";
import { readSoftTree } from "./soft-tree-data";

const CONTENT = "virtual:skeleton-content";
const SEARCH = "virtual:skeleton-search";
const RESOLVED_CONTENT = "\0" + CONTENT;
const RESOLVED_SEARCH = "\0" + SEARCH;
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
/** The soft tree (M9 plan decision 11) and the soft-tissue search index (decision 12): one lazy chunk each. */
const SOFT_TREE = "virtual:skeleton-soft-tree";
const SOFT_SEARCH = "virtual:skeleton-search-soft";
/** The eager layer's edges (M12 plan decision 3), in the main chunk: imported by src/content/indexData.ts. */
const GRAPH = "virtual:skeleton-graph";
const softExtra = new Map<string, () => unknown>([
  ["\0" + SOFT_TREE, readSoftTree],
  ["\0" + SOFT_SEARCH, readSoftSearchData],
  ["\0" + GRAPH, readEagerEdges],
]);
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
/** Files the soft-tissue chunks are built from, besides the content folders. */
const softDeps = ["content/soft-ids.json", "content/articulations.json", "content/regions.json", "content/joints.json", "content/movements.json", "assets/mapping/soft-to-id.json"].map((f) => join(root, f));

export function contentPlugin(): Plugin {
  return {
    name: "skeleton-content",
    resolveId: (id) =>
      id === CONTENT
        ? RESOLVED_CONTENT
        : id === SEARCH
          ? RESOLVED_SEARCH
          : id === ATTRIBUTION
            ? RESOLVED_ATTRIBUTION
            : id === IMPORTERS || softModules.has("\0" + id) || softExtra.has("\0" + id)
              ? "\0" + id
              : null,
    load(id) {
      if (id === RESOLVED_IMPORTERS) return importersModule();
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
      if (id !== RESOLVED_CONTENT && id !== RESOLVED_SEARCH) return null;
      this.addWatchFile(bonesDir);
      const files = readContentFiles();
      for (const name of files.keys()) this.addWatchFile(`${bonesDir}/${name}.md`);
      if (id === RESOLVED_CONTENT) {
        // The bones' attached muscles are edges from the muscles layer's files (M8 session AD; M12 BD).
        this.addWatchFile(softDir(NESTED_LAYER));
        softDeps.forEach((f) => this.addWatchFile(f));
      }
      if (id === RESOLVED_CONTENT) return `export default ${JSON.stringify(compileContent(files))};\nexport const edges = ${JSON.stringify(readEagerContentEdges())};`;
      this.addWatchFile(synonymsFile);
      return `export default ${JSON.stringify(readSearchData())};`;
    },
    configureServer(server) {
      // A content edit reloads the page with the recompiled modules.
      server.watcher.add(bonesDir);
      server.watcher.add(synonymsFile);
      LAZY_LAYERS.forEach((l) => server.watcher.add(softDir(l)));
      const reload = (file: string) => {
        const soft = LAZY_LAYERS.some((l) => file.startsWith(softDir(l))) || softDeps.includes(file);
        if (!file.startsWith(bonesDir) && file !== synonymsFile && !soft) return;
        for (const r of [RESOLVED_CONTENT, RESOLVED_SEARCH, ...softModules.keys(), ...softExtra.keys()]) {
          const mod = server.moduleGraph.getModuleById(r);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload).on("add", reload).on("unlink", reload);
    },
  };
}
