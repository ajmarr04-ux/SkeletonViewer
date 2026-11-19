import type { Lod, ObjectSummary } from "../scene/lod";
import { formatCount, formatMs } from "../scene/lod";

export type RenderStats = { drawCalls: number; renderedTriangles: number; fps: number };

type Props = {
  plan: Lod[];
  current: Lod | null;
  loadTimes: Partial<Record<Lod, number>>;
  objects: ObjectSummary | null;
  modelTriangles: number;
  stats: RenderStats;
  error: string | null;
};

/** Milestone 1 debug readout. data-* attributes are read by the Playwright smoke test. */
export function DebugOverlay({ plan, current, loadTimes, objects, modelTriangles, stats, error }: Props) {
  const done = plan.every((l) => loadTimes[l] !== undefined);
  return (
    <aside
      className="debug"
      aria-label="Debug information"
      data-testid="debug"
      data-lod={current ?? ""}
      data-loaded={plan.filter((l) => loadTimes[l] !== undefined).join(",")}
      data-complete={done ? "true" : "false"}
      data-objects={objects?.found ?? 0}
      data-known-missing={objects?.knownMissing.join(",") ?? ""}
      data-unexpected-missing={objects?.unexpectedMissing.join(",") ?? ""}
      data-unknown={objects?.unknown.join(",") ?? ""}
      data-triangles={modelTriangles}
    >
      <h1>Skeleton Viewer · Milestone 1</h1>
      {error && <p className="error">Load failed: {error}</p>}
      <dl>
        <dt>LOD</dt>
        <dd>
          {current ?? "loading…"}
          {plan.length === 1 && " (pinned by ?lod)"}
        </dd>
        {plan.map((l) => (
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
        <dd>{formatCount(modelTriangles)}</dd>
        <dt>Draw calls</dt>
        <dd>{stats.drawCalls}</dd>
        <dt>FPS</dt>
        <dd>{stats.fps.toFixed(0)}</dd>
      </dl>
      <p className="hint">
        Try <a href="?lod=low">?lod=low</a> · <a href="?lod=high">?lod=high</a> · <a href="?">both</a>
      </p>
    </aside>
  );
}
