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

import { attachedBoneOf, attachedKey, groupLayer, isGroupKey } from "../content/groups";
import { looksLikeSoftGroup } from "../content/softTree";
import { loadSoftTree } from "../content/softTreeLoader";
import { loadSoftContent } from "../content/softContentLoader";
import { ALL_SHOWN_ANNOUNCEMENT, hiddenAnnouncement } from "../content/announce";
import { hideTargets, isSoftId, softEntry, softLayerOf } from "../content/softRegistry";
import { hasMesh, isEagerId, isKnownId, layerOfId } from "../content/index";
import { hasSoftTier2, softTiersLoaded } from "../content/softRelations";
import { useLayerBatches } from "../scene/layerRegistry";
import { FULL_SKELETON, isolationStep, resolveClick, type HistoryStep, type Isolation, type IsolationAction, type ParentOf } from "./isolation";
import { COLOUR_MODE_KEY, type ColourMode } from "../scene/regionColours";
import { LAYERS_KEY, storedFlag, useViewer } from "./store";
import { DEFAULT_LAYER_SETTING, formatLayers, isDefaultLayers, isUserLayersValue, HIDDEN_URL_CAP, parseHidden, parseLayers, parseUrlState, serialiseUrlState, type GhostMode, type Layer, type LayerMode, type LayerSetting, type MuscleDepth, type UrlState } from "./url";
import { EAGER_LAYER, isLazyLayer, LAZY_LAYERS, layersOfSystem, NESTED_LAYER, presetDescriptor, presetModes, type LazyLayerId, type PresetId, type SystemId } from "../systems/registry";

export { hasMesh, isKnownId, layerOfId };
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
  if (layer && isLazyLayer(layer) && useViewer.getState().layers[layer] === "off") setLayerMode(layer, "on");
}
export const goBack = (): void => dispatchIsolation({ type: "back" });
/**
 * Isolate a whole group from the tree, the legend or a search result (plan
 * decision 5). A soft-tissue group (M9 plan decision 11) turns its layer On if
 * it is Off, as selecting a structure does, and is framed once that layer is
 * on screen. A soft group key not yet known loads the soft tree first.
 */
export async function isolateGroup(key: string): Promise<void> {
  if (!isGroupKey(key) && looksLikeSoftGroup(key)) await loadSoftTree();
  if (!isGroupKey(key)) return;
  const layer = groupLayer(key);
  if (layer !== null && attachedBoneOf(key) === null) {
    showLayerForGroup(key);
    dispatchIsolation({ type: "group", key });
    void frameWhenLayerShown(layer, key);
    return;
  }
  dispatchIsolation({ type: "group", key });
}
/**
 * A link to a soft-tissue structure from a bone's panel (M9 plan decision 9):
 * select it, turning the structure's layer on, as any selection does.
 */
export async function selectLink(id: string): Promise<void> {
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
  showLayerForGroup(key);
  dispatchIsolation({ type: "group", key });
  void frameWhenMusclesReady(key);
}

/**
 * A group whose members are soft tissue needs their layer showing: an Off layer
 * is turned On (the muscles for an attached-muscles group; a soft group's own
 * layer). Used by the actions, URL links and Back/Forward.
 */
function showLayerForGroup(grp: string | null): void {
  const layer = grp === null ? null : groupLayer(grp);
  if (layer !== null && useViewer.getState().layers[layer] === "off") setLayerMode(layer, "on");
}

/** Resolves once a layer's batch is on screen. */
function whenLayerShown(layer: LazyLayerId): Promise<void> {
  return new Promise<void>((resolve) => {
    if (useLayerBatches.getState()[layer]) return resolve();
    const off = useLayerBatches.subscribe((b) => {
      if (!b[layer]) return;
      off();
      resolve();
    });
  });
}

async function frameWhenLayerShown(layer: LazyLayerId, key: string): Promise<void> {
  await whenLayerShown(layer);
  if (useViewer.getState().grp === key) frameSoon();
}

async function frameWhenMusclesReady(key: string): Promise<void> {
  try {
    await loadSoftContent(NESTED_LAYER);
  } catch {
    return;
  }
  await frameWhenLayerShown(NESTED_LAYER, key);
}

/**
 * Choose a search result (plan decision 3): select at tier 0 and frame it,
 * as `F` would after a click. The one place where a selection moves the camera.
 */
