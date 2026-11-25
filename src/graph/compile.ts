// The generic edge compiler and its checks (SPEC-platform §4.1, §10; M12 plan
// decision 1). Pure: the content scripts, the Vite plugin and Vitest run it on
// edges extracted from the authoring files and on the derived edges computed
// from them. Names no system, layer, kind or edge type.
//
// Checks: every edge's type is registered; an authoring file never writes a
// derived type; both endpoints exist; a symmetric edge is stored once, as
// `from < to`. Exact duplicates (same ends, type and meta) are dropped, the
// first kept, so the edges keep the order the sources wrote them in.

import { edgeTypeIndex } from "./edgeTypes";
import type { Edge, EdgeTypeDescriptor } from "./types";

/** Edges one source wrote, and where, for the error messages ("content/ligaments/acl_left.md"). */
export type EdgeSource = { where: string; edges: readonly Edge[] };
/** A derived-edge rule: the edges so far → new edges (spec §4.4). */
export type EdgeRule = { where: string; derive: (edges: readonly Edge[]) => readonly Edge[] };

export type CompileInput = {
  /** Every ID an edge may name: structures and the non-structure nodes (joints). */
  nodes: Iterable<string>;
  types: readonly EdgeTypeDescriptor[];
  sources: readonly EdgeSource[];
  /** Run in order, each seeing every edge before it. */
  rules?: readonly EdgeRule[];
};

export type CompiledGraph = { edges: Edge[]; errors: string[] };

const metaKey = (m: Edge["meta"]): string =>
  m
    ? Object.keys(m)
        .sort()
        .map((k) => `${k}=${m[k]}`)
        .join("&")
    : "";
export const edgeKey = (e: Edge): string => `${e.from}\u0000${e.type}\u0000${e.to}\u0000${metaKey(e.meta)}`;

export function compileGraph(input: CompileInput): CompiledGraph {
  const types = edgeTypeIndex(input.types);
  const nodes = new Set(input.nodes);
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  const add = (where: string, e: Edge, derived: boolean) => {
    const t = types.edgeType(e.type);
    if (!t) return void errors.push(`${where}: edge type ${e.type} is not registered`);
    if (t.derived && !derived) return void errors.push(`${where}: ${e.type} is derived and can't be written by a file`);
    const missing = [e.from, e.to].filter((x) => !nodes.has(x));
    if (missing.length > 0) return void errors.push(`${where}: ${e.type} ${e.from} → ${e.to}: ${[...new Set(missing)].join(", ")} not known`);
    if (e.from === e.to) return void errors.push(`${where}: ${e.type} ${e.from} → itself`);
    const stored: Edge = t.symmetric && e.to < e.from ? { ...e, from: e.to, to: e.from } : e;
    const k = edgeKey(stored);
    if (seen.has(k)) return;
    seen.add(k);
    edges.push(stored);
  };

  for (const s of input.sources) for (const e of s.edges) add(s.where, e, false);
  for (const r of input.rules ?? []) for (const e of r.derive(edges.slice())) add(r.where, e, true);
  return { edges, errors };
}

/** Edge counts per type, in the registered order (types with none left out). */
export function edgeCounts(edges: readonly Edge[], types: readonly EdgeTypeDescriptor[]): [string, number][] {
  const n = new Map<string, number>();
  for (const e of edges) n.set(e.type, (n.get(e.type) ?? 0) + 1);
  return types.flatMap((t) => (n.has(t.id) ? [[t.id, n.get(t.id)!] as [string, number]] : []));
}
