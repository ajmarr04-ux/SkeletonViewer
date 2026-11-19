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
