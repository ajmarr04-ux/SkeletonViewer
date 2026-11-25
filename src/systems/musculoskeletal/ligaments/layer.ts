// The ligaments layer (M6).
import { defineLayer } from "../../types";
import { jointTiers } from "../jointTiers";

export const ligaments = defineLayer({
  id: "ligaments",
  system: "musculoskeletal",
  code: "l",
  label: "Ligaments",
  ghostOrder: 2,
  // M10 session AL (M7: #d9dde3): the old colour was too close to the hover outline.
  colour: { material: "#cccccc", debug: "#e4e0d6" },
  models: {
    file: "ligaments",
    eager: false,
    chunking: "single",
    debugManifest: () => import("../../../../assets/build/manifest-ligaments.json"),
    budgets: { high: { maxMiB: 2.5, targetTris: 120_000 }, low: { maxMiB: 1, targetTris: 40_000 } },
  },
  contentChunk: "virtual:skeleton-soft-content-ligaments",
  defaultSetting: "off",
  kinds: [{ id: "ligament", noun: { one: "ligament", many: "ligaments" }, labelPriority: 2, tiers: jointTiers("connects") }],
});
