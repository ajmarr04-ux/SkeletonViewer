import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYER_SETTING,
  formatCam,
  formatLayers,
  hasFlag,
  HIDDEN_URL_CAP,
  isDefaultLayers,
  parseCam,
  parseHidden,
  parseLayers,
  parseUrlState,
  serialiseUrlState,
} from "../src/state/url";

const cam = { position: [0.1234, 1.05, 3.2] as [number, number, number], target: [0, 0.95, -0.02] as [number, number, number] };

describe("parseCam / formatCam", () => {
  it("round-trips at 0.1 mm", () => {
    const s = formatCam(cam);
    expect(s).toBe("0.1234,1.05,3.2,0,0.95,-0.02");
    expect(parseCam(s)).toEqual(cam);
  });
  it("rounds to 4 decimals and never writes -0", () => {
    expect(formatCam({ position: [1.23456789, -0.00001, 2], target: [0, 0, 0] })).toBe("1.2346,0,2,0,0,0");
  });
  it.each([
    ["", "empty"],
    ["1,2,3,4,5", "five numbers"],
    ["1,2,3,4,5,6,7", "seven numbers"],
    ["1,2,x,4,5,6", "not a number"],
    ["1,2,,4,5,6", "a blank"],
    ["1,2,3,Infinity,5,6", "infinity"],
    ["1,2,3,4,5,600", "out of range"],
    ["1,2,3,1,2,3", "camera on its target"],
  ])("rejects %j (%s)", (s) => {
    expect(parseCam(s)).toBeNull();
  });
});

describe("URL state", () => {
  it("reads cam from the query string", () => {
    expect(parseUrlState("?lod=low&cam=0.1234,1.05,3.2,0,0.95,-0.02").cam).toEqual(cam);
    expect(parseUrlState("?cam=junk").cam).toBeNull();
    expect(parseUrlState("").cam).toBeNull();
  });
  it("writes cam with readable commas and keeps other parameters verbatim", () => {
    expect(serialiseUrlState({ cam }, "?debug&lod=low")).toBe("?debug&lod=low&cam=0.1234,1.05,3.2,0,0.95,-0.02");
    expect(serialiseUrlState({ cam }, "?cam=1,2,3,4,5,6&debug")).toBe("?debug&cam=0.1234,1.05,3.2,0,0.95,-0.02");
    expect(serialiseUrlState({ cam: null }, "?cam=1,2,3,4,5,6")).toBe("");
    expect(serialiseUrlState({ cam: null }, "")).toBe("");
  });
  it("round-trips through parse and serialise", () => {
    const search = serialiseUrlState({ cam }, "?lod=high");
    expect(parseUrlState(search).cam).toEqual(cam);
    expect(serialiseUrlState(parseUrlState(search), search)).toBe(search);
  });
});

describe("hasFlag", () => {
  it("treats bare and valued flags as set, and =0 or =false as unset", () => {
    expect(hasFlag("?debug", "debug")).toBe(true);
    expect(hasFlag("?lod=low&debug=1", "debug")).toBe(true);
    expect(hasFlag("?debug=0", "debug")).toBe(false);
    expect(hasFlag("?debug=false", "debug")).toBe(false);
    expect(hasFlag("?lod=low", "debug")).toBe(false);
  });
});

describe("selection in the URL", () => {
  const ids = new Set(["femur_left", "tooth_18"]);
  const isId = (id: string) => ids.has(id);

  it("reads sel, tier and ghost, dropping unknown IDs", () => {
    expect(parseUrlState("?sel=femur_left&tier=1&ghost=0", isId)).toEqual({ cam: null, sel: "femur_left", tier: 1, grp: null, ghost: "hide", color: null, layers: null, hid: [] });
    expect(parseUrlState("?sel=nope&tier=2", isId)).toEqual({ cam: null, sel: null, tier: 0, grp: null, ghost: "ghost", color: null, layers: null, hid: [] });
    expect(parseUrlState("?tier=2", isId).tier).toBe(0);
    expect(parseUrlState("?sel=femur_left&tier=7", isId).tier).toBe(0);
    expect(parseUrlState("?sel=tooth_18", isId).sel).toBe("tooth_18");
    expect(parseUrlState("?ghost=1").ghost).toBe("ghost");
  });

  it("reads and writes color=region (colour-by-region), after ghost and before cam", () => {
    expect(parseUrlState("?color=region").color).toBe("region");
    expect(parseUrlState("?color=bogus").color).toBeNull();
    expect(serialiseUrlState({ color: "region" }, "?sel=femur_left&ghost=0&cam=0,1,2,0,0.85,0")).toBe("?sel=femur_left&ghost=0&color=region&cam=0,1,2,0,0.85,0");
    expect(serialiseUrlState({ color: null }, "?debug&color=region")).toBe("?debug");
  });

  it("writes sel, tier, ghost and cam in that order, after other parameters, leaving defaults out", () => {
    expect(serialiseUrlState({ sel: "femur_left" }, "?debug&cam=1,2,3,4,5,6")).toBe("?debug&sel=femur_left&cam=1,2,3,4,5,6");
    expect(serialiseUrlState({ tier: 1 }, "?sel=femur_left")).toBe("?sel=femur_left&tier=1");
    expect(serialiseUrlState({ sel: null, tier: 0 }, "?sel=femur_left&tier=1&lod=low")).toBe("?lod=low");
    expect(serialiseUrlState({ ghost: "hide" }, "?sel=femur_left")).toBe("?sel=femur_left&ghost=0");
    expect(serialiseUrlState({ ghost: "ghost" }, "?sel=femur_left&ghost=0")).toBe("?sel=femur_left");
  });

  it("round-trips a full state", () => {
    const state = { cam: { position: [0, 1, 2], target: [0, 0.85, 0], offset: [0.1, 0] }, sel: "femur_left", tier: 2, grp: null, ghost: "hide", color: null, layers: null, hid: [] } as const;
    const search = serialiseUrlState(state as never, "");
    expect(search).toBe("?sel=femur_left&tier=2&ghost=0&cam=0,1,2,0,0.85,0,0.1,0");
    expect(parseUrlState(search, isId)).toEqual(state);
  });

  it("reads and writes grp (exclusive with sel)", () => {
    const isGroup = (k: string) => k === "dentition.type.molars";
    expect(parseUrlState("?grp=dentition.type.molars", isId, isGroup).grp).toBe("dentition.type.molars");
    expect(parseUrlState("?grp=nope", isId, isGroup).grp).toBeNull();
    expect(parseUrlState("?sel=femur_left&grp=dentition.type.molars", isId, isGroup)).toMatchObject({ sel: "femur_left", grp: null });
    expect(serialiseUrlState({ sel: null, tier: 0, grp: "dentition.type.molars" }, "?sel=femur_left&tier=1&ghost=0")).toBe("?grp=dentition.type.molars&ghost=0");
    expect(serialiseUrlState({ sel: "tooth_36", tier: 0, grp: null }, "?grp=dentition.type.molars")).toBe("?sel=tooth_36");
  });
});

