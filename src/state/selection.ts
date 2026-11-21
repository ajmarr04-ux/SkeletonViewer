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
import { attachedBoneOf, attachedKey, isGroupKey } from "../content/groups";
import { loadSoftContent } from "../content/softContentLoader";
import { displayName } from "../content/names";
import { hideTargets, isSoftId, softEntry, softLayerOf } from "../content/softRegistry";
import { loadSoftIds } from "../content/loadSoftIds";
import { hasSoftTier2, softTiersLoaded } from "../content/softRelations";
import { useLayerBatches } from "../scene/layerRegistry";
import { FULL_SKELETON, isolationStep, resolveClick, type HistoryStep, type Isolation, type IsolationAction, type ParentOf } from "./isolation";
import { COLOUR_MODE_KEY, type ColourMode } from "../scene/regionColours";
import { LAYERS_KEY, storedFlag, useViewer } from "./store";
import {
  DEFAULT_LAYER_SETTING,
  formatLayers,
  isDefaultLayers,
  isUserLayersValue,
  LAYERS,
  HIDDEN_URL_CAP,
  TISSUE_LAYERS,
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

/** A bone or tooth, or (once its table is loaded) a soft-tissue structure. */
export const isKnownId = (id: string): boolean => KNOWN.has(id) || isSoftId(id);
/** False for the four wisdom teeth, the parent muscles and the structures the source lacks. */
export const hasMesh = (id: string): boolean => WITH_MESH.has(id) || softEntry(id)?.mesh === true;
/** The layer an object is drawn in: bones (and teeth), or its soft-tissue layer; null if unknown. */
export const layerOfId = (id: string): Layer | null => (KNOWN.has(id) ? "bones" : softLayerOf(id));
/** A muscle part's muscle (spec §5.1), else null. */
export const parentOf: ParentOf = (id) => softEntry(id)?.parent ?? null;
/** The structures drawn for a selection: itself if it has a mesh, else its parts that do (a muscle with parts). */
export function drawnIds(id: string): string[] {
  if (hasMesh(id)) return [id];
  return (softEntry(id)?.parts ?? []).filter(hasMesh);
}
/** Something is drawn for this selection (a mesh of its own or of its parts). */
export const isDrawn = (id: string): boolean => drawnIds(id).length > 0;

type HistoryMark = { skvDepth?: number };
const depthNow = (): number => ((window.history.state as HistoryMark | null)?.skvDepth ?? 0);

function urlWith(state: Partial<UrlState>): string {
  return `${window.location.pathname}${serialiseUrlState(state, window.location.search)}${window.location.hash}`;
}

/** Apply an isolation action: store, URL and history, and move the pivot to a newly selected bone. */
export function dispatchIsolation(action: IsolationAction): void {
  const st = useViewer.getState();
  const { state, history, via } = isolationStep({ sel: st.sel, tier: st.tier, grp: st.grp }, action, parentOf);
  if (history === "none") return;
  if (history === "pop" && depthNow() > 0) {
    window.history.back(); // `popstate` applies the previous entry
    return;
  }
  st.setIsolation(state);
  const write = (step: HistoryStep, s: Isolation) => {
    const url = urlWith({ sel: s.sel, tier: s.tier, grp: s.grp, ant: false });
    if (step === "push") window.history.pushState({ ...window.history.state, skvDepth: depthNow() + 1 }, "", url);
    else window.history.replaceState(window.history.state, "", url);
  };
  if (via) {
    // A part chosen from elsewhere: its muscle's entry first, then the part's (plan decision 2).
    write(history, via);
    write("push", state);
  } else write(history, state);
  if (state.sel !== null && state.sel !== st.sel && isDrawn(state.sel)) st.requestCamera({ kind: "repivot", id: state.sel });
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
  if (!isKnownId(id)) return;
  showLayerOf(id);
  dispatchIsolation({ type: "select", id });
};

/**
 * A click, tap or Enter on the Tab cursor (spec §5.1): a part of a muscle
 * selects the whole muscle first, and the part on a second click.
 */
export const clickObject = (id: string): void => selectObject(resolveClick(id, useViewer.getState().sel, parentOf));

/** A soft-tissue structure is selected with its layer showing: an Off layer is turned On (plan decision 12). */
function showLayerOf(id: string): void {
  const layer = layerOfId(id);
  if (layer && layer !== "bones" && useViewer.getState().layers[layer] === "off") setLayerMode(layer, "on");
}
export const goBack = (): void => dispatchIsolation({ type: "back" });
/** Isolate a whole group from the tree or the legend (plan decision 5). */
export const isolateGroup = (key: string): void => {
  if (isGroupKey(key)) dispatchIsolation({ type: "group", key });
};
/**
 * A link to a soft-tissue structure from a bone's panel (M9 plan decision 9):
 * the soft-tissue table may not be loaded yet (every new layer off), so load
 * it first, then select (turning the structure's layer on, as any selection does).
 */
export async function selectLink(id: string): Promise<void> {
  if (!isKnownId(id)) await loadSoftIds();
  selectObject(id);
}

/**
 * "Show attached muscles" (spec §5.4; M9 plan decision 10): isolate the bone
 * and every muscle and part with an attachment on it, as the group
 * `attached:<bone>`. An explicit request for muscles, so an Off muscles layer
 * is turned On (as selecting a muscle does). Framed once the muscles are on
 * screen (their content and model load with the layer).
 */
export function isolateAttached(bone: string): void {
  const key = attachedKey(bone);
  if (!isGroupKey(key)) return;
  showMusclesFor(key);
  dispatchIsolation({ type: "group", key });
  void frameWhenMusclesReady(key);
}

/** An attached-muscles group needs the muscles layer showing: an Off layer is turned On (link, Back/Forward). */
function showMusclesFor(grp: string | null): void {
  if (grp === null || attachedBoneOf(grp) === null) return;
  if (useViewer.getState().layers.muscles === "off") setLayerMode("muscles", "on");
}

async function frameWhenMusclesReady(key: string): Promise<void> {
  try {
    await loadSoftContent("muscles");
  } catch {
    return;
  }
  await new Promise<void>((resolve) => {
    if (useLayerBatches.getState().muscles) return resolve();
    const off = useLayerBatches.subscribe((b) => {
      if (!b.muscles) return;
      off();
      resolve();
    });
  });
  if (useViewer.getState().grp === key) frameSoon();
}

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
  if (isDrawn(id)) frameSoon();
}
/** Why "Show related" / "Expand" wait for a soft structure's content chunk (M9 plan decision 4). */
export const LOADING_CONTENT_REASON = "Loading content…";
/** Why a ligament or cartilage with no joint has no tier 2 (M9 plan decision 4). */
export const NO_JOINT_REASON = "Not part of a joint";

