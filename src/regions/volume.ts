// Body-region volumes (M13 plan decisions 1–2, step 1). Pure: no three.js, no I/O.
//
// `content/regions/regions.json` is authored: each fine region's volume is one or
// more shapes, each either a `fit` around named anchor structures (the box or
// capsule around their vertices) or a literal `box` / `capsule` with a reason.
// `scripts/regions/volumes.ts` resolves the fits from the anchors' vertices into
// `assets/build/region-volumes.json`, which is all the app and the membership
// step read. Coordinates are glTF's: metres, +Y superior, +Z anterior, +X the
// patient's left.
//
// "Region" here is a *body* region. It is unrelated to the bones' tier 2
// (`content/regions.json`) and to colour-by-region (`src/scene/regionColours.ts`).

export type Vec3 = [number, number, number];
export type Side = "left" | "right";

/** Pads on the faces of a world-aligned box, in anatomical words. `medial`/`lateral` need a side. */
export type FacePads = Partial<
  Record<"superior" | "inferior" | "anterior" | "posterior" | "left" | "right" | "medial" | "lateral", number>
>;

/**
 * An anchor: a structure ID, optionally only a fraction `span` of it along an axis:
 * `long` (default; its own principal axis, signed by `orientAxis`), `vertical`
 * (0 = inferior), `anteroposterior` (0 = posterior) or `mediolateral` (0 = medial;
 * the side comes from the ID's `_left` / `_right`).
 */
/** Pads along a PCA shape's long axis and across it. */
export type AxisPads = { long: number; cross: number };

export type AnchorAxis = "long" | "vertical" | "anteroposterior" | "mediolateral";
export type Anchor = string | { id: string; span: [number, number]; axis?: AnchorAxis };

export type FitShape = {
  fit: Anchor[];
  /** `pca` (default): box axes along the anchors' principal axes. `world`: axis-aligned. */
  orient?: "pca" | "world";
  /** `box` (default) or `capsule` (along the first principal axis). */
  shape?: "box" | "capsule";
  /**
   * Metres added on every face; or per face (`FacePads`, world-oriented boxes only);
   * or `{ long, cross }` (along the first axis and across it, PCA boxes and capsules). Negative trims.
   */
  pad?: number | FacePads | AxisPads;
  /** Keep only this fraction range of the fitted points along the long axis (0 = the low end, see `orientAxis`). */
  span?: [number, number];
  /** In a region without sides: one shape per side, `{side}` replaced in the anchors. */
  eachSide?: boolean;
};
export type LiteralBox = { box: { center: Vec3; size: Vec3 }; reason: string; eachSide?: boolean };
export type LiteralCapsule = { capsule: { a: Vec3; b: Vec3; radius: number }; reason: string; eachSide?: boolean };
export type ShapeSpec = FitShape | LiteralBox | LiteralCapsule;

export type CoarseSpec = { key: string; name: string; sides?: boolean };
export type RegionSpec = { key: string; name: string; coarse: string; sides?: boolean; shapes: ShapeSpec[] };
export type RegionsFile = { threshold: number; coarse: CoarseSpec[]; regions: RegionSpec[] };

/** An oriented box: centre, three orthonormal axes, half extents along them. */
export type OBox = { type: "box"; center: Vec3; axes: [Vec3, Vec3, Vec3]; half: Vec3 };
export type Capsule = { type: "capsule"; a: Vec3; b: Vec3; radius: number };
export type Shape = OBox | Capsule;

export type ResolvedRegion = { key: string; name: string; coarse: string; side: Side | null; shapes: Shape[]; literal: boolean };
export type ResolvedCoarse = { key: string; name: string; side: Side | null };
export type RegionVolumes = {
  $comment: string;
  threshold: number;
  /** sha-256 of `content/regions/regions.json` (staleness check). */
  sourceHash: string;
  coarse: ResolvedCoarse[];
  regions: ResolvedRegion[];
};

// ---------------------------------------------------------------- vectors

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** Points as a flat xyz array. */
export type Points = Float64Array | number[];

const pointAt = (p: Points, i: number): Vec3 => [p[3 * i]!, p[3 * i + 1]!, p[3 * i + 2]!];

// ---------------------------------------------------------------- principal axes

