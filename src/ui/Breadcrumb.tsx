import { crumbGroups, ancestorsOf, groupAncestors, groupOf } from "../content/groups";
import { panelModel } from "../content/placeholder";
import { softPanelModel } from "../content/softPanel";
import { goBack, isolateGroup } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";

/**
 * Breadcrumb (spec §7): `Skeleton › Lower limb › Femur`, top left (one line on
 * a phone), shown while something is selected or a group is isolated, with the
 * tier at the end ("› Related", "› Region"). "Skeleton" goes back to the full
 * skeleton; a group level (Milestone 5) isolates that group.
 */
export const TIER_CRUMBS = ["", "Related", "Region"] as const;

export function Breadcrumb() {
  const sel = useViewer((s) => s.sel);
  const tier = useViewer((s) => s.tier);
  const grp = useViewer((s) => s.grp);
  let trail: string[];
  let links: (string | null)[];
  if (sel !== null) {
    const model = panelModel(sel) ?? softPanelModel(sel);
    if (!model) return null;
    trail = tier > 0 ? [...model.trail, TIER_CRUMBS[tier]] : model.trail;
    links = crumbGroups(trail, ancestorsOf(sel));
  } else if (grp !== null) {
    const g = groupOf(grp);
    if (!g) return null;
    trail = g.trail;
    links = crumbGroups(trail, groupAncestors(grp));
  } else return null;
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
        {trail.map((label, i) => {
          const key = links[i];
          return (
            <li key={`${i}-${label}`} aria-current={i === last ? "location" : undefined}>
              <span aria-hidden="true" className="crumb-sep">
                ›
              </span>
              {i !== last && key ? (
                <button type="button" className="crumb-link" data-group={key} onClick={() => isolateGroup(key)}>
                  {label}
                </button>
              ) : (
                <span className={i === last ? "crumb-current" : undefined}>{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
