// Region chunking (SPEC-platform §6.3; M13 plan decision 9). A layer whose
// `ModelSpec.chunking` is "region" ships one file per coarse region per LOD,
// `<file>-<coarse>-<lod>.glb`; each structure lives in the file of its *home*
// coarse region (assets/build/located-in.json), so it is stored once, keeps
// its name and never moves. Pure: the chunk table (which structures go in which
// file), the plan of what to fetch for a body region, and the checks.
// Names no layer or region. Used by the splitter, check-models, the Vite
// plugin (`virtual:skeleton-chunks`) and the lazy layer chunk's loader.

/** One chunked layer: its coarse chunks in coarse-region order (only those holding a structure) and each chunk's structures. */
export type LayerChunks = { file: string; chunks: string[]; ids: string[][] };
/** Every chunked layer, by layer ID. Single-file layers are not in it. */
export type ChunkTable = Readonly<Record<string, LayerChunks>>;

/** A chunk's file stem: `<file>-<coarse>-<lod>`. */
export const chunkStem = (file: string, chunk: string, lod: string): string => `${file}-${chunk}-${lod}`;

/**
 * A layer's chunks: its structures with a mesh grouped by home coarse region,
 * in `coarseOrder`. Errors for a structure without a home (it would be in no file).
 */
export function layerChunks(
  file: string,
  ids: readonly string[],
  homeOf: (id: string) => string | null | undefined,
  coarseOrder: readonly string[],
): { chunks: LayerChunks; errors: string[] } {
  const by = new Map<string, string[]>();
  const errors: string[] = [];
  for (const id of ids) {
    const home = homeOf(id);
    if (!home || !coarseOrder.includes(home)) {
      errors.push(`${id}: no home coarse region, so it would be in no chunk (run npm run regions)`);
      continue;
    }
    if (!by.has(home)) by.set(home, []);
    by.get(home)!.push(id);
  }
  const chunks = coarseOrder.filter((c) => by.has(c));
  return { chunks: { file, chunks, ids: chunks.map((c) => by.get(c)!) }, errors };
}

/** Structure → its chunk, for one layer. */
export function homeChunks(c: LayerChunks): Map<string, string> {
  const out = new Map<string, string>();
  c.chunks.forEach((chunk, i) => c.ids[i]!.forEach((id) => out.set(id, chunk)));
  return out;
}

/**
 * The chunks to fetch for a layer (decision 9): every chunk with no body
 * region; with one, the chunks holding a member of it (`members`: the
 * region's members, any layer), plus the chunk of each of `extra` (a selection
 * drawn from outside the region). In the layer's chunk order. `null` for a
 * layer that isn't chunked (one file).
 */
export function chunksFor(c: LayerChunks | undefined, region: string | null, members: readonly string[], extra: readonly (string | null)[] = []): string[] | null {
  if (!c) return null;
  if (region === null) return [...c.chunks];
  const home = homeChunks(c);
  const want = new Set<string>();
  for (const id of [...members, ...extra]) {
    const h = id === null ? undefined : home.get(id);
    if (h) want.add(h);
  }
  return c.chunks.filter((k) => want.has(k));
}

/**
 * check-models for a chunked layer (decision 9): every expected structure
 * exactly once over all chunks, and in its home chunk. `actual`: chunk → node names.
 */
export function checkChunks(tag: string, c: LayerChunks, actual: ReadonlyMap<string, readonly string[]>): string[] {
  const errors: string[] = [];
  const home = homeChunks(c);
  const seen = new Map<string, string>();
  for (const chunk of c.chunks) if (!actual.has(chunk)) errors.push(`${tag}: chunk ${chunk} is missing`);
  for (const [chunk, names] of actual) {
    if (!c.chunks.includes(chunk)) errors.push(`${tag}: unexpected chunk ${chunk}`);
    for (const n of names) {
      const before = seen.get(n);
      if (before !== undefined) errors.push(`${tag}: ${n} is in chunks ${before} and ${chunk}`);
      seen.set(n, chunk);
      const h = home.get(n);
      if (h === undefined) errors.push(`${tag}: unexpected node ${n} in chunk ${chunk}`);
      else if (h !== chunk) errors.push(`${tag}: ${n} is in chunk ${chunk}, but its home is ${h}`);
    }
  }
  for (const id of home.keys()) if (!seen.has(id)) errors.push(`${tag}: ${id} is in no chunk`);
  return errors;
}
