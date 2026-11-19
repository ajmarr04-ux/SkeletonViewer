import { describe, expect, it } from "vitest";
import {
  FOV_DEG,
  MAX_POLAR,
  MIN_POLAR,
  PRESETS,
  PRESET_ANGLES,
  anglesFromDirection,
  boxCentre,
  boxCorners,
  boxRadius,
  cameraLimits,
  clampCamera,
  clampDollyRatio,
  clipPlanes,
  defaultView,
  directionFromAngles,
  dollyToPoint,
  dot,
  fitDistance,
  framedHeightFraction,
  BOTTOM_INSET_PX,
  frameFrom,
  length,
  normalise,
  pointOnTargetPlane,
  presetOf,
  presetView,
  sub,
  viewBasis,
  worldPerPixel,
  type Box,
} from "../src/camera/math";
import type { Vec3 } from "../src/state/url";

// The real skeleton's bounds (assets/build/manifest.json, high LOD).
const SKELETON: Box = { min: [-0.334625, 0.009203, -0.112815], max: [0.334625, 1.705455, 0.137308] };
const STAPES_RADIUS = 0.0028133;

const close = (a: Vec3, b: Vec3, tol = 1e-9) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, -Math.log10(tol)));

/** Project a world point for a camera looking at target; returns NDC x, y. */
function project(cam: { position: Vec3; target: Vec3 }, p: Vec3, fovDeg: number, aspect: number) {
  const dir = normalise(sub(cam.position, cam.target));
  const { right, up } = viewBasis(dir);
  const rel = sub(p, cam.position);
  const depth = -dot(rel, dir);
  const t = Math.tan((fovDeg * Math.PI) / 360);
  return { x: dot(rel, right) / depth / (t * aspect), y: dot(rel, up) / depth / t };
}

describe("presets", () => {
  it.each([
    ["anterior", [0, 0, 1]],
    ["posterior", [0, 0, -1]],
    ["left", [1, 0, 0]],
    ["right", [-1, 0, 0]],
  ] as const)("%s looks from %j", (preset, dir) => {
    const { azimuth, polar } = PRESET_ANGLES[preset];
    close(directionFromAngles(azimuth, polar), [...dir] as Vec3);
  });

  it("superior and inferior sit just inside the pole clamp, with anterior at the top of the screen", () => {
    for (const p of ["superior", "inferior"] as const) {
      const { azimuth, polar } = PRESET_ANGLES[p];
      const d = directionFromAngles(azimuth, polar);
      expect(Math.sign(d[1])).toBe(p === "superior" ? 1 : -1);
      expect(polar).toBeGreaterThanOrEqual(MIN_POLAR);
      expect(polar).toBeLessThanOrEqual(MAX_POLAR);
      // Screen-up points toward +Z (anterior).
      expect(viewBasis(d).up[2]).toBeGreaterThan(0.99);
    }
  });

  it("every preset keeps world +Y up on screen for the side views", () => {
    for (const p of ["anterior", "posterior", "left", "right"] as const) {
      const { azimuth, polar } = PRESET_ANGLES[p];
      close(viewBasis(directionFromAngles(azimuth, polar)).up, [0, 1, 0]);
    }
  });

  it("presetOf recognises each preset view", () => {
    for (const p of PRESETS) expect(presetOf(presetView(p, SKELETON, FOV_DEG, 1.6))).toBe(p);
    expect(presetOf({ position: [1, 1, 1], target: [0, 0, 0] })).toBeNull();
  });

  it("angles round-trip through a direction", () => {
    const a = anglesFromDirection(directionFromAngles(0.7, 1.1));
    expect(a.azimuth).toBeCloseTo(0.7, 12);
    expect(a.polar).toBeCloseTo(1.1, 12);
  });
});

