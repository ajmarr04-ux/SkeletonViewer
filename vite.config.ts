import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { contentPlugin } from "./scripts/lib/content-plugin";
import { modelVersionsPlugin } from "./scripts/lib/model-versions-plugin";
import { indexPlugin } from "./scripts/lib/index-plugin";

// BASE is set by scripts/build-pages.sh: /SkeletonViewer/ for the live site and
// /SkeletonViewer/m<N>/ for each milestone snapshot. Local dev serves from /.
//
// `--mode fixture` (M11 plan decision 8) builds the app with the test registry
// (tests/fixtures/systems/: the real layers plus the fixture layer `widgets`)
// into dist-fixture/, for tests/e2e/fixture.spec.ts. Never deployed.
export default defineConfig(async ({ mode }) => {
  const fixture = mode === "fixture" ? await import("./tests/fixtures/systems/vite") : null;
  return {
    base: process.env.BASE ?? "/",
    plugins: [react(), contentPlugin(), modelVersionsPlugin(), indexPlugin(fixture?.fixtureRegistry), ...(fixture?.fixturePlugins() ?? [])],
    build: fixture ? { outDir: fixture.FIXTURE_OUT_DIR } : {},
    test: {
      include: ["tests/**/*.test.ts"],
      setupFiles: ["tests/setup.ts"],
    },
  };
});
