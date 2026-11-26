// The region picker's body map (M13 plan decision 8): a front view and a back
// view of the resolved region volumes (assets/build/region-volumes.json),
// projected orthographically, made at build time (`virtual:skeleton-region-map`,
// scripts/lib/index-plugin.ts). Nothing is drawn by hand: each region is the
// convex outline of its shapes' projected corners. Pure, for Vitest.
//
// Regions overlap (the thoracic wall and the shoulders; the back regions lie
// behind the trunk's front regions), so each view paints its regions back to
// front (by their nearest point) and keeps only those that stay visible: a
// region mostly hidden behind others in a view (the thoracic back from the
// front) is left out of that view, and is reached from the list or the other
// view. A region whose volume lies inside another's (the orbit in the face) is
// painted just after it, so it isn't lost under it. Names no region.

import { boxCorners, type RegionVolumes, type Shape, type Vec3 } from "./volume";

export type MapView = "front" | "back";
export type MapShape = { key: string; name: string; /** SVG path, one closed polygon per shape. */ d: string };
export type BodyMapView = { view: MapView; /** `0 0 w h` in map units. */ viewBox: string; /** Back to front: the last drawn is on top. */ shapes: MapShape[] };
export type RegionBox = { min: Vec3; max: Vec3 };
export type BodyMap = {
  views: BodyMapView[];
  /** Each region's world bounding box (glTF axes), fine and coarse, for framing. */
  boxes: Record<string, RegionBox>;
};

/** Map units per metre. */
export const MAP_SCALE = 1000;
/** Margin around the body in each view, in metres. */
const MARGIN = 0.02;
/** A region is drawn in a view when at least this share of its outline is visible there… */
export const MIN_VISIBLE = 0.2;
/** …on a raster of this cell size (metres). */
const CELL = 0.004;

type P2 = [number, number];

/** Points that bound a shape (a box's corners; a capsule's end spheres sampled). */
export function shapePoints(s: Shape): Vec3[] {
  if (s.type === "box") return boxCorners(s);
  const out: Vec3[] = [];
  for (const c of [s.a, s.b])
    for (let i = 0; i < 26; i++) {
      // The 26 directions of a cube's faces, edges and corners, normalised.
      const d = [((i % 3) - 1) as number, ((Math.floor(i / 3) % 3) - 1) as number, ((Math.floor(i / 9) % 3) - 1) as number];
      if (d[0] === 0 && d[1] === 0 && d[2] === 0) continue;
      const n = Math.hypot(d[0]!, d[1]!, d[2]!);
      out.push([c[0] + (s.radius * d[0]!) / n, c[1] + (s.radius * d[1]!) / n, c[2] + (s.radius * d[2]!) / n]);
    }
  return out;
}

/**
 * Orthographic projection, in metres: the front view looks from +Z (the
 * patient's left, +X, on the viewer's right), the back view from −Z. Screen y
 * grows downwards. Depth grows towards the viewer.
 */
export function project(p: Vec3, view: MapView): { u: number; v: number; depth: number } {
  return view === "front" ? { u: p[0], v: -p[1], depth: p[2] } : { u: -p[0], v: -p[1], depth: -p[2] };
}

