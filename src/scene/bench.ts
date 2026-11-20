// `?bench` mode (spec §8, plan step 10): orbit 360° over a fixed time and
// summarise the frame times. Pure, so Vitest covers it.

/** One full turn takes this long. */
export const BENCH_DURATION_MS = 10_000;
/** Frames in the first moments after the start are dropped (shader warm-up). */
export const BENCH_WARMUP_MS = 250;

export type BenchResult = {
  frames: number;
  /** Frames per second from the median frame time. */
  medianFps: number;
  /** 5th-percentile FPS: from the 95th-percentile (slow) frame time. */
  p5Fps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
};

/** Nearest-rank percentile (p in 0..100) of an ascending list. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

/** Summarise frame durations in milliseconds. Returns null with no frames. */
export function summariseFrames(frameMs: readonly number[]): BenchResult | null {
  const ms = frameMs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (ms.length === 0) return null;
  const median = percentile(ms, 50);
  const p95 = percentile(ms, 95);
  return {
    frames: ms.length,
    medianFps: 1000 / median,
    p5Fps: 1000 / p95,
    medianFrameMs: median,
    p95FrameMs: p95,
    maxFrameMs: ms[ms.length - 1]!,
  };
}

/** Azimuth (radians) the bench orbit has reached `elapsedMs` after its start. */
export function benchAzimuth(elapsedMs: number, durationMs = BENCH_DURATION_MS): number {
  return (2 * Math.PI * Math.min(Math.max(elapsedMs, 0), durationMs)) / durationMs;
}

/** Label layout cost during the bench (plan step 12): how many layouts ran and how long they took. */
export type LayoutTimes = { count: number; medianMs: number; maxMs: number };

export function summariseTimes(ms: readonly number[]): LayoutTimes | null {
  const sorted = ms.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return { count: sorted.length, medianMs: percentile(sorted, 50), maxMs: sorted[sorted.length - 1]! };
}

/**
 * Durations (ms) of the floating-label layouts since the bench started. The
 * label probe appends to it; the bench empties it at the start and reads it at
 * the end. Capped so it can't grow without a bench running.
 */
export const labelLayoutMs: number[] = [];
export const LABEL_TIMES_CAP = 2000;
export function recordLabelLayout(ms: number): void {
  if (labelLayoutMs.length < LABEL_TIMES_CAP) labelLayoutMs.push(ms);
}

/** The soft-tissue layers, in the spec's order (kept here so the bench needs no layer chunk). */
const BENCH_TISSUE = ["cartilage", "ligaments", "muscles"] as const;
type BenchTissue = (typeof BENCH_TISSUE)[number];
type BenchLayerLoad = { status: "loading" | "ready" | "error"; lod: "low" | "high" | null; fetching: "low" | "high" | null };

/**
 * M7 step 9: the bench waits until every soft-tissue layer that isn't Off has
 * its final LOD on screen (the same LOD plan as the bones), so the orbit
 * measures what the link asks for. "error" when a layer failed to load (the
 * bench doesn't run, and the panel says why).
 */
export function benchLayersState(
  layers: Readonly<Record<BenchTissue, "on" | "ghost" | "off">>,
  load: Readonly<Partial<Record<BenchTissue, BenchLayerLoad>>>,
  finalLod: "low" | "high" | null,
): "ready" | "waiting" | "error" {
  let waiting = false;
  for (const layer of BENCH_TISSUE) {
    if (layers[layer] === "off") continue;
    const l = load[layer];
    if (l?.status === "error") return "error";
    if (!l || l.status !== "ready" || l.lod !== finalLod || l.fetching !== null) waiting = true;
  }
  return waiting ? "waiting" : "ready";
}

/** The layer setting the bench ran with, for the panel: "bones on · muscles ghost (depth 1)". */
export function benchLayersLabel(layers: Readonly<Record<"bones" | BenchTissue, "on" | "ghost" | "off">>, depth: number): string {
  const parts = (["bones", ...BENCH_TISSUE] as const)
    .filter((l) => layers[l] !== "off")
    .map((l) => `${l} ${layers[l]}${l === "muscles" && depth > 0 ? ` (depth ${depth})` : ""}`);
  return parts.length === 0 ? "none" : parts.join(" · ");
}
