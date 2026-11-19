import { create } from "zustand";
import type { BenchResult } from "../scene/bench";
import type { Lod, LodSetting } from "../scene/lod";
import { NO_PANEL, type PanelInset, type Preset } from "../camera/math";
import type { Tier } from "./isolation";
import type { CameraState, GhostMode } from "./url";
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
export type JointHighlight = { a: string; b: string; name: string };

export type CameraCommand =
  | { kind: "preset"; preset: Preset }
  | { kind: "reset" }
  | { kind: "frame" }
  | { kind: "repivot"; id: string }
  | { kind: "centre"; id: string }
  | { kind: "goto"; cam: CameraState | null };

/** Ghost opacity (spec §6 slider): default and range. Kept in localStorage, not the URL. */
export const GHOST_OPACITY = { default: 0.1, min: 0.05, max: 0.5 } as const;
export const GHOST_OPACITY_KEY = "skeleton-viewer:ghost-opacity";

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
   * The keyboard cursor in the 3D view (plan step 4): the object Tab has reached
   * and where its centre is on screen (client px), or null.
   */
  keyCursor: { id: string; x: number; y: number } | null;
  setKeyCursor: (c: ViewerState["keyCursor"]) => void;
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
  setIsolation: (iso: { sel: string | null; tier: Tier; grp?: string | null }) => void;
  setGhostMode: (mode: GhostMode) => void;
  setGhostOpacity: (opacity: number) => void;
  setHovered: (id: string | null) => void;
  /** `?bench` result once the orbit is done, with the LOD and draw calls it ran at. */
  bench: (BenchResult & { lod: Lod; drawCalls: number }) | null;
  setBench: (bench: ViewerState["bench"]) => void;
  requestCamera: (command: CameraCommand) => void;
  setCamera: (camera: CameraState | null) => void;
  setLodSetting: (setting: LodSetting) => void;
  setLodActive: (lod: Lod | null) => void;
  setReducedMotion: (reduced: boolean) => void;
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
  keyCursor: null,
  setKeyCursor: (keyCursor) =>
    set((s) => (s.keyCursor === keyCursor || (s.keyCursor && keyCursor && s.keyCursor.id === keyCursor.id && s.keyCursor.x === keyCursor.x && s.keyCursor.y === keyCursor.y) ? s : { keyCursor })),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  sidebarLeft: 0,
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
  setIsolation: ({ sel, tier, grp = null }) =>
    set((s) => (s.sel === sel && s.tier === tier && s.grp === grp ? s : { sel, tier, grp, joint: null, explode: 0 })),
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
}));

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
