// The body regions at run time (M13 plan decision 5): the region list, each
// structure's `located_in` regions and the triangle totals, known from the
// first frame. Handed over once by src/content/indexData.ts (from
// `virtual:skeleton-index`'s `regions`). Main chunk: no three.js, no React.
// Names no layer or region, and imports nothing from the registry at run time:
// Vitest's setup file loads it before a test can swap the registry's list.

import type { Edge } from "../graph/types";
import type { Lod } from "../systems/types";
import type { RegionIndexData, RegionInfo } from "./codec";

let data: RegionIndexData = { regions: [], located: new Map(), tris: new Map() };
let byKey = new Map<string, RegionInfo>();
let members = new Map<string, readonly string[]>();
const NONE: readonly string[] = [];

/** Called once by src/content/indexData.ts. */
export function setRegionIndex(d: RegionIndexData): void {
  data = d;
  byKey = new Map(d.regions.map((r) => [r.key, r]));
  const m = new Map<string, string[]>(d.regions.map((r) => [r.key, []]));
  for (const [id, rs] of d.located) {
    const coarse = new Set<string>();
    for (const r of rs) {
      m.get(r)?.push(id);
      const c = byKey.get(r)?.coarse;
      if (c) coarse.add(c);
    }
    for (const c of coarse) m.get(c)?.push(id);
  }
  members = m;
}

/** Every region, fine then coarse, in file order. */
export const regionList = (): readonly RegionInfo[] => data.regions;
/** A region's key, name, level and coarse parent; undefined for an unknown key. */
export const regionInfo = (key: string): RegionInfo | undefined => byKey.get(key);
export const isRegionKey = (key: string): boolean => byKey.has(key);
/** The fine regions a structure is `located_in` (region order); empty for an unknown ID. */
export const regionsOf = (id: string): readonly string[] => data.located.get(id) ?? NONE;
/** A region's member structures (a coarse region: every member of its fine regions, once), in index order. */
export const membersOf = (key: string): readonly string[] => members.get(key) ?? NONE;
/** Is the structure in the region (fine or coarse)? */
export const isInRegion = (id: string, key: string): boolean => {
  const info = byKey.get(key);
  if (!info) return false;
  const rs = regionsOf(id);
  return info.fine ? rs.includes(key) : rs.some((r) => byKey.get(r)?.coarse === key);
};
/** Triangles of a layer's members of a region (each structure once) at one LOD; `null` = the whole layer. 0 for an unknown layer or key. */
export const regionTriangles = (layer: string, lod: Lod, key: string | null): number => data.tris.get(layer)?.[lod].get(key ?? "") ?? 0;

/** Every membership edge (`type`: the regions descriptor's edge type), structure → fine region, for the app's graph. */
export function locatedInEdges(type: string): Edge[] {
  const out: Edge[] = [];
  for (const [id, rs] of data.located) for (const r of rs) out.push({ from: id, type, to: r });
  return out;
}
