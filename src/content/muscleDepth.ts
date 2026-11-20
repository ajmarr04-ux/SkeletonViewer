// Muscle depth (musculoskeletal spec §6.2, M7 plan decisions 9 and 10). Pure
// lookup and peel rules the viewer uses (main chunk: no zod here; the
// validation rule is in `muscleDepthRules.ts`). Keys are side-free (`deltoid`, not `deltoid_left`): left and
// right share an entry. A part takes its own entry if it has one, else its
// muscle's.

export type Depth = 1 | 2 | 3;
/** The fields of a soft-tissue ID entry the rules need. */
export type DepthEntry = { id: string; kind: string; parent?: string | null };

export const sideFree = (id: string): string => id.replace(/_(left|right)$/, "");

/** A muscle's or part's depth, or undefined for anything else (or a gap in the table). */
export function depthOf(e: DepthEntry, table: Readonly<Record<string, Depth>>): Depth | undefined {
  if (e.kind !== "muscle" && e.kind !== "muscle_part") return undefined;
  return table[sideFree(e.id)] ?? (e.parent ? table[sideFree(e.parent)] : undefined);
}

/**
 * Is a muscle (or part) at this depth peeled away by the control's stop?
 * 0 All; 1 hides superficial; 2 hides superficial and intermediate; 3 deep only.
 */
export function peeled(depth: Depth | undefined, stop: 0 | 1 | 2 | 3): boolean {
  if (depth === undefined || stop === 0) return false;
  return stop === 1 ? depth === 1 : depth < 3;
}
