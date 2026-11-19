import { describe, expect, it } from "vitest";
import {
  add,
  centreOn,
  clampCamera,
  clampDollyFactor,
  clampOffset,
  clipPlanes,
  depthOf,
  directionFromAngles,
  dollyPose,
  dot,
  eyeOf,
  length,
  offsetOf,
  panPose,
  poseFromEye,
  repivot,
  scale,
  sub,
  viewBasis,
  viewDirection,
  type Box,
} from "../src/camera/math";
import { formatCam, parseCam, type CameraState, type Vec3 } from "../src/state/url";

const skeleton: Box = { min: [-0.33, 0, -0.12], max: [0.33, 1.7, 0.13] };
const pivot: Vec3 = [0, 0.85, 0];
const limits = { minDistance: 0.0042, maxDistance: 3.5, boundary: { min: [-0.5, -0.4, -0.3], max: [0.5, 2.1, 0.3] } as Box };

/** A point's place on screen: view-plane coordinates divided by depth. */
function screen(cam: CameraState, p: Vec3): [number, number] {
  const d = viewDirection(cam);
  const { right, up } = viewBasis(d);
  const rel = sub(p, eyeOf(cam));
  const z = dot(rel, scale(d, -1));
  return [dot(rel, right) / z, dot(rel, up) / z];
}

function orbitPose(azimuth: number, polar: number, r: number, offset?: [number, number]): CameraState {
  const cam: CameraState = { position: add(pivot, scale(directionFromAngles(azimuth, polar), r)), target: pivot };
  return offset ? { ...cam, offset } : cam;
}

const close = (a: number[], b: number[], tol = 1e-9) => a.every((x, i) => Math.abs(x - b[i]!) <= tol);

describe("fixed pivot: eye and offset", () => {
  it("with no offset the eye is the orbit position", () => {
    const cam = orbitPose(0.3, 1.2, 2);
    expect(eyeOf(cam)).toEqual(cam.position);
    expect(offsetOf(cam)).toEqual([0, 0]);
  });

  it("poseFromEye keeps the eye and the direction, whatever the pivot", () => {
    const cam = orbitPose(0.4, 1.1, 1.5, [0.1, -0.2]);
    const other = poseFromEye(eyeOf(cam), viewDirection(cam), [0.1, 0.3, 0.05]);
    expect(close(eyeOf(other), eyeOf(cam))).toBe(true);
    expect(close(viewDirection(other), viewDirection(cam))).toBe(true);
    expect(other.target).toEqual([0.1, 0.3, 0.05]);
  });
});

describe("pan", () => {
  it("moves the eye in the view plane and leaves the pivot alone", () => {
    const cam = orbitPose(0, Math.PI / 2, 2);
    const k = 0.001;
    const panned = panPose(cam, 100, 50, k);
    expect(panned.target).toEqual(pivot);
    expect(panned.position).toEqual(cam.position);
    // Picture follows the pointer: drag right and down, the pivot moves right and down on screen.
    const [x0, y0] = screen(cam, pivot);
    const [x1, y1] = screen(panned, pivot);
    expect(x1 - x0).toBeCloseTo((100 * k) / 2, 9);
    expect(y1 - y0).toBeCloseTo((-50 * k) / 2, 9);
  });

  it("orbiting after a pan keeps the pivot's place on screen", () => {
    const offset: [number, number] = [0.2, -0.1];
    const a = orbitPose(0, Math.PI / 2, 1, offset);
    const b = orbitPose(1.1, 0.7, 1, offset);
    expect(close(screen(a, pivot), screen(b, pivot))).toBe(true);
  });
});

describe("zoom toward a point", () => {
  const cam = orbitPose(0.2, 1.4, 1.8, [0.05, -0.3]);

  it("keeps the point under the cursor fixed and the pivot in place", () => {
    const point: Vec3 = [0.1, 0.2, 0.08]; // say, the left knee
    for (const f of [0.5, 0.9, 1.25]) {
      const z = dollyPose(cam, point, f);
      expect(close(screen(z, point), screen(cam, point), 1e-9)).toBe(true);
      expect(z.target).toEqual(cam.target);
      expect(close(viewDirection(z), viewDirection(cam))).toBe(true);
      expect(depthOf(z, point)).toBeCloseTo(depthOf(cam, point) * f, 9);
    }
  });

  it("zooming toward the screen centre on the pivot plane is a plain dolly", () => {
    const centre = add(cam.target, add(scale(viewBasis(viewDirection(cam)).right, 0.05), scale(viewBasis(viewDirection(cam)).up, -0.3)));
    const z = dollyPose(cam, centre, 0.5);
    expect(close(offsetOf(z), offsetOf(cam))).toBe(true);
    expect(length(sub(z.position, z.target))).toBeCloseTo(0.9, 9);
  });

  it("zooming past the pivot's plane slides the pivot along the view axis, keeping it in front", () => {
    // Looking down from above at the feet: the pelvis-height pivot ends up behind the camera otherwise.
    const above = orbitPose(Math.PI, 0.05, 2);
    const feet: Vec3 = [0.1, 0.02, 0.05];
    const z = dollyPose(above, feet, 0.1);
    expect(depthOf(z, z.target)).toBeGreaterThan(0);
    expect(depthOf(z, z.target)).toBeCloseTo(depthOf(z, feet), 9);
    expect(close(screen(z, feet), screen(above, feet), 1e-9)).toBe(true);
  });

  it("clampDollyFactor stops at the minimum distance from the point and the maximum for the pivot", () => {
    const point: Vec3 = [0.1, 0.2, 0.08];
    const depth = depthOf(cam, point);
    expect(clampDollyFactor(cam, point, 1e-6, limits) * depth).toBeCloseTo(limits.minDistance, 9);
    const out = dollyPose(cam, point, clampDollyFactor(cam, point, 100, limits));
    expect(depthOf(out, out.target)).toBeCloseTo(limits.maxDistance, 6);
    expect(clampDollyFactor(cam, point, 0.9, limits)).toBe(0.9);
  });

  it("clampDollyFactor only allows zooming out once closer than the minimum", () => {
    const near = dollyPose(cam, [0.1, 0.2, 0.08], 0.0001);
    expect(clampDollyFactor(near, [0.1, 0.2, 0.08], 0.5, limits)).toBe(1);
    expect(clampDollyFactor(near, [0.1, 0.2, 0.08], 2, limits)).toBe(2);
  });
});

