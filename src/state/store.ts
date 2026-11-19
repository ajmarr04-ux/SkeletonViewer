import { create } from "zustand";
import type { Lod, LodSetting } from "../scene/lod";
import type { CameraState } from "./url";

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
