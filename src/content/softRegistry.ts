// The lazy layers' structures as the main chunk sees them (M7 plan decisions
// 11 to 13), read off the always-loaded ID index (`src/content/index.ts`, M12
// plan decision 7): every lookup answers from the first frame.

import type { SoftId } from "../layers/softIds";
import type { LazyLayerId } from "../systems/registry";
import { lazyEntries, lazyEntry, lazyLayerOf } from "./index";
import { peeled } from "./muscleDepth";

export const softEntry = (id: string): SoftId | undefined => lazyEntry(id);
export const isSoftId = (id: string): boolean => lazyEntry(id) !== undefined;
/** Every lazy layer's entry, in the ID files' order. */
export const softEntries = (): readonly SoftId[] => lazyEntries();

/** The layer a soft-tissue structure is drawn in, or null for an unknown ID. */
export const softLayerOf = (id: string): LazyLayerId | null => lazyLayerOf(id);

/** "Biceps brachii (left)"; midline structures have no side. */
export function softDisplayName(e: SoftId): string {
  return e.side === "midline" ? e.name : `${e.name} (${e.side})`;
}

/** The same structure on the other side (`_left` ↔ `_right`), if the table has it. */
export function softOpposite(id: string): string | null {
  const e = softEntry(id);
  if (!e || e.side === "midline") return null;
  const other = e.side === "left" ? id.replace(/_left$/, "_right") : id.replace(/_right$/, "_left");
  return other !== id && softEntry(other)?.side !== undefined && softEntry(other)!.side !== e.side ? other : null;
}

/** What `Hide` hides for a structure: a muscle with parts hides its parts (spec §5.5); else the structure itself. */
export function hideTargets(id: string): string[] {
  const parts = softEntry(id)?.parts;
  return parts && parts.length > 0 ? [...parts] : [id];
}

/**
 * The muscles (and parts) peeled away at a depth stop (spec §6.2): hidden,
 * not ghosted. Cached per stop.
 */
const peelCache = new Map<number, ReadonlySet<string>>();
export function peeledAt(stop: 0 | 1 | 2): ReadonlySet<string> {
  if (stop === 0) return EMPTY;
  let s = peelCache.get(stop);
  if (!s) {
    s = new Set(lazyEntries().filter((e) => e.mesh && peeled(e.depth, stop)).map((e) => e.id));
    peelCache.set(stop, s);
  }
  return s;
}
const EMPTY: ReadonlySet<string> = new Set();

/** How many muscles a stop peels (a muscle's parts count once), for the announcement. */
export function peeledMuscleCount(stop: 0 | 1 | 2): number {
  return new Set([...peeledAt(stop)].map((id) => softEntry(id)?.parent ?? id)).size;
}