export async function selectAndFrame(id: string): Promise<void> {
  // A soft-tissue result (M9 plan decision 12): turn the layer on, frame once it shows.
  if (!isKnownId(id)) return;
  showLayerOf(id);
  const layer = layerOfId(id);
  const st = useViewer.getState();
  if (st.sel !== id || st.tier !== 0) {
    if (st.sel === id) {
      // Already the focus at a higher tier: step down to tier 0 in place.
      st.setIsolation({ sel: id, tier: 0 });
      window.history.replaceState(window.history.state, "", urlWith({ sel: id, tier: 0, grp: null }));
    } else dispatchIsolation({ type: "select", id });
  }
  if (!isDrawn(id)) return;
  if (layer !== null && isLazyLayer(layer)) await whenLayerShown(layer);
  if (useViewer.getState().sel === id) frameSoon();
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
  if (id === null || isEagerId(id) || !isSoftId(id)) return null;
  if (!softTiersLoaded(id)) return LOADING_CONTENT_REASON;
  if (tier === 2 && !hasSoftTier2(id)) return NO_JOINT_REASON;
  return null;
}

/** A muscle or muscle part (the layer with parts): its tiers are "Show attachments" and "Show functional group" (M9 plan decision 5). */
export const isMuscleKind = (id: string): boolean => softLayerOf(id) === NESTED_LAYER;

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
  const id = useViewer.getState().sel;
  if (id !== null) hideStructure(id);
}

/**
 * Hide one structure (M10 plan decision 5: `X` on the Tab cursor). The
 * selection itself is hidden as `hideSelected` says; anything else is hidden
 * with the selection kept, as one new history entry too (Back un-hides it).
 */
export function hideStructure(id: string): void {
  const st = useViewer.getState();
  if (!isDrawn(id)) return;
  const hidden = new Set(st.hidden);
  for (const t of hideTargets(id)) hidden.add(t);
  const all = [...hidden];
  const selected = st.sel === id;
  st.setHidden(all);
  if (selected) st.setIsolation(FULL_SKELETON);
  const url = selected ? urlWith({ sel: null, tier: 0, grp: null, hid: all.slice(0, HIDDEN_URL_CAP) }) : urlWith({ hid: all.slice(0, HIDDEN_URL_CAP) });
  window.history.pushState({ ...window.history.state, skvDepth: depthNow() + 1 }, "", url);
  if (all.length > HIDDEN_URL_CAP) st.showToast(`Only the first ${HIDDEN_URL_CAP} hidden structures are kept in the link`);
  st.say(hiddenAnnouncement(id, all.length));
}

/** Show every hidden structure again (the toolbar chip): one `replace`, not a history step. */
export function showAllHidden(): void {
  const st = useViewer.getState();
  if (st.hidden.size === 0) return;
  st.setHidden([]);
  window.history.replaceState(window.history.state, "", urlWith({ hid: [] }));
  st.say(ALL_SHOWN_ANNOUNCEMENT);
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
 * view is on (plan decision 2). `via`: the system whose group control made
 * the change (announced as one group change, M11 plan decision 5).
 */
export function setLayerSetting(next: LayerSetting, via: SystemId | null = null): void {
  const st = useViewer.getState();
  if (st.debugLayersView) return;
  storeLayers(next);
  const prev = currentLayers();
  if (formatLayers(prev) === formatLayers(next)) return;
  st.setLayerSetting(next.layers, next.depth, via);
  // Explode is bones only and off while a soft-tissue layer shows (plan decision 14).
  if (LAZY_LAYERS.some((l) => next.layers[l] !== "off")) st.setExplode(0);
  window.history.replaceState(window.history.state, "", urlWith({ layers: next }));
}

export function setLayerMode(layer: Layer, mode: LayerMode): void {
  const cur = currentLayers();
  setLayerSetting({ ...cur, layers: { ...cur.layers, [layer]: mode } });
}

export function setMuscleDepth(depth: MuscleDepth): void {
  setLayerSetting({ ...currentLayers(), depth });
}

/**
 * A system's group control (M11 plan decision 5): every layer of the system
 * in one mode, as one change (one URL update, one announcement). The depth is kept.
 */
export function setSystemMode(system: SystemId, mode: LayerMode): void {
  const cur = currentLayers();
  const layers = { ...cur.layers };
  for (const l of layersOfSystem(system)) layers[l] = mode;
  setLayerSetting({ ...cur, layers }, system);
}

/** A preset above the groups (spec §6.1; from the registry since M11). */
export function applyLayerPreset(preset: PresetId): void {
  const cur = currentLayers();
  const depth = presetDescriptor(preset).depth;
  setLayerSetting({ layers: presetModes(preset), depth: depth === undefined ? cur.depth : (depth as MuscleDepth) });
}

/**
 * Read the selection from the URL at start-up. Colour-by-region comes from the
 * URL when it says `color=region`, else from the stored preference (which is
 * then written to the URL, so the address always shows what is on screen).
 */
export function initSelectionFromUrl(): UrlState {
  // A soft-tissue `sel=` is known at once (the ID index, M12 decision 7) but still
  // goes through `selectSoftFromUrl`, which turns its layer on and waits for it.
  const url = parseUrlState(window.location.search, isEagerId, isGroupKey);
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
    showLayerForGroup(url.grp);
    if (url.cam === null) void frameWhenMusclesReady(url.grp);
  }
  const rawGrp = new URLSearchParams(window.location.search).get("grp");
  if (url.sel === null && url.grp === null && rawGrp !== null && looksLikeSoftGroup(rawGrp)) void softGroupFromUrl(rawGrp, url.cam !== null);
  const over = parseHidden(new URLSearchParams(window.location.search).get("hid")).dropped;
  if (over > 0) st.showToast(`Only the first ${url.hid.length} hidden structures are kept in the link`);
  const rawSel = new URLSearchParams(window.location.search).get("sel");
  if (url.sel === null && rawSel !== null && /^[a-z0-9_]+$/.test(rawSel)) void selectSoftFromUrl(rawSel, url.cam !== null);
  return url;
}

