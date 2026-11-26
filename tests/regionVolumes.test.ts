// M13 step 1 (BK): body-region volumes. Fitting, point tests, the authoring
// file's checks, the stale-file check, and the debug view's parameter.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  anchorPoints,
  boxCorners,
  checkRegionsFile,
  expandRegions,
  fitShape,
  inRegion,
  inShape,
  principalAxes,
  resolveRegions,
  type OBox,
  type Capsule,
  type RegionsFile,
  type RegionVolumes,
  type Vec3,
} from "../src/regions/volume";
import { volumesStale } from "../src/regions/stale";
import { debugRegionsShown, parseDebugRegions } from "../src/regions/debug";

const root = join(__dirname, "..");
const near = (a: number[], b: number[], eps = 1e-6) => a.every((x, i) => Math.abs(x - b[i]!) < eps);

/** A rod of points along `dir` through `c`, `len` long, with a small square cross-section. */
function rod(c: Vec3, dir: Vec3, len: number, w = 0.01, n = 41): number[] {
  const out: number[] = [];
  // Two unit vectors perpendicular to `dir` (and to each other).
  const cross = (u: Vec3, v: Vec3): Vec3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const unit = (u: Vec3): Vec3 => u.map((x) => x / Math.hypot(...u)) as Vec3;
  const a = unit(cross(dir, Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const b = unit(cross(dir, a));
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) - 0.5) * len;
    for (const [s1, s2] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      for (let k = 0; k < 3; k++) out.push(c[k]! + dir[k]! * t + (a[k]! * s1! + b[k]! * s2!) * (w / 2));
  }
  return out;
}

describe("fitting", () => {
  it("finds the long axis of a tilted rod, signed so its largest component is positive", () => {
    const d = Math.SQRT1_2;
    const [e0, e1, e2] = principalAxes(rod([0, 1, 0], [-d, -d, 0], 0.4));
    expect(near(e0, [d, d, 0], 1e-6)).toBe(true);
    // A right-handed orthonormal frame.
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(Math.abs(dot(e0, e1)) + Math.abs(dot(e0, e2)) + Math.abs(dot(e1, e2))).toBeLessThan(1e-9);
  });

  it("fits a PCA box with pads along and across, and a span", () => {
    const pts = rod([0, 1, 0], [0, 1, 0], 0.4, 0.02);
    const box = fitShape(pts, { pad: { long: 0, cross: 0.01 } }, null) as OBox;
    expect(box.type).toBe("box");
    expect(near(box.center, [0, 1, 0], 1e-4)).toBe(true);
    expect(near(box.half, [0.2, 0.02, 0.02], 1e-4)).toBe(true);
    // The upper half only: 0 is the inferior end.
    const top = fitShape(pts, { span: [0.5, 1], pad: 0 }, null) as OBox;
    expect(top.center[1]).toBeCloseTo(1.1, 3);
    expect(top.half[0]).toBeCloseTo(0.1, 3);
  });

  it("fits world boxes with per-face pads, medial and lateral by side", () => {
    const pts = [0.1, 0, 0, 0.2, 1, 1];
    const left = fitShape(pts, { orient: "world", pad: { lateral: 0.05, medial: 0.01, superior: 0.1 } }, "left") as OBox;
    const corners = boxCorners(left);
    const xs = corners.map((c) => c[0]);
    expect(Math.min(...xs)).toBeCloseTo(0.09, 6);
    expect(Math.max(...xs)).toBeCloseTo(0.25, 6);
    expect(Math.max(...corners.map((c) => c[1]))).toBeCloseTo(1.1, 6);
    const right = fitShape([-0.1, 0, 0, -0.2, 1, 1], { orient: "world", pad: { lateral: 0.05, medial: 0.01 } }, "right") as OBox;
    const rx = boxCorners(right).map((c) => c[0]);
    expect(Math.min(...rx)).toBeCloseTo(-0.25, 6);
    expect(Math.max(...rx)).toBeCloseTo(-0.09, 6);
    expect(() => fitShape(pts, { pad: { medial: 0.01 } }, "left")).toThrow(/orient: world/);
    expect(() => fitShape(pts, { orient: "world", pad: { medial: 0.01 } }, null)).toThrow(/sided/);
    expect(() => fitShape(pts, { orient: "world", pad: { left: -1 } }, null)).toThrow(/empty/);
  });

  it("fits a capsule whose caps don't add length", () => {
    const pts = rod([0, 0, 0], [0, 1, 0], 1, 0.02);
    const c = fitShape(pts, { shape: "capsule", pad: 0 }, null) as Capsule;
    expect(c.type).toBe("capsule");
    const ends = [c.a[1], c.b[1]].sort((x, y) => x - y);
    expect(ends[0]! - c.radius).toBeCloseTo(-0.5, 3);
    expect(ends[1]! + c.radius).toBeCloseTo(0.5, 3);
  });

  it("clips an anchor along an axis: mediolateral from the medial end on either side", () => {
    const left = [0.0, 0, 0, 0.1, 0, 0, 0.2, 0, 0, 0.3, 0, 0];
    expect(anchorPoints(left, { id: "x_left", span: [0, 0.4], axis: "mediolateral" })).toEqual([0, 0, 0, 0.1, 0, 0]);
    const right = left.map((v, i) => (i % 3 === 0 ? -v : v));
    expect(anchorPoints(right, { id: "x_right", span: [0, 0.4], axis: "mediolateral" })).toEqual([-0, 0, 0, -0.1, 0, 0]);
    expect(() => anchorPoints(left, { id: "x", span: [0, 0.4], axis: "mediolateral" })).toThrow(/sided/);
    expect(anchorPoints([0, 0, 0, 0, 1, 0], { id: "y", span: [0.5, 1], axis: "vertical" })).toEqual([0, 1, 0]);
  });
});

