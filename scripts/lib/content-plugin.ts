// Vite plugin: serves the compiled content (src/content/compile.ts) as the
// virtual module `virtual:skeleton-content`, and the prebuilt search index
// (src/content/search.ts, Milestone 5) as `virtual:skeleton-search`, and each
// soft-tissue layer's content (M8 plan decision 11) as
// `virtual:skeleton-soft-content-<layer>`. The app
// imports both dynamically, so each becomes its own chunk, loaded after the
// first frame (or when the sidebar first needs it). Nothing is written to disk,
// so there is no generated file to keep in step.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";
import { compileContent } from "../../src/content/compile";
import { SOFT_LAYERS, bonesDir, compileAllSoftFromDisk, readBoneMuscles, readContentFiles, root, softDir } from "./content-files";
import { readSearchData } from "./search-data";

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
const SOFT_PREFIX = "virtual:skeleton-soft-content-";
const softModules = new Map(SOFT_LAYERS.map((l) => ["\0" + SOFT_PREFIX + l, l]));
/** Files the soft-tissue chunks are built from, besides the content folders. */
const softDeps = ["content/soft-ids.json", "content/articulations.json", "content/joints.json", "content/movements.json"].map((f) => join(root, f));

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
            : softModules.has("\0" + id)
              ? "\0" + id
              : null,
    load(id) {
      const layer = softModules.get(id);
      if (layer) {
        const dir = softDir(layer);
        this.addWatchFile(dir);
        softDeps.forEach((f) => this.addWatchFile(f));
        SOFT_LAYERS.forEach((l) => this.addWatchFile(softDir(l))); // tier sets read every layer
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
        // The bones' muscle lists are derived from the muscles layer's files (M8 session AD).
        this.addWatchFile(softDir("muscles"));
        softDeps.forEach((f) => this.addWatchFile(f));
      }
      if (id === RESOLVED_CONTENT) return `export default ${JSON.stringify(compileContent(files, readBoneMuscles()))};`;
      this.addWatchFile(synonymsFile);
      return `export default ${JSON.stringify(readSearchData())};`;
    },
    configureServer(server) {
      // A content edit reloads the page with the recompiled modules.
      server.watcher.add(bonesDir);
      server.watcher.add(synonymsFile);
      SOFT_LAYERS.forEach((l) => server.watcher.add(softDir(l)));
      const reload = (file: string) => {
        const soft = SOFT_LAYERS.some((l) => file.startsWith(softDir(l))) || softDeps.includes(file);
        if (!file.startsWith(bonesDir) && file !== synonymsFile && !soft) return;
        for (const r of [RESOLVED_CONTENT, RESOLVED_SEARCH, ...softModules.keys()]) {
          const mod = server.moduleGraph.getModuleById(r);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload).on("add", reload).on("unlink", reload);
    },
  };
}