/**
 * `sel=` naming a soft-tissue structure (plan decision 12): if the ID is real, turn its layer on (if Off) and select it once that layer is
 * on screen, at the link's tier (M9; with `ant=1` at a muscle's tier 2), framed unless the link carries a camera. An unknown ID
 * is dropped from the URL, as for bones.
 */
export async function selectSoftFromUrl(id: string, hasCam: boolean): Promise<void> {
  const st = useViewer.getState();
  if (!isSoftId(id) || st.sel !== null) {
    if (!isSoftId(id)) window.history.replaceState(window.history.state, "", urlWith({ sel: st.sel }));
    return;
  }
  const layer = softLayerOf(id)!;
  // Part of opening the page: not announced (M10 plan decision 4).
  st.hush();
  showLayerOf(id);
  if (isDrawn(id)) await whenLayerShown(layer);
  const now = useViewer.getState();
  if (now.sel !== null) return; // the user selected something meanwhile
  now.hush();
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
 * `grp=` naming a soft-tissue group (M9 plan decision 11): load the soft tree;
 * if the group is real, isolate it (turning its layer on if Off), framed once
 * the layer shows unless the link carries a camera. An unknown key is dropped
 * from the URL, as for bone groups.
 */
export async function softGroupFromUrl(key: string, hasCam: boolean): Promise<void> {
  await loadSoftTree();
  const st = useViewer.getState();
  if (!isGroupKey(key)) {
    if (st.sel === null && st.grp === null) window.history.replaceState(window.history.state, "", urlWith({ grp: null }));
    return;
  }
  if (st.sel !== null || st.grp !== null) return; // the user chose something meanwhile
  st.hush(); // part of opening the page: not announced
  st.setIsolation({ sel: null, tier: 0, grp: key });
  showLayerForGroup(key);
  const layer = groupLayer(key);
  if (!hasCam && layer !== null) void frameWhenLayerShown(layer, key);
}

/**
 * Browser Back / Forward. When the isolation changes, only the isolation
 * follows the URL: the camera stays where it is (moving it back as well would
 * jump the view), and the entry's `cam` is updated to match. When only the
 * camera differs, the camera follows.
 */
export function onPopState(): void {
  // An entry naming a soft group the page hasn't loaded yet: load the soft tree, then apply it.
  const rawGrp = new URLSearchParams(window.location.search).get("grp");
  if (rawGrp !== null && !isGroupKey(rawGrp) && looksLikeSoftGroup(rawGrp)) {
    const at = window.location.href;
    void loadSoftTree().then(() => {
      if (window.location.href === at && isGroupKey(rawGrp)) onPopState();
    });
    return;
  }
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
  showLayerForGroup(url.grp);
  if (st.camera) window.history.replaceState(window.history.state, "", urlWith({ cam: st.camera }));
  if (newSel !== null && isDrawn(newSel)) st.requestCamera({ kind: "repivot", id: newSel });
}

/** Start listening to Back / Forward. Returns an unsubscribe function. */
export function watchHistory(): () => void {
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}
