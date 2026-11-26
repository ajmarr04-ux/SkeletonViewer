import { create } from "zustand";
import type { BenchResult, LayoutTimes } from "../scene/bench";
import type { Lod, LodSetting } from "../scene/lod";
import { NO_PANEL, type Box, type PanelInset, type Preset } from "../camera/math";
import type { Tier } from "./isolation";
import { DEFAULT_LAYER_SETTING, type CameraState, type GhostMode, type Layer, type LayerMode, type LayerModes, type MuscleDepth } from "./url";
import { LAZY_LAYERS, type LayerId, type LazyLayerId, type SystemId } from "../systems/registry";
import type { LodSource } from "../scene/budget";
import type { ColourMode } from "../scene/regionColours";
import type { PlacedLabel } from "../scene/labels";

/** Floating labels on or off (plan decision 7): localStorage, not the URL. */
export const LABELS_KEY = "skeleton-viewer:labels";

/**
 * A camera move asked for by the UI or the selection logic.
 * - `frame`: fit the selection (or the whole skeleton) from the current direction (`F`);
 * - `repivot`: move the orbit pivot to a bone without moving the picture (on select);
 * - `centre`: ease the bone to the middle of the view and orbit about it (double-click);
 * - `goto`: go to a pose (browser Back / Forward).
 */
/**
 * A highlight from the panel (plan step 7): an articulation's two bones, or (M9)
 * a bone and a muscle or part attached to it. `text` replaces the joint
 * announcement when given.
 */
export type JointHighlight = { a: string; b: string; name: string; text?: string };

export type CameraCommand =
  | { kind: "preset"; preset: Preset }
  | { kind: "reset" }
  /**
   * Frame the isolation beside the panels. `region` (M13 plan decision 8): a
   * body region was chosen, so the box is its volume's (`box`, from the picker)
   * joined with its drawn members, and leaving the region later restores the
   * camera from before it if the user hasn't moved it since.
   */
  | { kind: "frame"; region?: { box: Box | null } }
  | { kind: "repivot"; id: string }
  | { kind: "centre"; id: string }
  | { kind: "goto"; cam: CameraState | null };

/** Ghost opacity (spec §6 slider): default and range. Kept in localStorage, not the URL. */
export const GHOST_OPACITY = { default: 0.1, min: 0.05, max: 0.5 } as const;
export const GHOST_OPACITY_KEY = "skeleton-viewer:ghost-opacity";

/** Layers and muscle depth (M7 plan decision 1): localStorage as well as the URL. */
export const LAYERS_KEY = "skeleton-viewer:layers";
/** Which system groups of the Layers panel are expanded (M11 plan decision 5): JSON `{ "<system>": false }`, collapsed ones only. */
export const SYSTEMS_KEY = "skeleton-viewer:systems";

/** Loading state of one soft-tissue layer (M7 plan decision 3), for its row in the Layers panel. */
export type LayerLoad = {
  status: "loading" | "ready" | "error";
  /** The LOD on screen, or null before the first one arrives. */
  lod: "low" | "high" | null;
  /** The LOD being fetched, or null when nothing is. */
  fetching: "low" | "high" | null;
  /** Bytes received and expected for the file being fetched. */
  received: number;
  total: number;
  error: string | null;
  /** Grows by one on each Retry after an error, so the loader tries again. */
  attempt: number;
  /** `performance.now()` when a LOD of this layer was first drawn, by LOD (perf measurements). */
  shownAt: Partial<Record<"low" | "high", number>>;
};

/**
 * App state (spec §2: zustand, mirrored to the URL): the camera, the LOD, the
 * reduced-motion preference, and (Milestone 3) selection, tier, ghost mode
 * and hover.
 */
