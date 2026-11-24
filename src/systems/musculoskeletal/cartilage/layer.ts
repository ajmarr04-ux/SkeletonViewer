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
  },
  contentChunk: "virtual:skeleton-soft-content-cartilage",
  defaultSetting: "off",
  kinds: [{ id: "cartilage" }, { id: "disc" }, { id: "meniscus" }],
});
