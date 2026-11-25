// Resolve the body regions' volumes (M13 plan decision 2, step 1).
//   npm run regions:volumes            writes assets/build/region-volumes.json
//   npm run regions:volumes -- --check fails if that file is stale (in `npm run check`)
// Reads content/regions/regions.json and the anchors' vertices from the high-LOD
// layer files (the eager layer first; a lazy layer's file only if an anchor is in it).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EAGER_LAYER, LAZY_LAYERS, type LayerId } from "../../src/systems/registry";
import { checkRegionsFile, expandRegions, resolveRegions, type RegionsFile } from "../../src/regions/volume";
import { volumesStale } from "../../src/regions/stale";
import { fileStem } from "../lib/model-checks";
import { readNodePoints } from "../lib/glb-points";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = "content/regions/regions.json";
const OUT = "assets/build/region-volumes.json";
const readJson = <T>(rel: string) => JSON.parse(readFileSync(join(root, rel), "utf8")) as T;

type Entry = { id: string; meshAvailable: boolean; layer?: string };
const ids = readJson<Entry[]>("content/ids.json");
const softIds = readJson<Entry[]>("content/soft-ids.json");
const layerOf = new Map<string, LayerId>();
for (const e of ids) if (e.meshAvailable) layerOf.set(e.id, EAGER_LAYER);
for (const e of softIds) if (e.meshAvailable && (LAZY_LAYERS as readonly string[]).includes(e.layer!)) layerOf.set(e.id, e.layer as LayerId);

/** Every key a region key must not reuse: structure IDs, joint and articulation IDs, hierarchy group keys. */
function takenKeys(): Set<string> {
  const out = new Set<string>([...ids.map((e) => e.id), ...softIds.map((e) => e.id)]);
  for (const j of readJson<{ id: string }[]>("content/joints.json")) out.add(j.id);
  for (const a of readJson<{ joint: string }[]>("content/articulations.json")) out.add(a.joint);
  type H = { key: string; children: (H | string)[] };
  const walk = (n: H) => {
    out.add(n.key);
    for (const c of n.children) if (typeof c !== "string") walk(c);
  };
  readJson<H[]>("content/hierarchy.json").forEach(walk);
  return out;
}

const text = readFileSync(join(root, SOURCE), "utf8");
const file = JSON.parse(text) as RegionsFile;
const errors = checkRegionsFile(file, new Set(layerOf.keys()), takenKeys());
if (errors.length) {
  console.error(`${SOURCE}:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

// Load only the layer files the anchors need.
const needed = new Set<LayerId>();
for (const r of expandRegions(file).regions)
  for (const { spec } of r.shapes) if ("fit" in spec) for (const a of spec.fit) needed.add(layerOf.get(typeof a === "string" ? a : a.id)!);
const points = new Map<string, Float64Array>();
for (const layer of needed) {
  for (const [id, p] of await readNodePoints(join(root, `public/models/${fileStem(layer)}-high.glb`))) points.set(id, p);
}
const pointsOf = (id: string) => {
  const p = points.get(id);
  if (!p) throw new Error(`no vertices for ${id}`);
  return p;
};

const sourceHash = createHash("sha256").update(text).digest("hex");
const volumes = resolveRegions(file, pointsOf, sourceHash);
const json = JSON.stringify(volumes, null, 1) + "\n";

const fine = volumes.regions.length;
const shapes = volumes.regions.reduce((n, r) => n + r.shapes.length, 0);
const literal = volumes.regions.filter((r) => r.literal).map((r) => r.key);
const summary = `${volumes.coarse.length} coarse, ${fine} fine regions, ${shapes} shapes${literal.length ? `; literal shapes in ${literal.join(", ")}` : ""}`;

if (process.argv.includes("--check")) {
  const stale = volumesStale(readFileSync(join(root, OUT), "utf8"), json);
  if (stale) {
    console.error(`${OUT} is stale (${stale}). Run: npm run regions:volumes`);
    process.exit(1);
  }
  console.log(`${OUT}: up to date (${summary})`);
} else {
  writeFileSync(join(root, OUT), json);
  console.log(`wrote ${OUT}: ${summary}`);
}
