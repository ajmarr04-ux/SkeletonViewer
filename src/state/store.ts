import { create } from "zustand";
import type { Lod, LodSetting } from "../scene/lod";
import type { Preset } from "../camera/math";
import type { CameraState } from "./url";

/** A camera move asked for by the UI (toolbar, keyboard shortcuts elsewhere). */
export type CameraCommand = { kind: "preset"; preset: Preset } | { kind: "reset" } | { kind: "frame" };

/**
 * App state (spec §2: zustand, mirrored to the URL). Milestone 2 holds the
 * camera, the LOD and the reduced-motion preference. Selection, tier and
 * ghost mode arrive in Milestone 3.
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
