import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { chooseLod, formatMs, lodPlan, lodsToLoad, parseLodSetting, summariseObjects, withoutLodParam, type DeviceProbe } from "../src/scene/lod";

const desktop: DeviceProbe = {
  width: 1440,
  height: 900,
  deviceMemory: 8,
  maxTextureSize: 16384,
  renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
};

describe("chooseLod", () => {
  it.each<[string, Partial<DeviceProbe>, "low" | "high"]>([
    ["a capable desktop", {}, "high"],
    ["a 390 px phone", { width: 390, height: 844 }, "low"],
    ["a phone in landscape", { width: 844, height: 390 }, "low"],
    ["a tablet", { width: 820, height: 1180 }, "high"],
    ["4 GB of memory", { deviceMemory: 4 }, "low"],
    ["no deviceMemory (Safari, Firefox)", { deviceMemory: undefined }, "high"],
    ["a small max texture size", { maxTextureSize: 4096 }, "low"],
    ["SwiftShader", { renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" }, "low"],
    ["llvmpipe", { renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" }, "low"],
    ["an old Mali", { renderer: "Mali-G52" }, "low"],
    ["an old Adreno", { renderer: "Adreno (TM) 506" }, "low"],
    ["a recent Adreno", { renderer: "Adreno (TM) 740" }, "high"],
    ["an NVIDIA GPU", { renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)" }, "high"],
  ])("%s → %s", (_, override, lod) => {
    expect(chooseLod({ ...desktop, ...override }).lod).toBe(lod);
  });
});

describe("lodPlan", () => {
  it("follows the device when the setting is auto", () => {
    expect(lodPlan("", "auto", desktop)).toMatchObject({ lods: ["low", "high"], source: "auto" });
    expect(lodPlan("", "auto", { ...desktop, width: 390 })).toMatchObject({ lods: ["low"], source: "auto" });
    expect(lodPlan("?lod=medium", "auto", desktop).lods).toEqual(["low", "high"]);
  });
  it("loads low first even when the setting is high", () => {
    expect(lodPlan("", "high", { ...desktop, width: 390 })).toMatchObject({ lods: ["low", "high"], source: "setting" });
    expect(lodPlan("", "low", desktop)).toMatchObject({ lods: ["low"], source: "setting" });
  });
  it("lets ?lod override everything", () => {
    expect(lodPlan("?lod=low", "high", desktop).lods).toEqual(["low"]);
    expect(lodPlan("?x=1&lod=high", "low", desktop).lods).toEqual(["high"]);
    expect(lodPlan("?lod=both", "low", { ...desktop, width: 390 })).toMatchObject({ lods: ["low", "high"], source: "url" });
  });
});

describe("parseLodSetting", () => {
  it("accepts low and high, and treats anything else as auto", () => {
    expect(parseLodSetting("low")).toBe("low");
    expect(parseLodSetting("high")).toBe("high");
    expect(parseLodSetting(null)).toBe("auto");
    expect(parseLodSetting("ultra")).toBe("auto");
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

describe("lodsToLoad (a Settings change while a model is shown)", () => {
  it.each<[string, ("low" | "high")[], "low" | "high" | null, ("low" | "high")[]]>([
    ["first load: the whole plan", ["low", "high"], null, ["low", "high"]],
    ["first load, low only", ["low"], null, ["low"]],
    ["low shown, now High: only high", ["low", "high"], "low", ["high"]],
    ["high shown, now Low: only low", ["low"], "high", ["low"]],
    ["already showing the final LOD", ["low", "high"], "high", []],
    ["low shown, still low", ["low"], "low", []],
  ])("%s", (_, plan, shown, want) => {
    expect(lodsToLoad(plan, shown)).toEqual(want);
  });
});

describe("withoutLodParam", () => {
  it("drops lod and keeps everything else verbatim", () => {
    expect(withoutLodParam("?lod=low&debug&cam=1,2,3,4,5,6")).toBe("?debug&cam=1,2,3,4,5,6");
    expect(withoutLodParam("?lod=both")).toBe("");
    expect(withoutLodParam("")).toBe("");
    expect(withoutLodParam("?bench&lodx=1")).toBe("?bench&lodx=1");
  });
});
