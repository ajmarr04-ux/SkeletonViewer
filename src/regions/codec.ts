// The body regions' wire format (M13 plan decision 5): the region list, every
// structure's `located_in` regions and the triangle totals, shipped in the main
// chunk with the ID index (`virtual:skeleton-index`'s `regions` export). A
// right-side structure whose regions are the mirror of its left twin's
// (`_left` → `_right` in each region key) is a 0 instead of a list.
//
// `decodeRegions` is the main chunk's half; `encodeRegions` runs in the Vite
// plugin. Names no layer or region.

import type { LocatedInFile } from "./membership";

export type PackedRegions = {
  /** Fine region keys, then coarse keys. */
  keys: string[];
  /** Their names, in the same order. */
  names: string[];
  /** Per fine region: the index (in `keys`) of its coarse region. */
  coarseOf: number[];
  /** Per structure in index order: its fine regions' indices, or 0 for the mirror of its `_left` twin's. */
  loc: (number[] | 0)[];
  /** Per layer: `[high, low]`, each a total per key (fine, then coarse), then the whole layer's. */
  tris: Record<string, [number[], number[]]>;
};

export type RegionInfo = { key: string; name: string; fine: boolean; coarse: string | null; side: "left" | "right" | null };

export type RegionIndexData = {
  /** Fine regions, then coarse regions. */
  regions: RegionInfo[];
  /** Each structure's fine regions, in region order (structures the file doesn't list are left out). */
  located: Map<string, readonly string[]>;
  /** Per layer and LOD: key (or "" for the whole layer) → triangles. */
  tris: Map<string, { high: Map<string, number>; low: Map<string, number> }>;
};

const toRight = (s: string): string => s.replace(/_left$/, "_right");
const sideOf = (k: string): RegionInfo["side"] => (k.endsWith("_left") ? "left" : k.endsWith("_right") ? "right" : null);

/** `ids` = the structures in index order (the eager ID file's, then the lazy entries'); `names` = every region key's name. */
export function encodeRegions(file: LocatedInFile, names: Readonly<Record<string, string>>, ids: readonly string[]): PackedRegions {
  const keys = [...file.regions, ...file.coarse.map((c) => c.key)];
  const at = new Map(keys.map((k, i) => [k, i]));
  const coarseOf = file.regions.map((r) => at.get(file.coarse.find((c) => c.regions.includes(r))!.key)!);
  const listOf = (id: string): number[] => (file.structures[id]?.regions ?? []).map((r) => at.get(r)!);
  const pos = new Map(ids.map((id, i) => [id, i]));
  const loc = ids.map((id, i): number[] | 0 => {
    const own = listOf(id);
    const left = id.replace(/_right$/, "_left");
    if (id.endsWith("_right") && file.structures[id] && (pos.get(left) ?? Infinity) < i) {
      const mirrored = (file.structures[left]?.regions ?? []).map((r) => at.get(toRight(r)));
      if (file.structures[left] && mirrored.length === own.length && mirrored.every((k, i) => k === own[i])) return 0;
    }
    return own;
  });
  const tris = Object.fromEntries(
    Object.entries(file.triangles).map(([layer, t]) => [layer, [[...keys.map((k) => t.high[k]!), t.total.high], [...keys.map((k) => t.low[k]!), t.total.low]] as [number[], number[]]]),
  );
  return { keys, names: keys.map((k) => names[k] ?? k), coarseOf, loc, tris };
}

export function decodeRegions(p: PackedRegions, ids: readonly string[]): RegionIndexData {
  const fineCount = p.coarseOf.length;
  const regions: RegionInfo[] = p.keys.map((key, i) => ({
    key,
    name: p.names[i]!,
    fine: i < fineCount,
    coarse: i < fineCount ? p.keys[p.coarseOf[i]!]! : null,
    side: sideOf(key),
  }));
  const located = new Map<string, readonly string[]>();
  ids.forEach((id, i) => {
    const row = p.loc[i];
    if (row === undefined) return;
    if (row === 0) {
      const left = located.get(id.replace(/_right$/, "_left")) ?? [];
      located.set(id, left.map(toRight));
    } else if (row.length > 0) located.set(id, row.map((k) => p.keys[k]!));
  });
  const tris = new Map<string, { high: Map<string, number>; low: Map<string, number> }>();
  for (const [layer, [high, low]] of Object.entries(p.tris)) {
    const lod = (list: number[]) => new Map<string, number>([...p.keys.map((k, i) => [k, list[i]!] as const), ["", list[p.keys.length]!]]);
    tris.set(layer, { high: lod(high), low: lod(low) });
  }
  return { regions, located, tris };
}
