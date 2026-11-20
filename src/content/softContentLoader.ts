// Lazy loading of the soft-tissue content (M8 plan decision 11): one chunk per
// layer, fetched when the layer is first turned on (in parallel with its model
// file) or when the panel shows one of its structures. Never with every new
// layer off.

import { useEffect, useSyncExternalStore } from "react";
import type { TissueLayer } from "../state/url";
import type { SoftLayerContent } from "./softCompile";
import { registerSoftTiers } from "./softRelations";

const importers: Record<TissueLayer, () => Promise<{ default: SoftLayerContent }>> = {
  muscles: () => import("virtual:skeleton-soft-content-muscles"),
  ligaments: () => import("virtual:skeleton-soft-content-ligaments"),
  cartilage: () => import("virtual:skeleton-soft-content-cartilage"),
};

const loaded: Partial<Record<TissueLayer, SoftLayerContent>> = {};
const pending: Partial<Record<TissueLayer, Promise<SoftLayerContent>>> = {};
const listeners = new Set<() => void>();
let version = 0;

export function loadSoftContent(layer: TissueLayer): Promise<SoftLayerContent> {
  const done = loaded[layer];
  if (done) return Promise.resolve(done);
  pending[layer] ??= importers[layer]().then((m) => {
    loaded[layer] = m.default;
    registerSoftTiers(layer, m.default.tiers);
    version++;
    listeners.forEach((l) => l());
    return m.default;
  });
  return pending[layer];
}

/** The content loaded so far for a layer, else null. */
export const softContentOf = (layer: TissueLayer): SoftLayerContent | null => loaded[layer] ?? null;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** A layer's content once loaded, else null (and starts the load). Null layer: nothing. */
export function useSoftContent(layer: TissueLayer | null): SoftLayerContent | null {
  useSyncExternalStore(subscribe, () => version);
  const c = layer ? (loaded[layer] ?? null) : null;
  useEffect(() => {
    if (layer && !c) void loadSoftContent(layer).catch(() => undefined);
  }, [layer, c]);
  return c;
}