describe("point tests", () => {
  const box: OBox = { type: "box", center: [0, 0, 0], axes: [[Math.SQRT1_2, Math.SQRT1_2, 0], [-Math.SQRT1_2, Math.SQRT1_2, 0], [0, 0, 1]], half: [1, 0.5, 0.25] };
  it("box: inside, on a face, on a corner, outside", () => {
    expect(inShape(box, [0, 0, 0])).toBe(true);
    const corner = boxCorners(box)[7]!;
    expect(inShape(box, corner, 1e-9)).toBe(true);
    expect(inShape(box, [0, 0, 0.25])).toBe(true);
    expect(inShape(box, [0, 0, 0.2500001])).toBe(false);
    // Along the rotated first axis, the face is at distance 1.
    expect(inShape(box, [Math.SQRT1_2, Math.SQRT1_2, 0], 1e-12)).toBe(true);
    expect(inShape(box, [0.71, 0.71, 0])).toBe(false);
  });
  it("capsule: the cylinder, the caps, their surfaces, and outside", () => {
    const c: Capsule = { type: "capsule", a: [0, 0, 0], b: [0, 1, 0], radius: 0.1 };
    expect(inShape(c, [0.1, 0.5, 0])).toBe(true);
    expect(inShape(c, [0.1001, 0.5, 0])).toBe(false);
    expect(inShape(c, [0, 1.1, 0])).toBe(true);
    expect(inShape(c, [0, -0.1, 0])).toBe(true);
    expect(inShape(c, [0.08, 1.08, 0])).toBe(false);
    const dot: Capsule = { type: "capsule", a: [0, 0, 0], b: [0, 0, 0], radius: 0.1 };
    expect(inShape(dot, [0, 0.1, 0])).toBe(true);
    expect(inRegion({ shapes: [box, c] }, [0, 1.05, 0])).toBe(true);
  });
});

const tiny: RegionsFile = {
  threshold: 0.15,
  coarse: [{ key: "trunk", name: "Trunk" }, { key: "limb_{side}", name: "Limb ({side})", sides: true }],
  regions: [
    { key: "core", name: "Core", coarse: "trunk", shapes: [{ fit: ["spine"], orient: "world", pad: 0.01 }, { eachSide: true, fit: ["rib_{side}"], orient: "world", pad: { lateral: 0.02 } }] },
    { key: "hand_{side}", name: "Hand ({side})", coarse: "limb_{side}", sides: true, shapes: [{ fit: ["bone_{side}"] }] },
  ],
};
const meshIds = new Set(["spine", "rib_left", "rib_right", "bone_left", "bone_right"]);

