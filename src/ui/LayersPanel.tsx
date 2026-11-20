// The Layers panel (musculoskeletal spec §6.1, M7 plan step 3): two presets,
// then On / Ghost / Off for each layer, with a progress line while a layer's
// files load and Retry if they fail. Lives in the main chunk (it is small);
// the layer files and their code load only when a layer is turned on.

import { useId } from "react";
import { peeledMuscleCount, softTableLoaded } from "../content/softRegistry";
import { applyLayerPreset, presetOf, setLayerMode, setMuscleDepth, type LayerPreset } from "../state/selection";
import { useViewer, type LayerLoad } from "../state/store";
import { LAYERS, type Layer, type LayerMode, type MuscleDepth, type TissueLayer } from "../state/url";

export const LAYER_LABELS: Record<Layer, string> = { bones: "Bones", cartilage: "Cartilage", ligaments: "Ligaments", muscles: "Muscles" };
const MODE_LABELS: Record<LayerMode, string> = { on: "On", ghost: "Ghost", off: "Off" };
const PRESETS: { key: LayerPreset; label: string }[] = [
  { key: "skeleton", label: "Skeleton" },
  { key: "full", label: "Full musculoskeletal" },
];
const DEPTH_STOPS = ["All", "Hide superficial", "Hide superficial + intermediate", "Deep only"];

export function LayersPanel() {
  const layers = useViewer((s) => s.layers);
  const debugView = useViewer((s) => s.debugLayersView);
  const say = useViewer((s) => s.say);
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
            onClick={() => {
              applyLayerPreset(p.key);
              say(p.key === "skeleton" ? "Skeleton: bones only" : "Full musculoskeletal: every layer on");
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {LAYERS.map((layer) => (
        <LayerRow key={layer} layer={layer} mode={layers[layer]} disabled={debugView} />
      ))}
    </div>
  );
}

function LayerRow({ layer, mode, disabled }: { layer: Layer; mode: LayerMode; disabled: boolean }) {
  const name = useId();
  const say = useViewer((s) => s.say);
  const load = useViewer((s) => (layer === "bones" ? undefined : s.layerLoad[layer as TissueLayer]));
  return (
    <fieldset className="layer-row" data-layer={layer} data-mode={mode} data-status={load?.status ?? ""} data-lod={load?.lod ?? ""}>
      <legend>{LAYER_LABELS[layer]}</legend>
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
              onChange={() => {
                setLayerMode(layer, m);
                say(`${LAYER_LABELS[layer]}: ${MODE_LABELS[m].toLowerCase()}`);
              }}
            />
            {MODE_LABELS[m]}
          </label>
        ))}
      </div>
      {layer !== "bones" && mode !== "off" && load && <LoadStatus layer={layer as TissueLayer} load={load} />}
      {layer === "muscles" && <DepthControl />}
    </fieldset>
  );
}

function LoadStatus({ layer, load }: { layer: TissueLayer; load: LayerLoad }) {
  const setLoad = useViewer((s) => s.setLayerLoad);
  if (load.status === "error") {
    return (
      <p className="layer-status error" role="alert">
        Could not load {LAYER_LABELS[layer].toLowerCase()}: {load.error}{" "}
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
      <progress max={100} value={pct ?? undefined} aria-label={`${what}: ${LAYER_LABELS[layer]}`} />
      <span className="muted">
        {what}
        {pct !== null ? ` ${pct}%` : "…"}
      </span>
    </div>
  );
}

/**
 * The muscle depth control (spec §6.2, M7 plan decision 10): four stops; the
 * peeled muscles are hidden, not ghosted, so the next layer down can be
 * clicked. Enabled while the muscles layer is On or Ghost.
 */
function DepthControl() {
  const name = useId();
  const depth = useViewer((s) => s.muscleDepth);
  const off = useViewer((s) => s.layers.muscles === "off" || s.debugLayersView);
  const say = useViewer((s) => s.say);
  return (
    <fieldset className="layer-depth" disabled={off} data-testid="muscle-depth">
      <legend>Depth</legend>
      {DEPTH_STOPS.map((label, i) => (
        <label key={label}>
          <input
            type="radio"
            name={name}
            value={i}
            checked={i === depth}
            data-testid={`muscle-depth-${i}`}
            onChange={() => {
              const stop = i as MuscleDepth;
              setMuscleDepth(stop);
              say(depthAnnouncement(stop, softTableLoaded() ? peeledMuscleCount(stop) : null));
            }}
          />
          {label}
        </label>
      ))}
      {off && <p className="muted">Turn the muscles on to peel them by depth.</p>}
    </fieldset>
  );
}

/** "Superficial muscles hidden: 41 muscles." (plan step 7). */
export function depthAnnouncement(stop: MuscleDepth, count: number | null): string {
  if (stop === 0) return "All muscles shown";
  const what = stop === 1 ? "Superficial muscles hidden" : stop === 2 ? "Superficial and intermediate muscles hidden" : "Deep muscles only";
  return count === null ? what : `${what}: ${count} ${count === 1 ? "muscle" : "muscles"}${stop === 3 ? " hidden" : ""}`;
}
