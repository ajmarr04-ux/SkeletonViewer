// The cartilage layer: articular and costal cartilage, discs and menisci (M6).
import { defineLayer } from "../../types";

export const cartilage = defineLayer({
  id: "cartilage",
  system: "musculoskeletal",
  code: "c",
  label: "Cartilage",
  ghostOrder: 1,
  // M10 session AL (M7: #a9bccb): the old colour was too close to the pectoral girdle's region colour under deuteranopia.
  colour: { material: "#c5dfee", debug: "#9fb2c2" },
  models: {
    file: "cartilage",
    eager: false,
    chunking: "single",
    debugManifest: () => import("../../../../assets/build/manifest-cartilage.json"),
    budgets: { high: { maxMiB: 2, targetTris: 80_000 }, low: { maxMiB: 1, targetTris: 30_000 } },
  },
  contentChunk: "virtual:skeleton-soft-content-cartilage",
  defaultSetting: "off",
  kinds: [
    { id: "cartilage", noun: { one: "cartilage", many: "cartilages" }, labelPriority: 3 },
    { id: "disc", noun: { one: "disc", many: "discs" }, labelPriority: 4 },
    { id: "meniscus", noun: { one: "meniscus", many: "menisci" }, labelPriority: 5 },
  ],
});
