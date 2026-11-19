import type { DeviceProbe } from "./lod";

/** True when the browser can create a WebGL 2 context. */
export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

/** Screen, memory and GPU facts for the automatic LOD choice (spec §8). */
export function probeDevice(): DeviceProbe {
  const probe: DeviceProbe = { width: window.innerWidth, height: window.innerHeight };
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number") probe.deviceMemory = mem;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      probe.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      probe.renderer = String(gl.getParameter(gl.RENDERER));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // No probe; chooseLod falls back to screen size and memory.
  }
  return probe;
}

/** The stored model-detail setting, or null if storage is unavailable. */
export function readStoredSetting(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
