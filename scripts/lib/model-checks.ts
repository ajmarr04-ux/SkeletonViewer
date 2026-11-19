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
    : [`${lod}: ${(bytes / 1e6).toFixed(2)} MB is over the ${(budget.maxBytes / 1024 / 1024).toFixed(0)} MiB budget`];
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
