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
import { isolationStep, type IsolationAction } from "./isolation";
import { useViewer } from "./store";
import { parseUrlState, serialiseUrlState, type GhostMode, type UrlState } from "./url";

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
  const { state, history } = isolationStep({ sel: st.sel, tier: st.tier }, action);
  if (history === "none") return;
  if (history === "pop" && depthNow() > 0) {
    window.history.back(); // `popstate` applies the previous entry
    return;
  }
  st.setIsolation(state);
  const url = urlWith({ sel: state.sel, tier: state.tier });
  if (history === "push") window.history.pushState({ ...window.history.state, skvDepth: depthNow() + 1 }, "", url);
  else window.history.replaceState(window.history.state, "", url);
  if (state.sel !== null && state.sel !== st.sel && hasMesh(state.sel)) st.requestCamera({ kind: "repivot", id: state.sel });
}

export const selectObject = (id: string): void => {
  if (isKnownId(id)) dispatchIsolation({ type: "select", id });
};
export const goBack = (): void => dispatchIsolation({ type: "back" });

/** Ghost or hide (spec §6 toggle): store and URL (`ghost=0` for hide), no new history entry. */
export function setGhostMode(mode: GhostMode): void {
  const st = useViewer.getState();
  if (st.ghostMode === mode) return;
  st.setGhostMode(mode);
  window.history.replaceState(window.history.state, "", urlWith({ ghost: mode }));
}

/** Read the selection from the URL at start-up. */
export function initSelectionFromUrl(): UrlState {
  const url = parseUrlState(window.location.search, isKnownId);
  const st = useViewer.getState();
  st.setIsolation({ sel: url.sel, tier: url.tier });
  st.setGhostMode(url.ghost);
  return url;
}

/**
 * Browser Back / Forward. When the isolation changes, only the isolation
 * follows the URL: the camera stays where it is (moving it back as well would
 * jump the view), and the entry's `cam` is updated to match. When only the
 * camera differs, the camera follows.
 */
export function onPopState(): void {
  const url = parseUrlState(window.location.search, isKnownId);
  const st = useViewer.getState();
  const isolationChanged = url.sel !== st.sel || url.tier !== st.tier || url.ghost !== st.ghostMode;
  if (!isolationChanged) {
    st.requestCamera({ kind: "goto", cam: url.cam });
    return;
  }
  const newSel = url.sel !== st.sel ? url.sel : null;
  st.setIsolation({ sel: url.sel, tier: url.tier });
  st.setGhostMode(url.ghost);
  if (st.camera) window.history.replaceState(window.history.state, "", urlWith({ cam: st.camera }));
  if (newSel !== null && hasMesh(newSel)) st.requestCamera({ kind: "repivot", id: newSel });
}

/** Start listening to Back / Forward. Returns an unsubscribe function. */
export function watchHistory(): () => void {
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}
