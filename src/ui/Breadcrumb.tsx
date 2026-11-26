import { useSyncExternalStore } from "react";
import { crumbGroups, ancestorsOf, groupAncestors, groupOf, softTreeVersion, subscribeSoftTree } from "../content/groups";
import { regionInfo } from "../regions/index";
import { focusRegion, goBack, isolateGroup, leaveRegion, selectObject } from "../state/selection";
import { useViewer } from "../state/store";
import { focusCanvas } from "./canvasFocus";
import { usePanelModel } from "./usePanelModel";

/**
 * Breadcrumb (spec §7): `Skeleton › Lower limb › Femur`, top left (one line on
 * a phone), shown while something is selected or a group is isolated, with the
 * tier at the end ("› Related", "› Region"). "Skeleton" goes back to the full
 * skeleton; a group level (Milestone 5) isolates that group. For a muscle
 * part (Milestone 9, spec §5.1) the muscle's crumb selects the muscle: one
 * level up at tier 0 (a Back step), a new focus from tiers 1 and 2. For an
 * attached-muscles group (spec §5.4) the bone's crumb selects the bone.
 * Inside a body region (M13 plan decision 8, spec §6.4) the region's crumb
 * comes first after "Skeleton": `Skeleton › Forearm (left) › Muscles › Flexor
 * carpi radialis`. Its crumb leaves the isolation but keeps the region, and
 * "Skeleton" leaves the region.
 */
export const TIER_CRUMBS = ["", "Related", "Region"] as const;

/** Marks the crumb that selects a part's muscle rather than isolating a group. */
const UP = "\u0000up";
/** Marks the body region's crumb (M13). */
const REGION = "\u0000region";

export function Breadcrumb() {
  const sel = useViewer((s) => s.sel);
  const tier = useViewer((s) => s.tier);
  const grp = useViewer((s) => s.grp);
  const reg = useViewer((s) => s.reg);
  const region = reg !== null ? regionInfo(reg) : undefined;
  const model = usePanelModel(sel);
  // Soft groups (M9) can be crumbs once the soft tree has loaded (it isn't fetched for this).
  useSyncExternalStore(subscribeSoftTree, softTreeVersion);
  let up: string | null = null;
  let trail: string[];
  let links: (string | null)[];
  if (sel !== null) {
    if (!model) return null;
    trail = tier > 0 ? [...model.trail, TIER_CRUMBS[tier]] : model.trail;
    up = model.partOf?.id ?? null;
    const groups = crumbGroups(trail, ancestorsOf(sel));
    links = trail.map((_, i) => (i === model.parentCrumb ? UP : groups[i]!));
  } else if (grp !== null) {
    const g = groupOf(grp);
    if (!g) return null;
    trail = g.trail;
    links = crumbGroups(trail, groupAncestors(grp));
    // "Show attached muscles" (M9): the bone's crumb selects the bone.
    if (g.attached) {
      up = g.attached.bone;
      links[trail.length - 2] = UP;
    }
  } else if (region) {
    trail = [];
    links = [];
  } else return null;
  if (region) {
    trail = [region.name, ...trail];
    links = [trail.length > 1 ? REGION : null, ...links];
  }
  const last = trail.length - 1;
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb" data-testid="breadcrumb">
      <ol>
        <li>
          <button
            type="button"
            className="crumb-link"
            onClick={() => {
              if (region) leaveRegion();
              else goBack();
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
              {i !== last && key === REGION ? (
                <button
                  type="button"
                  className="crumb-link"
                  data-region={reg ?? undefined}
                  onClick={() => {
                    if (reg !== null) focusRegion(reg);
                    focusCanvas();
                  }}
                >
                  {label}
                </button>
              ) : i !== last && key === UP ? (
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
                <button type="button" className="crumb-link" data-group={key} onClick={() => void isolateGroup(key)}>
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