describe("framing", () => {
  for (const aspect of [390 / 844, 1, 16 / 9]) {
    it(`every preset frames the whole skeleton, tightly, at aspect ${aspect.toFixed(2)}`, () => {
      for (const p of PRESETS) {
        const cam = presetView(p, SKELETON, FOV_DEG, aspect);
        close(cam.target, boxCentre(SKELETON));
        let maxEdge = 0;
        for (const c of boxCorners(SKELETON)) {
          const { x, y } = project(cam, c, FOV_DEG, aspect);
          expect(Math.abs(x)).toBeLessThanOrEqual(1);
          expect(Math.abs(y)).toBeLessThanOrEqual(1);
          maxEdge = Math.max(maxEdge, Math.abs(x), Math.abs(y));
        }
        // Tight: one corner touches the 5% margin.
        expect(maxEdge).toBeCloseTo(1 / 1.05, 6);
      }
    });
  }

  it("the default view is the anterior preset", () => {
    expect(defaultView(SKELETON, FOV_DEG, 1.5)).toEqual(presetView("anterior", SKELETON, FOV_DEG, 1.5));
  });

  it("frameFrom keeps the given direction", () => {
    const dir: Vec3 = [1, 0.5, 2];
    const cam = frameFrom(SKELETON, dir, FOV_DEG, 1.2);
    close(normalise(sub(cam.position, cam.target)), normalise(dir));
  });

  it("leaves room for the toolbar: the box fits the shorter height, the width is unchanged", () => {
    for (const aspect of [0.46, 1.6]) {
      const hf = 0.85;
      const cam = presetView("anterior", SKELETON, FOV_DEG, aspect, hf);
      let maxY = 0;
      let maxX = 0;
      for (const c of boxCorners(SKELETON)) {
        // y in NDC about the (offset) projection centre; the framed area is ±hf.
        const { x, y } = project(cam, c, FOV_DEG, aspect);
        maxY = Math.max(maxY, Math.abs(y));
        maxX = Math.max(maxX, Math.abs(x));
      }
      expect(maxY).toBeLessThanOrEqual(hf / 1.05 + 1e-9);
      expect(maxX).toBeLessThanOrEqual(1 / 1.05 + 1e-9);
      expect(Math.max(maxY / hf, maxX)).toBeCloseTo(1 / 1.05, 6);
    }
  });

  it("framedHeightFraction takes the inset, capped at a quarter of the height", () => {
    expect(framedHeightFraction(800)).toBeCloseTo(1 - BOTTOM_INSET_PX / 800, 12);
    expect(framedHeightFraction(200)).toBeCloseTo(0.75, 12);
    expect(framedHeightFraction(0)).toBe(1);
    expect(framedHeightFraction(800, 0)).toBe(1);
  });

  it("a wider screen never needs a larger distance", () => {
    const c = boxCentre(SKELETON);
    expect(fitDistance(SKELETON, c, [0, 0, 1], FOV_DEG, 2)).toBeLessThanOrEqual(fitDistance(SKELETON, c, [0, 0, 1], FOV_DEG, 0.5));
  });
});

describe("limits", () => {
  const radii = [STAPES_RADIUS, 0.05, 0.2];
  it("min distance comes from the smallest object (the stapes)", () => {
    expect(cameraLimits(SKELETON, radii, FOV_DEG, 1.5).minDistance).toBeCloseTo(1.5 * STAPES_RADIUS, 9);
  });
  it("max distance is at least 3 × the skeleton's radius and always fits every preset", () => {
    for (const aspect of [0.46, 1, 1.78, 3]) {
      const lim = cameraLimits(SKELETON, radii, FOV_DEG, aspect);
      expect(lim.maxDistance).toBeGreaterThanOrEqual(3 * boxRadius(SKELETON) - 1e-12);
      for (const p of PRESETS) {
        const cam = presetView(p, SKELETON, FOV_DEG, aspect);
        expect(length(sub(cam.position, cam.target))).toBeLessThan(lim.maxDistance);
      }
    }
  });
  it("ignores zero-size objects", () => {
    expect(cameraLimits(SKELETON, [0, 0.01], FOV_DEG, 1).minDistance).toBeCloseTo(0.015, 12);
  });
});