/**
 * Why the selection can't go to a tier, or null if it can (M9 plan decisions
 * 4 and 5). Bones always can (M8); a soft structure once its layer's content
 * has loaded, and tier 2 only if it has one.
 */
export function tierBlockedReason(id: string | null, tier: 1 | 2): string | null {
  if (id === null || KNOWN.has(id) || !isSoftId(id)) return null;
  if (!softTiersLoaded(id)) return LOADING_CONTENT_REASON;
  if (tier === 2 && !hasSoftTier2(id)) return NO_JOINT_REASON;
  return null;
}

/** A muscle or muscle part: its tiers are "Show attachments" and "Show functional group" (M9 plan decision 5). */
export const isMuscleKind = (id: string): boolean => softLayerOf(id) === "muscles";

/** Can the antagonist toggle be used now? Only at a muscle's or part's tier 2 (M9 plan decision 7). */
export const antagonistsAvailable = (st: { sel: string | null; tier: number }): boolean => st.tier === 2 && st.sel !== null && isMuscleKind(st.sel);

/** "Show antagonists" on or off: store and URL (`ant=1`), no new history entry. */
export function setAntagonists(on: boolean): void {
  const st = useViewer.getState();
  if (on && !antagonistsAvailable(st)) return;
  if (st.antagonists === on) return;
  st.setAntagonists(on);
  window.history.replaceState(window.history.state, "", urlWith({ ant: on }));
}

/** Tier 1 (spec §6 "Show related"; for a muscle "Show attachments"). */
export const showRelated = (): void => {
  if (tierBlockedReason(useViewer.getState().sel, 1) === null) dispatchIsolation({ type: "related" });
};
/** Tier 2 (spec §6 "Expand region"; for a muscle "Show functional group"). */
export const expandRegion = (): void => {
  if (tierBlockedReason(useViewer.getState().sel, 2) === null) dispatchIsolation({ type: "region" });
};

/**
 * Hide the selected structure (spec §5.5, plan decision 13): the panel's Hide
 * button and the `X` key. A muscle with parts hides all its parts. The
 * selection is cleared (for a leaf at tier 0 that is the step Esc takes), and
 * hiding and clearing are one new history entry, so browser Back brings the
 * structure back, selected. The URL keeps the first 100 hidden IDs.
 */
