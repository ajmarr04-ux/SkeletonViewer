// What the region scripts and validate-content read from disk (M13): the
// structures with a mesh and their layers, and every key a region key must not reuse.
import { EAGER_LAYER, LAZY_LAYERS, type LayerId } from "../../src/systems/registry";
import { readIds, readJson, readSoftIds } from "./content-files";

/** Every structure with a mesh → its layer (the eager layer's ID file, then the lazy layers'). */
export function meshLayers(): Map<string, LayerId> {
  const out = new Map<string, LayerId>();
  for (const e of readIds()) if (e.meshAvailable) out.set(e.id, EAGER_LAYER);
  for (const e of readSoftIds()) if (e.meshAvailable && (LAZY_LAYERS as readonly string[]).includes(e.layer)) out.set(e.id, e.layer as LayerId);
  return out;
}

/** Every key a region key must not reuse: structure IDs, joint and articulation IDs, hierarchy group keys. */
export function takenKeys(): Set<string> {
  const out = new Set<string>([...readIds().map((e) => e.id), ...readSoftIds().map((e) => e.id)]);
  for (const j of readJson("content/joints.json") as { id: string }[]) out.add(j.id);
  for (const a of readJson("content/articulations.json") as { joint: string }[]) out.add(a.joint);
  type H = { key: string; children: (H | string)[] };
  const walk = (n: H) => {
    out.add(n.key);
    for (const c of n.children) if (typeof c !== "string") walk(c);
  };
  (readJson("content/hierarchy.json") as H[]).forEach(walk);
  return out;
}

/** A layer's build manifest (repo path): the eager layer's is `manifest.json`, the others `manifest-<layer>.json` (as check-models reads them). */
export const manifestPath = (layer: LayerId): string => (layer === EAGER_LAYER ? "assets/build/manifest.json" : `assets/build/manifest-${layer}.json`);
