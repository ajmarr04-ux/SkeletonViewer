import type { ReactNode } from "react";
import type { Lod, LodPlan, ObjectSummary } from "../scene/lod";
import { formatCount, formatMs } from "../scene/lod";
import { useViewer } from "../state/store";
import { formatCam } from "../state/url";
import type { IsolationStats } from "../scene/Isolation";

export type RenderStats = { drawCalls: number; renderedTriangles: number; fps: number };

/** Result of comparing each batched bone's world bounds with the Blender manifest. */
export type BoundsReport = { lod: Lod; checked: number; maxDelta: number; errors: string[]; ghostChecked?: number };

type Props = {
  plan: LodPlan;
  current: Lod | null;
  loadTimes: Partial<Record<Lod, number>>;
  objects: ObjectSummary | null;
  instances: number;
  modelTriangles: number;
  stats: RenderStats;
  /** undefined: not requested (no ?debug); null: running. */
  bounds?: BoundsReport | null;
  error: string | null;
  isolation?: IsolationStats | null;
  /** Extra lines (the M6 layer view, a lazy chunk). */
  children?: ReactNode;
};

/** Debug readout. data-* attributes are read by the Playwright tests. */
export function DebugOverlay(p: Props) {
  const { plan, current, loadTimes, objects, stats, bounds, error, isolation: iso } = p;
  const done = plan.lods.every((l) => loadTimes[l] !== undefined) && current === plan.lods[plan.lods.length - 1];
  const camera = useViewer((s) => s.camera);
  const bench = useViewer((s) => s.bench);
  const explode = useViewer((s) => s.explode);
  const boundsDone = bounds !== undefined && bounds !== null && bounds.lod === current;
  return (
    <aside
      className="debug"
      aria-label="Debug information"
      data-testid="debug"
      data-lod={current ?? ""}
      data-plan={plan.lods.join(",")}
      data-plan-source={plan.source}
      data-loaded={plan.lods.filter((l) => loadTimes[l] !== undefined).join(",")}
      data-load-low={loadTimes.low !== undefined ? Math.round(loadTimes.low) : undefined}
      data-load-high={loadTimes.high !== undefined ? Math.round(loadTimes.high) : undefined}
      data-complete={done && (bounds === undefined || boundsDone) ? "true" : "false"}
      data-objects={objects?.found ?? 0}
      data-instances={p.instances}
      data-known-missing={objects?.knownMissing.join(",") ?? ""}
      data-unexpected-missing={objects?.unexpectedMissing.join(",") ?? ""}
      data-unknown={objects?.unknown.join(",") ?? ""}
      data-triangles={p.modelTriangles}
      data-draw-calls={stats.drawCalls}
      data-cam={camera ? formatCam(camera) : ""}
      data-bench-done={bench ? "true" : ""}
      data-bench-median-fps={bench ? bench.medianFps.toFixed(1) : ""}
      data-bench-p5-fps={bench ? bench.p5Fps.toFixed(1) : ""}
      data-bench-frames={bench ? bench.frames : ""}
      data-bench-draw-calls={bench ? bench.drawCalls : ""}
      data-bench-lod={bench?.lod ?? ""}
      data-bounds-ok={boundsDone ? String(bounds.errors.length === 0) : ""}
      data-bounds-checked={boundsDone ? bounds.checked : ""}
      data-bounds-ghost-checked={boundsDone ? (bounds.ghostChecked ?? "") : ""}
      data-solid={iso ? iso.solid : ""}
      data-ghosts={iso ? iso.ghost : ""}
      data-focus={iso?.focus ?? ""}
      data-outline-selected={iso?.outlineSelected ?? ""}
      data-outline-hover={iso?.outlineHover ?? ""}
      data-joint={iso ? iso.joint.join(",") : ""}
      data-colour={iso?.colour ?? ""}
      data-explode={explode}
      data-highlight-ms={iso?.highlightMs != null ? iso.highlightMs.toFixed(1) : ""}
      data-bounds-max-delta-mm={boundsDone ? (bounds.maxDelta * 1000).toFixed(4) : ""}
    >
      <h1>Debug · Milestone 6</h1>
      {error && <p className="error">Load failed: {error}</p>}
      <dl>
        <dt>LOD</dt>
        <dd>{current ?? "loading…"}</dd>
        <dt>Plan</dt>
        <dd>
          {plan.lods.join(" → ")} ({plan.reason})
        </dd>
        {plan.lods.map((l) => (
          <div key={l} className="row">
            <dt>{l} loaded</dt>
            <dd>{formatMs(loadTimes[l])}</dd>
          </div>
        ))}
        <dt>Objects</dt>
        <dd>
          {objects ? `${objects.found} meshes of ${objects.found + objects.knownMissing.length} IDs` : "…"}
        </dd>
        {objects && objects.knownMissing.length > 0 && (
          <>
            <dt>No mesh</dt>
            <dd>{objects.knownMissing.join(", ")}</dd>
          </>
        )}
        {objects && objects.unexpectedMissing.length > 0 && (
          <>
            <dt className="error">Missing</dt>
            <dd className="error">{objects.unexpectedMissing.join(", ")}</dd>
          </>
        )}
        {objects && objects.unknown.length > 0 && (
          <>
            <dt className="error">Unknown</dt>
            <dd className="error">{objects.unknown.join(", ")}</dd>
          </>
        )}
        <dt>Triangles</dt>
        <dd>{formatCount(p.modelTriangles)}</dd>
        <dt>Draw calls</dt>
        <dd>{stats.drawCalls}</dd>
        <dt>Camera</dt>
        <dd>{camera ? formatCam(camera) : "default"}</dd>
        {iso && (
          <>
            <dt>Isolation</dt>
            <dd>
              {iso.focus ? `${iso.focus}: ${iso.solid} solid, ${iso.ghost} ghosts` : "full skeleton"}
              {iso.highlightMs !== null && ` · click → highlight ${iso.highlightMs.toFixed(0)} ms`}
            </dd>
          </>
        )}
        <dt>FPS</dt>
        <dd>{stats.fps.toFixed(0)}</dd>
        {bounds !== undefined && (
          <>
            <dt>Bounds</dt>
            <dd className={boundsDone && bounds.errors.length ? "error" : undefined}>
              {!boundsDone
                ? "checking…"
                : bounds.errors.length
                  ? `${bounds.errors.length} moved: ${bounds.errors.slice(0, 3).join("; ")}`
                  : `${bounds.checked} match the manifest (max ${(bounds.maxDelta * 1000).toFixed(3)} mm)`}
            </dd>
          </>
        )}
      </dl>
      {p.children}
      <p className="hint">
        Try <a href="?lod=low&amp;debug">?lod=low</a> · <a href="?lod=high&amp;debug">?lod=high</a> ·{" "}
        <a href="?lod=both&amp;debug">both</a> · <a href="?debug">auto</a> · <a href="?bench&amp;debug">bench</a>
      </p>
    </aside>
  );
}
