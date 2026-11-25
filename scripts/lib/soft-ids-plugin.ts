// Vite plugin: `virtual:skeleton-soft-ids`, the lazy layers' ID table (each
// lazy layer's content half names its `idsFile`; for the musculoskeletal
// layers that is content/soft-ids.json, M6) with each muscle's depth (the depth
// layer's `depthFile`, content/muscle-depth.json) resolved, trimmed to the
// fields the viewer uses in M7 (plan decision 15). Only the lazy layer chunk
// imports it, so the default load never fetches it.
//
// The registry is an option so the fixture build (`--mode fixture`, M11 plan
// decision 8) can pass the test registry; the default is the real one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { trimSoftIds, type RawSoftId } from "../../src/layers/softIds";
import type { LayerContent } from "../../src/systems/contentTypes";
import { REGISTRY } from "../../src/systems/registry";
import { CONTENT_REGISTRY, DEPTH_FILE } from "../../src/systems/registry.content";
import type { LayerDescriptor } from "../../src/systems/types";
import { root } from "./content-files";

const ID = "virtual:skeleton-soft-ids";
const RESOLVED = "\0" + ID;
const depthFile = join(root, DEPTH_FILE);

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

/** Every lazy layer's entries, from the files the registry names. */
export function readLayerIds(reg: RegistryOption = REAL): RawSoftId[] {
  return [...idFiles(reg)].flatMap(([file, layers]) =>
    (JSON.parse(readFileSync(join(root, file), "utf8")) as RawSoftId[]).filter((e) => layers.has(e.layer)),
  );
}

export function softIdsPlugin(reg: RegistryOption = REAL): Plugin {
  return {
    name: "skeleton-soft-ids",
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      for (const f of idFiles(reg).keys()) this.addWatchFile(join(root, f));
      this.addWatchFile(depthFile);
      const depths = JSON.parse(readFileSync(depthFile, "utf8")) as Record<string, 1 | 2 | 3>;
      return `export default ${JSON.stringify(trimSoftIds(readLayerIds(reg), depths))};`;
    },
  };
}
