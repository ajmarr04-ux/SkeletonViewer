// The soft-tissue tier sets as the main chunk sees them (M9 plan decisions 3
// and 4). Each layer's lazy content chunk carries its structures' tier sets
// and the reverse edges (bone → muscles attached, ligaments connecting it,
// cartilage on it); `softContentLoader.ts` registers them here when the chunk
// loads. Until then a soft structure has no tiers ("Loading content…") and a
// bone gains nothing from that layer, which is right: its content is requested
// with the layer.

import { useSyncExternalStore } from "react";
import type { SoftTierData, SoftTierEntry } from "./softTiers";

const tiers = new Map<string, SoftTierEntry>();
const reverse = new Map<string, string[]>();
const registered = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

/** Called when a layer's content chunk loads. Idempotent per layer. */
export function registerSoftTiers(layer: string, data: SoftTierData | undefined): void {
  if (!data || registered.has(layer)) return;
  registered.add(layer);
  for (const [id, e] of Object.entries(data.tiers)) tiers.set(id, e);
  for (const [s, ids] of Object.entries(data.reverse)) reverse.set(s, [...(reverse.get(s) ?? []), ...ids]);
  version++;
  listeners.forEach((l) => l());
}

/** For tests: forget everything registered. */
export function resetSoftTiers(): void {
  tiers.clear();
  reverse.clear();
  registered.clear();
  version++;
}

/** True once the structure's layer content (and so its tier sets) has loaded. */
export const softTiersLoaded = (id: string): boolean => tiers.has(id);

/** Does the structure have a tier 2? False for ligaments and cartilage with no joint (and before loading). */
export const hasSoftTier2 = (id: string): boolean => tiers.get(id)?.t2 != null;

/** A soft structure's additions at a tier (not itself), unfiltered. Empty before loading. */
export function softRelated(id: string, tier: 0 | 1 | 2): string[] {
  const e = tiers.get(id);
  if (!e || tier === 0) return [];
  return tier === 1 || e.t2 === null ? e.t1 : [...e.t1, ...e.t2];
}

/** The soft structures related to a structure (a bone) at tier 1, from every loaded layer. */
export const reverseRelated = (id: string): readonly string[] => reverse.get(id) ?? [];

export const softTiersVersion = (): number => version;
export function subscribeSoftTiers(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-render when a layer's tier sets arrive. */
export const useSoftTiersVersion = (): number => useSyncExternalStore(subscribeSoftTiers, softTiersVersion);
