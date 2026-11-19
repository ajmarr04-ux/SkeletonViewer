import { describe, expect, it } from "vitest";
import { formatCam, hasFlag, parseCam, parseUrlState, serialiseUrlState } from "../src/state/url";

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
    expect(parseUrlState("?sel=femur_left&tier=1&ghost=0", isId)).toEqual({ cam: null, sel: "femur_left", tier: 1, ghost: "hide" });
    expect(parseUrlState("?sel=nope&tier=2", isId)).toEqual({ cam: null, sel: null, tier: 0, ghost: "ghost" });
    expect(parseUrlState("?tier=2", isId).tier).toBe(0);
    expect(parseUrlState("?sel=femur_left&tier=7", isId).tier).toBe(0);
    expect(parseUrlState("?sel=tooth_18", isId).sel).toBe("tooth_18");
    expect(parseUrlState("?ghost=1").ghost).toBe("ghost");
  });

  it("writes sel, tier, ghost and cam in that order, after other parameters, leaving defaults out", () => {
    expect(serialiseUrlState({ sel: "femur_left" }, "?debug&cam=1,2,3,4,5,6")).toBe("?debug&sel=femur_left&cam=1,2,3,4,5,6");
    expect(serialiseUrlState({ tier: 1 }, "?sel=femur_left")).toBe("?sel=femur_left&tier=1");
    expect(serialiseUrlState({ sel: null, tier: 0 }, "?sel=femur_left&tier=1&lod=low")).toBe("?lod=low");
    expect(serialiseUrlState({ ghost: "hide" }, "?sel=femur_left")).toBe("?sel=femur_left&ghost=0");
    expect(serialiseUrlState({ ghost: "ghost" }, "?sel=femur_left&ghost=0")).toBe("?sel=femur_left");
  });

  it("round-trips a full state", () => {
    const state = { cam: { position: [0, 1, 2], target: [0, 0.85, 0], offset: [0.1, 0] }, sel: "femur_left", tier: 2, ghost: "hide" } as const;
    const search = serialiseUrlState(state as never, "");
    expect(search).toBe("?sel=femur_left&tier=2&ghost=0&cam=0,1,2,0,0.85,0,0.1,0");
    expect(parseUrlState(search, isId)).toEqual(state);
  });
});