export function hideSelected(): void {
  const st = useViewer.getState();
  const id = st.sel;
  if (id === null || !isDrawn(id)) return;
  const hidden = new Set(st.hidden);
  for (const t of hideTargets(id)) hidden.add(t);
  const all = [...hidden];
  st.setHidden(all);
  st.setIsolation(FULL_SKELETON);
  const url = urlWith({ sel: null, tier: 0, grp: null, hid: all.slice(0, HIDDEN_URL_CAP) });
  window.history.pushState({ ...window.history.state, skvDepth: depthNow() + 1 }, "", url);
  if (all.length > HIDDEN_URL_CAP) st.showToast(`Only the first ${HIDDEN_URL_CAP} hidden structures are kept in the link`);
  st.say(`${displayName(id)} hidden. ${all.length} hidden.`);
}

/** Show every hidden structure again (the toolbar chip): one `replace`, not a history step. */
export function showAllHidden(): void {
  const st = useViewer.getState();
  if (st.hidden.size === 0) return;
  st.setHidden([]);
  window.history.replaceState(window.history.state, "", urlWith({ hid: [] }));
  st.say("All hidden structures shown.");
}
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
  // Explode is bones only and off while a soft-tissue layer shows (plan decision 14).
  if (TISSUE_LAYERS.some((l) => next.layers[l] !== "off")) st.setExplode(0);
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
  st.setIsolation({ sel: url.sel, tier: url.tier, grp: url.grp, ant: url.ant });
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
  if (url.grp !== null && attachedBoneOf(url.grp) !== null) {
    showMusclesFor(url.grp);
    if (url.cam === null) void frameWhenMusclesReady(url.grp);
  }
  const over = parseHidden(new URLSearchParams(window.location.search).get("hid")).dropped;
  if (over > 0) st.showToast(`Only the first ${url.hid.length} hidden structures are kept in the link`);
  const rawSel = new URLSearchParams(window.location.search).get("sel");
  if (url.sel === null && rawSel !== null && /^[a-z0-9_]+$/.test(rawSel)) void selectSoftFromUrl(rawSel, url.cam !== null);
  return url;
}

/**
 * `sel=` naming a soft-tissue structure (plan decision 12): load the table; if
 * the ID is real, turn its layer on (if Off) and select it once that layer is
 * on screen, at the link's tier (M9; with `ant=1` at a muscle's tier 2), framed unless the link carries a camera. An unknown ID
 * is dropped from the URL, as for bones.
 */
export async function selectSoftFromUrl(id: string, hasCam: boolean): Promise<void> {
  await loadSoftIds();
  const st = useViewer.getState();
  if (!isSoftId(id) || st.sel !== null) {
    if (!isSoftId(id)) window.history.replaceState(window.history.state, "", urlWith({ sel: st.sel }));
    return;
  }
  const layer = softLayerOf(id)!;
  showLayerOf(id);
  if (isDrawn(id)) await new Promise<void>((resolve) => {
    if (useLayerBatches.getState()[layer]) return resolve();
    const off = useLayerBatches.subscribe((b) => {
      if (!b[layer]) return;
      off();
      resolve();
    });
  });
  const now = useViewer.getState();
  if (now.sel !== null) return; // the user selected something meanwhile
  // The link's tier and `ant=1` (M9: soft structures have tiers now; the sets appear when the content chunk loads).
  const q = new URLSearchParams(window.location.search);
  const t = Number(q.get("tier"));
  const tier = t === 1 || t === 2 ? t : 0;
  const ant = tier === 2 && q.get("ant") === "1" && isMuscleKind(id);
  now.setIsolation({ sel: id, tier, ant });
  window.history.replaceState(window.history.state, "", urlWith({ sel: id, tier, grp: null, ant }));
  if (isDrawn(id)) {
    if (hasCam) now.requestCamera({ kind: "repivot", id });
    else frameSoon();
  }
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
  const isolationChanged =
    url.sel !== st.sel || url.tier !== st.tier || url.grp !== st.grp || url.ghost !== st.ghostMode || url.ant !== st.antagonists;
  if (!isolationChanged) {
    st.requestCamera({ kind: "goto", cam: url.cam });
    return;
  }
  const newSel = url.sel !== st.sel ? url.sel : null;
  st.setIsolation({ sel: url.sel, tier: url.tier, grp: url.grp, ant: url.ant });
  st.setGhostMode(url.ghost);
  showMusclesFor(url.grp);
  if (st.camera) window.history.replaceState(window.history.state, "", urlWith({ cam: st.camera }));
  if (newSel !== null && isDrawn(newSel)) st.requestCamera({ kind: "repivot", id: newSel });
}

/** Start listening to Back / Forward. Returns an unsubscribe function. */
export function watchHistory(): () => void {
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}