describe("layers (M7 plan decision 1)", () => {
  it("parses the user format, keeping defaults for missing layers", () => {
    expect(parseLayers("b:on,c:off,l:off,m:ghost")).toEqual({
      layers: { bones: "on", cartilage: "off", ligaments: "off", muscles: "ghost" },
      depth: 0,
    });
    expect(parseLayers("m:on")).toEqual({ layers: { bones: "on", cartilage: "off", ligaments: "off", muscles: "on" }, depth: 0 });
    expect(parseLayers("b:ghost,muscles:on:2")?.depth).toBe(2);
    expect(parseLayers("b:ghost,muscles:on:2")?.layers.bones).toBe("ghost");
  });
  it("ignores bad entries and depths, and isn't the debug format", () => {
    expect(parseLayers("x:on,m:maybe,l:on,m:on:9")).toEqual({
      layers: { bones: "on", cartilage: "off", ligaments: "on", muscles: "on" },
      depth: 0,
    });
    expect(parseLayers("x:on")).toBeNull();
    expect(parseLayers("all")).toBeNull();
    expect(parseLayers("m,l,c,a")).toBeNull();
    expect(parseLayers(null)).toBeNull();
  });
  it("formats every layer in panel order, depth on muscles", () => {
    const s = parseLayers("m:ghost:2,l:on")!;
    expect(formatLayers(s)).toBe("b:on,c:off,l:on,m:ghost:2");
    // A link from the four-stop control's build: "Deep only" (3) is the third stop now.
    expect(parseLayers("m:on:3")?.depth).toBe(2);
    expect(parseLayers(formatLayers(s))).toEqual(s);
    expect(isDefaultLayers(DEFAULT_LAYER_SETTING)).toBe(true);
    expect(isDefaultLayers(s)).toBe(false);
  });
  it("writes layers only when they differ from the default", () => {
    const on = parseLayers("m:on")!;
    expect(serialiseUrlState({ layers: on }, "?lod=low")).toBe("?lod=low&layers=b:on,c:off,l:off,m:on");
    expect(serialiseUrlState({ layers: DEFAULT_LAYER_SETTING }, "?layers=b:on,c:off,l:off,m:on")).toBe("");
    expect(serialiseUrlState({ sel: "femur_left" }, "?layers=m:on")).toBe("?sel=femur_left&layers=b:on,c:off,l:off,m:on");
  });
  it("keeps the M6 debug format verbatim unless the layers are set", () => {
    expect(parseUrlState("?debug&layers=all").layers).toBeNull();
    expect(serialiseUrlState({ sel: "femur_left" }, "?debug&layers=all")).toBe("?debug&layers=all&sel=femur_left");
    expect(serialiseUrlState({ layers: parseLayers("l:on") }, "?debug&layers=all")).toBe("?debug&layers=b:on,c:off,l:on,m:off");
  });
});

describe("hid (spec §5.5)", () => {
  it("reads well-formed, known IDs once each", () => {
    expect(parseHidden("femur_left,Bad-Id,femur_left,,tibia_left")).toEqual({ ids: ["femur_left", "tibia_left"], dropped: 0 });
    expect(parseHidden("a,b", (id) => id === "b").ids).toEqual(["b"]);
    expect(parseHidden(null)).toEqual({ ids: [], dropped: 0 });
  });
  it("caps the list and counts what was dropped", () => {
    const many = Array.from({ length: HIDDEN_URL_CAP + 7 }, (_, i) => `x_${i}`).join(",");
    const r = parseHidden(many);
    expect(r.ids).toHaveLength(HIDDEN_URL_CAP);
    expect(r.dropped).toBe(7);
  });
  it("round-trips through the URL", () => {
    expect(serialiseUrlState({ hid: ["femur_left", "tibia_left"] }, "?lod=low")).toBe("?lod=low&hid=femur_left,tibia_left");
    expect(parseUrlState("?hid=femur_left,tibia_left").hid).toEqual(["femur_left", "tibia_left"]);
    expect(serialiseUrlState({ hid: [] }, "?hid=femur_left")).toBe("");
  });
});
