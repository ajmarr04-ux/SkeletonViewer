import { describe, expect, it } from "vitest";
import {
  DOLLY_STEP,
  INITIAL_TAP_STATE,
  NO_WHEEL_MEMORY,
  ORBIT_STEP,
  PAN_STEP,
  classifyWheel,
  keyAction,
  tapStep,
  zoomFactor,
  type PointerSample,
  type TapState,
  type WheelKind,
  type WheelSample,
} from "../src/camera/input";

/** Run a sequence of wheel events through the classifier. */
function classifyAll(events: Partial<WheelSample>[]): WheelKind[] {
  let memory = NO_WHEEL_MEMORY;
  return events.map((e) => {
    const r = classifyWheel({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, timeStamp: 0, ...e }, memory);
    memory = r.memory;
    return r.kind;
  });
}

// Sequences shaped like what each browser and device sends (values typical of
// each, not captured from one machine; the plan asks for a hand check on real
// hardware too).
describe("classifyWheel", () => {
  it("Chrome or Edge, trackpad pinch: ctrlKey", () => {
    expect(classifyAll([
      { deltaY: -3.2, ctrlKey: true, timeStamp: 0, wheelDeltaY: 9 },
      { deltaY: -5.1, ctrlKey: true, timeStamp: 16, wheelDeltaY: 15 },
    ])).toEqual(["pinch", "pinch"]);
  });

  it("Chrome on macOS, trackpad two-finger drag: wheelDeltaY = -3 × deltaY", () => {
    expect(classifyAll([
      { deltaY: 2, wheelDeltaY: -6, timeStamp: 0 },
      { deltaX: -1, deltaY: 7, wheelDeltaY: -21, timeStamp: 16 },
      { deltaY: 40, wheelDeltaY: -120, timeStamp: 33 },
    ])).toEqual(["pan", "pan", "pan"]);
  });

  it("Chrome on macOS, mouse wheel: 4.000244 px per notch, wheelDeltaY ±120", () => {
    expect(classifyAll([
      { deltaY: 4.000244140625, wheelDeltaY: -120, timeStamp: 0 },
      { deltaY: -4.000244140625, wheelDeltaY: 120, timeStamp: 400 },
    ])).toEqual(["wheel", "wheel"]);
  });

  it("Chrome on Windows, mouse wheel: 100 px per notch (66.67 at 150% scaling)", () => {
    expect(classifyAll([
      { deltaY: 100, wheelDeltaY: -120, timeStamp: 0 },
      { deltaY: 66.66666, wheelDeltaY: -120, timeStamp: 500 },
    ])).toEqual(["wheel", "wheel"]);
  });

  it("Firefox, mouse wheel: line mode", () => {
    expect(classifyAll([{ deltaY: 3, deltaMode: 1 }])).toEqual(["wheel"]);
  });

  it("Firefox, trackpad pinch: ctrlKey with pixel deltas", () => {
    expect(classifyAll([{ deltaY: 1.5, ctrlKey: true }])).toEqual(["pinch"]);
  });

  it("no wheelDeltaY: fractional small deltas or any horizontal delta pan", () => {
    expect(classifyAll([{ deltaY: 1.25, timeStamp: 0 }])).toEqual(["pan"]);
    expect(classifyAll([{ deltaX: 3, deltaY: 0, timeStamp: 0 }])).toEqual(["pan"]);
  });

  it("no wheelDeltaY: big or whole-pixel steps zoom", () => {
    expect(classifyAll([{ deltaY: 102.5, timeStamp: 0 }])).toEqual(["wheel"]);
    expect(classifyAll([{ deltaY: 16, timeStamp: 0 }])).toEqual(["wheel"]);
  });

  it("one gesture keeps the meaning of its first event", () => {
    // A trackpad drag whose later events look like wheel notches stays a pan.
    expect(classifyAll([
      { deltaY: 1.5, timeStamp: 0 },
      { deltaY: 16, timeStamp: 16 },
      { deltaY: 60, timeStamp: 32 },
    ])).toEqual(["pan", "pan", "pan"]);
  });

  it("a pause ends the gesture", () => {
    expect(classifyAll([
      { deltaY: 1.5, timeStamp: 0 },
      { deltaY: 100, timeStamp: 1000 },
    ])).toEqual(["pan", "wheel"]);
  });

  it("a pinch is never overridden by gesture memory", () => {
    expect(classifyAll([
      { deltaY: 1.5, timeStamp: 0 },
      { deltaY: 1.5, ctrlKey: true, timeStamp: 10 },
    ])).toEqual(["pan", "pinch"]);
  });
});

