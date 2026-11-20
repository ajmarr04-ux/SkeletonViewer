import { describe, expect, it } from "vitest";
import { layerReport, parseDebugLayers, type LayerManifest } from "../src/scene/debugLayers";

describe("parseDebugLayers", () => {
  it("is off without both debug and layers", () => {
    expect(parseDebugLayers("")).toBeNull();
    expect(parseDebugLayers("?debug")).toBeNull();
    expect(parseDebugLayers("?layers=all")).toBeNull();
    expect(parseDebugLayers("?debug=0&layers=all")).toBeNull();
  });
  it("reads all, codes and names, in file order", () => {
    const all = ["muscles", "ligaments", "cartilage", "attachments"];
    expect(parseDebugLayers("?debug&layers=all")).toEqual(all);
    expect(parseDebugLayers("?layers=all&debug=1")).toEqual(all);
    expect(parseDebugLayers("?debug&layers=")).toEqual(all);
    expect(parseDebugLayers("?debug&layers=c,m")).toEqual(["muscles", "cartilage"]);
    expect(parseDebugLayers("?debug&layers=ligaments,a")).toEqual(["ligaments", "attachments"]);
  });
  it("ignores bones and unknown codes", () => {
    expect(parseDebugLayers("?debug&layers=b,x")).toEqual([]);
  });
  it("leaves M7's user format (with colons) to the real layers", () => {
    expect(parseDebugLayers("?debug&layers=b:on,m:on,l:off,c")).toBeNull();
    expect(parseDebugLayers("?debug&layers=m:ghost")).toBeNull();
  });
});

describe("layerReport", () => {
  const manifest: LayerManifest = {
    objects: {
      a: { lods: { low: { bboxMin: [0, 0, 0], bboxMax: [1, 1, 1] }, high: { bboxMin: [0, 0, 0], bboxMax: [1, 1, 1] } } },
      b: { lods: { low: { bboxMin: [0, 0, 0], bboxMax: [2, 2, 2] }, high: { bboxMin: [0, 0, 0], bboxMax: [2, 2, 2] } } },
    },
  };
  it("passes within 1 mm", () => {
    const r = layerReport(
      "muscles",
      "low",
      new Map([
        ["a", { min: [0.0005, 0, 0], max: [1, 1, 1] }],
        ["b", { min: [0, 0, 0], max: [2, 2, 2] }],
      ]),
      10,
      manifest,
    );
    expect(r.errors).toEqual([]);
    expect(r.nodes).toBe(2);
    expect(r.checked).toBe(2);
    expect(r.maxDelta).toBeCloseTo(0.0005);
  });
  it("reports moved, missing and unknown nodes", () => {
    const r = layerReport(
      "cartilage",
      "high",
      new Map([
        ["a", { min: [0.01, 0, 0], max: [1, 1, 1] }],
        ["z", { min: [0, 0, 0], max: [1, 1, 1] }],
      ]),
      10,
      manifest,
    );
    expect(r.checked).toBe(1);
    expect(r.errors).toHaveLength(3);
    expect(r.errors.join("\n")).toMatch(/a bounds differ.*\n.*z is not in the manifest\n.*b is missing/);
  });
});

describe("modelVersions (cache-busting the layer files)", async () => {
  const { modelVersions } = await import("../scripts/lib/model-versions-plugin");
  const { SOFT_LAYERS } = await import("../scripts/lib/model-checks");
  it("has a content hash for every layer file and LOD", () => {
    const v = modelVersions();
    for (const layer of SOFT_LAYERS) {
      for (const lod of ["low", "high"]) expect(v[`${layer}-${lod}`], `${layer}-${lod}`).toMatch(/^[0-9a-f]{10}$/);
    }
    expect(new Set(Object.values(v)).size).toBe(Object.keys(v).length);
  });
});
