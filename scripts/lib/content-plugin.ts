// Vite plugin: serves the compiled content (src/content/compile.ts) as the
// virtual module `virtual:skeleton-content`. The app imports it dynamically, so
// it becomes its own chunk, loaded after the first frame (plan step 4). Nothing
// is written to disk, so there is no generated file to keep in step.
import type { Plugin } from "vite";
import { compileContent } from "../../src/content/compile";
import { bonesDir, readContentFiles } from "./content-files";

const ID = "virtual:skeleton-content";
const RESOLVED = "\0" + ID;

export function contentPlugin(): Plugin {
  return {
    name: "skeleton-content",
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile(bonesDir);
      const files = readContentFiles();
      for (const name of files.keys()) this.addWatchFile(`${bonesDir}/${name}.md`);
      return `export default ${JSON.stringify(compileContent(files))};`;
    },
    configureServer(server) {
      // A content edit reloads the page with the recompiled module.
      server.watcher.add(bonesDir);
      const reload = (file: string) => {
        if (!file.startsWith(bonesDir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload).on("add", reload).on("unlink", reload);
    },
  };
}
