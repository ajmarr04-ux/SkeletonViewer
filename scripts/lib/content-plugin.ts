// Vite plugin: serves the compiled content (src/content/compile.ts) as the
// virtual module `virtual:skeleton-content`, and the prebuilt search index
// (src/content/search.ts, Milestone 5) as `virtual:skeleton-search`. The app
// imports both dynamically, so each becomes its own chunk, loaded after the
// first frame (or when the sidebar first needs it). Nothing is written to disk,
// so there is no generated file to keep in step.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";
import { compileContent } from "../../src/content/compile";
import { bonesDir, readContentFiles, root } from "./content-files";
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

export function contentPlugin(): Plugin {
  return {
    name: "skeleton-content",
    resolveId: (id) => (id === CONTENT ? RESOLVED_CONTENT : id === SEARCH ? RESOLVED_SEARCH : id === ATTRIBUTION ? RESOLVED_ATTRIBUTION : null),
    load(id) {
      if (id === RESOLVED_ATTRIBUTION) {
        this.addWatchFile(attributionFile);
        return `export default ${JSON.stringify(attributionHtml())};`;
      }
      if (id !== RESOLVED_CONTENT && id !== RESOLVED_SEARCH) return null;
      this.addWatchFile(bonesDir);
      const files = readContentFiles();
      for (const name of files.keys()) this.addWatchFile(`${bonesDir}/${name}.md`);
      if (id === RESOLVED_CONTENT) return `export default ${JSON.stringify(compileContent(files))};`;
      this.addWatchFile(synonymsFile);
      return `export default ${JSON.stringify(readSearchData())};`;
    },
    configureServer(server) {
      // A content edit reloads the page with the recompiled modules.
      server.watcher.add(bonesDir);
      server.watcher.add(synonymsFile);
      const reload = (file: string) => {
        if (!file.startsWith(bonesDir) && file !== synonymsFile) return;
        for (const r of [RESOLVED_CONTENT, RESOLVED_SEARCH]) {
          const mod = server.moduleGraph.getModuleById(r);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload).on("add", reload).on("unlink", reload);
    },
  };
}
