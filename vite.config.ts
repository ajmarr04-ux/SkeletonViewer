import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// BASE is set by scripts/build-pages.sh: /SkeletonViewer/ for the live site and
// /SkeletonViewer/m<N>/ for each milestone snapshot. Local dev serves from /.
export default defineConfig({
  base: process.env.BASE ?? "/",
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