/** Eigenvectors of a symmetric 3×3 matrix (Jacobi), sorted by decreasing eigenvalue. */
export function symmetricEigen(m: number[][]): { values: Vec3; vectors: [Vec3, Vec3, Vec3] } {
  const a = m.map((r) => [...r]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0]![1]! ** 2 + a[0]![2]! ** 2 + a[1]![2]! ** 2;
    if (off < 1e-30) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      const apq = a[p]![q]!;
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k]![p]!;
        const akq = a[k]![q]!;
        a[k]![p] = c * akp - s * akq;
        a[k]![q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p]![k]!;
        const aqk = a[q]![k]!;
        a[p]![k] = c * apk - s * aqk;
        a[q]![k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k]![p]!;
        const vkq = v[k]![q]!;
        v[k]![p] = c * vkp - s * vkq;
        v[k]![q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[j]![j]! - a[i]![i]!);
  const values = order.map((i) => a[i]![i]!) as Vec3;
  const vectors = order.map((i) => [v[0]![i]!, v[1]![i]!, v[2]![i]!] as Vec3) as [Vec3, Vec3, Vec3];
  return { values, vectors };
}

/**
 * Give an axis a deterministic sign: its largest world component is positive.
 * So along a vertical bone 0 is the inferior end, along a transverse one the right end.
 */
export function orientAxis(axis: Vec3): Vec3 {
  let k = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(axis[i]!) > Math.abs(axis[k]!) + 1e-12) k = i;
  return axis[k]! < 0 ? scale(axis, -1) : axis;
}

/** Principal axes of a point set: a right-handed orthonormal frame, the first axis the longest. */
export function principalAxes(points: Points): [Vec3, Vec3, Vec3] {
  const n = points.length / 3;
  if (n === 0) throw new Error("no points");
  const c: Vec3 = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] = c[k]! + points[3 * i + k]! / n;
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const d = sub(pointAt(points, i), c);
    for (let r = 0; r < 3; r++) for (let s = 0; s < 3; s++) m[r]![s] = m[r]![s]! + (d[r]! * d[s]!) / n;
  }
  const { vectors } = symmetricEigen(m);
  const e0 = orientAxis(norm(vectors[0]));
  // Re-orthogonalise the second axis against the first, then complete a right-handed frame.
  let e1 = sub(vectors[1], scale(e0, dot(vectors[1], e0)));
  e1 = orientAxis(norm(e1));
  const e2 = norm(cross(e0, e1));
  return [e0, e1, e2];
}

const WORLD: [Vec3, Vec3, Vec3] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Extents of points along an axis frame. */
function extents(points: Points, axes: [Vec3, Vec3, Vec3]): { lo: Vec3; hi: Vec3 } {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length / 3; i++) {
    const p = pointAt(points, i);
    for (let k = 0; k < 3; k++) {
      const t = dot(p, axes[k]!);
      if (t < lo[k]!) lo[k] = t;
      if (t > hi[k]!) hi[k] = t;
    }
  }
  return { lo, hi };
}

/** The points whose position along `axis` lies in the `span` fraction of their own range. */
export function clipSpan(points: Points, axis: Vec3, span: [number, number]): number[] {
  const [lo0, hi0] = span;
  if (!(lo0 >= 0 && hi0 <= 1 && lo0 < hi0)) throw new Error(`bad span [${span.join(", ")}]`);
  let lo = Infinity;
  let hi = -Infinity;
  const n = points.length / 3;
  for (let i = 0; i < n; i++) {
    const t = dot(pointAt(points, i), axis);
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  const a = lo + lo0 * (hi - lo);
  const b = lo + hi0 * (hi - lo);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pointAt(points, i);
    const t = dot(p, axis);
    if (t >= a - 1e-12 && t <= b + 1e-12) out.push(...p);
  }
  return out;
}

/** The side an ID names by its suffix, or null for a midline structure. */
export const sideOfId = (id: string): Side | null => (id.endsWith("_left") ? "left" : id.endsWith("_right") ? "right" : null);

/** One anchor's points: the whole structure, or the `span` of it along an axis (see `Anchor`). */
export function anchorPoints(points: Points, anchor: Anchor): Points {
  if (typeof anchor === "string") return points;
  const axis = anchor.axis ?? "long";
  let dir: Vec3;
  if (axis === "long") dir = principalAxes(points)[0];
  else if (axis === "vertical") dir = [0, 1, 0];
  else if (axis === "anteroposterior") dir = [0, 0, 1];
  else {
    const side = sideOfId(anchor.id);
    if (!side) throw new Error(`anchor ${anchor.id}: a mediolateral span needs a sided structure`);
    dir = side === "left" ? [1, 0, 0] : [-1, 0, 0];
  }
  return clipSpan(points, dir, anchor.span);
}

