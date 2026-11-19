import { create } from "zustand";
import type { BenchResult } from "../scene/bench";
import type { Lod, LodSetting } from "../scene/lod";
import type { Preset } from "../camera/math";
import type { Tier } from "./isolation";
import type { CameraState, GhostMode } from "./url";

/**
 * A camera move asked for by the UI or the selection logic.
 * - `frame`: fit the selection (or the whole skeleton) from the current direction (`F`);
 * - `repivot`: move the orbit pivot to a bone without moving the picture (on select);
 * - `centre`: ease the bone to the middle of the view and orbit about it (double-click);
 * - `goto`: go to a pose (browser Back / Forward).
 */
export type CameraCommand =
  | { kind: "preset"; preset: Preset }
  | { kind: "reset" }
  | { kind: "frame" }
  | { kind: "repivot"; id: string }
  | { kind: "centre"; id: string }
  | { kind: "goto"; cam: CameraState | null };

/** Ghost opacity (spec §6 slider): default and range. Kept in localStorage, not the URL. */
export const GHOST_OPACITY = { default: 0.15, min: 0.05, max: 0.5 } as const;
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
  ghostMode: GhostMode;
  ghostOpacity: number;
  /** Object under the mouse pointer (desktop hover), or null. */
  hovered: string | null;
  setIsolation: (iso: { sel: string | null; tier: Tier }) => void;
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
  ghostMode: "ghost",
  ghostOpacity: GHOST_OPACITY.default,
  hovered: null,
  setIsolation: ({ sel, tier }) => set({ sel, tier }),
  setGhostMode: (ghostMode) => set({ ghostMode }),
  setGhostOpacity: (o) => set({ ghostOpacity: clampOpacity(o) }),
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

export function clampOpacity(o: number): number {
  if (!Number.isFinite(o)) return GHOST_OPACITY.default;
  return Math.min(GHOST_OPACITY.max, Math.max(GHOST_OPACITY.min, o));
}
