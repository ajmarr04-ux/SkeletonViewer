// The soft-tissue ID table as the main chunk sees it (M7 plan decisions 11 to 13).
// The table itself (`virtual:skeleton-soft-ids`) lives in a lazy chunk; it is
// registered here when that chunk loads (the first time a layer is turned on,
// or when a link selects a soft-tissue structure). Until then every lookup
// says "unknown", which is right: nothing of a layer can be on screen before
// its table is loaded.

import type { SoftId } from "../layers/softIds";
import type { Layer, TissueLayer } from "../state/url";
import { peeled } from "./muscleDepth";

let table: Map<string, SoftId> | null = null;
let order: readonly SoftId[] = [];

/** Called by the lazy chunk (`src/layers/softTable.ts`). Idempotent. */
export function registerSoftIds(entries: readonly SoftId[]): void {
  if (table) return;
  table = new Map(entries.map((e) => [e.id, e]));
  order = entries;
}

/** For tests: forget the table. */
export function resetSoftIds(): void {
  table = null;
  order = [];
  peelCache.clear();
}

export const softEntry = (id: string): SoftId | undefined => table?.get(id);
export const isSoftId = (id: string): boolean => table?.has(id) ?? false;
/** Every registered entry, in table order. */
export const softEntries = (): readonly SoftId[] => order;
export const softTableLoaded = (): boolean => table !== null;

export const LAYER_LABELS: Record<Layer, string> = { bones: "Bones", cartilage: "Cartilage", ligaments: "Ligaments", muscles: "Muscles" };

/** The layer a soft-tissue structure is drawn in, or null for an unknown ID. */
export const softLayerOf = (id: string): TissueLayer | null => softEntry(id)?.layer ?? null;

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
 * not ghosted. Empty until the table is loaded. Cached per stop.
 */
const peelCache = new Map<number, ReadonlySet<string>>();
export function peeledAt(stop: 0 | 1 | 2): ReadonlySet<string> {
  if (stop === 0 || !table) return EMPTY;
  let s = peelCache.get(stop);
  if (!s) {
    s = new Set(order.filter((e) => e.mesh && peeled(e.depth, stop)).map((e) => e.id));
    peelCache.set(stop, s);
  }
  return s;
}
const EMPTY: ReadonlySet<string> = new Set();

/** How many muscles a stop peels (a muscle's parts count once), for the announcement. */
export function peeledMuscleCount(stop: 0 | 1 | 2): number {
  return new Set([...peeledAt(stop)].map((id) => softEntry(id)?.parent ?? id)).size;
}
