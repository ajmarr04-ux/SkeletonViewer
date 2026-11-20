import { crumbGroups, ancestorsOf, groupAncestors, groupOf } from "../content/groups";
import { panelModel } from "../content/placeholder";
import { softPanelModel } from "../content/softPanel";
import { useSoftContent } from "../content/softContentLoader";
import { softLayerOf } from "../content/softRegistry";
import { goBack, isolateGroup, selectObject } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";

/**
 * Breadcrumb (spec §7): `Skeleton › Lower limb › Femur`, top left (one line on
 * a phone), shown while something is selected or a group is isolated, with the
 * tier at the end ("› Related", "› Region"). "Skeleton" goes back to the full
 * skeleton; a group level (Milestone 5) isolates that group. For a muscle
 * part (Milestone 9, spec §5.1) the muscle's crumb selects the muscle: one
 * level up at tier 0 (a Back step), a new focus from tiers 1 and 2.
 */
export const TIER_CRUMBS = ["", "Related", "Region"] as const;

/** Marks the crumb that selects a part's muscle rather than isolating a group. */
const UP = "\u0000up";

export function Breadcrumb() {
  const sel = useViewer((s) => s.sel);
  const tier = useViewer((s) => s.tier);
  const grp = useViewer((s) => s.grp);
  const softLayer = sel === null ? null : softLayerOf(sel);
  const softContent = useSoftContent(softLayer);
  let up: string | null = null;
  let trail: string[];
  let links: (string | null)[];
  if (sel !== null) {
    const bone = panelModel(sel);
    const soft = bone ? null : softPanelModel(sel, softContent);
    const model = bone ?? soft;
    if (!model) return null;
    trail = tier > 0 ? [...model.trail, TIER_CRUMBS[tier]] : model.trail;
    up = soft?.partOf?.id ?? null;
    links = bone ? crumbGroups(trail, ancestorsOf(sel)) : trail.map((_, i) => (i === soft!.parentCrumb ? UP : null));
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
              {i !== last && key === UP ? (
                <button
                  type="button"
                  className="crumb-link"
                  data-up="true"
                  onClick={() => {
                    if (up) selectObject(up);
                    focusCanvas();
                  }}
                >
                  {label}
                </button>
              ) : i !== last && key ? (
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
