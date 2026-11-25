import { useGraphVersion } from "../content/appGraph";
import { viewOf } from "../scene/isolation";
import { usePatchBatch } from "../scene/layerRegistry";
import { REGIONS, regionColour } from "../scene/regionColours";
import { TINT_COLOURS, TINT_NAMES, TINT_ROLES, type TintRole } from "../scene/tints";
import { hasMesh, isMuscleKind, isolateGroup } from "../state/selection";
import { useViewer, type ViewerState } from "../state/store";
import { type Layer } from "../state/url";
import { LAYER_IDS, layerDescriptor } from "../systems/registry";

/** A layer's colour-key entry: its descriptor's colour, named by `keyLabel` or its label. */
const layerKey = (l: Layer): { name: string; colour: string } => {
  const d = layerDescriptor(l);
  return { name: d.colour.keyLabel ?? d.label, colour: d.colour.material };
};

let cache: { key: unknown[]; out: string } | null = null;

/**
 * The tints on screen now, as "origin,insertion,…" (a string, so the selector
 * is stable). Only a muscle or part at tier 1 or 2 has any; the view is
 * computed only then, and once per change of what it depends on.
 */
export function tintsInUse(s: Pick<ViewerState, "sel" | "tier" | "antagonists" | "layers" | "hidden" | "ghostMode" | "grp" | "joint" | "muscleDepth">, version: number, failed: boolean): string {
  if (s.sel === null || s.tier === 0 || !isMuscleKind(s.sel)) return "";
  const key = [s.sel, s.tier, s.antagonists, s.layers, s.hidden, s.ghostMode, s.muscleDepth, version, failed];
  if (cache && cache.key.length === key.length && cache.key.every((k, i) => k === key[i])) return cache.out;
  const v = viewOf(s, hasMesh);
  const used = new Set<TintRole>([...v.tints.values(), ...v.patches.values()]);
  const out = TINT_ROLES.filter((r) => used.has(r)).join(",");
  cache = { key, out };
  return out;
}

/**
 * The colour key (spec §7): the regions in colour-by-region (plan decision 8 of
 * M5; each entry also isolates its region as a group), the layer colours when
 * more than one layer is showing, and the origin, insertion and antagonist
 * chips while they are in use (M9 plan decision 8).
 */
export function Legend() {
  const regions = useViewer((s) => s.colourMode === "region");
  const grp = useViewer((s) => s.grp);
  const version = useGraphVersion();
  const failed = usePatchBatch((p) => p.failed);
  const tints = useViewer((s) => tintsInUse(s, version, failed));
  const layers = useViewer((s) => LAYER_IDS.filter((l) => s.layers[l] !== "off").join(","));
  const shownLayers = (layers ? layers.split(",") : []) as Layer[];
  const tintRoles = (tints ? tints.split(",") : []) as TintRole[];
  const keyItems = [
    ...(shownLayers.length > 1 ? shownLayers.map((l) => ({ key: `layer-${l}`, ...layerKey(l) })) : []),
    ...tintRoles.map((r) => ({ key: `tint-${r}`, name: TINT_NAMES[r], colour: TINT_COLOURS[r] })),
  ];
  if (!regions && keyItems.length === 0) return null;
  return (
    <section className="legend" aria-label={regions ? "Colour key: regions" : "Colour key"} data-testid="legend">
      {regions && tintRoles.length > 0 && (
        // Colour-by-region pauses while tints are drawn (drawnColourMode, M10 session AL): say so rather than key colours not on screen.
        <p className="legend-note" data-testid="legend-paused">
          Region colours paused while origins, insertions or antagonists are shown.
        </p>
      )}
      {regions && tintRoles.length === 0 && (
        <>
          <h2 className="legend-title">Regions</h2>
          <ul>
            {REGIONS.map((r) => (
              <li key={r.region}>
                <button
                  type="button"
                  className="legend-item"
                  data-region={r.region}
                  aria-current={grp === r.group ? "true" : undefined}
                  title={`Isolate: ${r.name}`}
                  onClick={() => void isolateGroup(r.group)}
                >
                  <span className="legend-swatch" style={{ background: regionColour(r.region) }} aria-hidden="true" />
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {keyItems.length > 0 && (
        <>
          {regions && <h2 className="legend-title">Key</h2>}
          <ul className="legend-key" data-testid="legend-key">
            {keyItems.map((k) => (
              <li key={k.key} className="legend-chip" data-key={k.key}>
                <span className="legend-swatch" style={{ background: k.colour }} aria-hidden="true" />
                {k.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
