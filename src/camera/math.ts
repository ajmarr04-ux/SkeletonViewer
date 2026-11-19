// Pure camera maths (spec §6, "Camera"): presets, framing, clamps and
// dolly-toward-a-point. No three.js or React here, so Vitest covers it directly.
//
// Coordinates are the glTF ones: metres, Y up, the skeleton faces +Z and the
// patient's left is +X. Angles follow camera-controls: the camera sits at
// target + r * (sin(polar) sin(azimuth), cos(polar), sin(polar) cos(azimuth)).

import type { CameraState, Vec3 } from "../state/url";

export type Box = { min: Vec3; max: Vec3 };

export type Preset = "anterior" | "posterior" | "left" | "right" | "superior" | "inferior";
export const PRESETS: readonly Preset[] = ["anterior", "posterior", "left", "right", "superior", "inferior"];

/** Vertical orbit stops this far (radians) short of each pole, so the view never flips. */
export const POLE_MARGIN = 0.01;
export const MIN_POLAR = POLE_MARGIN;
export const MAX_POLAR = Math.PI - POLE_MARGIN;

/** The view's vertical field of view, in degrees. */
export const FOV_DEG = 35;
/** Frames leave this much room around the skeleton (5%). */
export const FRAME_MARGIN = 1.05;

/**
 * Where the camera sits, as camera-controls angles. Superior and inferior sit
 * just inside the pole clamp, turned so that anterior (+Z) is at the top of the
 * screen: from above, the camera leans slightly posterior; from below, slightly
 * anterior.
 */
export const PRESET_ANGLES: Record<Preset, { azimuth: number; polar: number }> = {
  anterior: { azimuth: 0, polar: Math.PI / 2 },
  posterior: { azimuth: Math.PI, polar: Math.PI / 2 },
  left: { azimuth: Math.PI / 2, polar: Math.PI / 2 },
  right: { azimuth: -Math.PI / 2, polar: Math.PI / 2 },
  superior: { azimuth: Math.PI, polar: MIN_POLAR },
  inferior: { azimuth: 0, polar: MAX_POLAR },
};

// --- small vector helpers -------------------------------------------------

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalise = (a: Vec3): Vec3 => scale(a, 1 / length(a));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function boxCentre(b: Box): Vec3 {
  return scale(add(b.min, b.max), 0.5);
}
/** Radius of the box's bounding sphere (half the diagonal). */
export function boxRadius(b: Box): number {
  return length(sub(b.max, b.min)) / 2;
}
export function boxCorners(b: Box): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) out.push([x, y, z]);
  return out;
}
export function unionBoxes(boxes: Box[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.min[i]!);
      max[i] = Math.max(max[i]!, b.max[i]!);
    }
  return { min, max };
}
export function expandBox(b: Box, by: number): Box {
  return { min: sub(b.min, [by, by, by]), max: add(b.max, [by, by, by]) };
}
export function clampToBox(p: Vec3, b: Box): Vec3 {
  return [clamp(p[0], b.min[0], b.max[0]), clamp(p[1], b.min[1], b.max[1]), clamp(p[2], b.min[2], b.max[2])];
}

// --- angles -------------------------------------------------------------

/** Unit vector from the target toward the camera. */
export function directionFromAngles(azimuth: number, polar: number): Vec3 {
  const s = Math.sin(polar);
  return [s * Math.sin(azimuth), Math.cos(polar), s * Math.cos(azimuth)];
}

export function anglesFromDirection(d: Vec3): { azimuth: number; polar: number } {
  const n = normalise(d);
  return { azimuth: Math.atan2(n[0], n[2]), polar: Math.acos(clamp(n[1], -1, 1)) };
}

/** Screen axes for a camera looking along -dir with world +Y as its up hint. */
export function viewBasis(dir: Vec3): { right: Vec3; up: Vec3 } {
  const forward = scale(normalise(dir), -1);
  const right = normalise(cross(forward, [0, 1, 0]));
  return { right, up: cross(right, forward) };
}