export type ViewerState = {
  /** Last camera pose at rest. Written by the camera rig, never per frame. */
  camera: CameraState | null;
  /** The user's model-detail setting (stored in localStorage). */
  lodSetting: LodSetting;
  /** The LOD currently on screen. */
  lodActive: Lod | null;
  reducedMotion: boolean;
  /** Latest camera command; `seq` grows by one each time, so repeats are seen. */
  cameraRequest: { command: CameraCommand; seq: number } | null;
  /** Selected object (stable ID), or null for the full skeleton. May be a tooth with no mesh. */
  sel: string | null;
  tier: Tier;
  /** Isolated group (Milestone 5, plan decision 5), or null. Never set together with `sel`. */
  grp: string | null;
  /** Body region in focus (M13 plan decision 7): a fine or coarse region key, or null for the whole body. Combines with `sel` or `grp`. */
  reg: string | null;
  /** Antagonists shown in their tint (M9 plan decision 7): only at a muscle's tier 2; cleared by every isolation change. */
  antagonists: boolean;
  ghostMode: GhostMode;
  ghostOpacity: number;
  /** Colour-by-region or plain bone (plan decision 8): URL `color=region` and localStorage. */
  colourMode: ColourMode;
  setColourMode: (mode: ColourMode) => void;
  /** Floating labels on or off (plan decision 7). */
  labelsOn: boolean;
  setLabelsOn: (on: boolean) => void;
  /** The labels placed by the last layout (CSS px, client coordinates), drawn by `Labels.tsx` and the screenshot. */
  labelLayout: readonly PlacedLabel[];
  setLabelLayout: (layout: readonly PlacedLabel[]) => void;
  /** A short message shown as a toast ("Link copied"), with a sequence number; also announced. */
  toast: { text: string; seq: number } | null;
  showToast: (text: string) => void;
  /** A message for the live region (spec §10), with a sequence number so a repeat is heard again. */
  announce: { text: string; seq: number } | null;
  say: (text: string) => void;
  /**
   * Grows by one when the changes made in the same task are part of opening the
   * page (a soft `sel=` or `grp=` from the link, applied once its layer is on screen):
   * the live region says nothing for them (M10 plan decision 4).
   */
  hushed: number;
  hush: () => void;
  /**
   * The keyboard cursor in the 3D view (plan step 4): the object Tab has reached
   * and where its centre is on screen (client px), or null.
   */
  keyCursor: { id: string; x: number; y: number } | null;
  setKeyCursor: (c: ViewerState["keyCursor"]) => void;
  /** Whether the body-region picker (M13 plan decision 8) is open. */
  regionPickerOpen: boolean;
  setRegionPickerOpen: (open: boolean) => void;
  /**
   * The camera before a body region was framed and the pose it was framed to
   * (M13 plan decision 8): leaving the region goes back to `before` if the
   * camera is still at `after`. Null when no region framing is pending.
   */
  regionFrame: { before: CameraState; after: CameraState } | null;
  setRegionFrame: (f: ViewerState["regionFrame"]) => void;
  /** Whether the sidebar (search and tree, Milestone 5) is open. */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** Width of the left sidebar on desktop (CSS px), 0 when closed, for framing. */
  sidebarLeft: number;
  setSidebarLeft: (px: number) => void;
  /** Object under the mouse pointer (desktop hover), or null. */
  hovered: string | null;
  /**
   * The articulation highlighted from the panel (plan step 7): hover or focus
   * on desktop, press-and-hold on a phone. `a` is the selected object, `b` its
   * partner. Cleared whenever the selection changes.
   */
  joint: JointHighlight | null;
  setJoint: (joint: JointHighlight | null) => void;
  /**
   * Explode slider value (plan step 8), 0 (rest) to 1, only non-zero while the
   * slider is held or easing back. Not in the URL. Reset with the selection.
   */
  explode: number;
  setExplode: (value: number) => void;
  /** Canvas area covered by the info panel (CSS px), for framing (`F`, double-click). */
  panelInset: PanelInset;
  setPanelInset: (inset: PanelInset) => void;
  /**
   * `performance.now()` time of the pointer-up that asked for a selection, until
   * the highlight is drawn (click → highlight timing, spec §8); else null.
   */
  inputAt: number | null;
  markInput: (t: number | null) => void;
  /** Set the isolation; `ant` (default false) only sticks at tier 2. */
  /** `reg` left out keeps the current body region. */
  setIsolation: (iso: { sel: string | null; tier: Tier; grp?: string | null; ant?: boolean; reg?: string | null }) => void;
  setAntagonists: (on: boolean) => void;
  setGhostMode: (mode: GhostMode) => void;
  setGhostOpacity: (opacity: number) => void;
  setHovered: (id: string | null) => void;
  /** `?bench` result once the orbit is done, with the LOD and draw calls it ran at. */
  bench: (BenchResult & { lod: Lod; drawCalls: number; triangles: number; labels: LayoutTimes | null }) | null;
  setBench: (bench: ViewerState["bench"]) => void;
  requestCamera: (command: CameraCommand) => void;
  setCamera: (camera: CameraState | null) => void;
  setLodSetting: (setting: LodSetting) => void;
  setLodActive: (lod: Lod | null) => void;
  setReducedMotion: (reduced: boolean) => void;
  /** On / Ghost / Off per layer (musculoskeletal spec §6.1). */
  layers: LayerModes;
  /** Muscle depth control (spec §6.2), 0 = all. */
  muscleDepth: MuscleDepth;
  /** `performance.now()` when each soft-tissue layer was first turned on (or the start, for a link). */
  layerOnAt: Partial<Record<LazyLayerId, number>>;
  /**
   * The system whose group control made the last layer change (M11 plan
   * decision 5), so it is announced as one group change; null for any other change.
   */
  layersVia: SystemId | null;
  setLayerSetting: (layers: LayerModes, depth: MuscleDepth, via?: SystemId | null) => void;
  /**
   * True when the URL asks for M6's debug layer view (`?debug&layers=all`):
   * the real layers then stay at their default and the Layers panel is disabled (plan decision 2).
   */
  debugLayersView: boolean;
  setDebugLayersView: (on: boolean) => void;
  /** Loading state of each soft-tissue layer once it has been turned on. */
  layerLoad: Partial<Record<LazyLayerId, LayerLoad>>;
  setLayerLoad: (layer: LazyLayerId, load: Partial<LayerLoad>) => void;
  /** Structures hidden one by one (spec §5.5, `hid=`). */
  hidden: ReadonlySet<string>;
  setHidden: (ids: Iterable<string>) => void;
  /** The budget governor's state (M13 plan decision 10; src/state/budget.ts), null until the viewer starts it. */
  budget: BudgetState | null;
  /** Layers held back by the phone's start until a body region or "Whole body" is chosen (decision 10): not drawn. */
  budgetHeld: readonly LayerId[];
  /** The view the "heavy view" prompt is shown for (its key), or null when it is not shown. */
  budgetPrompt: string | null;
  /** The view whose prompt was dismissed (or answered): it isn't shown again until the layers or region change. */
  budgetDismissed: string | null;
};

