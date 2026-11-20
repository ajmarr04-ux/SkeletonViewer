import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { contentPlugin } from "./scripts/lib/content-plugin";
import { modelVersionsPlugin } from "./scripts/lib/model-versions-plugin";

// BASE is set by scripts/build-pages.sh: /SkeletonViewer/ for the live site and
// /SkeletonViewer/m<N>/ for each milestone snapshot. Local dev serves from /.
export default defineConfig({
  base: process.env.BASE ?? "/",
  plugins: [react(), contentPlugin(), modelVersionsPlugin()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
