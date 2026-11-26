// Layer file URLs and sizes (M7 plan decision 3), and the chunk table of the
// layers split by body region (M13 plan decision 9). Part of the lazy layer chunk.
import modelVersions, { sizes } from "virtual:skeleton-model-versions";
import chunkTable from "virtual:skeleton-chunks";
import { chunkStem, type LayerChunks } from "../regions/chunks";
import type { Lod } from "../scene/lod";

/** A file stem: the layer's whole file, or one of its region chunks. */
const stemOf = (file: string, lod: Lod, chunk?: string): string => (chunk ? chunkStem(file, chunk, lod) : `${file}-${lod}`);

/**
 * The file's URL with its content hash, so a rebuilt file is never taken from
 * the HTTP cache next to a new manifest (M6). The bone files keep plain URLs.
 * `chunk`: a coarse region's file of a chunked layer.
 */
export function layerUrl(layer: string, lod: Lod, chunk?: string): string {
  const stem = stemOf(layer, lod, chunk);
  const v = modelVersions[stem];
  return `${import.meta.env.BASE_URL}models/${stem}.glb${v ? `?v=${v}` : ""}`;
}

/** The file's size in bytes, for the progress indicator (0 if unknown). */
export function layerBytes(layer: string, lod: Lod, chunk?: string): number {
  return sizes[stemOf(layer, lod, chunk)] ?? 0;
}

/** A chunked layer's chunks; undefined for a layer in one file. */
export const layerChunksOf = (layer: string): LayerChunks | undefined => chunkTable[layer];