describe("zoomFactor", () => {
  it("one notch is 10%, in either direction", () => {
    expect(zoomFactor("wheel", { deltaY: -100, deltaMode: 0 })).toBeCloseTo(0.9, 12);
    expect(zoomFactor("wheel", { deltaY: 100, deltaMode: 0 })).toBeCloseTo(1 / 0.9, 12);
    expect(zoomFactor("wheel", { deltaY: -3, deltaMode: 1 })).toBeCloseTo(0.9, 12);
    expect(zoomFactor("wheel", { deltaY: -1, deltaMode: 2 })).toBeCloseTo(0.9, 12);
  });
  it("pinching out moves closer, pinching in moves away", () => {
    expect(zoomFactor("pinch", { deltaY: -5, deltaMode: 0 })).toBeLessThan(1);
    expect(zoomFactor("pinch", { deltaY: 5, deltaMode: 0 })).toBeGreaterThan(1);
  });
  it("a huge delta is capped", () => {
    expect(zoomFactor("wheel", { deltaY: -10000, deltaMode: 0 })).toBeCloseTo(Math.pow(0.9, 5), 12);
  });
});

describe("keyAction", () => {
  const k = (key: string, shiftKey = false, extra = {}) => keyAction({ key, shiftKey, ...extra });

  it.each([
    ["ArrowLeft", ORBIT_STEP, 0],
    ["ArrowRight", -ORBIT_STEP, 0],
    ["ArrowUp", 0, ORBIT_STEP],
    ["ArrowDown", 0, -ORBIT_STEP],
  ])("%s orbits by 5°", (key, azimuth, polar) => {
    expect(k(key)).toEqual({ kind: "orbit", azimuth, polar });
  });

  it.each([
    ["ArrowLeft", PAN_STEP, 0],
    ["ArrowRight", -PAN_STEP, 0],
    ["ArrowUp", 0, PAN_STEP],
    ["ArrowDown", 0, -PAN_STEP],
  ])("Shift + %s pans by 2%% of the distance", (key, x, y) => {
    expect(k(key, true)).toEqual({ kind: "pan", x, y });
  });

  it("+ and = dolly in by 10%, - and _ dolly back out", () => {
    for (const key of ["+", "="]) expect(k(key, key === "+")).toEqual({ kind: "dolly", factor: DOLLY_STEP });
    for (const key of ["-", "_"]) expect(k(key, key === "_")).toEqual({ kind: "dolly", factor: 1 / DOLLY_STEP });
  });

  it("X hides, Shift + X shows all; R and E step to tiers 1 and 2 (M10 AN)", () => {
    expect(k("x")).toEqual({ kind: "hide" });
    expect(k("X", true)).toEqual({ kind: "showAll" });
    expect(k("r")).toEqual({ kind: "tier", tier: 1 });
    expect(k("R", true)).toEqual({ kind: "tier", tier: 1 });
    expect(k("e")).toEqual({ kind: "tier", tier: 2 });
    expect(k("E", true)).toEqual({ kind: "tier", tier: 2 });
    expect(k("r", false, { ctrlKey: true })).toBeNull();
  });

  it("H resets and F frames, either case", () => {
    expect(k("h")).toEqual({ kind: "reset" });
    expect(k("H", true)).toEqual({ kind: "reset" });
    expect(k("f")).toEqual({ kind: "frame" });
    expect(k("F", true)).toEqual({ kind: "frame" });
  });

  it("leaves other keys and browser shortcuts alone", () => {
    expect(k("a")).toBeNull();
    expect(k("Tab")).toBeNull();
    expect(k("ArrowLeft", false, { altKey: true })).toBeNull();
    expect(k("=", false, { ctrlKey: true })).toBeNull();
    expect(k("h", false, { metaKey: true })).toBeNull();
  });
});