/** What the budget governor decided for the current view. */
export type BudgetState = {
  /** The triangle budget and where it came from (`?debug&budget=` or the device class). */
  limit: number;
  limitSource: "device" | "url";
  phone: boolean;
  /** The viewer's plan: its final LOD and source. */
  planLod: Lod;
  source: LodSource;
  /** Layers capped to low (step 1). */
  caps: readonly LayerId[];
  /** The drawn total (index estimate, overlays not counted) and whether it is still over (step 2). */
  drawn: number;
  over: boolean;
};

export const useViewer = create<ViewerState>()((set) => ({
  camera: null,
  lodSetting: "auto",
  lodActive: null,
  reducedMotion: false,
  cameraRequest: null,
  bench: null,
  sel: null,
  tier: 0,
  grp: null,
  reg: null,
  antagonists: false,
  ghostMode: "ghost",
  ghostOpacity: typeof window === "undefined" ? GHOST_OPACITY.default : storedGhostOpacity(),
  colourMode: "bone",
  setColourMode: (colourMode) => set({ colourMode }),
  labelsOn: typeof window === "undefined" ? false : storedFlag(LABELS_KEY),
  setLabelsOn: (labelsOn) => {
    set({ labelsOn });
    try {
      if (labelsOn) window.localStorage.setItem(LABELS_KEY, "1");
      else window.localStorage.removeItem(LABELS_KEY);
    } catch {
      // Storage disabled: the choice lasts for this page only.
    }
  },
  labelLayout: [],
  setLabelLayout: (labelLayout) => set((s) => (s.labelLayout.length === 0 && labelLayout.length === 0 ? s : { labelLayout })),
  toast: null,
  showToast: (text) =>
    set((s) => ({ toast: { text, seq: (s.toast?.seq ?? 0) + 1 }, announce: { text, seq: (s.announce?.seq ?? 0) + 1 } })),
  hovered: null,
  announce: null,
  say: (text) => set((s) => ({ announce: { text, seq: (s.announce?.seq ?? 0) + 1 } })),
  hushed: 0,
  hush: () => set((s) => ({ hushed: s.hushed + 1 })),
  keyCursor: null,
  setKeyCursor: (keyCursor) =>
    set((s) => (s.keyCursor === keyCursor || (s.keyCursor && keyCursor && s.keyCursor.id === keyCursor.id && s.keyCursor.x === keyCursor.x && s.keyCursor.y === keyCursor.y) ? s : { keyCursor })),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  sidebarLeft: 0,
  regionPickerOpen: false,
  setRegionPickerOpen: (open) => set({ regionPickerOpen: open }),
  regionFrame: null,
  setRegionFrame: (f) => set({ regionFrame: f }),
  setSidebarLeft: (sidebarLeft) => set((s) => (s.sidebarLeft === sidebarLeft ? s : { sidebarLeft })),
  joint: null,
  explode: 0,
  setExplode: (v) => set((s) => {
    const explode = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
    return s.explode === explode ? s : { explode };
  }),
  setJoint: (joint) => set((s) => (sameJoint(s.joint, joint) ? s : { joint })),
  panelInset: NO_PANEL,
  setPanelInset: (inset) =>
    set((s) =>
      s.panelInset.right === inset.right && s.panelInset.bottom === inset.bottom && s.panelInset.top === inset.top ? s : { panelInset: inset },
    ),
  inputAt: null,
  markInput: (inputAt) => set({ inputAt }),
  setIsolation: ({ sel, tier, grp = null, ant = false, reg }) =>
    set((s) => {
      const antagonists = tier === 2 && sel !== null && ant;
      const region = reg === undefined ? s.reg : reg;
      if (s.sel === sel && s.tier === tier && s.grp === grp && s.reg === region) return s.antagonists === antagonists ? s : { antagonists };
      return { sel, tier, grp, reg: region, antagonists, joint: null, explode: 0 };
    }),
  setAntagonists: (on) => set((s) => (s.antagonists === on ? s : { antagonists: on && s.tier === 2 && s.sel !== null })),
  setGhostMode: (ghostMode) => set({ ghostMode }),
  setGhostOpacity: (o) => {
    const ghostOpacity = clampOpacity(o);
    set({ ghostOpacity });
    try {
      window.localStorage.setItem(GHOST_OPACITY_KEY, String(ghostOpacity));
    } catch {
      // Private mode or storage disabled: the value lasts for this page only.
    }
  },
  setHovered: (hovered) => set((s) => (s.hovered === hovered ? s : { hovered })),
  setBench: (bench) => set({ bench }),
  requestCamera: (command) => set((s) => ({ cameraRequest: { command, seq: (s.cameraRequest?.seq ?? 0) + 1 } })),
  setCamera: (camera) => set({ camera }),
  setLodSetting: (lodSetting) => set({ lodSetting }),
  setLodActive: (lodActive) => set({ lodActive }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  layers: DEFAULT_LAYER_SETTING.layers,
  muscleDepth: 0,
  layerOnAt: {},
  layersVia: null,
  setLayerSetting: (layers, muscleDepth, via = null) =>
    set((s) => {
      if (sameLayers(s.layers, layers) && s.muscleDepth === muscleDepth) return s;
      // The first time each lazy layer is turned on, for the `?debug` load time (M7 step 9).
      let layerOnAt = s.layerOnAt;
      for (const l of LAZY_LAYERS) {
        if (layers[l] !== "off" && layerOnAt[l] === undefined) layerOnAt = { ...layerOnAt, [l]: performance.now() };
      }
      return { layers: { ...layers }, muscleDepth, layerOnAt, layersVia: via };
    }),
  debugLayersView: false,
  setDebugLayersView: (debugLayersView) => set({ debugLayersView }),
  layerLoad: {},
  setLayerLoad: (layer, load) =>
    set((s) => {
      const prev: LayerLoad = s.layerLoad[layer] ?? { status: "loading", lod: null, fetching: null, received: 0, total: 0, error: null, attempt: 0, shownAt: {} };
      return { layerLoad: { ...s.layerLoad, [layer]: { ...prev, ...load } } };
    }),
  budget: null,
  budgetHeld: [],
  budgetPrompt: null,
  budgetDismissed: null,
  hidden: new Set(),
  setHidden: (ids) =>
    set((s) => {
      const next = new Set(ids);
      return next.size === s.hidden.size && [...next].every((id) => s.hidden.has(id)) ? s : { hidden: next };
    }),
}));

function sameLayers(a: LayerModes, b: LayerModes): boolean {
  return (Object.keys(a) as Layer[]).every((k) => a[k] === b[k]);
}

/** The mode of one layer: a selector helper for components. */
export const layerMode = (layer: Layer) => (s: ViewerState): LayerMode => s.layers[layer];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Keep `reducedMotion` in step with the OS setting. Returns an unsubscribe function. */
export function watchReducedMotion(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION);
  const update = () => useViewer.getState().setReducedMotion(mq.matches);
  update();
  mq.addEventListener("change", update);
  return () => mq.removeEventListener("change", update);
}

/** A stored on/off flag ("1" means on). */
export function storedFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** The stored ghost opacity, or the default. */
export function storedGhostOpacity(): number {
  try {
    const raw = window.localStorage.getItem(GHOST_OPACITY_KEY);
    return raw === null ? GHOST_OPACITY.default : clampOpacity(Number(raw));
  } catch {
    return GHOST_OPACITY.default;
  }
}

export function clampOpacity(o: number): number {
  if (!Number.isFinite(o)) return GHOST_OPACITY.default;
  return Math.min(GHOST_OPACITY.max, Math.max(GHOST_OPACITY.min, o));
}

function sameJoint(x: JointHighlight | null, y: JointHighlight | null): boolean {
  return x === y || (x !== null && y !== null && x.a === y.a && x.b === y.b && x.name === y.name);
}
