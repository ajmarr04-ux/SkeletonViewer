// Pure checks used by scripts/check-models.ts (and unit-tested in tests/).
// No I/O here: callers pass in plain data read from the .glb, ids.json and
// the Blender manifest. File names and budgets come from the registry's descriptors.

import { isOverlayId, layerDescriptor, LAZY_LAYERS, OVERLAYS, type LayerId, type LazyLayerId, type OverlayId } from "../../src/systems/registry";
import type { Lod } from "../../src/systems/types";

export type Vec3 = [number, number, number];
export type Bounds = { min: Vec3; max: Vec3 };

export type IdEntry = { id: string; meshAvailable: boolean };

export type LodBudget = { maxBytes: number; targetTris: number; triTolerance: number };

/** Every model's triangle count may be this far from its target (spec §5 / plan step 4). */
export const TRI_TOLERANCE = 0.15;
const MiB = 1024 * 1024;

/** The lazy layers' and overlays' model files (M6 plan decision 8), in registry order. */
export type LayerFile = LazyLayerId | OverlayId;
export const LAYER_FILES: readonly LayerFile[] = [...LAZY_LAYERS, ...OVERLAYS.map((o) => o.id)];

const modelOf = (name: LayerId | OverlayId) => (isOverlayId(name) ? OVERLAYS.find((o) => o.id === name)! : layerDescriptor(name).models);
/** A layer's or overlay's file stem in public/models (`<stem>-<lod>.glb`). */
export const fileStem = (name: LayerId | OverlayId): string => modelOf(name).file;

/** A layer's or overlay's budget for one LOD, from its descriptor (`budgets`). */
export function lodBudget(name: LayerId | OverlayId, lod: Lod): LodBudget {
  const b = modelOf(name).budgets[lod];
  return { maxBytes: b.maxMiB * MiB, targetTris: b.targetTris, triTolerance: TRI_TOLERANCE };
}

/**
 * A layer's budget with the triangle target capped at the source total:
 * a layer with less geometry than its target keeps all of it (decision 8).
 */
export function layerBudget(layer: LayerFile, lod: Lod, sourceTris: number): LodBudget {
  const b = lodBudget(layer, lod);
  return { ...b, targetTris: Math.min(b.targetTris, sourceTris) };
}

export type SoftIdEntry = IdEntry & { layer: string };

/** Node names expected in a layer file: the layer's structures with a mesh, or an overlay's nodes. */
export function expectedLayerNodeNames(layer: LayerFile, softIds: SoftIdEntry[], overlayNodes: string[]): string[] {
  if (isOverlayId(layer)) return [...overlayNodes];
  return softIds.filter((e) => e.layer === layer && e.meshAvailable).map((e) => e.id);
}

/** Quantisation tolerance for world bounds, in metres. */
export const BOUNDS_TOLERANCE_M = 1e-3;

/** IDs that must appear as nodes: those with a mesh. */
export function expectedNodeNames(ids: IdEntry[]): string[] {
  return ids.filter((e) => e.meshAvailable).map((e) => e.id);
}

/** Missing, extra and duplicated node names. */
export function compareNames(expected: string[], actual: string[]): string[] {
  const errors: string[] = [];
  const exp = new Set(expected);
  const seen = new Set<string>();
  for (const n of actual) {
    if (seen.has(n)) errors.push(`duplicate node name: ${n}`);
    seen.add(n);
    if (!exp.has(n)) errors.push(`unexpected node: ${n}`);
  }
  for (const n of expected) if (!seen.has(n)) errors.push(`missing node: ${n}`);
  return errors;
}

export function checkSize(lod: string, bytes: number, budget: LodBudget): string[] {
  return bytes < budget.maxBytes
    ? []
    : [`${lod}: ${(bytes / 1e6).toFixed(2)} MB is over the ${+(budget.maxBytes / 1024 / 1024).toFixed(1)} MiB budget`];
}

export function checkTriangles(lod: string, tris: number, budget: LodBudget): string[] {
  const dev = Math.abs(tris - budget.targetTris) / budget.targetTris;
  return dev <= budget.triTolerance
    ? []
    : [`${lod}: ${tris} triangles is ${(dev * 100).toFixed(1)}% from the ${budget.targetTris} target`];
}

/** Largest per-axis difference between two boxes' corners. */
export function boundsDelta(a: Bounds, b: Bounds): number {
  let d = 0;
  for (let i = 0; i < 3; i++) {
    d = Math.max(d, Math.abs(a.min[i]! - b.min[i]!), Math.abs(a.max[i]! - b.max[i]!));
  }
  return d;
}

/**
 * Every node's world bounds must match the manifest within `tol`.
 * Names missing on either side are reported by compareNames, not here.
 */
export function compareBounds(
  lod: string,
  actual: Map<string, Bounds>,
  manifest: Record<string, Bounds | undefined>,
  tol = BOUNDS_TOLERANCE_M,
): { errors: string[]; maxDelta: number } {
  const errors: string[] = [];
  let maxDelta = 0;
  for (const [name, b] of actual) {
    const m = manifest[name];
    if (!m) continue;
    const d = boundsDelta(b, m);
    maxDelta = Math.max(maxDelta, d);
    if (d > tol) errors.push(`${lod}: ${name} bounds differ from manifest by ${(d * 1000).toFixed(3)} mm`);
  }
  return { errors, maxDelta };
}
