// Vite plugin: `virtual:skeleton-soft-ids`, the soft-tissue ID table
// (content/soft-ids.json, M6) with each muscle's depth (content/muscle-depth.json) resolved, trimmed to the fields the viewer uses in M7
// (plan decision 15). Only the lazy layer chunk imports it, so the default
// load never fetches it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { trimSoftIds, type RawSoftId } from "../../src/layers/softIds";
import { root } from "./content-files";

const ID = "virtual:skeleton-soft-ids";
const RESOLVED = "\0" + ID;
const file = join(root, "content/soft-ids.json");
const depthFile = join(root, "content/muscle-depth.json");

export function readSoftIds(): RawSoftId[] {
  return JSON.parse(readFileSync(file, "utf8")) as RawSoftId[];
}

export function softIdsPlugin(): Plugin {
  return {
    name: "skeleton-soft-ids",
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile(file);
      this.addWatchFile(depthFile);
      const depths = JSON.parse(readFileSync(depthFile, "utf8")) as Record<string, 1 | 2 | 3>;
      return `export default ${JSON.stringify(trimSoftIds(readSoftIds(), depths))};`;
    },
  };
}