describe("repivot and centre", () => {
  it("repivot moves the pivot without changing the picture", () => {
    const cam = orbitPose(0.3, 1.3, 1.6, [0.1, 0.2]);
    const femur: Vec3 = [0.1, 0.65, 0.02];
    const r = repivot(cam, femur, limits.minDistance);
    expect(r.target).toEqual(femur);
    expect(close(eyeOf(r), eyeOf(cam))).toBe(true);
    expect(close(viewDirection(r), viewDirection(cam))).toBe(true);
    for (const p of [femur, pivot, [0.3, 1.5, -0.1] as Vec3]) expect(close(screen(r, p), screen(cam, p))).toBe(true);
  });

  it("repivot keeps a too-close pivot at the minimum depth, at the same place on screen", () => {
    const cam = orbitPose(0, Math.PI / 2, 0.01);
    const behind: Vec3 = [0.001, 0.851, 0.008]; // 2 mm in front of the eye
    const r = repivot(cam, behind, 0.005);
    expect(depthOf(r, r.target)).toBeCloseTo(0.005, 9);
    expect(close(screen(r, r.target), screen(cam, behind), 1e-9)).toBe(true);
  });

  it("centreOn puts the pivot in the middle at the same distance and direction", () => {
    const cam = orbitPose(0.3, 1.3, 1.6, [0.1, 0.2]);
    const c = centreOn(cam, [0.1, 0.65, 0.02]);
    expect(offsetOf(c)).toEqual([0, 0]);
    expect(length(sub(c.position, c.target))).toBeCloseTo(1.6, 9);
    expect(close(screen(c, c.target), [0, 0])).toBe(true);
  });
});

describe("limits with an offset", () => {
  it("clampOffset keeps the view centre inside the boundary, along the same line", () => {
    const dir = directionFromAngles(0, Math.PI / 2); // looking along -Z: right = +X, up = +Y
    expect(clampOffset(pivot, dir, [0.2, 0.3], limits.boundary)).toEqual([0.2, 0.3]);
    const o = clampOffset(pivot, dir, [1, 0.5], limits.boundary);
    expect(o[0]).toBeCloseTo(0.5, 9);
    expect(o[1]).toBeCloseTo(0.25, 9);
  });

  it("clampCamera keeps a valid offset and drops a zero one", () => {
    const cam = orbitPose(0, Math.PI / 2, 1, [0.1, -0.2]);
    expect(clampCamera(cam, limits).offset).toEqual([0.1, -0.2]);
    expect(clampCamera(orbitPose(0, Math.PI / 2, 1), limits).offset).toBeUndefined();
  });

  it("the near plane follows the closer of the pivot and the zoom point", () => {
    const cam = orbitPose(0, Math.PI / 2, 0.5, [0, -0.6]);
    expect(clipPlanes(cam, [0, 0.85, 0], 0.92).near).toBeCloseTo(0.01, 9);
    expect(clipPlanes(cam, [0, 0.85, 0], 0.92, 0.05).near).toBeCloseTo(0.001, 9);
  });
});

describe("cam= with an offset", () => {
  it("reads and writes the optional two offset values", () => {
    const cam = parseCam("0,1,2,0,0.85,0,0.1,-0.25");
    expect(cam).toEqual({ position: [0, 1, 2], target: [0, 0.85, 0], offset: [0.1, -0.25] });
    expect(formatCam(cam!)).toBe("0,1,2,0,0.85,0,0.1,-0.25");
  });

  it("still reads Milestone 2 links (six values) and writes six when the offset is zero", () => {
    expect(parseCam("0,1,2,0,0.85,0")).toEqual({ position: [0, 1, 2], target: [0, 0.85, 0] });
    expect(parseCam("0,1,2,0,0.85,0,0,0")).toEqual({ position: [0, 1, 2], target: [0, 0.85, 0] });
    expect(formatCam({ position: [0, 1, 2], target: [0, 0.85, 0], offset: [0.00001, 0] })).toBe("0,1,2,0,0.85,0");
  });

  it("rejects seven values and out-of-range offsets", () => {
    expect(parseCam("0,1,2,0,0.85,0,0.1")).toBeNull();
    expect(parseCam("0,1,2,0,0.85,0,0.1,500")).toBeNull();
  });
});
