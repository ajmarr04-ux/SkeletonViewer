import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { formatMs, lodPlan, summariseObjects } from "../src/scene/lod";

describe("lodPlan", () => {
  it("loads low then high by default", () => {
    expect(lodPlan("")).toEqual(["low", "high"]);
    expect(lodPlan("?lod=medium")).toEqual(["low", "high"]);
  });
  it("pins a single LOD with ?lod", () => {
    expect(lodPlan("?lod=low")).toEqual(["low"]);
    expect(lodPlan("?x=1&lod=high")).toEqual(["high"]);
  });
});

describe("summariseObjects", () => {
  const withMesh = ids.filter((e) => e.meshAvailable).map((e) => e.id);

  it("accepts the 234 meshes and reports the 4 known-missing third molars", () => {
    const s = summariseObjects(withMesh, ids);
    expect(s.found).toBe(234);
    expect([...s.knownMissing].sort()).toEqual(["tooth_18", "tooth_28", "tooth_38", "tooth_48"]);
    expect(s.unexpectedMissing).toEqual([]);
    expect(s.unknown).toEqual([]);
  });

  it("flags missing and unknown objects", () => {
    const names = withMesh.filter((n) => n !== "femur_left").concat("mystery_bone");
    const s = summariseObjects(names, ids);
    expect(s.found).toBe(233);
    expect(s.unexpectedMissing).toEqual(["femur_left"]);
    expect(s.unknown).toEqual(["mystery_bone"]);
  });
});

describe("formatMs", () => {
  it("formats pending, milliseconds and seconds", () => {
    expect(formatMs(undefined)).toBe("…");
    expect(formatMs(412.4)).toBe("412 ms");
    expect(formatMs(2345)).toBe("2.35 s");
  });
});
