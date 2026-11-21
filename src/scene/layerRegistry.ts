// The soft-tissue layers' batches on screen, shared by the lazy layer chunk
// (which builds them) and the main chunk (isolation, outlines, picking).
// Main chunk, and tiny: types and one zustand store.

import type { Color } from "three";
import { create } from "zustand";
import type { TissueLayer } from "../state/url";
import type { BatchedSkeleton } from "./batchSkeleton";
import type { Lod } from "./lod";
import type { Outline } from "./outline";
import type { TintRole } from "./tints";

/** The most parts any muscle has (checked against content/soft-ids.json in tests/nestedSelection.test.ts). */
export const MAX_PARTS = 3;

export type LayerBatches = {
  lod: Lod;
  solid: BatchedSkeleton;
  ghost: BatchedSkeleton;
  /** Selection and hover outlines over the solid batch's buffers (drawn only while they have a target). */
  outlines: { selected: Outline; hover: Outline };
  /**
   * More selection outlines, for a selected muscle's other parts (spec §5.1,
   * §8: one hull per selected part). `MAX_PARTS - 1` for the muscles layer,
   * none for the others; each costs a draw call only while it has a target.
   */
  moreSelected: Outline[];
  /** A structure's own instance colour (white, or the tendon tint). */
  base: (id: string) => Color;
  /** The instance colour of the selected structure in this layer's material. */
  accent: Color;
  /** Instance colours of the origin, insertion and antagonist tints in this layer's material (M9). */
  tint: Record<TintRole, Color>;
};

/**
 * The attachment patches (M9 plan decision 6): one solid batch, loaded the
 * first time a muscle or part reaches tier 1, drawn only while patches are
 * wanted. Instance colours: `tint` by role. Never picked.
 */
export type PatchBatch = { lod: Lod; solid: BatchedSkeleton; tint: Record<"origin" | "insertion", Color> };
/** `failed`: the patch file could not be loaded, so the tints fall back to whole structures. */
export const usePatchBatch = create<{ batch: PatchBatch | null; failed: boolean }>(() => ({ batch: null, failed: false }));

/** The batches on screen per layer. Set by `LayerScenes`, read by `Isolation` and the camera rig. */
export const useLayerBatches = create<Partial<Record<TissueLayer, LayerBatches>>>(() => ({}));