// --- framing ------------------------------------------------------------

/**
 * Toolbar and credits sit over the bottom of the canvas. Framing keeps the
 * skeleton in the area above them: the projection centre is moved up by half
 * the inset (`setViewOffset`), and fits use the shorter height.
 */
export const BOTTOM_INSET_PX = 100;
/** The inset never takes more than this share of the canvas height. */
export const MAX_INSET_SHARE = 0.25;

/** Share of the canvas height that framing may use (1 = all of it). */
export function framedHeightFraction(heightPx: number, insetPx = BOTTOM_INSET_PX): number {
  if (!(heightPx > 0)) return 1;
  return 1 - Math.min(insetPx, heightPx * MAX_INSET_SHARE) / heightPx;
}

/**
 * Smallest distance from `centre` (along `dir`, toward the camera) at which
 * every corner of `box` is inside the view, with `margin` to spare. Exact for
 * a perspective camera looking at `centre`. With `heightFraction` < 1 the box
 * must fit in that share of the height, centred on the (offset) projection
 * centre; the width is unchanged.
 */
export function fitDistance(
  box: Box,
  centre: Vec3,
  dir: Vec3,
  fovDeg: number,
  aspect: number,
  margin = FRAME_MARGIN,
  heightFraction = 1,
): number {
  const tanFull = Math.tan((fovDeg * Math.PI) / 360) / margin;
  const tanV = tanFull * heightFraction;
  const tanH = tanFull * aspect;
  const d = normalise(dir);
  const { right, up } = viewBasis(d);
  let need = 0;
  for (const c of boxCorners(box)) {
    const p = sub(c, centre);
    const z = dot(p, d); // toward the camera
    need = Math.max(need, z + Math.abs(dot(p, right)) / tanH, z + Math.abs(dot(p, up)) / tanV);
  }
  return need;
}

/** Look at the box's centre from `dir`, far enough back to frame all of it. */
export function frameFrom(box: Box, dir: Vec3, fovDeg: number, aspect: number, heightFraction = 1): CameraState {
  const target = boxCentre(box);
  const d = normalise(dir);
  return { position: add(target, scale(d, fitDistance(box, target, d, fovDeg, aspect, FRAME_MARGIN, heightFraction))), target };
}

export function presetView(preset: Preset, box: Box, fovDeg: number, aspect: number, heightFraction = 1): CameraState {
  const { azimuth, polar } = PRESET_ANGLES[preset];
  return frameFrom(box, directionFromAngles(azimuth, polar), fovDeg, aspect, heightFraction);
}

/** The first-load view, also used by Home and `H`. */
export function defaultView(box: Box, fovDeg: number, aspect: number, heightFraction = 1): CameraState {
  return presetView("anterior", box, fovDeg, aspect, heightFraction);
}

/** Which preset (if any) a camera is looking from, within `tol` radians. */
export function presetOf(cam: CameraState, tol = 0.02): Preset | null {
  const d = normalise(sub(cam.position, cam.target));
  for (const p of PRESETS) {
    const { azimuth, polar } = PRESET_ANGLES[p];
    if (Math.acos(clamp(dot(d, directionFromAngles(azimuth, polar)), -1, 1)) < tol) return p;
  }
  return null;
}

// --- clamps ---------------------------------------------------------------

export type Limits = {
  minDistance: number;
  maxDistance: number;
  /** The orbit target stays inside this box, so panning can't lose the skeleton. */
  boundary: Box;
};

/**
 * Zoom and pan limits (spec §6). The minimum distance is 1.5 × the bounding-
 * sphere radius of the smallest object (the stapes), so it can fill the view.
 * The maximum is 3 × the skeleton's bounding-sphere radius, but never less than
 * 1.2 × the distance any preset needs to frame the skeleton at this aspect
 * ratio (the skeleton is tall and thin, so on a wide screen 3 × radius would
 * not quite fit it).
 */
