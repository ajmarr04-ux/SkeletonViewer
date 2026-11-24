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
  kinds: [
    {
      id: "muscle",
      noun: { one: "muscle", many: "muscles" },
      labelPriority: 0,
      // The most parts any muscle has (checked against content/soft-ids.json in tests/nestedSelection.test.ts).
      parentOf: { childKind: "muscle_part", selection: "nested", maxParts: 3 },
    },
    {
      id: "muscle_part",
      noun: { one: "part", many: "parts" },
      labelPriority: 1,
      // Tendons and aponeuroses get the lighter muscle colour (spec §6.3).
      partTypes: [{ id: "head" }, { id: "belly" }, { id: "portion" }, { id: "tendon", tendinous: true }, { id: "aponeurosis", tendinous: true }],
    },
  ],
});
