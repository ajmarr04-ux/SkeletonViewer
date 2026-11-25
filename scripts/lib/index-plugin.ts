// Vite plugin: `virtual:skeleton-index`, the always-loaded ID index (M12 plan
// decision 7, SPEC-platform §4.5). It holds what the main chunk doesn't have
// already: every lazy layer's structures (each lazy layer's content half names
// its `idsFile`; for the musculoskeletal layers that is content/soft-ids.json,
// M6) trimmed to the fields the viewer uses (M7 plan decision 15), each
// muscle's depth resolved (the depth layer's `depthFile`), and the graph's
// non-structure nodes (the joints) with their names. The eager layer's
// structures are content/ids.json, which the main chunk imports directly.
// Packed by src/content/indexCodec.ts (mirrored right sides as references).
//
// Imported once, by src/content/indexData.ts (the app's entry and Vitest's
// setup file), which hands it to src/content/index.ts. Scripts and the other
// Vite plugins never resolve it.
//
// The registry is an option so the fixture build (`--mode fixture`, M11 plan
// decision 8) can pass the test registry; the default is the real one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { trimSoftIds, type RawSoftId } from "../../src/layers/softIds";
import type { LayerContent } from "../../src/systems/contentTypes";
import { REGIONS, REGISTRY } from "../../src/systems/registry";
import { encodeRegions, type PackedRegions } from "../../src/regions/codec";
import type { LocatedInFile } from "../../src/regions/membership";
import { CONTENT_REGISTRY, DEPTH_FILE, SYSTEM_CONTENT } from "../../src/systems/registry.content";
import type { LayerDescriptor } from "../../src/systems/types";
import type { IndexData } from "../../src/content/index";
import { encodeIndex } from "../../src/content/indexCodec";
import { root } from "./content-files";

const ID = "virtual:skeleton-index";
const RESOLVED = "\0" + ID;

export type RegistryOption = {
  layers: readonly LayerDescriptor[];
  content: Readonly<Record<string, LayerContent>>;
};
const REAL: RegistryOption = { layers: REGISTRY, content: CONTENT_REGISTRY };

/** Each ID file, with the lazy layers it holds (registry order; a file read once, in its own order). */
export function idFiles(reg: RegistryOption = REAL): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const l of reg.layers) {
    const file = reg.content[l.id]?.idsFile;
    if (l.models.eager || !file) continue;
    if (!out.has(file)) out.set(file, new Set());
    out.get(file)!.add(l.id);
  }
  return out;
}

const readJsonFile = (rel: string): unknown => JSON.parse(readFileSync(join(root, rel), "utf8"));

/** Every lazy layer's entries, from the files the registry names. */
export function readLayerIds(reg: RegistryOption = REAL, read: (rel: string) => unknown = readJsonFile): RawSoftId[] {
  return [...idFiles(reg)].flatMap(([file, layers]) => (read(file) as RawSoftId[]).filter((e) => layers.has(e.layer)));
}

/** The index's data: the eager layer's ID, the lazy layers' trimmed entries (file order) and the systems' joint nodes. */
export function readIndexData(reg: RegistryOption = REAL, read: (rel: string) => unknown = readJsonFile): IndexData {
  const depths = read(DEPTH_FILE) as Record<string, 1 | 2 | 3>;
  const entries = trimSoftIds(readLayerIds(reg, read), depths);
  const ctx = { readJson: read, kindOf: () => undefined, fm: {}, nodes: entries.map((e) => e.id) };
  const nodes = SYSTEM_CONTENT.flatMap((s) => s.nodes?.(ctx) ?? []);
  return { eager: reg.layers.find((l) => l.models.eager)!.id as IndexData["eager"], entries, nodes };
}

/**
 * The body regions for the index (M13 plan decision 5): the membership file the
 * registry's regions descriptor names, with the region names from the resolved
 * volumes, packed in index order (the eager ID file's IDs, then `data.entries`).
 */
export function readRegionData(data: IndexData, read: (rel: string) => unknown = readJsonFile): PackedRegions {
  const file = read(REGIONS.membershipFile) as LocatedInFile;
  const volumes = read(REGIONS.volumesFile) as { coarse: { key: string; name: string }[]; regions: { key: string; name: string }[] };
  const names = Object.fromEntries([...volumes.regions, ...volumes.coarse].map((r) => [r.key, r.name]));
  const ids = [...(read("content/ids.json") as { id: string }[]).map((e) => e.id), ...data.entries.map((e) => e.id)];
  return encodeRegions(file, names, ids);
}

export function indexPlugin(reg: RegistryOption = REAL): Plugin {
  return {
    name: "skeleton-index",
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      const data = readIndexData(reg, (rel) => {
        this.addWatchFile(join(root, rel));
        return readJsonFile(rel);
      });
      const regions = readRegionData(data, (rel) => {
        this.addWatchFile(join(root, rel));
        return readJsonFile(rel);
      });
      return `export default ${JSON.stringify(encodeIndex(data))};\nexport const regions = ${JSON.stringify(regions)};`;
    },
  };
}
