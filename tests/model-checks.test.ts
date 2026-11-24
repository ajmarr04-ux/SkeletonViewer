import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import softIds from "../content/soft-ids.json";
import softMapping from "../assets/mapping/soft-to-id.json";
import {
  BOUNDS_TOLERANCE_M,
  LAYER_FILES,
  expectedLayerNodeNames,
  fileStem,
  layerBudget,
  lodBudget,
  type SoftIdEntry,
  type LayerFile,
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

const LOD_BUDGETS = { high: lodBudget("bones", "high"), low: lodBudget("bones", "low") };

describe("budgets", () => {
  it("reads the skeleton's budgets from the bones descriptor (15 and 6 MiB; 500k and 150k triangles)", () => {
    expect(LOD_BUDGETS.high).toEqual({ maxBytes: 15 * 1024 * 1024, targetTris: 500_000, triTolerance: 0.15 });
    expect(LOD_BUDGETS.low).toEqual({ maxBytes: 6 * 1024 * 1024, targetTris: 150_000, triTolerance: 0.15 });
  });
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

describe("soft-tissue layers (M6)", () => {
  const soft = [
    { id: "deltoid_left", layer: "muscles", meshAvailable: false },
    { id: "deltoid_clavicular_part_left", layer: "muscles", meshAvailable: true },
    { id: "patellar_ligament_left", layer: "ligaments", meshAvailable: false },
    { id: "iliofemoral_ligament_left", layer: "ligaments", meshAvailable: true },
    { id: "lateral_meniscus_left", layer: "cartilage", meshAvailable: true },
  ];
  it("expects only the layer's IDs that have a mesh", () => {
    expect(expectedLayerNodeNames("muscles", soft, [])).toEqual(["deltoid_clavicular_part_left"]);
    expect(expectedLayerNodeNames("ligaments", soft, [])).toEqual(["iliofemoral_ligament_left"]);
    expect(expectedLayerNodeNames("cartilage", soft, [])).toEqual(["lateral_meniscus_left"]);
  });
  it("expects the attachment IDs for the attachments file", () => {
    expect(expectedLayerNodeNames("attachments", soft, ["a__origin", "a__insertion"])).toEqual([
      "a__origin",
      "a__insertion",
    ]);
  });
  it("matches the real ID lists", () => {
    const real = softIds as SoftIdEntry[];
    const att = Object.keys(softMapping.attachments);
    const n = (l: LayerFile) => expectedLayerNodeNames(l, real, att).length;
    expect([n("muscles"), n("ligaments"), n("cartilage"), n("attachments")]).toEqual([477, 300, 61, 697]); // muscles include the linea alba (QUESTIONS 40)
  });
  it("caps the triangle target at the source total", () => {
    expect(layerBudget("ligaments", "high", 1_000_000).targetTris).toBe(120_000);
    expect(layerBudget("ligaments", "high", 90_000).targetTris).toBe(90_000);
    expect(layerBudget("ligaments", "high", 90_000).maxBytes).toBe(2.5 * 1024 * 1024);
  });
  it("lists M6's four layer files, from the registry", () => {
    expect([...LAYER_FILES].sort()).toEqual(["attachments", "cartilage", "ligaments", "muscles"]);
    expect(LAYER_FILES.map(fileStem)).toEqual(LAYER_FILES);
    expect(fileStem("bones")).toBe("skeleton");
  });
  it("has a budget for every layer and LOD", () => {
    for (const l of LAYER_FILES) {
      const high = lodBudget(l, "high");
      expect(high.targetTris).toBeGreaterThan(lodBudget(l, "low").targetTris);
      expect(checkSize(`${l}-high`, high.maxBytes, high)).toHaveLength(1);
    }
  });
});
