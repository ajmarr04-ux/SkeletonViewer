import { panelModel } from "../content/placeholder";
import { goBack } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";

/**
 * Breadcrumb (spec §7): `Skeleton › Lower limb › Femur`, top left (one line on
 * a phone), shown while something is selected. "Skeleton" goes back to the
 * full skeleton; the group levels become links with Expand region (Milestone 4).
 */
export function Breadcrumb() {
  const sel = useViewer((s) => s.sel);
  const model = sel === null ? null : panelModel(sel);
  if (!model) return null;
  const last = model.trail.length - 1;
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
        {model.trail.map((label, i) => (
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
