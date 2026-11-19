import { describe, expect, it } from "vitest";
import { BENCH_DURATION_MS, benchAzimuth, percentile, summariseFrames, summariseTimes, recordLabelLayout, labelLayoutMs, LABEL_TIMES_CAP } from "../src/scene/bench";

describe("percentile", () => {
  it("uses the nearest rank", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 50)).toBe(5);
    expect(percentile(xs, 95)).toBe(10);
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 100)).toBe(10);
    expect(percentile([], 50)).toBeNaN();
  });
});

describe("summariseFrames", () => {
  it("gives median and 5th-percentile FPS from frame times", () => {
    // 95 frames at 60 FPS and 5 slow ones at 25 FPS.
    const frames = [...Array<number>(95).fill(1000 / 60), ...Array<number>(5).fill(40)];
    const r = summariseFrames(frames)!;
    expect(r.frames).toBe(100);
    expect(r.medianFps).toBeCloseTo(60, 6);
    expect(r.p5Fps).toBeCloseTo(60, 6); // the 95th frame is still a fast one
    expect(r.maxFrameMs).toBe(40);
    const r2 = summariseFrames([...frames, ...Array<number>(5).fill(40)])!;
    expect(r2.p5Fps).toBeCloseTo(25, 6);
  });

  it("ignores junk and returns null with no frames", () => {
    expect(summariseFrames([])).toBeNull();
    expect(summariseFrames([0, -1, NaN, Infinity])).toBeNull();
    expect(summariseFrames([NaN, 20])!.frames).toBe(1);
  });
});

describe("benchAzimuth", () => {
  it("turns once over the duration and stops there", () => {
    expect(benchAzimuth(0)).toBe(0);
    expect(benchAzimuth(BENCH_DURATION_MS / 4)).toBeCloseTo(Math.PI / 2, 12);
    expect(benchAzimuth(BENCH_DURATION_MS)).toBeCloseTo(2 * Math.PI, 12);
    expect(benchAzimuth(BENCH_DURATION_MS * 3)).toBeCloseTo(2 * Math.PI, 12);
    expect(benchAzimuth(-5)).toBe(0);
  });
});

describe("label layout times (plan step 12)", () => {
  it("summarises count, median and max, ignoring bad values", () => {
    expect(summariseTimes([])).toBeNull();
    expect(summariseTimes([3, 1, NaN, 2, -1, 10])).toEqual({ count: 4, medianMs: 2, maxMs: 10 });
  });
  it("records up to a cap", () => {
    labelLayoutMs.length = 0;
    for (let i = 0; i < LABEL_TIMES_CAP + 50; i++) recordLabelLayout(1);
    expect(labelLayoutMs.length).toBe(LABEL_TIMES_CAP);
    labelLayoutMs.length = 0;
  });
});
