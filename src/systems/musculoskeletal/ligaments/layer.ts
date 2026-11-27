// The ligaments layer (M6).
import { defineLayer } from "../../types";
import { jointChrome, jointPanel } from "../jointPanel";
import { jointTiers } from "../jointTiers";
import { STRUCTURE_SEARCH } from "../search";

const LABEL = "Ligaments";

export const ligaments = defineLayer({
  id: "ligaments",
  system: "musculoskeletal",
  code: "l",
  label: LABEL,
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
  // By functional joint, then pair joint; no joint → "Other ligaments" (M9 plan decision 11).
  tree: {
    builder: "byJoint",
    root: { label: LABEL, name: "All ligaments", order: 1 },
    field: "joint",
    nodeName: (label) => `Ligaments of the ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
    other: { key: "other", label: "Other ligaments" },
  },
  kinds: [
    {
      id: "ligament",
      label: "Ligament",
      noun: { one: "ligament", many: "ligaments" },
      labelPriority: 2,
      searchFields: STRUCTURE_SEARCH,
      tiers: jointTiers("connects"),
      panel: jointPanel("Connects", "connects", "connects"),
      chrome: jointChrome("Ligament", LABEL),
    },
  ],
});
