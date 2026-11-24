// The bones layer: bones and teeth (`content/ids.json`), loaded with the main chunk.
import { defineLayer } from "../../types";

export const bones = defineLayer({
  id: "bones",
  system: "musculoskeletal",
  code: "b",
  label: "Bones",
  ghostOrder: 0,
  colour: { material: "#d8cdb8", keyLabel: "Bone" },
  models: {
    file: "skeleton",
    eager: true,
    chunking: "single",
    budgets: { high: { maxMiB: 15, targetTris: 500_000 }, low: { maxMiB: 6, targetTris: 150_000 } },
  },
  defaultSetting: "on",
  // Below every other layer for the labels' focus; teeth are counted as bones.
  kinds: [
    { id: "bone", noun: { one: "bone", many: "bones" }, labelPriority: 6 },
    { id: "tooth", noun: { one: "bone", many: "bones" }, labelPriority: 6 },
  ],
});
