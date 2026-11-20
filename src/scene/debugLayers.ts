// Pure helpers for the M6 debug layer view (`?debug&layers=all`, plan decision 13).
// No three.js or React here, so Vitest covers them directly.

import type { Bounds } from "../../scripts/lib/model-checks";
import { BOUNDS_TOLERANCE_M, compareBounds, SOFT_LAYERS, type SoftLayer } from "../../scripts/lib/model-checks";
import type { Lod } from "./lod";

export { SOFT_LAYERS, type SoftLayer };

/** One-letter codes for `layers=m,l,c,a`. `b` (bones) is accepted and ignored: bones always load. */
const CODES: Record<string, SoftLayer | "bones"> = {
  m: "muscles",
  l: "ligaments",
  c: "cartilage",
  a: "attachments",
  b: "bones",
};

/**
 * The soft-tissue layers a debug URL asks for, in file order, or null when the
 * view is off. Needs both `debug` and `layers`. `layers=all` is every layer;
 * otherwise a comma list of codes (`m,l,c,a`) or full names. M7's real format
 * (`b:on,c:off`) is not parsed here: an entry's `:on` is accepted and `:off` drops it.
 */
export function parseDebugLayers(search: string): SoftLayer[] | null {
  const params = new URLSearchParams(search);
  const debug = params.get("debug");
  if (debug === null || debug === "0" || debug === "false") return null;
  const raw = params.get("layers");
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  if (value === "" || value === "all") return [...SOFT_LAYERS];
  const wanted = new Set<SoftLayer>();
  for (const piece of value.split(",")) {
    const [key = "", state] = piece.trim().split(":");
    if (state === "off") continue;
    const layer = CODES[key] ?? ((SOFT_LAYERS as readonly string[]).includes(key) ? (key as SoftLayer) : undefined);
    if (layer && layer !== "bones") wanted.add(layer);
  }
  return SOFT_LAYERS.filter((l) => wanted.has(l));
}

/** Flat debug colours (musculoskeletal spec §6.3); patches in amber so they read against bone. */
export const DEBUG_LAYER_COLOURS: Record<SoftLayer, string> = {
  muscles: "#a8524c",
  ligaments: "#e4e0d6",
  cartilage: "#9fb2c2",
  attachments: "#e0a33a",
};

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
