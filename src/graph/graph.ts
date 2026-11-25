// The runtime relationship graph (SPEC-platform §4.5; M12 plan decisions 1
// and 3). One index for the whole app: each content chunk registers its edges
// when it loads (idempotent per chunk, edges deduplicated across chunks), and
// the index keeps forward and inverse adjacency per edge type, built at
// registration. Generic: names no system, layer, kind or edge type.
//
// Order: every list keeps the order the edges were added in (the written
// order), chunk by chunk. A symmetric edge is stored once (`from < to`) and
// read from either end.

import { edgeKey } from "./compile";
import { edgeTypeIndex, type EdgeTypes } from "./edgeTypes";
import type { Edge, EdgeTypeDescriptor } from "./types";

export type Graph = {
  readonly types: EdgeTypes;
  /** Changes whenever a chunk adds edges (memoised queries key on it). */
  readonly version: number;
  /**
   * Add a chunk's edges. Returns false (and changes nothing) for a chunk
   * already added. An edge another chunk added already is skipped.
   */
  add(chunk: string, edges: readonly Edge[]): boolean;
  /** The edges of a type that leave a node (both ends' edges for a symmetric type), in written order. */
  out(id: string, type: string): readonly Edge[];
  /** The edges of a type that arrive at a node (the same as `out` for a symmetric type), in written order. */
  in(id: string, type: string): readonly Edge[];
  /**
   * The nodes one step away along a step name: an edge type ID (forward), an
   * inverse label (backward), or a symmetric type (either end). Each node once,
   * in written order. Throws on a name no registered type has.
   */
  neighbours(id: string, name: string): string[];
  /** Does the node have at least one edge along the step name? */
  has(id: string, name: string): boolean;
  /** Every edge added, in order. */
  edges(): readonly Edge[];
  subscribe(listener: () => void): () => void;
};

type Adjacency = Map<string, Map<string, Edge[]>>;

const push = (adj: Adjacency, id: string, type: string, e: Edge) => {
  let byType = adj.get(id);
  if (!byType) adj.set(id, (byType = new Map()));
  const list = byType.get(type);
  if (list) list.push(e);
  else byType.set(type, [e]);
};

const NONE: readonly Edge[] = [];

export function createGraph(edgeTypes: readonly EdgeTypeDescriptor[] | EdgeTypes): Graph {
  const types: EdgeTypes = "byLabel" in edgeTypes ? edgeTypes : edgeTypeIndex(edgeTypes);
  const forward: Adjacency = new Map();
  const backward: Adjacency = new Map();
  const all: Edge[] = [];
  /** Every edge added, by key: the copy that went into the lists. */
  const stored = new Map<string, Edge>();
  const chunks = new Set<string>();
  const listeners = new Set<() => void>();
  let version = 0;

  const resolve = (name: string) => {
    const r = types.byLabel(name);
    if (!r) throw new Error(`graph: no edge type or inverse label "${name}"`);
    return r;
  };
  const out = (id: string, type: string) => forward.get(id)?.get(type) ?? NONE;
  const inn = (id: string, type: string) => backward.get(id)?.get(type) ?? NONE;

  return {
    types,
    get version() {
      return version;
    },
    add(chunk, edges) {
      if (chunks.has(chunk)) return false;
      chunks.add(chunk);
      // Each node's lists as this chunk writes them, edges seen before included (as their stored copy).
      type Written = { adj: Adjacency; id: string; type: string; edges: Edge[] };
      const byKey = new Map<string, Written>();
      const note = (adj: Adjacency, id: string, type: string, key: string) => {
        const k = `${adj === forward ? ">" : "<"}${id}\u0000${type}`;
        let l = byKey.get(k);
        if (!l) byKey.set(k, (l = { adj, id, type, edges: [] }));
        l.edges.push(stored.get(key)!);
      };
      for (const e of edges) {
        const k = edgeKey(e);
        const fresh = !stored.has(k);
        if (fresh) {
          stored.set(k, e);
          all.push(e);
          push(forward, e.from, e.type, e);
          push(backward, e.to, e.type, e);
        }
        note(forward, e.from, e.type, k);
        note(backward, e.to, e.type, k);
        // A symmetric edge reads the same from either end.
        if (types.isSymmetric(e.type)) {
          if (fresh) {
            push(forward, e.to, e.type, e);
            push(backward, e.from, e.type, e);
          }
          note(forward, e.to, e.type, k);
          note(backward, e.from, e.type, k);
        }
      }
      // Written order doesn't depend on which chunk came first: a chunk holding
      // every edge a list already has (the edges' home chunk; another chunk's
      // reverse-index copies are a subset of it) sets that list's order.
      for (const l of byKey.values()) {
        const list = l.adj.get(l.id)!;
        const current = list.get(l.type)!;
        const written = [...new Set(l.edges)];
        if (written.length === current.length && written.every((e, i) => e === current[i])) continue;
        const has = new Set(written);
        if (current.every((e) => has.has(e))) list.set(l.type, written);
      }
      version++;
      listeners.forEach((l) => l());
      return true;
    },
    out,
    in: inn,
    neighbours(id, name) {
      const { type, inverse } = resolve(name);
      const list = inverse ? inn(id, type.id) : out(id, type.id);
      const result = new Set<string>();
      for (const e of list) {
        result.add(inverse ? e.from : type.symmetric && e.to === id ? e.from : e.to);
      }
      return [...result];
    },
    has(id, name) {
      const { type, inverse } = resolve(name);
      return (inverse ? inn(id, type.id) : out(id, type.id)).length > 0;
    },
    edges: () => all,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
