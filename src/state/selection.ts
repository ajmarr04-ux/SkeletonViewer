// Selection and isolation, wired to the store and the browser history
// (spec §6 and §7 "URL state"). The rules themselves are the pure reducer in
// `isolation.ts`; this module only applies them.
//
// History: a new isolation level is a new entry (pushState), so the browser's
// Back button steps back one level. Entries the app pushed carry
// `{ skvDepth: n }` in history.state. Stepping back (Esc, empty click, the
// panel's Back) calls history.back() when the current entry was pushed by the
// app, so the history stays in step; on an entry the page was loaded with,
// it replaces the entry instead (history.back() would leave the site).

import ids from "../../content/ids.json";
import { isGroupKey } from "../content/groups";
import { isolationStep, type IsolationAction } from "./isolation";
import { COLOUR_MODE_KEY, type ColourMode } from "../scene/regionColours";
import { LAYERS_KEY, storedFlag, useViewer } from "./store";
import {
  DEFAULT_LAYER_SETTING,
  formatLayers,
  isDefaultLayers,
  isUserLayersValue,
  LAYERS,
  parseHidden,
  parseLayers,
  parseUrlState,
  serialiseUrlState,
  type GhostMode,
  type Layer,
  type LayerMode,
  type LayerSetting,
  type MuscleDepth,
  type UrlState,
} from "./url";

type IdEntry = { id: string; meshAvailable: boolean };
const ENTRIES = ids as IdEntry[];
const KNOWN = new Set(ENTRIES.map((e) => e.id));
const WITH_MESH = new Set(ENTRIES.filter((e) => e.meshAvailable).map((e) => e.id));

export const isKnownId = (id: string): boolean => KNOWN.has(id);
/** False for the four wisdom teeth, which have no mesh in the source. */
export const hasMesh = (id: string): boolean => WITH_MESH.has(id);

type HistoryMark = { skvDepth?: number };
const depthNow = (): number => ((window.history.state as HistoryMark | null)?.skvDepth ?? 0);

function urlWith(state: Partial<UrlState>): string {
  return `${window.location.pathname}${serialiseUrlState(state, window.location.search)}${window.location.hash}`;
}

/** Apply an isolation action: store, URL and history, and move the pivot to a newly selected bone. */
export function dispatchIsolation(action: IsolationAction): void {
  const st = useViewer.getState();
  const { state, history } = isolationStep({ sel: st.sel, tier: st.tier, grp: st.grp }, action);
  if (history === "none") return;
  if (history === "pop" && depthNow() > 0) {
    window.history.back(); // `popstate` applies the previous entry
    return;
  }
  st.setIsolation(state);
  const url = urlWith({ sel: state.sel, tier: state.tier, grp: state.grp });
  if (history === "push") window.history.pushState({ ...window.history.state, skvDepth: depthNow() + 1 }, "", url);
  else window.history.replaceState(window.history.state, "", url);
  if (state.sel !== null && state.sel !== st.sel && hasMesh(state.sel)) st.requestCamera({ kind: "repivot", id: state.sel });
  // A group is framed when it is isolated: it may be small or off screen (the ossicles, a quadrant's molars).
  if (state.grp !== null && state.grp !== st.grp) frameSoon();
}

/**
 * Frame the isolation once the panel that opens with it has laid out and
 * reported the area it covers, so the bones end up beside it.
 */
function frameSoon(): void {
  requestAnimationFrame(() => requestAnimationFrame(() => useViewer.getState().requestCamera({ kind: "frame" })));
}

export const selectObject = (id: string): void => {
  if (isKnownId(id)) dispatchIsolation({ type: "select", id });
};
export const goBack = (): void => dispatchIsolation({ type: "back" });
/** Isolate a whole group from the tree or the legend (plan decision 5). */
export const isolateGroup = (key: string): void => {
  if (isGroupKey(key)) dispatchIsolation({ type: "group", key });
};
/**
 * Choose a search result (plan decision 3): select at tier 0 and frame it,
 * as `F` would after a click. The one place where a selection moves the camera.
 */
