import type { Box3 } from "three";
import { compareBounds, type Bounds } from "../../scripts/lib/model-checks";
import type { BoundsReport } from "../ui/DebugOverlay";
import type { Lod } from "./lod";

type Manifest = {
  objects: Record<string, { lods: Record<Lod, { bboxMin: [number, number, number]; bboxMax: [number, number, number] }> }>;
};

/**
 * Debug only: compare each batched instance's world bounds with the Blender
 * manifest (the same 1 mm tolerance as `check-models`). This proves that
 * batching moved no bone. The manifest is loaded on demand as its own chunk.
 */
export async function checkInstanceBounds(lod: Lod, actual: Map<string, Box3>): Promise<BoundsReport> {
  const manifest = (await import("../../assets/build/manifest.json")).default as unknown as Manifest;
  const expected: Record<string, Bounds> = {};
  for (const [id, o] of Object.entries(manifest.objects)) {
    expected[id] = { min: o.lods[lod].bboxMin, max: o.lods[lod].bboxMax };
  }
  const got = new Map<string, Bounds>();
  for (const [id, b] of actual) got.set(id, { min: b.min.toArray(), max: b.max.toArray() });
  const missing = [...actual.keys()].filter((id) => !expected[id]);
  const { errors, maxDelta } = compareBounds(lod, got, expected);
  errors.push(...missing.map((id) => `${lod}: ${id} is not in the manifest`));
  return { lod, checked: got.size, maxDelta, errors };
}
