// The bones layer: bones and teeth (`content/ids.json`), loaded with the main chunk.
import { defineLayer } from "../../types";

export const bones = defineLayer({
  id: "bones",
  system: "musculoskeletal",
  code: "b",
  label: "Bones",
  ghostOrder: 0,
  colour: { material: "#d8cdb8", keyLabel: "Bone" },
  models: { file: "skeleton", eager: true, chunking: "single" },
  defaultSetting: "on",
  kinds: [{ id: "bone" }, { id: "tooth" }],
});