export function selectAndFrame(id: string): void {
  if (!isKnownId(id)) return;
  const st = useViewer.getState();
  if (st.sel !== id || st.tier !== 0) {
    if (st.sel === id) {
      // Already the focus at a higher tier: step down to tier 0 in place.
      st.setIsolation({ sel: id, tier: 0 });
      window.history.replaceState(window.history.state, "", urlWith({ sel: id, tier: 0, grp: null }));
    } else dispatchIsolation({ type: "select", id });
  }
  if (hasMesh(id)) frameSoon();
}
/** Tier 1 (spec §6 "Show related"). */
export const showRelated = (): void => dispatchIsolation({ type: "related" });
/** Tier 2 (spec §6 "Expand region"). */
export const expandRegion = (): void => dispatchIsolation({ type: "region" });
/** The other side of a pair, keeping the tier (plan decision 8). */
export const switchSide = (id: string): void => {
  if (isKnownId(id)) dispatchIsolation({ type: "switchSide", id });
};

/** Ghost or hide (spec §6 toggle): store and URL (`ghost=0` for hide), no new history entry. */
export function setGhostMode(mode: GhostMode): void {
  const st = useViewer.getState();
  if (st.ghostMode === mode) return;
  st.setGhostMode(mode);
  window.history.replaceState(window.history.state, "", urlWith({ ghost: mode }));
}

/**
 * Colour-by-region on or off (plan decision 8): store, localStorage and the URL
 * (`color=region`, no new history entry), so a share link shows the same colours.
 */
export function setColourMode(mode: ColourMode): void {
  const st = useViewer.getState();
  try {
    if (mode === "region") window.localStorage.setItem(COLOUR_MODE_KEY, "1");
    else window.localStorage.removeItem(COLOUR_MODE_KEY);
  } catch {
    // Storage disabled: the URL still carries it.
  }
  if (st.colourMode === mode) return;
  st.setColourMode(mode);
  window.history.replaceState(window.history.state, "", urlWith({ color: mode === "region" ? "region" : null }));
}

/** The layer setting in the store. */
function currentLayers(): LayerSetting {
  const st = useViewer.getState();
  return { layers: st.layers, depth: st.muscleDepth };
}

function storeLayers(setting: LayerSetting): void {
  try {
    if (isDefaultLayers(setting)) window.localStorage.removeItem(LAYERS_KEY);
    else window.localStorage.setItem(LAYERS_KEY, formatLayers(setting));
  } catch {
    // Storage disabled: the URL still carries it.
  }
}

/** The stored layer setting, if any (M7 plan decision 1). */
function storedLayers(): LayerSetting | null {
  try {
    return parseLayers(window.localStorage.getItem(LAYERS_KEY));
  } catch {
    return null;
  }
}

/**
 * Change the layers (M7 plan decision 1): store, localStorage and the URL
 * (`layers=b:on,…`, no new history entry). Ignored while M6's debug layer
 * view is on (plan decision 2).
 */
export function setLayerSetting(next: LayerSetting): void {
  const st = useViewer.getState();
  if (st.debugLayersView) return;
  storeLayers(next);
  const prev = currentLayers();
  if (formatLayers(prev) === formatLayers(next)) return;
  st.setLayerSetting(next.layers, next.depth);
  window.history.replaceState(window.history.state, "", urlWith({ layers: next }));
}

export function setLayerMode(layer: Layer, mode: LayerMode): void {
  const cur = currentLayers();
  setLayerSetting({ ...cur, layers: { ...cur.layers, [layer]: mode } });
}

export function setMuscleDepth(depth: MuscleDepth): void {
  setLayerSetting({ ...currentLayers(), depth });
}

/** The two presets above the toggles (spec §6.1). */
export type LayerPreset = "skeleton" | "full";
export function applyLayerPreset(preset: LayerPreset): void {
  const cur = currentLayers();
  if (preset === "skeleton") setLayerSetting({ ...cur, layers: { ...DEFAULT_LAYER_SETTING.layers } });
  else setLayerSetting({ layers: Object.fromEntries(LAYERS.map((l) => [l, "on"])) as LayerSetting["layers"], depth: 0 });
}

