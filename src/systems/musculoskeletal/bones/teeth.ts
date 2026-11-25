// The teeth either side of a tooth in its arch (FDI numbers), the facts behind
// the derived `adjacent_tooth` edges (M12 plan decision 2). Was
// src/content/relations.ts's `adjacentTeeth` until M12 BC.

const TOOTH = /^tooth_([1-4])([1-8])$/;
/** Quadrant across the midline in the same arch: 1 ↔ 2 (upper), 3 ↔ 4 (lower). */
const ACROSS: Record<string, string> = { "1": "2", "2": "1", "3": "4", "4": "3" };

/** The teeth either side of a tooth in its arch, mesial first, including across the midline for central incisors. */
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