/** World axis index and sign of each anatomical face (`medial`/`lateral` by side; the patient's left is +X). */
function faceOf(face: keyof FacePads, side: Side | null): { axis: number; sign: 1 | -1 } {
  switch (face) {
    case "superior":
      return { axis: 1, sign: 1 };
    case "inferior":
      return { axis: 1, sign: -1 };
    case "anterior":
      return { axis: 2, sign: 1 };
    case "posterior":
      return { axis: 2, sign: -1 };
    case "left":
      return { axis: 0, sign: 1 };
    case "right":
      return { axis: 0, sign: -1 };
    case "medial":
    case "lateral": {
      if (!side) throw new Error(`pad "${face}" needs a sided shape`);
      const lateralSign = side === "left" ? 1 : -1;
      return { axis: 0, sign: (face === "lateral" ? lateralSign : -lateralSign) as 1 | -1 };
    }
  }
}

/** Fit a box or capsule around points (already gathered from the anchors). */
export function fitShape(points: Points, spec: Omit<FitShape, "fit" | "eachSide">, side: Side | null): Shape {
  const orient = spec.orient ?? "pca";
  let axes: [Vec3, Vec3, Vec3] = orient === "world" ? WORLD : principalAxes(points);
  let pts = points;
  if (spec.span) {
    pts = clipSpan(points, orient === "world" ? longestWorldAxis(points) : axes[0], spec.span);
    if (pts.length === 0) throw new Error("span left no points");
    // Keep the long axis; refit the cross-section to the points that are left.
    if (orient === "pca") axes = frameFrom(axes[0], pts);
  }
  const { lo, hi } = extents(pts, axes);
  const pad = spec.pad ?? 0;
  const isAxisPads = (x: typeof pad): x is AxisPads => typeof x === "object" && ("long" in x || "cross" in x);
  if (typeof pad === "number" || isAxisPads(pad)) {
    const along = typeof pad === "number" ? [pad, pad, pad] : [pad.long, pad.cross, pad.cross];
    for (let k = 0; k < 3; k++) {
      lo[k] = lo[k]! - along[k]!;
      hi[k] = hi[k]! + along[k]!;
    }
  } else {
    if (orient !== "world") throw new Error("per-face pads need orient: world");
    for (const [face, v] of Object.entries(pad) as [keyof FacePads, number][]) {
      const { axis, sign } = faceOf(face, side);
      if (sign > 0) hi[axis] = hi[axis]! + v;
      else lo[axis] = lo[axis]! - v;
    }
  }
  for (let k = 0; k < 3; k++) if (!(hi[k]! > lo[k]!)) throw new Error("pad left an empty shape");
  if ((spec.shape ?? "box") === "capsule") {
    // Along the first axis; the radius covers the farthest point from the axis line.
    const mid1 = (lo[1]! + hi[1]!) / 2;
    const mid2 = (lo[2]! + hi[2]!) / 2;
    let r = 0;
    for (let i = 0; i < pts.length / 3; i++) {
      const p = pointAt(pts, i);
      r = Math.max(r, Math.hypot(dot(p, axes[1]) - mid1, dot(p, axes[2]) - mid2));
    }
    const radius = r + (typeof pad === "number" ? pad : isAxisPads(pad) ? pad.cross : 0);
    const base = add(scale(axes[1], mid1), scale(axes[2], mid2));
    // The capsule's caps add the radius at each end: pull the segment in so the length matches the box.
    const lo0 = Math.min(lo[0]! + radius, (lo[0]! + hi[0]!) / 2);
    const hi0 = Math.max(hi[0]! - radius, (lo[0]! + hi[0]!) / 2);
    return { type: "capsule", a: round3(add(base, scale(axes[0], lo0))), b: round3(add(base, scale(axes[0], hi0))), radius: round(radius) };
  }
  const centreLocal: Vec3 = [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2];
  const center = add(add(scale(axes[0], centreLocal[0]), scale(axes[1], centreLocal[1])), scale(axes[2], centreLocal[2]));
  const half: Vec3 = [(hi[0]! - lo[0]!) / 2, (hi[1]! - lo[1]!) / 2, (hi[2]! - lo[2]!) / 2];
  return { type: "box", center: round3(center), axes: axes.map(roundAxis) as [Vec3, Vec3, Vec3], half: round3(half) };
}