export function cameraLimits(skeleton: Box, objectRadii: number[], fovDeg: number, aspect: number, heightFraction = 1): Limits {
  const radius = boxRadius(skeleton);
  const smallest = Math.min(...objectRadii.filter((r) => r > 0));
  const centre = boxCentre(skeleton);
  let fit = 0;
  for (const p of PRESETS) {
    const { azimuth, polar } = PRESET_ANGLES[p];
    fit = Math.max(fit, fitDistance(skeleton, centre, directionFromAngles(azimuth, polar), fovDeg, aspect, FRAME_MARGIN, heightFraction));
  }
  return {
    minDistance: 1.5 * (Number.isFinite(smallest) ? smallest : radius * 0.01),
    maxDistance: Math.max(3 * radius, 1.2 * fit),
    boundary: expandBox(skeleton, radius * 0.25),
  };
}

/**
 * Bring any camera pose (for example one read from the URL) inside the limits:
 * target inside the boundary, distance within [min, max] and the view
 * direction inside the pole clamp. The direction is otherwise kept.
 */
export function clampCamera(cam: CameraState, limits: Limits): CameraState {
  const target = clampToBox(cam.target, limits.boundary);
  const offset = sub(cam.position, target);
  const dist = clamp(length(offset), limits.minDistance, limits.maxDistance);
  const { azimuth, polar } = anglesFromDirection(length(offset) > 0 ? offset : [0, 0, 1]);
  const dir = directionFromAngles(azimuth, clamp(polar, MIN_POLAR, MAX_POLAR));
  return { position: add(target, scale(dir, dist)), target };
}

// --- dolly toward the cursor -------------------------------------------------

/**
 * Scale the camera's distance by `s` about `point` (a point on the plane
 * through the target, under the cursor). Both the camera and the target move
 * toward `point` by the same ratio, so `point` stays under the cursor and the
 * view direction is unchanged.
 */
export function dollyToPoint(cam: CameraState, point: Vec3, s: number): CameraState {
  const about = (p: Vec3) => add(point, scale(sub(p, point), s));
  return { position: about(cam.position), target: about(cam.target) };
}

/** The ratio actually allowed for a dolly by `s`, given the distance clamp. */
export function clampDollyRatio(distance: number, s: number, limits: Pick<Limits, "minDistance" | "maxDistance">): number {
  return clamp(distance * s, limits.minDistance, limits.maxDistance) / distance;
}

/**
 * Where a ray from the camera through the cursor meets the plane that passes
 * through the target and faces the camera. `ray` is a direction (any length).
 */
export function pointOnTargetPlane(cam: CameraState, ray: Vec3): Vec3 {
  const forward = normalise(sub(cam.target, cam.position));
  const r = normalise(ray);
  const along = dot(r, forward);
  const dist = length(sub(cam.target, cam.position));
  // A ray parallel to the plane never meets it: fall back to the target.
  if (along < 1e-6) return cam.target;
  return add(cam.position, scale(r, dist / along));
}

/** World-space size of one CSS pixel at the target's depth. */
export function worldPerPixel(distance: number, fovDeg: number, heightPx: number): number {
  return (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(1, heightPx);
}

/**
 * Near and far planes that follow the camera, so close-ups (the stapes is
 * about 3 mm) don't clip and the depth buffer keeps its precision. The far
 * plane always reaches past the whole skeleton.
 */
export function clipPlanes(cam: CameraState, skeletonCentre: Vec3, skeletonRadius: number): { near: number; far: number } {
  const distance = length(sub(cam.position, cam.target));
  const near = clamp(distance * 0.02, 1e-4, 0.05);
  const far = length(sub(cam.position, skeletonCentre)) + skeletonRadius * 1.5 + 0.1;
  return { near, far: Math.max(far, near * 10) };
}

export function sameCamera(a: CameraState, b: CameraState, tol = 1e-4): boolean {
  return length(sub(a.position, b.position)) <= tol && length(sub(a.target, b.target)) <= tol;
}
