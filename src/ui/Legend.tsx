import { REGIONS, regionColour } from "../scene/regionColours";
import { isolateGroup } from "../state/selection";
import { useViewer } from "../state/store";

/**
 * The colour-by-region legend (plan decision 8): a swatch and a name per
 * region. Each entry is also a button that isolates its region as a group
 * (plan step 6), so the key doubles as a shortcut.
 */
export function Legend() {
  const on = useViewer((s) => s.colourMode === "region");
  const grp = useViewer((s) => s.grp);
  if (!on) return null;
  return (
    <section className="legend" aria-label="Colour key: regions" data-testid="legend">
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
              onClick={() => isolateGroup(r.group)}
            >
              <span className="legend-swatch" style={{ background: regionColour(r.region) }} aria-hidden="true" />
              {r.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
