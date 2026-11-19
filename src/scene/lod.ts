// Pure helpers for the bare viewer: LOD choice and model statistics.
// Kept free of three.js and React so Vitest can cover them directly.

export type Lod = "low" | "high";

/** The user's model-detail setting. */
export type LodSetting = "auto" | Lod;

export const LOD_SETTING_KEY = "skeleton-viewer:lod";

export function parseLodSetting(value: string | null | undefined): LodSetting {
  return value === "low" || value === "high" ? value : "auto";
}

/** What the device looks like, for the automatic choice (spec §8). */
export type DeviceProbe = {
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  /** `navigator.deviceMemory` in GiB, where the browser exposes it. */
  deviceMemory?: number;
  /** `gl.MAX_TEXTURE_SIZE` from a throwaway WebGL 2 context. */
  maxTextureSize?: number;
  /** `gl.RENDERER` from the same context. */
  renderer?: string;
};

/** Below this shortest side (CSS px) the screen counts as a phone. */
export const SMALL_SCREEN_PX = 600;

/** Software renderers and older or low-end mobile GPUs. */
const WEAK_GPU =
  /swiftshader|llvmpipe|softpipe|software|microsoft basic render|mali-[gt]?\d{1,3}\b|mali-4|adreno[^0-9]*[1-5]\d\d\b|powervr|videocore/i;

export type LodChoice = { lod: Lod; reason: string };

/** Pick the detail level a device should end on (low is always shown first). */
export function chooseLod(p: DeviceProbe): LodChoice {
  const shortest = Math.min(p.width, p.height);
  if (shortest < SMALL_SCREEN_PX) return { lod: "low", reason: `small screen (${Math.round(shortest)} px)` };
  if (p.deviceMemory !== undefined && p.deviceMemory <= 4) {
    return { lod: "low", reason: `${p.deviceMemory} GB device memory` };
  }
  if (p.maxTextureSize !== undefined && p.maxTextureSize < 8192) {
    return { lod: "low", reason: `max texture size ${p.maxTextureSize}` };
  }
  if (p.renderer && WEAK_GPU.test(p.renderer)) return { lod: "low", reason: `GPU: ${p.renderer}` };
  return { lod: "high", reason: "capable device" };
}

/** Where the LOD plan came from, for the debug overlay. */
export type LodPlan = { lods: Lod[]; source: "url" | "setting" | "auto"; reason: string };

/**
 * The LODs to load, in order. `?lod=low|high` pins one file and `?lod=both`
 * forces low then high (for testing); otherwise the stored setting decides,
 * and with "auto" the device probe does. Low is always loaded first.
 */
export function lodPlan(search: string, setting: LodSetting = "auto", probe?: DeviceProbe): LodPlan {
  const lod = new URLSearchParams(search).get("lod");
  if (lod === "low" || lod === "high") return { lods: [lod], source: "url", reason: `?lod=${lod}` };
  if (lod === "both") return { lods: ["low", "high"], source: "url", reason: "?lod=both" };
  if (setting !== "auto") {
    return { lods: setting === "high" ? ["low", "high"] : ["low"], source: "setting", reason: `setting: ${setting}` };
  }
  const choice = probe ? chooseLod(probe) : { lod: "high" as const, reason: "no device probe" };
  return { lods: choice.lod === "high" ? ["low", "high"] : ["low"], source: "auto", reason: choice.reason };
}

export type IdEntry = { id: string; meshAvailable: boolean };

export type ObjectSummary = {
  /** Named nodes in the model that are canonical IDs. */
  found: number;
  /** IDs flagged meshAvailable: false (the four third molars). */
  knownMissing: string[];
  /** IDs flagged meshAvailable: true that the model lacks. */
  unexpectedMissing: string[];
  /** Named mesh nodes that are not canonical IDs. */
  unknown: string[];
};

/** Compare the model's object names against content/ids.json. */
export function summariseObjects(nodeNames: Iterable<string>, ids: IdEntry[]): ObjectSummary {
  const names = new Set(nodeNames);
  const known = new Set(ids.map((e) => e.id));
  return {
    found: ids.filter((e) => names.has(e.id)).length,
    knownMissing: ids.filter((e) => !e.meshAvailable).map((e) => e.id),
    unexpectedMissing: ids.filter((e) => e.meshAvailable && !names.has(e.id)).map((e) => e.id),
    unknown: [...names].filter((n) => !known.has(n)).sort(),
  };
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "…";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
