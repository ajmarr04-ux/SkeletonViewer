// The Layers panel (musculoskeletal spec §6.1, M7 plan step 3): two presets,
// then On / Ghost / Off for each layer, with a progress line while a layer's
// files load and Retry if they fail. Lives in the main chunk (it is small);
// the layer files and their code load only when a layer is turned on. Its
// changes are announced from the store (`src/ui/Announcer.tsx`), not here.

import { useId } from "react";
import { applyLayerPreset, presetOf, setLayerMode, setMuscleDepth, type LayerPreset } from "../state/selection";
import { useViewer, type LayerLoad } from "../state/store";
import { type Layer, type LayerMode, type MuscleDepth } from "../state/url";
import { DEPTH_LAYER, depthStops, isLazyLayer, LAYER_IDS, layerLabel, type LazyLayerId } from "../systems/registry";

const MODE_LABELS: Record<LayerMode, string> = { on: "On", ghost: "Ghost", off: "Off" };
const PRESETS: { key: LayerPreset; label: string }[] = [
  { key: "skeleton", label: "Skeleton" },
  { key: "full", label: "Full musculoskeletal" },
];

export function LayersPanel() {
  const layers = useViewer((s) => s.layers);
  const debugView = useViewer((s) => s.debugLayersView);
  const preset = presetOf(layers);
  return (
    <div className="layers-panel" data-testid="layers-panel">
      {debugView && (
        <p className="muted" data-testid="layers-debug-note">
          The debug layer view is on (<code>layers=</code> in the address). Remove it to use Layers.
        </p>
      )}
      <div className="layer-presets" role="group" aria-label="Presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="button"
            aria-pressed={preset === p.key}
            data-testid={`layers-preset-${p.key}`}
            disabled={debugView}
            onClick={() => applyLayerPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {LAYER_IDS.map((layer) => (
        <LayerRow key={layer} layer={layer} mode={layers[layer]} disabled={debugView} />
      ))}
    </div>
  );
}

function LayerRow({ layer, mode, disabled }: { layer: Layer; mode: LayerMode; disabled: boolean }) {
  const name = useId();
  const load = useViewer((s) => (isLazyLayer(layer) ? s.layerLoad[layer] : undefined));
  return (
    <fieldset className="layer-row" data-layer={layer} data-mode={mode} data-status={load?.status ?? ""} data-lod={load?.lod ?? ""} data-shown-low={load?.shownAt.low?.toFixed(0) ?? ""}>
      <legend>{layerLabel(layer)}</legend>
      <div className="layer-modes">
        {(Object.keys(MODE_LABELS) as LayerMode[]).map((m) => (
          <label key={m}>
            <input
              type="radio"
              name={name}
              value={m}
              checked={mode === m}
              disabled={disabled}
              data-testid={`layer-${layer}-${m}`}
              onChange={() => setLayerMode(layer, m)}
            />
            {MODE_LABELS[m]}
          </label>
        ))}
      </div>
      {isLazyLayer(layer) && mode !== "off" && load && <LoadStatus layer={layer} load={load} />}
      {layer === DEPTH_LAYER && <DepthControl />}
    </fieldset>
  );
}

function LoadStatus({ layer, load }: { layer: LazyLayerId; load: LayerLoad }) {
  const setLoad = useViewer((s) => s.setLayerLoad);
  if (load.status === "error") {
    return (
      <p className="layer-status error" role="alert">
        Could not load {layerLabel(layer).toLowerCase()}: {load.error}{" "}
        <button type="button" className="button" onClick={() => setLoad(layer, { status: "loading", error: null, attempt: load.attempt + 1 })}>
          Retry
        </button>
      </p>
    );
  }
  if (load.fetching === null) return null;
  const pct = load.total > 0 ? Math.min(100, Math.round((load.received / load.total) * 100)) : null;
  const what = load.fetching === "low" ? "Loading" : "Loading full detail";
  return (
    <div className="layer-status" data-testid={`layer-${layer}-progress`}>
      <progress max={100} value={pct ?? undefined} aria-label={`${what}: ${layerLabel(layer)}`} />
      <span className="muted">
        {what}
        {pct !== null ? ` ${pct}%` : "…"}
      </span>
    </div>
  );
}

/**
 * The muscle depth control (spec §6.2, M7 plan decision 10): three stops; the
 * peeled muscles are hidden, not ghosted, so the next layer down can be
 * clicked. Enabled while the muscles layer is On or Ghost.
 */
function DepthControl() {
  const name = useId();
  const depth = useViewer((s) => s.muscleDepth);
  const off = useViewer((s) => s.layers[DEPTH_LAYER] === "off" || s.debugLayersView);
  return (
    <fieldset className="layer-depth" disabled={off} data-testid="muscle-depth">
      <legend>Depth</legend>
      {depthStops().map((label, i) => (
        <label key={label}>
          <input
            type="radio"
            name={name}
            value={i}
            checked={i === depth}
            data-testid={`muscle-depth-${i}`}
            onChange={() => setMuscleDepth(i as MuscleDepth)}
          />
          {label}
        </label>
      ))}
      {off && <p className="muted">Turn the muscles on to peel them by depth.</p>}
    </fieldset>
  );
}
