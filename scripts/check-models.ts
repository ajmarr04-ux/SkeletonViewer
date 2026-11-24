// Check the compressed models in public/models against the canonical ID lists
// and the Blender manifests (Milestone 1 step 4; M6 step 6 adds the four
// soft-tissue layer files). Exits non-zero on failure.
//   npx tsx scripts/check-models.ts      (npm run check-models)
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { EAGER_LAYER } from "../src/systems/registry";
import {
  LAYER_FILES,
  checkSize,
  checkTriangles,
  compareBounds,
  compareNames,
  expectedLayerNodeNames,
  expectedNodeNames,
  fileStem,
  layerBudget,
  lodBudget,
  type Bounds,
  type IdEntry,
  type LodBudget,
  type SoftIdEntry,
  type Vec3,
} from "./lib/model-checks";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = JSON.parse(readFileSync(join(root, "content/ids.json"), "utf8")) as IdEntry[];
type ManifestLod = { tris: number; bboxMin: Vec3; bboxMax: Vec3 };
type Manifest = { sourceTris?: number; objects: Record<string, { lods: Record<string, ManifestLod> }> };
const readJson = <T>(rel: string) => JSON.parse(readFileSync(join(root, rel), "utf8")) as T;
const softIds = readJson<SoftIdEntry[]>("content/soft-ids.json");
const attachmentIds = Object.keys(
  readJson<{ attachments: Record<string, unknown> }>("assets/mapping/soft-to-id.json").attachments,
);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder,
});

/** Primitives under a node that lack the baked AO attribute. */
function primitivesWithoutAO(node: Node): number {
  let n = 0;
  for (const prim of node.getMesh()?.listPrimitives() ?? []) if (!prim.getAttribute("COLOR_0")) n++;
  for (const c of node.listChildren()) n += primitivesWithoutAO(c);
  return n;
}

function subtreeTriangles(node: Node): number {
  let n = 0;
  const mesh = node.getMesh();
  for (const prim of mesh?.listPrimitives() ?? []) {
    if (prim.getMode() !== 4) continue; // TRIANGLES only
    const count = prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION")?.getCount() ?? 0;
    n += count / 3;
  }
  for (const c of node.listChildren()) n += subtreeTriangles(c);
  return n;
}

const errors: string[] = [];

async function checkFile(stem: string, expected: string[], manifest: Manifest, budgets: Record<"high" | "low", LodBudget>) {
  for (const lod of ["high", "low"] as const) {
    const tag = `${stem}-${lod}`;
    const file = join(root, `public/models/${tag}.glb`);
    const bytes = statSync(file).size;
    const doc = await io.read(file);
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!;
    // Named top-level nodes are the structures; gltfpack hangs each mesh (with
    // its dequantisation transform) on an unnamed child.
    const named = scene.listChildren().filter((n) => n.getName() !== "");
    const unnamedRoots = scene.listChildren().length - named.length;
    if (unnamedRoots) errors.push(`${tag}: ${unnamedRoots} unnamed root nodes`);
    errors.push(...compareNames(expected, named.map((n) => n.getName())).map((e) => `${tag}: ${e}`));

    let tris = 0;
    const bounds = new Map<string, Bounds>();
    for (const n of named) {
      const t = subtreeTriangles(n);
      if (t === 0) errors.push(`${tag}: node ${n.getName()} has no triangles`);
      if (primitivesWithoutAO(n)) errors.push(`${tag}: node ${n.getName()} has no COLOR_0 (baked AO)`);
      tris += t;
      const b = getBounds(n);
      bounds.set(n.getName(), { min: b.min as Vec3, max: b.max as Vec3 });
    }
    const mb: Record<string, Bounds | undefined> = {};
    for (const [id, o] of Object.entries(manifest.objects)) {
      const l = o.lods[lod];
      if (l) mb[id] = { min: l.bboxMin, max: l.bboxMax };
    }
    const cmp = compareBounds(tag, bounds, mb);
    errors.push(...checkSize(tag, bytes, budgets[lod]), ...checkTriangles(tag, tris, budgets[lod]), ...cmp.errors);
    console.log(
      `${tag}: ${named.length} nodes, ${tris} triangles, ${(bytes / 1e6).toFixed(2)} MB, ` +
        `max bounds drift ${(cmp.maxDelta * 1000).toFixed(3)} mm`,
    );
  }
}

// The eager layer (the skeleton), then every lazy layer and overlay, from the registry.
await checkFile(fileStem(EAGER_LAYER), expectedNodeNames(ids), readJson<Manifest>("assets/build/manifest.json"), {
  high: lodBudget(EAGER_LAYER, "high"),
  low: lodBudget(EAGER_LAYER, "low"),
});
for (const layer of LAYER_FILES) {
  const manifest = readJson<Manifest>(`assets/build/manifest-${layer}.json`);
  const src = manifest.sourceTris ?? Infinity;
  await checkFile(fileStem(layer), expectedLayerNodeNames(layer, softIds, attachmentIds), manifest, {
    high: layerBudget(layer, "high", src),
    low: layerBudget(layer, "low", src),
  });
}

if (errors.length) {
  console.error(`check-models FAILED (${errors.length}):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log("check-models: OK");
