// `vite build --mode fixture` (M11 plan decision 8): the app built with the test
// registry. These things differ from the real build, and nothing else:
//   1. src/systems/registered.ts resolves to ./registry.ts (real layers + `widgets`);
//   2. the index plugin reads the test registry, so the widgets' IDs are in the ID index;
//   3. the widgets' model files are served (dev) and emitted (build) at models/;
//   4. (M12 plan decision 14) the widgets' content chunk (their entries and edges),
//      the layer importers with it, and the sidebar tree with the widgets' root,
//      and (M14 plan decision 4) the widgets' search index with the search
//      importers, each compiled by the app's own generic code
//      (./demo/widgets/compile.ts). The content plugin runs in Node with the real
//      registry, so the fixture serves these five modules itself, before it.
// Output goes to dist-fixture/, so the real dist/ is never touched.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { importersModule, searchImportersModule } from "../../../scripts/lib/content-plugin";
import { readSoftTree } from "../../../scripts/lib/soft-tree-data";
import type { SoftTreeData } from "../../../src/tree/types";
import { compileWidgets, widgetsSearch, widgetsTree } from "./demo/widgets/compile";
import { WIDGETS_DIR } from "./demo/widgets/content";
import { FIXTURE_CONTENT } from "./registry.content";
import { widgets } from "./demo/widgets/layer";
import { REGISTRY } from "./registry";
import { fixtureRegistry } from "./option";

const here = import.meta.dirname;
const MODELS = join(here, "demo/widgets/models");
const glbs = () => readdirSync(MODELS).filter((f) => f.endsWith(".glb"));

/** The one redirect: the registry's list module → the test registry. */
function testRegistry(): Plugin {
  const target = join(here, "registry.ts");
  return {
    name: "fixture-registry",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "./registered" && importer?.replace(/\\/g, "/").endsWith("src/systems/registry.ts")) return target;
      return null;
    },
  };
}

/** The fixture's `.glb` files at `<base>models/`. */
function fixtureModels(): Plugin {
  return {
    name: "fixture-models",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const f = req.url?.split("?")[0]?.match(/\/models\/([^/]+\.glb)$/)?.[1];
        if (!f || !glbs().includes(f)) return next();
        res.setHeader("Content-Type", "model/gltf-binary");
        res.end(readFileSync(join(MODELS, f)));
      });
    },
    generateBundle() {
      for (const f of glbs()) this.emitFile({ type: "asset", fileName: `models/${f}`, source: readFileSync(join(MODELS, f)) });
    },
  };
}

/** The sidebar tree: the real roots, then the widgets' (its `order` is after theirs). */
export function fixtureTree(): SoftTreeData {
  const real = readSoftTree();
  return { ...real, roots: [...real.roots, widgetsTree()] };
}

/** The layer importers (every lazy layer of the test registry), the widgets' content chunk, the sidebar tree, the search importers (every layer) and the widgets' search index. */
function fixtureContent(): Plugin {
  const modules = new Map<string, () => string>([
    ["virtual:skeleton-layer-importers", () => importersModule(REGISTRY.filter((l) => !l.models.eager))],
    [widgets.contentChunk, () => `export default ${JSON.stringify(compileWidgets())};`],
    ["virtual:skeleton-soft-tree", () => `export default ${JSON.stringify(fixtureTree())};`],
    ["virtual:skeleton-search-importers", () => searchImportersModule(REGISTRY.map((l) => ({ id: l.id, searchChunk: FIXTURE_CONTENT[l.id]!.searchChunk })))],
    [FIXTURE_CONTENT[widgets.id]!.searchChunk, () => `export default ${JSON.stringify(widgetsSearch())};`],
  ]);
  return {
    name: "fixture-content",
    enforce: "pre",
    resolveId: (source) => (modules.has(source) ? `\0fixture:${source}` : null),
    load(id) {
      const make = id.startsWith("\0fixture:") ? modules.get(id.slice("\0fixture:".length)) : undefined;
      if (!make) return null;
      this.addWatchFile(join(here, "../../..", WIDGETS_DIR));
      return make();
    },
  };
}

export { fixtureRegistry };
export const fixturePlugins = (): Plugin[] => [testRegistry(), fixtureModels(), fixtureContent()];
export const FIXTURE_OUT_DIR = "dist-fixture";
