// Tier sets (spec §6, plan decisions 3 to 5): tier 1 is every articulation
// partner (from either side of each stored pair), plus the neighbouring teeth
// in the same arch for a tooth; tier 2 adds the curated set in regions.json.

import articulationsJson from "../../content/articulations.json";
import idsJson from "../../content/ids.json";
import regionsJson from "../../content/regions.json";
import type { Articulation, Regions } from "./schema";

const TOOTH = /^tooth_([1-4])([1-8])$/;
/** Quadrant across the midline in the same arch: 1 ↔ 2 (upper), 3 ↔ 4 (lower). */
const ACROSS: Record<string, string> = { "1": "2", "2": "1", "3": "4", "4": "3" };

/** The teeth either side of a tooth in its arch (FDI numbers), including across the midline for central incisors. */
export function adjacentTeeth(id: string): string[] {
  const m = TOOTH.exec(id);
  if (!m) return [];
  const q = m[1]!;
  const p = Number(m[2]);
  const out: string[] = [];
  out.push(p === 1 ? `tooth_${ACROSS[q]}1` : `tooth_${q}${p - 1}`);
  if (p < 8) out.push(`tooth_${q}${p + 1}`);
  return out;
}

export type Relations = {
  /** Articulations that include this object, each seen from it: `other` is the partner. */
  articulationsOf(id: string): (Articulation & { other: string })[];
  /** Tier-1 additions (not including the object itself), in anatomical order. */
  tier1(id: string): string[];
  /** Tier-2 additions on top of tier 1 (regions.json). */
  regionOf(id: string): string[];
  /** Everything solid at a tier, the focus first. */
  visibleAt(id: string, tier: 0 | 1 | 2): string[];
};

/** Anatomical order (the order of content/ids.json), for stable lists. */
const ORDER = new Map((idsJson as { id: string }[]).map((e, i) => [e.id, i]));
const byOrder = (a: string, b: string) => (ORDER.get(a) ?? Infinity) - (ORDER.get(b) ?? Infinity);

export function buildRelations(articulations: Articulation[], regions: Regions): Relations {
  const byObject = new Map<string, (Articulation & { other: string })[]>();
  for (const a of articulations) {
    for (const [self, other] of [[a.a, a.b], [a.b, a.a]] as const) {
      let list = byObject.get(self);
      if (!list) byObject.set(self, (list = []));
      list.push({ ...a, other });
    }
  }
  const tier1 = (id: string): string[] => {
    const set = new Set((byObject.get(id) ?? []).map((a) => a.other));
    for (const t of adjacentTeeth(id)) set.add(t);
    set.delete(id);
    return [...set].sort(byOrder);
  };
  const regionOf = (id: string): string[] => regions[id] ?? [];
  return {
    articulationsOf: (id) => byObject.get(id) ?? [],
    tier1,
    regionOf,
    visibleAt(id, tier) {
      const out = new Set([id]);
      if (tier >= 1) for (const x of tier1(id)) out.add(x);
      if (tier >= 2) for (const x of regionOf(id)) out.add(x);
      return [...out];
    },
  };
}

/** The app's relations, from the committed content files. */
export const relations: Relations = buildRelations(articulationsJson as Articulation[], regionsJson as Regions);
