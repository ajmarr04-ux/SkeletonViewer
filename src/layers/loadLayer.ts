// Fetch and parse one soft-tissue layer file (M7 plan decision 3), with
// progress for the Layers panel. Part of the lazy layer chunk.
import { partsFromGlb } from "../scene/loadSkeleton";
import type { BonePart } from "../scene/batchSkeleton";
import type { Lod } from "../scene/lod";
import { layerBytes, layerUrl } from "./urls";

export type Progress = (received: number, total: number) => void;

/** Download a file, reporting bytes as they arrive (the body after any gzip, i.e. the file's own size). */
export async function fetchWithProgress(url: string, expected: number, onProgress: Progress): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${url.replace(/\?.*$/, "").split("/").pop()}: HTTP ${res.status}`);
  const total = expected || Number(res.headers.get("content-length")) || 0;
  onProgress(0, total);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onProgress(buf.byteLength, total || buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(received, Math.max(total, received));
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out.buffer;
}

/**
 * One layer file (`ModelSpec.file` or an overlay's) at one LOD, or one region
 * chunk of it (`chunk`, M13): a part per named node, geometry plus world
 * matrix (nothing moves).
 */
export async function loadLayerParts(file: string, lod: Lod, onProgress: Progress, chunk?: string): Promise<BonePart[]> {
  const url = layerUrl(file, lod, chunk);
  const data = await fetchWithProgress(url, layerBytes(file, lod, chunk), onProgress);
  return partsFromGlb(data, url.replace(/\?.*$/, "").split("/").pop()!, url.replace(/[^/]*$/, ""));
}