/** For a world box with a span: the world axis along which the points are longest. */
function longestWorldAxis(points: Points): Vec3 {
  const { lo, hi } = extents(points, WORLD);
  let k = 0;
  for (let i = 1; i < 3; i++) if (hi[i]! - lo[i]! > hi[k]! - lo[k]!) k = i;
  return WORLD[k]!;
}

/** A right-handed frame whose first axis is `e0`, the others the clipped points' principal axes around it. */
function frameFrom(e0: Vec3, points: Points): [Vec3, Vec3, Vec3] {
  const [, b1] = principalAxes(points);
  let e1 = sub(b1, scale(e0, dot(b1, e0)));
  if (Math.hypot(...e1) < 1e-9) e1 = Math.abs(e0[0]) < 0.9 ? cross(e0, [1, 0, 0]) : cross(e0, [0, 1, 0]);
  e1 = orientAxis(norm(e1));
  return [e0, e1, norm(cross(e0, e1))];
}

// Round to 0.1 mm (and axes to 1e-6) so the generated file is stable and diff-friendly.
const round = (x: number) => Math.round(x * 1e4) / 1e4 + 0;
const round3 = (v: Vec3): Vec3 => [round(v[0]), round(v[1]), round(v[2])];
const roundAxis = (v: Vec3): Vec3 => v.map((x) => Math.round(x * 1e6) / 1e6 + 0) as Vec3;

// ---------------------------------------------------------------- point tests

/** Inside or on the surface of a shape (`eps` metres of slack). */
export function inShape(s: Shape, p: Vec3, eps = 1e-9): boolean {
  if (s.type === "box") {
    const d = sub(p, s.center);
    for (let k = 0; k < 3; k++) if (Math.abs(dot(d, s.axes[k]!)) > s.half[k]! + eps) return false;
    return true;
  }
  const ab = sub(s.b, s.a);
  const len2 = dot(ab, ab);
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, s.a), ab) / len2));
  const q = add(s.a, scale(ab, t));
  const d = sub(p, q);
  return Math.sqrt(dot(d, d)) <= s.radius + eps;
}

export const inRegion = (r: { shapes: Shape[] }, p: Vec3): boolean => r.shapes.some((s) => inShape(s, p));

/** The eight corners of a box (for drawing and for framing). */
export function boxCorners(b: OBox): Vec3[] {
  const out: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        out.push(
          add(add(add(b.center, scale(b.axes[0], sx * b.half[0])), scale(b.axes[1], sy * b.half[1])), scale(b.axes[2], sz * b.half[2])),
        );
  return out;
}

// ---------------------------------------------------------------- authoring file

const SIDES: Side[] = ["left", "right"];
const withSide = (s: string, side: Side) => s.split("{side}").join(side);
const anchorId = (a: Anchor) => (typeof a === "string" ? a : a.id);

function sideShape(s: ShapeSpec, side: Side): ShapeSpec {
  if ("fit" in s) return { ...s, fit: s.fit.map((a) => (typeof a === "string" ? withSide(a, side) : { ...a, id: withSide(a.id, side) })) };
  return s;
}

/** A fine region with its sides and `eachSide` shapes expanded; `side` drives `medial`/`lateral` pads. */
export type ExpandedRegion = { key: string; name: string; coarse: string; side: Side | null; shapes: { spec: ShapeSpec; side: Side | null }[] };

/** Expand `{side}` templates: sided regions into one region per side, `eachSide` shapes into two shapes. */
export function expandRegions(file: RegionsFile): { coarse: ResolvedCoarse[]; regions: ExpandedRegion[] } {
  const coarse = file.coarse.flatMap((c): ResolvedCoarse[] =>
    c.sides ? SIDES.map((side) => ({ key: withSide(c.key, side), name: withSide(c.name, side), side })) : [{ key: c.key, name: c.name, side: null }],
  );
  const regions: ExpandedRegion[] = [];
  for (const r of file.regions) {
    const variants: (Side | null)[] = r.sides ? SIDES : [null];
    for (const side of variants) {
      const sub = (x: string) => (side ? withSide(x, side) : x);
      const shapes = r.shapes.flatMap((s) => {
        if (s.eachSide) {
          if (side) throw new Error(`${r.key}: eachSide inside a sided region`);
          return SIDES.map((sd) => ({ spec: sideShape(s, sd), side: sd }));
        }
        return [{ spec: side ? sideShape(s, side) : s, side }];
      });
      regions.push({ key: sub(r.key), name: sub(r.name), coarse: sub(r.coarse), side, shapes });
    }
  }
  return { coarse, regions };
}

