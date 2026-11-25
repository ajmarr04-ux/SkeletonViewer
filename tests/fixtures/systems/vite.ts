// `vite build --mode fixture` (M11 plan decision 8): the app built with the test
// registry. Three things differ from the real build, and nothing else:
//   1. src/systems/registered.ts resolves to ./registry.ts (real layers + `widgets`);
//   2. the soft-ids plugin reads the test registry, so the widgets' IDs are in the table;
//   3. the widgets' model files are served (dev) and emitted (build) at models/.
// Output goes to dist-fixture/, so the real dist/ is never touched.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import type { RegistryOption } from "../../../scripts/lib/soft-ids-plugin";
import { FIXTURE_CONTENT } from "./registry.content";
import { REGISTRY } from "./registry";

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

export const fixtureRegistry: RegistryOption = { layers: REGISTRY, content: FIXTURE_CONTENT };
export const fixturePlugins = (): Plugin[] => [testRegistry(), fixtureModels()];
export const FIXTURE_OUT_DIR = "dist-fixture";
