// The wire format of a chunk's edges (M12 plan decision 3). Generic: names no
// edge type. Each chunk carries its own ID table, so a chunk decodes without
// the ID index (the fixture build's index differs from the real one), and per
// edge type a run-length list: `[from, n, to × n, from, n, …]`, where a run
// merges consecutive edges with the same `from` (regions.json writes a bone's
// neighbours together). Edges keep their order within each type, which is all
// the runtime graph's adjacency lists read. Meta, where a type has any, is a
// parallel list, one `k=v&k=v` string (or 0) per edge.

import type { Edge } from "./types";

export type EdgeWire = {
  ids: string[];
  t: Record<string, { r: number[]; m?: (string | 0)[] }>;
};

const META_SAFE = /^[^=&]*$/;

export function encodeEdges(edges: readonly Edge[]): EdgeWire {
  const ids: string[] = [];
  const index = new Map<string, number>();
  const at = (s: string) => {
    let i = index.get(s);
    if (i === undefined) {
      i = ids.length;
      ids.push(s);
      index.set(s, i);
    }
    return i;
  };
  const t: EdgeWire["t"] = {};
  const runStart = new Map<string, number>();
  const metas = new Map<string, (string | 0)[]>();
  for (const e of edges) {
    const row = (t[e.type] ??= { r: [] });
    const f = at(e.from);
    const start = runStart.get(e.type);
    if (start !== undefined && row.r[start] === f) {
      row.r[start + 1]!++;
      row.r.push(at(e.to));
    } else {
      runStart.set(e.type, row.r.length);
      row.r.push(f, 1, at(e.to));
    }
    let meta: string | 0 = 0;
    if (e.meta && Object.keys(e.meta).length > 0) {
      meta = Object.entries(e.meta)
        .map(([k, v]) => {
          if (!META_SAFE.test(k) || !META_SAFE.test(v)) throw new Error(`encodeEdges: meta ${k}=${v} contains "=" or "&"`);
          return `${k}=${v}`;
        })
        .join("&");
    }
    const list = metas.get(e.type) ?? metas.set(e.type, []).get(e.type)!;
    list.push(meta);
  }
  for (const [type, list] of metas) if (list.some((m) => m !== 0)) t[type]!.m = list;
  return { ids, t };
}

export function decodeEdges(wire: EdgeWire): Edge[] {
  const out: Edge[] = [];
  for (const [type, { r, m }] of Object.entries(wire.t)) {
    let k = 0;
    for (let i = 0; i < r.length; ) {
      const from = wire.ids[r[i]!]!;
      const n = r[i + 1]!;
      for (let j = 0; j < n; j++) {
        const e: Edge = { from, type, to: wire.ids[r[i + 2 + j]!]! };
        const meta = m?.[k];
        if (meta) e.meta = Object.fromEntries(meta.split("&").map((kv) => kv.split("=") as [string, string]));
        out.push(e);
        k++;
      }
      i += 2 + n;
    }
  }
  return out;
}
