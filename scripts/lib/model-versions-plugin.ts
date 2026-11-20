// Vite plugin: `virtual:skeleton-model-versions`, a short content hash of each
// public/models/*.glb, so the layer files can be requested as `…glb?v=<hash>`.
// A rebuilt file then gets a new URL, and a browser's cached copy of the old
// one (GitHub Pages sends max-age=600) is never paired with the new manifest.
// Only the debug layer view imports it (a lazy chunk); the bone files keep
// their plain URLs, which index.html's preload has to match.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { root } from "./content-files";

const ID = "virtual:skeleton-model-versions";
const RESOLVED = "\0" + ID;
export const modelsDir = join(root, "public/models");

/** File stem (`muscles-high`) → first 10 hex digits of its SHA-256. */
export function modelVersions(dir: string = modelsDir): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".glb")) continue;
    out[f.slice(0, -4)] = createHash("sha256").update(readFileSync(join(dir, f))).digest("hex").slice(0, 10);
  }
  return out;
}

/** File stem → size in bytes (the Layers panel's progress, M7 plan decision 3). */
export function modelSizes(dir: string = modelsDir): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of readdirSync(dir).sort()) if (f.endsWith(".glb")) out[f.slice(0, -4)] = statSync(join(dir, f)).size;
  return out;
}

export function modelVersionsPlugin(): Plugin {
  return {
    name: "skeleton-model-versions",
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile(modelsDir);
      return `export default ${JSON.stringify(modelVersions())};\nexport const sizes = ${JSON.stringify(modelSizes())};`;
    },
  };
}