/** Convex hull (monotone chain), counter-clockwise in a y-up frame; collinear points dropped. */
export function convexHull(points: readonly P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const crossZ = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && crossZ(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Is `p` inside (or on) a convex polygon given in hull order? */
export function inConvex(poly: readonly P2[], p: P2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (c === 0) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return poly.length >= 3;
}

type Projected = { key: string; name: string; polys: P2[][]; front: number };
type Region = RegionVolumes["regions"][number];

/** How far (metres) a nested region may stick out of the volume it lies in. */
const NEST_TOLERANCE = 0.01;

function aabb(points: readonly Vec3[]): RegionBox {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  return { min, max };
}

/** For each region, the region whose bounding box holds all of it (within `NEST_TOLERANCE`), if any: the smallest such. */
export function containers(regions: readonly Region[]): Map<string, string> {
  const boxes = regions.map((r) => ({ key: r.key, pts: r.shapes.flatMap(shapePoints), box: aabb(r.shapes.flatMap(shapePoints)) }));
  const vol = (b: RegionBox) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
  const out = new Map<string, string>();
  for (const r of boxes) {
    const holders = boxes.filter(
      (o) => o.key !== r.key && vol(o.box) > vol(r.box) && r.pts.every((p) => p.every((x, i) => x >= o.box.min[i]! - NEST_TOLERANCE && x <= o.box.max[i]! + NEST_TOLERANCE)),
    );
    holders.sort((a, b) => vol(a.box) - vol(b.box));
    if (holders[0]) out.set(r.key, holders[0].key);
  }
  return out;
}

function projectRegion(r: Region, view: MapView): Projected {
  let front = -Infinity;
  const polys = r.shapes.map((s) => {
    const pts = shapePoints(s).map((p) => project(p, view));
    for (const q of pts) front = Math.max(front, q.depth);
    return convexHull(pts.map((q): P2 => [q.u, q.v]));
  });
  return { key: r.key, name: r.name, polys, front };
}

/** Each region projected, a nested one's paint depth just in front of its container's. */
function projectAll(regions: readonly Region[], view: MapView): Projected[] {
  const out = regions.map((r) => projectRegion(r, view));
  const at = new Map(out.map((p) => [p.key, p]));
  const holder = containers(regions);
  const depthOf = (key: string, seen = 0): number => {
    const p = at.get(key)!;
    const h = holder.get(key);
    return h && seen < regions.length ? Math.max(p.front, depthOf(h, seen + 1) + 1e-3) : p.front;
  };
  const fronts = new Map(out.map((p) => [p.key, depthOf(p.key)]));
  return out.map((p) => ({ ...p, front: fronts.get(p.key)! }));
}

/**
 * Share of each region's outline left visible once every region is painted
 * back to front (nearest front face last), on a `CELL` raster.
 */
export function visibleShares(regions: readonly Projected[]): Map<string, number> {
  const order = [...regions].sort((a, b) => a.front - b.front || a.key.localeCompare(b.key));
  const all = order.flatMap((r) => r.polys.flat());
  const u0 = Math.min(...all.map((p) => p[0]));
  const v0 = Math.min(...all.map((p) => p[1]));
  const nu = Math.ceil((Math.max(...all.map((p) => p[0])) - u0) / CELL) + 1;
  const nv = Math.ceil((Math.max(...all.map((p) => p[1])) - v0) / CELL) + 1;
  const owner = new Int32Array(nu * nv).fill(-1);
  const area = order.map(() => 0);
  order.forEach((r, k) => {
    for (const poly of r.polys) {
      const us = poly.map((p) => p[0]);
      const vs = poly.map((p) => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...us) - u0) / CELL));
      const i1 = Math.min(nu - 1, Math.ceil((Math.max(...us) - u0) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(...vs) - v0) / CELL));
      const j1 = Math.min(nv - 1, Math.ceil((Math.max(...vs) - v0) / CELL));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const c: P2 = [u0 + (i + 0.5) * CELL, v0 + (j + 0.5) * CELL];
          if (!inConvex(poly, c)) continue;
          // A region's own shapes may overlap each other: count a cell once.
          if (owner[j * nu + i] !== k) area[k]!++;
          owner[j * nu + i] = k;
        }
    }
  });
  const shown = order.map(() => 0);
  for (const k of owner) if (k >= 0) shown[k]!++;
  return new Map(order.map((r, k) => [r.key, area[k]! > 0 ? shown[k]! / area[k]! : 0]));
}

const fmt = (x: number) => String(Math.round(x * MAP_SCALE));

/** The two views and the regions' boxes. */
export function buildBodyMap(volumes: Pick<RegionVolumes, "regions" | "coarse">): BodyMap {
  const views = (["front", "back"] as const).map((view): BodyMapView => {
    const projected = projectAll(volumes.regions, view);
    const shares = visibleShares(projected);
    const all = projected.flatMap((r) => r.polys.flat());
    const u0 = Math.min(...all.map((p) => p[0])) - MARGIN;
    const v0 = Math.min(...all.map((p) => p[1])) - MARGIN;
    const w = Math.max(...all.map((p) => p[0])) + MARGIN - u0;
    const h = Math.max(...all.map((p) => p[1])) + MARGIN - v0;
    const shapes = projected
      .filter((r) => (shares.get(r.key) ?? 0) >= MIN_VISIBLE)
      .sort((a, b) => a.front - b.front || a.key.localeCompare(b.key))
      .map((r) => ({
        key: r.key,
        name: r.name,
        d: r.polys.map((poly) => `M${poly.map((p) => `${fmt(p[0] - u0)} ${fmt(p[1] - v0)}`).join("L")}Z`).join(""),
      }));
    return { view, viewBox: `0 0 ${fmt(w)} ${fmt(h)}`, shapes };
  });
  const boxes: Record<string, RegionBox> = {};
  const grow = (key: string, p: Vec3) => {
    const b = (boxes[key] ??= { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    for (let i = 0; i < 3; i++) {
      b.min[i] = Math.min(b.min[i]!, p[i]!);
      b.max[i] = Math.max(b.max[i]!, p[i]!);
    }
  };
  for (const r of volumes.regions)
    for (const s of r.shapes)
      for (const p of shapePoints(s)) {
        grow(r.key, p);
        grow(r.coarse, p);
      }
  const round = (b: RegionBox): RegionBox => ({ min: b.min.map((x) => +x.toFixed(4)) as Vec3, max: b.max.map((x) => +x.toFixed(4)) as Vec3 });
  return { views, boxes: Object.fromEntries(volumes.coarse.filter((c) => boxes[c.key]).map((c) => [c.key, round(boxes[c.key]!)]).concat(volumes.regions.map((r) => [r.key, round(boxes[r.key]!)]))) };
}