describe("clampCamera", () => {
  const lim = cameraLimits(SKELETON, [STAPES_RADIUS], FOV_DEG, 1.5);
  const centre = boxCentre(SKELETON);

  it("leaves a camera inside the limits alone", () => {
    const cam = { position: [0.3, 1.2, 1.5] as Vec3, target: [0, 1, 0] as Vec3 };
    const out = clampCamera(cam, lim);
    close(out.position, cam.position, 1e-12);
    close(out.target, cam.target, 1e-12);
  });
  it("pulls a far camera in to max distance along the same direction", () => {
    const out = clampCamera({ position: [0, centre[1], 50], target: centre }, lim);
    expect(length(sub(out.position, out.target))).toBeCloseTo(lim.maxDistance, 9);
    close(normalise(sub(out.position, out.target)), [0, 0, 1]);
  });
  it("pushes a too-close camera out to min distance", () => {
    const out = clampCamera({ position: [0, 1, 0.0001], target: [0, 1, 0] }, lim);
    expect(length(sub(out.position, out.target))).toBeCloseTo(lim.minDistance, 12);
  });
  it("moves a camera straight above the target just inside the pole", () => {
    const out = clampCamera({ position: [0, 2, 0], target: [0, 1, 0] }, lim);
    expect(anglesFromDirection(sub(out.position, out.target)).polar).toBeCloseTo(MIN_POLAR, 9);
  });
  it("keeps the target inside the boundary", () => {
    const out = clampCamera({ position: [10, 1, 1], target: [9, 1, 0] }, lim);
    expect(out.target[0]).toBeCloseTo(lim.boundary.max[0], 12);
  });
});

describe("dolly toward the cursor", () => {
  const cam = { position: [0, 1, 3] as Vec3, target: [0, 1, 0] as Vec3 };

  it("keeps the point under the cursor fixed on screen and the direction unchanged", () => {
    const point: Vec3 = [0.4, 1.3, 0];
    const before = project(cam, point, FOV_DEG, 1.5);
    const after = dollyToPoint(cam, point, 0.5);
    const now = project(after, point, FOV_DEG, 1.5);
    expect(now.x).toBeCloseTo(before.x, 12);
    expect(now.y).toBeCloseTo(before.y, 12);
    expect(length(sub(after.position, after.target))).toBeCloseTo(1.5, 12);
    close(normalise(sub(after.position, after.target)), [0, 0, 1]);
  });

  it("finds the point under the cursor on the target plane", () => {
    expect(pointOnTargetPlane(cam, [0, 0, -1])).toEqual([0, 1, 0]);
    close(pointOnTargetPlane(cam, [0.1, 0, -1]), [0.3, 1, 0]);
    // A ray that never meets the plane falls back to the target.
    expect(pointOnTargetPlane(cam, [1, 0, 0])).toEqual([0, 1, 0]);
  });

  it("clamps the ratio to the distance limits", () => {
    const lim = { minDistance: 1, maxDistance: 4 };
    expect(clampDollyRatio(2, 0.1, lim)).toBeCloseTo(0.5, 12);
    expect(clampDollyRatio(2, 10, lim)).toBeCloseTo(2, 12);
    expect(clampDollyRatio(2, 1.1, lim)).toBeCloseTo(1.1, 12);
  });
});

describe("clip planes and pixel size", () => {
  const centre = boxCentre(SKELETON);
  const r = boxRadius(SKELETON);
  it("the far plane always reaches past the skeleton", () => {
    const cam = presetView("anterior", SKELETON, FOV_DEG, 1.5);
    const { near, far } = clipPlanes(cam, centre, r);
    for (const c of boxCorners(SKELETON)) expect(length(sub(c, cam.position))).toBeLessThan(far);
    expect(near).toBeLessThanOrEqual(0.05);
  });
  it("close-ups get a small near plane", () => {
    const { near } = clipPlanes({ position: [0, 1.6, 0.005], target: [0, 1.6, 0] }, centre, r);
    expect(near).toBeLessThan(0.001);
  });
  it("a pixel at the target's depth", () => {
    expect(worldPerPixel(1, 90, 200)).toBeCloseTo(0.01, 12);
  });
});
