import { BENCH_DURATION_MS } from "../scene/bench";
import { useViewer } from "../state/store";

/** `?bench`: the result of the 360° orbit, or a note that it is running. */
export function BenchPanel() {
  const bench = useViewer((s) => s.bench);
  const active = useViewer((s) => s.lodActive);
  return (
    <aside className="bench" aria-label="Benchmark" aria-live="polite" data-testid="bench">
      <h2>Benchmark</h2>
      {!bench ? (
        <p>
          Orbiting 360° over {BENCH_DURATION_MS / 1000} s on {active ?? "…"} detail. Don't touch the view.
        </p>
      ) : (
        <dl>
          <dt>LOD</dt>
          <dd>{bench.lod}</dd>
          <dt>Median FPS</dt>
          <dd>{bench.medianFps.toFixed(1)}</dd>
          <dt>5th pct FPS</dt>
          <dd>{bench.p5Fps.toFixed(1)}</dd>
          <dt>Frame time</dt>
          <dd>
            median {bench.medianFrameMs.toFixed(1)} ms · p95 {bench.p95FrameMs.toFixed(1)} ms · max{" "}
            {bench.maxFrameMs.toFixed(1)} ms
          </dd>
          <dt>Frames</dt>
          <dd>{bench.frames}</dd>
          <dt>Draw calls</dt>
          <dd>{bench.drawCalls}</dd>
          <dt>Pixel ratio</dt>
          <dd>{window.devicePixelRatio}</dd>
        </dl>
      )}
    </aside>
  );
}
