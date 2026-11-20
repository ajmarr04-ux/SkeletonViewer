// Pure checks used by scripts/check-models.ts (and unit-tested in tests/).
// No I/O here: callers pass in plain data read from the .glb, ids.json and
// the Blender manifest.

export type Vec3 = [number, number, number];
export type Bounds = { min: Vec3; max: Vec3 };

export type IdEntry = { id: string; meshAvailable: boolean };

export type LodBudget = { maxBytes: number; targetTris: number; triTolerance: number };

/** Budgets from spec §5 / plan step 4. */
export const LOD_BUDGETS: Record<"high" | "low", LodBudget> = {
  high: { maxBytes: 15 * 1024 * 1024, targetTris: 500_000, triTolerance: 0.15 },
  low: { maxBytes: 6 * 1024 * 1024, targetTris: 150_000, triTolerance: 0.15 },
};

/** Soft-tissue layer files (M6 plan decision 8). */
export const SOFT_LAYERS = ["muscles", "ligaments", "cartilage", "attachments"] as const;
export type SoftLayer = (typeof SOFT_LAYERS)[number];

const MiB = 1024 * 1024;
export const LAYER_BUDGETS: Record<SoftLayer, Record<"high" | "low", LodBudget>> = {
  muscles: {
    high: { maxBytes: 10 * MiB, targetTris: 800_000, triTolerance: 0.15 },
    low: { maxBytes: 4 * MiB, targetTris: 230_000, triTolerance: 0.15 },
  },
  ligaments: {
    high: { maxBytes: 2.5 * MiB, targetTris: 120_000, triTolerance: 0.15 },
    low: { maxBytes: 1 * MiB, targetTris: 40_000, triTolerance: 0.15 },
  },
  cartilage: {
    high: { maxBytes: 2 * MiB, targetTris: 80_000, triTolerance: 0.15 },
    low: { maxBytes: 1 * MiB, targetTris: 30_000, triTolerance: 0.15 },
  },
  attachments: {
    high: { maxBytes: 3 * MiB, targetTris: 150_000, triTolerance: 0.15 },
    low: { maxBytes: 1 * MiB, targetTris: 50_000, triTolerance: 0.15 },
  },
};

/**
 * A layer's budget with the triangle target capped at the source total:
 * a layer with less geometry than its target keeps all of it (decision 8).
 */
export function layerBudget(layer: SoftLayer, lod: "high" | "low", sourceTris: number): LodBudget {
  const b = LAYER_BUDGETS[layer][lod];
  return { ...b, targetTris: Math.min(b.targetTris, sourceTris) };
}

export type SoftIdEntry = IdEntry & { layer: string };

/** Node names expected in a soft-tissue layer file. */
export function expectedLayerNodeNames(
  layer: SoftLayer,
  softIds: SoftIdEntry[],
  attachmentIds: string[],
): string[] {
  if (layer === "attachments") return [...attachmentIds];
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