/**
 * Problems with the authoring file that need no geometry: keys (snake_case, unique,
 * not an existing ID or group key), coarse parents, `{side}` use, the threshold,
 * a reason on every literal shape, and anchors that name known structures with a mesh.
 */
export function checkRegionsFile(file: RegionsFile, meshIds: ReadonlySet<string>, takenKeys: ReadonlySet<string> = new Set()): string[] {
  const errors: string[] = [];
  if (!(file.threshold > 0 && file.threshold < 1)) errors.push(`threshold ${file.threshold} is not between 0 and 1`);
  for (const c of file.coarse) if (c.sides !== !!c.key.includes("{side}") && (c.sides || c.key.includes("{side}"))) errors.push(`coarse ${c.key}: sides and {side} disagree`);
  for (const r of file.regions) if (!!r.sides !== r.key.includes("{side}")) errors.push(`${r.key}: sides and {side} disagree`);
  let expanded: ReturnType<typeof expandRegions>;
  try {
    expanded = expandRegions(file);
  } catch (e) {
    return [...errors, (e as Error).message];
  }
  const seen = new Set<string>();
  const coarseKeys = new Set(expanded.coarse.map((c) => c.key));
  for (const key of [...expanded.coarse.map((c) => c.key), ...expanded.regions.map((r) => r.key)]) {
    if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(key)) errors.push(`${key}: key is not snake_case`);
    if (seen.has(key)) errors.push(`${key}: duplicate key`);
    if (takenKeys.has(key)) errors.push(`${key}: collides with an existing ID or group key`);
    seen.add(key);
  }
  for (const r of expanded.regions) {
    if (!coarseKeys.has(r.coarse)) errors.push(`${r.key}: unknown coarse region ${r.coarse}`);
    if (r.shapes.length === 0) errors.push(`${r.key}: no shapes`);
    for (const { spec } of r.shapes) {
      if ("fit" in spec) {
        if (spec.fit.length === 0) errors.push(`${r.key}: a fit with no anchors`);
        for (const a of spec.fit) if (!meshIds.has(anchorId(a))) errors.push(`${r.key}: anchor ${anchorId(a)} is not a structure with a mesh`);
      } else if (!spec.reason?.trim()) errors.push(`${r.key}: a literal shape without a reason`);
    }
  }
  for (const c of expanded.coarse) if (!expanded.regions.some((r) => r.coarse === c.key)) errors.push(`coarse ${c.key}: no fine regions`);
  return errors;
}

/** Resolve every region's shapes; `pointsOf` gives a structure's world vertices. */
export function resolveRegions(
  file: RegionsFile,
  pointsOf: (id: string) => Points,
  sourceHash: string,
): RegionVolumes {
  const { coarse, regions } = expandRegions(file);
  const out: ResolvedRegion[] = regions.map((r) => {
    let literal = false;
    const shapes = r.shapes.map(({ spec, side }): Shape => {
      if ("box" in spec) {
        literal = true;
        const h = scale(spec.box.size, 0.5);
        return { type: "box", center: round3(spec.box.center), axes: WORLD, half: round3(h) };
      }
      if ("capsule" in spec) {
        literal = true;
        return { type: "capsule", a: round3(spec.capsule.a), b: round3(spec.capsule.b), radius: round(spec.capsule.radius) };
      }
      const pts: number[] = [];
      for (const a of spec.fit) {
        let p: Points;
        try {
          p = anchorPoints(pointsOf(anchorId(a)), a);
        } catch (e) {
          throw new Error(`${r.key}: ${(e as Error).message}`);
        }
        for (let i = 0; i < p.length; i++) pts.push(p[i]!);
      }
      try {
        return fitShape(pts, spec, side);
      } catch (e) {
        throw new Error(`${r.key}: ${(e as Error).message}`);
      }
    });
    return { key: r.key, name: r.name, coarse: r.coarse, side: r.side, shapes, literal };
  });
  return {
    $comment: "Generated by scripts/regions/volumes.ts from content/regions/regions.json (npm run regions:volumes). Do not edit.",
    threshold: file.threshold,
    sourceHash,
    coarse,
    regions: out,
  };
}
