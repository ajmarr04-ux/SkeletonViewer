// Pure helpers for the M6 debug layer view (`?debug&layers=all`, plan decision 13).
// No three.js or React here, so Vitest covers them directly.

import type { Bounds } from "../../scripts/lib/model-checks";
import { BOUNDS_TOLERANCE_M, compareBounds, SOFT_LAYERS, type SoftLayer } from "../../scripts/lib/model-checks";
import { DEBUG_CODES, debugFacts } from "../systems/registry";
import type { Lod } from "./lod";

export { SOFT_LAYERS, type SoftLayer };


/**
 * The soft-tissue layers a debug URL asks for, in file order, or null when the
 * view is off. Needs both `debug` and `layers`. `layers=all` is every layer;
 * otherwise a comma list of codes (`m,l,c,a`) or full names. A value with a
 * colon is M7's user format (`b:on,m:ghost`, `src/state/url.ts`), which drives
 * the real layers instead, so the debug view stays off (M7 plan decision 2).
 */
export function parseDebugLayers(search: string): SoftLayer[] | null {
  const params = new URLSearchParams(search);
  const debug = params.get("debug");
  if (debug === null || debug === "0" || debug === "false") return null;
  const raw = params.get("layers");
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  if (value.includes(":")) return null;
  if (value === "" || value === "all") return [...SOFT_LAYERS];
  const wanted = new Set<string>();
  for (const piece of value.split(",")) {
    const key = piece.trim();
    // One-letter codes from the registry (`m,l,c,a`) or full names. The eager layer's code (`b`) is accepted and ignored: it always loads.
    wanted.add(DEBUG_CODES.get(key) ?? key);
  }
  return SOFT_LAYERS.filter((l) => wanted.has(l));
}

/** Flat debug colours (musculoskeletal spec §6.3), from the descriptors. */
export const DEBUG_LAYER_COLOURS = Object.fromEntries(SOFT_LAYERS.map((l) => [l, debugFacts(l)!.colour!])) as Record<SoftLayer, string>;

/** A layer's or overlay's build manifest: its own chunk, fetched only in `?debug`. */
export function loadLayerManifest(layer: SoftLayer): Promise<LayerManifest> {
  return debugFacts(layer)!.manifest!().then((x) => (x as { default: unknown }).default as LayerManifest);
}

export type LayerManifest = {
  objects: Record<string, { lods: Record<Lod, { bboxMin: Bounds["min"]; bboxMax: Bounds["max"] }> }>;
};

/** One line of the debug overlay. */
export type LayerReport = {
  layer: SoftLayer;
  lod: Lod;
  nodes: number;
  triangles: number;
  /** Nodes found in the manifest and compared. */
  checked: number;
  maxDelta: number;
  /** Nodes in the file but not the manifest, manifest IDs not in the file, and bounds beyond 1 mm. */
  errors: string[];
};

/** Compare a layer file's node bounds with its Blender manifest (same 1 mm rule as `check-models`). */
export function layerReport(
  layer: SoftLayer,
  lod: Lod,
  actual: Map<string, Bounds>,
  triangles: number,
  manifest: LayerManifest,
  tol = BOUNDS_TOLERANCE_M,
): LayerReport {
  const expected: Record<string, Bounds> = {};
  for (const [id, o] of Object.entries(manifest.objects)) {
    const l = o.lods[lod];
    if (l) expected[id] = { min: l.bboxMin, max: l.bboxMax };
  }
  const { errors, maxDelta } = compareBounds(`${layer} ${lod}`, actual, expected, tol);
  for (const id of actual.keys()) if (!expected[id]) errors.push(`${layer} ${lod}: ${id} is not in the manifest`);
  for (const id of Object.keys(expected)) if (!actual.has(id)) errors.push(`${layer} ${lod}: ${id} is missing`);
  const checked = [...actual.keys()].filter((id) => expected[id]).length;
  return { layer, lod, nodes: actual.size, triangles, checked, maxDelta, errors };
}
