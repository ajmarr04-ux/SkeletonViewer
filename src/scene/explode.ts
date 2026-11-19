// Explode (spec §6, plan decision 10 and step 8): while the slider is held, the
// focus's tier-1 bones move apart from it, each along the line from the focus
// bone's box centre to its own, by up to its bounding radius × EXPLODE.scale.
// The focus stays still and tier-2-only bones don't move. Only the solid
// batch's instance matrices change, and only for the moving bones; each matrix
// is saved before the first move and written back exactly at the end, so the
// rest pose is restored bit for bit (spec §12: nothing is re-posed for good).

import { Matrix4, type Box3 } from "three";
import type { BatchedSkeleton } from "./batchSkeleton";

export const EXPLODE = {
  /** Displacement at the slider's end, as a fraction of each bone's bounding radius. */
  scale: 0.5,
  /** Ease back to rest after release (instant with reduced motion). */
  releaseMs: 400,
} as const;

export type Vec3 = [number, number, number];
export type BoneBox = { centre: Vec3; radius: number };

/** Centre and bounding radius (half the diagonal) of a box. */
export function boneBox(b: Box3): BoneBox {
  const c: Vec3 = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2];
  const dx = b.max.x - b.min.x;
  const dy = b.max.y - b.min.y;
  const dz = b.max.z - b.min.z;
  return { centre: c, radius: Math.hypot(dx, dy, dz) / 2 };
}

/**
 * Full-slider offset of each moving bone (world metres): the unit vector from
 * the focus centre to the bone's centre, times its radius × `EXPLODE.scale`.
 * A bone whose centre coincides with the focus's gets no offset.
 */
export function explodeOffsets(focus: BoneBox, movers: ReadonlyMap<string, BoneBox>): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const [id, b] of movers) {
    const d: Vec3 = [b.centre[0] - focus.centre[0], b.centre[1] - focus.centre[1], b.centre[2] - focus.centre[2]];
    const len = Math.hypot(...d);
    const k = len > 1e-9 ? (b.radius * EXPLODE.scale) / len : 0;
    out.set(id, [d[0] * k, d[1] * k, d[2] * k]);
  }
  return out;
}

/** Ease-out cubic, for the release. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Slider value `elapsed` ms into the release from `from`: eases to exactly 0 at `ms`. */
export function releaseValue(from: number, elapsed: number, ms: number = EXPLODE.releaseMs): number {
  if (ms <= 0 || elapsed >= ms) return 0;
  return from * (1 - easeOut(elapsed / ms));
}

/** A running explode: the saved rest matrices and full offsets, by instance ID. */
export type ExplodeRun = { base: Map<number, Matrix4>; offsets: Map<number, Vec3> };

/** Save the moving bones' matrices. Bones not in the batch are skipped. */
export function beginExplode(sk: BatchedSkeleton, offsets: ReadonlyMap<string, Vec3>): ExplodeRun {
  const run: ExplodeRun = { base: new Map(), offsets: new Map() };
  for (const [id, o] of offsets) {
    const i = sk.instanceOf.get(id);
    if (i === undefined) continue;
    run.base.set(i, sk.mesh.getMatrixAt(i, new Matrix4()));
    run.offsets.set(i, o);
  }
  return run;
}

const _m = new Matrix4();
const _t = new Matrix4();

/** Place the moving bones at slider value `s` (0 to 1): translation(offset × s) × rest matrix. */
export function setExplode(sk: BatchedSkeleton, run: ExplodeRun, s: number): void {
  for (const [i, base] of run.base) {
    const o = run.offsets.get(i)!;
    _t.makeTranslation(o[0] * s, o[1] * s, o[2] * s);
    sk.mesh.setMatrixAt(i, _m.multiplyMatrices(_t, base));
  }
  sk.mesh.boundingSphere = null; // recomputed for culling from the moved instances
  sk.mesh.boundingBox = null;
}

/** Write the saved rest matrices back exactly. */
export function endExplode(sk: BatchedSkeleton, run: ExplodeRun): void {
  for (const [i, base] of run.base) sk.mesh.setMatrixAt(i, base);
  sk.mesh.boundingSphere = null;
  sk.mesh.boundingBox = null;
}
