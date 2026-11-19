import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import {
  BOUNDS_TOLERANCE_M,
  LOD_BUDGETS,
  boundsDelta,
  checkSize,
  checkTriangles,
  compareBounds,
  compareNames,
  expectedNodeNames,
  type Bounds,
} from "../scripts/lib/model-checks";

const box = (x: number): Bounds => ({ min: [x, x, x], max: [x + 1, x + 1, x + 1] });

describe("expectedNodeNames", () => {
  it("lists the 234 IDs that have a mesh and skips the third molars", () => {
    const names = expectedNodeNames(ids);
    expect(names).toHaveLength(234);
    for (const t of ["tooth_18", "tooth_28", "tooth_38", "tooth_48"]) expect(names).not.toContain(t);
  });
});

describe("compareNames", () => {
  it("passes on an exact match in any order", () => {
    expect(compareNames(["a", "b"], ["b", "a"])).toEqual([]);
  });
  it("reports missing, extra and duplicated nodes", () => {
    const errs = compareNames(["a", "b", "c"], ["a", "a", "x"]);
    expect(errs).toContain("duplicate node name: a");
    expect(errs).toContain("unexpected node: x");
    expect(errs).toContain("missing node: b");
    expect(errs).toContain("missing node: c");
  });
});

describe("budgets", () => {
  it("rejects files at or over the size budget", () => {
    expect(checkSize("high", 2_600_000, LOD_BUDGETS.high)).toEqual([]);
    expect(checkSize("low", LOD_BUDGETS.low.maxBytes, LOD_BUDGETS.low)).toHaveLength(1);
  });
  it("accepts triangle counts within ±15% of the target", () => {
    expect(checkTriangles("high", 500_000 * 1.15, LOD_BUDGETS.high)).toEqual([]);
    expect(checkTriangles("high", 500_000 * 0.85, LOD_BUDGETS.high)).toEqual([]);
    expect(checkTriangles("low", 150_000 * 1.2, LOD_BUDGETS.low)).toHaveLength(1);
    expect(checkTriangles("low", 100_000, LOD_BUDGETS.low)).toHaveLength(1);
  });
});

describe("bounds", () => {
  it("measures the largest corner difference on any axis", () => {
    const a: Bounds = { min: [0, 0, 0], max: [1, 1, 1] };
    const b: Bounds = { min: [0, -0.002, 0], max: [1, 1, 1.0005] };
    expect(boundsDelta(a, b)).toBeCloseTo(0.002, 9);
  });
  it("passes drift within tolerance and flags a moved bone", () => {
    const actual = new Map<string, Bounds>([
      ["femur_left", box(0)],
      ["femur_right", box(0.01)], // moved 1 cm
    ]);
    const manifest = { femur_left: box(BOUNDS_TOLERANCE_M / 2), femur_right: box(0) };
    const { errors, maxDelta } = compareBounds("high", actual, manifest);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/femur_right/);
    expect(maxDelta).toBeCloseTo(0.01, 9);
  });
  it("leaves names absent from the manifest to compareNames", () => {
    const { errors } = compareBounds("low", new Map([["extra", box(0)]]), {});
    expect(errors).toEqual([]);
  });
});
