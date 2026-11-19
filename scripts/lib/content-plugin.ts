// Vite plugin: serves the compiled content (src/content/compile.ts) as the
// virtual module `virtual:skeleton-content`, and the prebuilt search index
// (src/content/search.ts, Milestone 5) as `virtual:skeleton-search`. The app
// imports both dynamically, so each becomes its own chunk, loaded after the
// first frame (or when the sidebar first needs it). Nothing is written to disk,
// so there is no generated file to keep in step.
import { join } from "node:path";
import type { Plugin } from "vite";
import { compileContent } from "../../src/content/compile";
import { bonesDir, readContentFiles, root } from "./content-files";
import { readSearchData } from "./search-data";

const CONTENT = "virtual:skeleton-content";
const SEARCH = "virtual:skeleton-search";
const RESOLVED_CONTENT = "\0" + CONTENT;
const RESOLVED_SEARCH = "\0" + SEARCH;
const synonymsFile = join(root, "content/synonyms.json");

export function contentPlugin(): Plugin {
  return {
    name: "skeleton-content",
    resolveId: (id) => (id === CONTENT ? RESOLVED_CONTENT : id === SEARCH ? RESOLVED_SEARCH : null),
    load(id) {
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
