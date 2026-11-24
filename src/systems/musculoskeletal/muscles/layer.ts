// The muscles layer: muscles and their parts (M6), the outermost layer.
import { defineLayer } from "../../types";

export const muscles = defineLayer({
  id: "muscles",
  system: "musculoskeletal",
  code: "m",
  label: "Muscles",
  ghostOrder: 3,
  // M10 session AL (M7: #a8483f): the old swatch was under 3:1 on the legend.
  colour: { material: "#b44d43", debug: "#a8524c" },
  models: {
    file: "muscles",
    eager: false,
    chunking: "single",
    debugManifest: () => import("../../../../assets/build/manifest-muscles.json"),
  },
  contentChunk: "virtual:skeleton-soft-content-muscles",
  defaultSetting: "off",
  // Three stops, each one layer deeper (session V; the spec's fourth, "Deep only", was the same as the third).
  // `3` was "Deep only" while the control had four stops (session V's first build): the same as 2.
  depth: { stops: ["All", "Hide superficial", "Hide superficial + intermediate"], legacy: { 3: 2 } },
  overlays: [
    {
      id: "attachments",
      debugCode: "a",
      file: "attachments",
      // Patches in amber so they read against bone.
      colour: { debug: "#e0a33a" },
      when: "selected-tier",
      debugManifest: () => import("../../../../assets/build/manifest-attachments.json"),
    },
  ],
  kinds: [{ id: "muscle", parentOf: { childKind: "muscle_part", selection: "nested" } }, { id: "muscle_part" }],
});
