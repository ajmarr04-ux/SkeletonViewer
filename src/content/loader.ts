// Lazy loading of the compiled content (plan step 4): a separate chunk, fetched
// once the first LOD is on screen (or as soon as the panel needs it), so the
// text never delays the first frame.

import { useEffect, useSyncExternalStore } from "react";
import { EAGER_LAYER } from "../systems/registry";
import { registerContentEdges } from "./appGraph";
import type { CompiledContent } from "./compile";

let content: CompiledContent | null = null;
let pending: Promise<CompiledContent> | null = null;
const listeners = new Set<() => void>();

export function loadContent(): Promise<CompiledContent> {
  if (content) return Promise.resolve(content);
  pending ??= import("virtual:skeleton-content").then((m) => {
    // The attachment edges into the bones, so their panels need no lazy chunk (M12 BD).
    registerContentEdges(`${EAGER_LAYER}-content`, m.edges);
    content = m.default;
    listeners.forEach((l) => l());
    return content;
  });
  return pending;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The compiled content once loaded, else null (and starts the load). */
export function useContent(): CompiledContent | null {
  const c = useSyncExternalStore(subscribe, () => content);
  useEffect(() => {
    if (!c) void loadContent();
  }, [c]);
  return c;
}
