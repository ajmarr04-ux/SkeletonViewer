// The cartilage layer: articular and costal cartilage, discs and menisci (M6).
import { defineLayer } from "../../types";
import { jointChrome, jointPanel } from "../jointPanel";
import { jointTiers } from "../jointTiers";

const TIERS = jointTiers("attached_to");
const PANEL = jointPanel("Attached to", "attached-to", "attached_to");
const LABEL = "Cartilage";

export const cartilage = defineLayer({
  id: "cartilage",
  system: "musculoskeletal",
  code: "c",
  label: LABEL,
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
  // By kind, then joint (M9 plan decision 11).
  tree: {
    builder: "byKind",
    root: { label: LABEL, name: "All cartilage", order: 2 },
    field: "joint",
    kinds: [
      { kind: "cartilage", label: "Cartilage and labra" },
      { kind: "disc", label: "Discs" },
      { kind: "meniscus", label: "Menisci and articular discs" },
    ],
    nodeName: (kindLabel, jointLabel) => `${kindLabel}: ${jointLabel}`,
  },
  kinds: [
    { id: "cartilage", label: "Cartilage", noun: { one: "cartilage", many: "cartilages" }, labelPriority: 3, tiers: TIERS, panel: PANEL, chrome: jointChrome("Cartilage", LABEL) },
    { id: "disc", label: "Intervertebral disc", noun: { one: "disc", many: "discs" }, labelPriority: 4, tiers: TIERS, panel: PANEL, chrome: jointChrome("Intervertebral disc", LABEL) },
    { id: "meniscus", label: "Meniscus", noun: { one: "meniscus", many: "menisci" }, labelPriority: 5, tiers: TIERS, panel: PANEL, chrome: jointChrome("Meniscus", LABEL) },
  ],
});
