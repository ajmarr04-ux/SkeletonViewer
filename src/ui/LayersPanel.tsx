// The Layers panel (musculoskeletal spec §6.1, M7 plan step 3; grouped by
// system since M11, plan decision 5): the registry's presets, then one
// collapsible group per system with a group On / Ghost / Off control, and
// On / Ghost / Off for each layer, with a progress line while a layer's files
// load and Retry if they fail. Lives in the main chunk (it is small); the layer
// files and their code load only when a layer is turned on. Its changes are
// announced from the store (`src/ui/Announcer.tsx`), not here.

import { useId, useState } from "react";
import { systemModeAnnouncement } from "../content/announce";
import { applyLayerPreset, setLayerMode, setMuscleDepth, setSystemMode } from "../state/selection";
import { SYSTEMS_KEY, useViewer, type LayerLoad } from "../state/store";
import { type Layer, type LayerMode, type LayerModes, type MuscleDepth } from "../state/url";
import { DEPTH_LAYER, depthStops, isLazyLayer, layerLabel, layersOfSystem, presetOf, PRESETS, SYSTEMS, systemMode, type LazyLayerId, type SystemId } from "../systems/registry";
import { formatCollapsed, parseCollapsed, toggleCollapsed } from "./systemGroups";

const MODE_LABELS: Record<LayerMode, string> = { on: "On", ghost: "Ghost", off: "Off" };
const MODES = Object.keys(MODE_LABELS) as LayerMode[];

function readCollapsed(): ReadonlySet<string> {
  try {
    return parseCollapsed(window.localStorage.getItem(SYSTEMS_KEY));
  } catch {
    return new Set();
  }
}

function writeCollapsed(collapsed: ReadonlySet<string>): void {
  try {
    const v = formatCollapsed(collapsed);
    if (v === null) window.localStorage.removeItem(SYSTEMS_KEY);
    else window.localStorage.setItem(SYSTEMS_KEY, v);
  } catch {
    // Storage disabled: the groups open expanded next time.
  }
}

export function LayersPanel() {
  const layers = useViewer((s) => s.layers);
  const debugView = useViewer((s) => s.debugLayersView);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const preset = presetOf(layers);
  const toggle = (system: SystemId) => {
    const next = toggleCollapsed(collapsed, system);
    writeCollapsed(next);
    setCollapsed(next);
  };
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
            key={p.id}
            type="button"
            className="button"
            aria-pressed={preset === p.id}
            data-testid={`layers-preset-${p.id}`}
            disabled={debugView}
            onClick={() => applyLayerPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {SYSTEMS.map((s) => (
        <SystemGroup key={s.id} system={s.id} label={s.label} layers={layers} expanded={!collapsed.has(s.id)} onToggle={() => toggle(s.id)} disabled={debugView} />
      ))}
    </div>
  );
}

/**
 * One system (M11 plan decision 5): a disclosure button, the group control
 * (every layer of the system at once; no option checked while its layers
 * differ, described as "Musculoskeletal: mixed."), then its layer rows. The
 * rows stay in the page while collapsed (`hidden`), so their state is kept.
 */
function SystemGroup({ system, label, layers, expanded, onToggle, disabled }: { system: SystemId; label: string; layers: LayerModes; expanded: boolean; onToggle: () => void; disabled: boolean }) {
  const name = useId();
  const rowsId = useId();
  const stateId = useId();
  const mode = systemMode(system, layers);
  return (
    <section className="layer-system" data-system={system} data-mode={mode} data-expanded={expanded}>
      <div className="layer-system-header">
        <button type="button" className="layer-system-toggle" aria-expanded={expanded} aria-controls={rowsId} data-testid={`system-${system}-toggle`} onClick={onToggle}>
          <span className="layer-system-chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          {label}
        </button>
        <fieldset className="layer-modes layer-system-modes" aria-describedby={stateId} data-testid={`system-${system}-modes`}>
          <legend className="visually-hidden">All {label.toLowerCase()} layers</legend>
          {MODES.map((m) => (
            <label key={m}>
              <input
                type="radio"
                name={name}
                value={m}
                checked={mode === m}
                // Mixed: no option checked, and browsers would make each radio a Tab stop; keep one.
                tabIndex={mode === "mixed" && m !== MODES[0] ? -1 : undefined}
                disabled={disabled}
                data-testid={`system-${system}-${m}`}
                onChange={() => setSystemMode(system, m)}
              />
              {MODE_LABELS[m]}
            </label>
          ))}
          <span id={stateId} className="visually-hidden">
            {systemModeAnnouncement(system, mode)}
          </span>
          {mode === "mixed" && (
            <span className="layer-system-mixed muted" aria-hidden="true">
              Mixed
            </span>
          )}
        </fieldset>
      </div>
      <div id={rowsId} className="layer-system-rows" hidden={!expanded}>
        {layersOfSystem(system).map((layer) => (
          <LayerRow key={layer} layer={layer} mode={layers[layer]} disabled={disabled} />
        ))}
      </div>
    </section>
  );
}

function LayerRow({ layer, mode, disabled }: { layer: Layer; mode: LayerMode; disabled: boolean }) {
  const name = useId();
  const load = useViewer((s) => (isLazyLayer(layer) ? s.layerLoad[layer] : undefined));
  return (
    <fieldset className="layer-row" data-layer={layer} data-mode={mode} data-status={load?.status ?? ""} data-lod={load?.lod ?? ""} data-shown-low={load?.shownAt.low?.toFixed(0) ?? ""}>
      <legend>{layerLabel(layer)}</legend>
      <div className="layer-modes">
        {MODES.map((m) => (
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
