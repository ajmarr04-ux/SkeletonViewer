// Which chunk ships each edge (M12 plan decision 3, SPEC-platform §4.5).
// Generic: names no layer or edge type. Build time only.
//
// - An edge ships in the chunk of its `from`'s layer; a `from` in the eager
//   layer or in no layer (a joint node) ships in the eager (main) chunk.
// - As the reverse index, it also ships in its `to`'s lazy layer's chunk.
// - A symmetric edge ships with both endpoints' layers (eager included).
// A structure's panel and tiers so need the main chunk, its own layer's chunk
// and the chunks of the layers showing, nothing else.

import type { Edge } from "./types";

export function shipEdges(
  edges: readonly Edge[],
  opts: { eager: string; lazy: readonly string[]; layerOf(id: string): string | undefined; isSymmetric(type: string): boolean },
): Record<string, Edge[]> {
  const lazy = new Set(opts.lazy);
  const out: Record<string, Edge[]> = { [opts.eager]: [] };
  for (const l of opts.lazy) out[l] = [];
  const home = (id: string) => {
    const l = opts.layerOf(id);
    return l !== undefined && lazy.has(l) ? l : opts.eager;
  };
  for (const e of edges) {
    const to = opts.layerOf(e.to);
    const chunks = new Set([home(e.from)]);
    if (opts.isSymmetric(e.type)) chunks.add(home(e.to));
    else if (to !== undefined && lazy.has(to)) chunks.add(to);
    for (const c of chunks) out[c]!.push(e);
  }
  return out;
}
