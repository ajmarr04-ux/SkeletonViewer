// Lazy loading of the soft-tissue content (M8 plan decision 11): one chunk per
// layer, fetched when the layer is first turned on (in parallel with its model
// file) or when the panel shows one of its structures. Never with every new
// layer off.

import { useEffect, useSyncExternalStore } from "react";
// One `import()` per lazy layer's `contentChunk`, generated from the registry (scripts/lib/content-plugin.ts).
import importers from "virtual:skeleton-layer-importers";
import type { LazyLayerId } from "../systems/registry";
import type { SoftLayerContent } from "./softCompile";
import { registerLayerEdges } from "./appGraph";

const loaded: Partial<Record<LazyLayerId, SoftLayerContent>> = {};
const pending: Partial<Record<LazyLayerId, Promise<SoftLayerContent>>> = {};
const NO_CONTENT: SoftLayerContent = { entries: {}, derived: null };
const listeners = new Set<() => void>();
let version = 0;

export function loadSoftContent(layer: LazyLayerId): Promise<SoftLayerContent> {
  const done = loaded[layer];
  if (done) return Promise.resolve(done);
  // A layer without a `contentChunk` (the fixture layer, M11 plan decision 8) has no content: the placeholder panel.
  const importer = importers[layer] ?? (() => Promise.resolve({ default: NO_CONTENT }));
  pending[layer] ??= importer().then((m) => {
    registerSoftContent(layer, m.default);
    return m.default;
  });
  return pending[layer];
}

/** A layer's content has arrived: keep it and add its edges (and patches) to the app's graph (M12 plan decision 3). Tests call it directly. */
export function registerSoftContent(layer: LazyLayerId, content: SoftLayerContent): void {
  loaded[layer] = content;
  registerLayerEdges(layer, content);
  version++;
  listeners.forEach((l) => l());
}

/** For tests: forget the content loaded so far (the graph has `resetAppGraph`). */
export function resetSoftContent(): void {
  for (const l of Object.keys(loaded) as LazyLayerId[]) delete loaded[l];
  for (const l of Object.keys(pending) as LazyLayerId[]) delete pending[l];
  version++;
}

/** The content loaded so far for a layer, else null. */
export const softContentOf = (layer: LazyLayerId): SoftLayerContent | null => loaded[layer] ?? null;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** A layer's content once loaded, else null (and starts the load). Null layer: nothing. */
export function useSoftContent(layer: LazyLayerId | null): SoftLayerContent | null {
  useSyncExternalStore(subscribe, () => version);
  const c = layer ? (loaded[layer] ?? null) : null;
  useEffect(() => {
    if (layer && !c) void loadSoftContent(layer).catch(() => undefined);
  }, [layer, c]);
  return c;
}
