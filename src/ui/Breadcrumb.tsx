import { panelModel } from "../content/placeholder";
import { goBack } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";

/**
 * Breadcrumb (spec §7): `Skeleton › Lower limb › Femur`, top left (one line on
 * a phone), shown while something is selected, with the tier at the end
 * ("› Related", "› Region"). "Skeleton" goes back to the full skeleton. The
 * group levels stay plain text until the hierarchy tree (Milestone 5).
 */
export const TIER_CRUMBS = ["", "Related", "Region"] as const;

export function Breadcrumb() {
  const sel = useViewer((s) => s.sel);
  const tier = useViewer((s) => s.tier);
  const model = sel === null ? null : panelModel(sel);
  if (!model) return null;
  const trail = tier > 0 ? [...model.trail, TIER_CRUMBS[tier]] : model.trail;
  const last = trail.length - 1;
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb" data-testid="breadcrumb">
      <ol>
        <li>
          <button
            type="button"
            className="crumb-link"
            onClick={() => {
              goBack();
              focusCanvas();
            }}
          >
            Skeleton
          </button>
        </li>
        {trail.map((label, i) => (
          <li key={`${i}-${label}`} aria-current={i === last ? "location" : undefined}>
            <span aria-hidden="true" className="crumb-sep">
              ›
            </span>
            <span className={i === last ? "crumb-current" : undefined}>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
