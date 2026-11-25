import { defineSystem } from "../types";
import { MUSCULOSKELETAL_EDGES } from "./edges";

export const musculoskeletal = defineSystem({
  id: "musculoskeletal",
  label: "Musculoskeletal",
  edgeTypes: MUSCULOSKELETAL_EDGES,
  // The Layers panel's presets (musculoskeletal spec §6.1; M11 plan decision 5).
  presets: [
    { id: "skeleton", label: "Skeleton", summary: "bones only", modes: { bones: "on" } },
    { id: "full", label: "Full musculoskeletal", summary: "all layers on", modes: { bones: "on", cartilage: "on", ligaments: "on", muscles: "on" }, depth: 0 },
  ],
});