describe("double tap", () => {
  function run(events: PointerSample[]): { x: number; y: number }[] {
    let s: TapState = INITIAL_TAP_STATE;
    const out: { x: number; y: number }[] = [];
    for (const e of events) {
      const r = tapStep(s, e);
      s = r.state;
      if (r.doubleTap) out.push(r.doubleTap);
    }
    return out;
  }
  const tap = (t: number, x = 100, y = 100, id = 1): PointerSample[] => [
    { type: "down", id, x, y, t },
    { type: "up", id, x: x + 1, y, t: t + 80 },
  ];

  it("two quick, still taps make a double tap at the first press", () => {
    expect(run([...tap(0), ...tap(200, 103, 101)])).toEqual([{ x: 103, y: 101 }]);
  });
  it("too slow, too far apart, or a single tap: nothing", () => {
    expect(run([...tap(0), ...tap(800)])).toEqual([]);
    expect(run([...tap(0), ...tap(200, 200, 100)])).toEqual([]);
    expect(run(tap(0))).toEqual([]);
  });
  it("a drag past 5 px is not a tap", () => {
    expect(
      run([
        ...tap(0),
        { type: "down", id: 1, x: 100, y: 100, t: 150 },
        { type: "move", id: 1, x: 106, y: 100, t: 170 },
        { type: "up", id: 1, x: 100, y: 100, t: 200 },
      ]),
    ).toEqual([]);
  });
  it("a press of 4 px still counts", () => {
    expect(
      run([
        ...tap(0),
        { type: "down", id: 1, x: 100, y: 100, t: 150 },
        { type: "move", id: 1, x: 104, y: 100, t: 170 },
        { type: "up", id: 1, x: 104, y: 100, t: 200 },
      ]),
    ).toEqual([{ x: 100, y: 100 }]);
  });
  it("a second finger (pinch) cancels the tap", () => {
    expect(
      run([
        ...tap(0),
        { type: "down", id: 1, x: 100, y: 100, t: 150 },
        { type: "down", id: 2, x: 200, y: 200, t: 160 },
        { type: "up", id: 2, x: 200, y: 200, t: 190 },
        { type: "up", id: 1, x: 100, y: 100, t: 200 },
      ]),
    ).toEqual([]);
  });
  it("a long press is not a tap", () => {
    expect(run([...tap(0), { type: "down", id: 1, x: 100, y: 100, t: 100 }, { type: "up", id: 1, x: 100, y: 100, t: 700 }])).toEqual([]);
  });
  it("pointer cancel resets", () => {
    expect(run([...tap(0), { type: "cancel", id: 1, x: 0, y: 0, t: 100 }, ...tap(150)])).toEqual([]);
  });
});

describe("single tap (click to select)", () => {
  function taps(events: PointerSample[]): { taps: number; doubles: number } {
    let s: TapState = INITIAL_TAP_STATE;
    let n = 0;
    let d = 0;
    for (const e of events) {
      const r = tapStep(s, e);
      s = r.state;
      if (r.tap) n++;
      if (r.doubleTap) d++;
    }
    return { taps: n, doubles: d };
  }
  const press = (t: number, x = 100, moveTo = x, ms = 80): PointerSample[] => [
    { type: "down", id: 1, x, y: 100, t },
    { type: "move", id: 1, x: moveTo, y: 100, t: t + ms / 2 },
    { type: "up", id: 1, x: moveTo, y: 100, t: t + ms },
  ];

  it("every still press is a tap; the second of a quick pair is also a double tap", () => {
    expect(taps(press(0))).toEqual({ taps: 1, doubles: 0 });
    expect(taps([...press(0), ...press(200)])).toEqual({ taps: 2, doubles: 1 });
    expect(taps([...press(0), ...press(1000)])).toEqual({ taps: 2, doubles: 0 });
  });
  it("a drag of more than 5 px is a camera move, never a tap", () => {
    expect(taps(press(0, 100, 106))).toEqual({ taps: 0, doubles: 0 });
    expect(taps(press(0, 100, 105))).toEqual({ taps: 1, doubles: 0 });
  });
});