describe("the authoring file", () => {
  it("expands sides and eachSide", () => {
    const { coarse, regions } = expandRegions(tiny);
    expect(coarse.map((c) => c.key)).toEqual(["trunk", "limb_left", "limb_right"]);
    expect(regions.map((r) => `${r.key}<${r.coarse}`)).toEqual(["core<trunk", "hand_left<limb_left", "hand_right<limb_right"]);
    expect(regions[0]!.shapes.map((s) => s.side)).toEqual([null, "left", "right"]);
    expect(regions[2]!.name).toBe("Hand (right)");
  });

  it("accepts a good file and reports each kind of mistake", () => {
    expect(checkRegionsFile(tiny, meshIds)).toEqual([]);
    const bad = structuredClone(tiny);
    bad.threshold = 1.5;
    bad.regions.push({ key: "Core", name: "x", coarse: "nowhere", shapes: [{ box: { center: [0, 0, 0], size: [1, 1, 1] }, reason: " " }] });
    bad.regions.push({ key: "core", name: "x", coarse: "trunk", shapes: [{ fit: ["tooth_18"] }] });
    const errors = checkRegionsFile(bad, meshIds, new Set(["hand_left"]));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/threshold/),
        "Core: key is not snake_case",
        "Core: unknown coarse region nowhere",
        "Core: a literal shape without a reason",
        "core: duplicate key",
        "core: anchor tooth_18 is not a structure with a mesh",
        "hand_left: collides with an existing ID or group key",
      ]),
    );
    const noSides = structuredClone(tiny);
    delete noSides.regions[1]!.sides;
    expect(checkRegionsFile(noSides, meshIds).join()).toMatch(/sides and \{side\} disagree/);
  });

  it("resolves fits, literal shapes and the hash", () => {
    const file: RegionsFile = structuredClone(tiny);
    file.regions[0]!.shapes.push({ box: { center: [0, 2, 0], size: [0.2, 0.2, 0.2] }, reason: "test" });
    const pts: Record<string, number[]> = { spine: [0, 0, 0, 0, 1, 0], rib_left: [0.1, 0.5, 0, 0.2, 0.6, 0.1], rib_right: [-0.1, 0.5, 0, -0.2, 0.6, 0.1], bone_left: rod([0.5, 1, 0], [0, 1, 0], 0.3), bone_right: rod([-0.5, 1, 0], [0, 1, 0], 0.3) };
    const v = resolveRegions(file, (id) => pts[id]!, "abc");
    expect(v.sourceHash).toBe("abc");
    const core = v.regions[0]!;
    expect(core.literal).toBe(true);
    expect(core.shapes).toHaveLength(4);
    expect(inRegion(core, [0.215, 0.55, 0.05])).toBe(true); // lateral pad on the left rib box
    expect(inRegion(core, [0.205, 0.55, 0.11])).toBe(false);
    expect(inRegion(core, [0, 2.09, 0])).toBe(true);
    expect(v.regions[1]!.side).toBe("left");
    expect(() => resolveRegions({ ...file, regions: [{ ...file.regions[0]!, shapes: [{ fit: ["spine"], span: [0.5, 0.2] }] }] }, (id) => pts[id]!, "")).toThrow(/core: bad span/);
  });
});

describe("the committed files", () => {
  const file = JSON.parse(readFileSync(join(root, "content/regions/regions.json"), "utf8")) as RegionsFile;
  const volumes = JSON.parse(readFileSync(join(root, "assets/build/region-volumes.json"), "utf8")) as RegionVolumes;
  it("regions.json passes its own checks against the structures with a mesh", () => {
    const ids = JSON.parse(readFileSync(join(root, "content/ids.json"), "utf8")) as { id: string; meshAvailable: boolean }[];
    const soft = JSON.parse(readFileSync(join(root, "content/soft-ids.json"), "utf8")) as { id: string; meshAvailable: boolean }[];
    const withMesh = new Set([...ids, ...soft].filter((e) => e.meshAvailable).map((e) => e.id));
    expect(checkRegionsFile(file, withMesh, new Set([...ids, ...soft].map((e) => e.id)))).toEqual([]);
  });
  it("the resolved volumes list every fine region, each with shapes, and every coarse region in use", () => {
    const { regions, coarse } = expandRegions(file);
    expect(volumes.regions.map((r) => r.key)).toEqual(regions.map((r) => r.key));
    expect(volumes.coarse.map((c) => c.key)).toEqual(coarse.map((c) => c.key));
    for (const r of volumes.regions) expect(r.shapes.length).toBeGreaterThan(0);
    expect(volumes.threshold).toBe(file.threshold);
  });
});

describe("stale check", () => {
  const a = JSON.stringify({ sourceHash: "1", regions: [{ key: "x", shapes: [1] }] });
  it("is null when identical and names the reason otherwise", () => {
    expect(volumesStale(a, a)).toBeNull();
    expect(volumesStale(a, JSON.stringify({ sourceHash: "2", regions: [{ key: "x" }] }))).toMatch(/regions\.json changed/);
    expect(volumesStale(a, JSON.stringify({ sourceHash: "1", regions: [{ key: "y" }] }))).toMatch(/region list/);
    expect(volumesStale(a, JSON.stringify({ sourceHash: "1", regions: [{ key: "x", shapes: [2] }] }))).toMatch(/shapes differ/);
    expect(volumesStale("{", a)).toMatch(/JSON/);
  });
});

describe("?debug&regions", () => {
  it("needs both parameters; all, a fine key or a coarse key", () => {
    expect(parseDebugRegions("?regions")).toBeNull();
    expect(parseDebugRegions("?debug=0&regions")).toBeNull();
    expect(parseDebugRegions("?debug")).toBeNull();
    expect(parseDebugRegions("?debug&regions")).toBe("all");
    expect(parseDebugRegions("?debug&regions=all")).toBe("all");
    expect(parseDebugRegions("?debug&regions=Forearm_left")).toBe("forearm_left");
    const v = { regions: [{ key: "forearm_left", coarse: "upper_limb_left" }, { key: "arm_left", coarse: "upper_limb_left" }, { key: "face", coarse: "head" }] };
    expect(debugRegionsShown(v, "all")).toHaveLength(3);
    expect(debugRegionsShown(v, "upper_limb_left").map((r) => r.key)).toEqual(["forearm_left", "arm_left"]);
    expect(debugRegionsShown(v, "face").map((r) => r.key)).toEqual(["face"]);
    expect(debugRegionsShown(v, "nope")).toEqual([]);
  });
});
