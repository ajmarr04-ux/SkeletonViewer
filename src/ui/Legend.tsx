import { useMemo } from "react";
import { useGraphVersion } from "../content/appGraph";
import { viewOf } from "../scene/isolation";
import { usePatchBatch } from "../scene/layerRegistry";
import { REGIONS, regionColour } from "../scene/regionColours";
import { markColour, PATTERN_OF, PATTERN_SWATCH_CSS, patternPath, type Pattern } from "../scene/patterns";
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

/** One colour-key chip: a layer or a tint (with its pattern, M14 BX). */
export type KeyItem = { key: string; name: string; colour: string; pattern: Pattern };

type KeyState = Parameters<typeof tintsInUse>[0] & Pick<ViewerState, "layers">;

/** The colour key's chips: the layers when more than one is showing, then the tints in use. The legend and the screenshot both draw these. */
export function keyItems(s: KeyState, version: number, failed: boolean): KeyItem[] {
  const shown = LAYER_IDS.filter((l) => s.layers[l] !== "off");
  const tints = tintsInUse(s, version, failed);
  return [
    ...(shown.length > 1 ? shown.map((l) => ({ key: `layer-${l}`, ...layerKey(l), pattern: "none" as const })) : []),
    ...((tints ? tints.split(",") : []) as TintRole[]).map((r) => ({ key: `tint-${r}`, name: TINT_NAMES[r], colour: TINT_COLOURS[r], pattern: PATTERN_OF[r] })),
  ];
}

/** A swatch: the colour, and over it the pattern's marks in the darker shade, at the swatch period (the pattern's look; its size on screen depends on the zoom). */
function Swatch({ item }: { item: KeyItem }) {
  if (item.pattern === "none") return <span className="legend-swatch" style={{ background: item.colour }} aria-hidden="true" />;
  const id = `legend-pattern-${item.pattern}`;
  const s = PATTERN_SWATCH_CSS;
  return (
    <svg className="legend-swatch" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" data-pattern={item.pattern} style={{ background: item.colour }}>
      <defs>
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
          <path d={patternPath(item.pattern, s)} fill={markColour(item.colour)} />
        </pattern>
      </defs>
      <rect width="14" height="14" fill={`url(#${id})`} />
    </svg>
  );
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
  const tintRoles = (tints ? tints.split(",") : []) as TintRole[];
  const items = useMemo(() => keyItems(useViewer.getState(), version, failed), [tints, layers, version, failed]);
  if (!regions && items.length === 0) return null;
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
      {items.length > 0 && (
        <>
          {regions && <h2 className="legend-title">Key</h2>}
          <ul className="legend-key" data-testid="legend-key">
            {items.map((k) => (
              <li key={k.key} className="legend-chip" data-key={k.key}>
                <Swatch item={k} />
                {k.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
