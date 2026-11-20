// The soft-tissue layers' batches on screen, shared by the lazy layer chunk
// (which builds them) and the main chunk (isolation, outlines, picking).
// Main chunk, and tiny: types and one zustand store.

import type { Color } from "three";
import { create } from "zustand";
import type { TissueLayer } from "../state/url";
import type { BatchedSkeleton } from "./batchSkeleton";
import type { Lod } from "./lod";
import type { Outline } from "./outline";

export type LayerBatches = {
  lod: Lod;
  solid: BatchedSkeleton;
  ghost: BatchedSkeleton;
  /** Selection and hover outlines over the solid batch's buffers (drawn only while they have a target). */
  outlines: { selected: Outline; hover: Outline };
  /** A structure's own instance colour (white, or the tendon tint). */
  base: (id: string) => Color;
  /** The instance colour of the selected structure in this layer's material. */
  accent: Color;
};

/** The batches on screen per layer. Set by `LayerScenes`, read by `Isolation` and the camera rig. */
export const useLayerBatches = create<Partial<Record<TissueLayer, LayerBatches>>>(() => ({}));