/** Which preset the layers match, if any. */
export function presetOf(layers: LayerSetting["layers"]): LayerPreset | null {
  if (LAYERS.every((l) => layers[l] === DEFAULT_LAYER_SETTING.layers[l])) return "skeleton";
  if (LAYERS.every((l) => layers[l] === "on")) return "full";
  return null;
}

/**
 * Read the selection from the URL at start-up. Colour-by-region comes from the
 * URL when it says `color=region`, else from the stored preference (which is
 * then written to the URL, so the address always shows what is on screen).
 */
export function initSelectionFromUrl(): UrlState {
  const url = parseUrlState(window.location.search, isKnownId, isGroupKey);
  const st = useViewer.getState();
  st.setIsolation({ sel: url.sel, tier: url.tier, grp: url.grp });
  st.setGhostMode(url.ghost);
  const colour: ColourMode = url.color === "region" || storedFlag(COLOUR_MODE_KEY) ? "region" : "bone";
  st.setColourMode(colour);
  if (colour === "region" && url.color !== "region") {
    window.history.replaceState(window.history.state, "", urlWith({ color: "region" }));
  }
  // Layers (M7 plan decision 1): the URL, else the stored setting (then written to the URL), else the default.
  // M6's debug format (`?debug&layers=all`) keeps the real layers at their default (plan decision 2).
  const rawLayers = new URLSearchParams(window.location.search).get("layers");
  const debugView = rawLayers !== null && !isUserLayersValue(rawLayers) && new URLSearchParams(window.location.search).has("debug");
  st.setDebugLayersView(debugView);
  const layers = debugView ? DEFAULT_LAYER_SETTING : (url.layers ?? storedLayers() ?? DEFAULT_LAYER_SETTING);
  st.setLayerSetting(layers.layers, layers.depth);
  if (!debugView && url.layers === null && !isDefaultLayers(layers)) {
    window.history.replaceState(window.history.state, "", urlWith({ layers }));
  }
  st.setHidden(url.hid);
  const over = parseHidden(new URLSearchParams(window.location.search).get("hid")).dropped;
  if (over > 0) st.showToast(`Only the first ${url.hid.length} hidden structures are kept in the link`);
  return url;
}

/**
 * Browser Back / Forward. When the isolation changes, only the isolation
 * follows the URL: the camera stays where it is (moving it back as well would
 * jump the view), and the entry's `cam` is updated to match. When only the
 * camera differs, the camera follows.
 */
export function onPopState(): void {
  const url = parseUrlState(window.location.search, isKnownId, isGroupKey);
  const st = useViewer.getState();
  // Colour-by-region isn't history: an older entry keeps today's colours, and its URL is brought up to date.
  const colour = st.colourMode === "region" ? "region" : null;
  if (url.color !== colour) window.history.replaceState(window.history.state, "", urlWith({ color: colour }));
  // Nor are the layers (plan decision 1): the entry's `layers=` is brought up to date too.
  if (!st.debugLayersView) {
    const layers = currentLayers();
    const want = isDefaultLayers(layers) ? null : formatLayers(layers);
    const have = url.layers && !isDefaultLayers(url.layers) ? formatLayers(url.layers) : null;
    if (want !== have) window.history.replaceState(window.history.state, "", urlWith({ layers }));
  }
  // Hidden structures belong to the history entry (spec §5.5: Back un-hides).
  st.setHidden(url.hid);
  const isolationChanged = url.sel !== st.sel || url.tier !== st.tier || url.grp !== st.grp || url.ghost !== st.ghostMode;
  if (!isolationChanged) {
    st.requestCamera({ kind: "goto", cam: url.cam });
    return;
  }
  const newSel = url.sel !== st.sel ? url.sel : null;
  st.setIsolation({ sel: url.sel, tier: url.tier, grp: url.grp });
  st.setGhostMode(url.ghost);
  if (st.camera) window.history.replaceState(window.history.state, "", urlWith({ cam: st.camera }));
  if (newSel !== null && hasMesh(newSel)) st.requestCamera({ kind: "repivot", id: newSel });
}

/** Start listening to Back / Forward. Returns an unsubscribe function. */
export function watchHistory(): () => void {
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}
