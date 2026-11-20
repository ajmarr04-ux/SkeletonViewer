// Layer file URLs and sizes (M7 plan decision 3). Part of the lazy layer chunk.
import modelVersions, { sizes } from "virtual:skeleton-model-versions";
import type { Lod } from "../scene/lod";

/**
 * The file's URL with its content hash, so a rebuilt file is never taken from
 * the HTTP cache next to a new manifest (M6). The bone files keep plain URLs.
 */
export function layerUrl(layer: string, lod: Lod): string {
  const v = modelVersions[`${layer}-${lod}`];
  return `${import.meta.env.BASE_URL}models/${layer}-${lod}.glb${v ? `?v=${v}` : ""}`;
}

/** The file's size in bytes, for the progress indicator (0 if unknown). */
export function layerBytes(layer: string, lod: Lod): number {
  return sizes[`${layer}-${lod}`] ?? 0;
}
