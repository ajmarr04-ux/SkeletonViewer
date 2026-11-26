// Check the compressed models in public/models against the canonical ID lists
// and the Blender manifests (Milestone 1 step 4; M6 step 6 adds the four
// soft-tissue layer files). Exits non-zero on failure. M13 (plan decision 9):
// a layer chunked by body region is checked over the union of its chunks, the
// same way as a single file, plus every structure in its home chunk.
//   npx tsx scripts/check-models.ts      (npm run check-models)
//   SKV_REGISTRY=fixture npx tsx scripts/check-models.ts   the fixture layer's own files only
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { checkChunks, chunkStem, type LayerChunks } from "../src/regions/chunks";
import { EAGER_LAYER } from "../src/systems/registry";
import { readChunkTable, readLayerIds } from "./lib/index-plugin";
import { registryOption } from "./lib/registry-option";
import {
  LAYER_FILES,
  TRI_TOLERANCE,
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

/** Where a layer's files are (default public/models), and its chunks if it is chunked. */
type Files = { dir?: string; chunks?: LayerChunks };

async function checkFile(stem: string, expected: string[], manifest: Manifest, budgets: Record<"high" | "low", LodBudget>, files: Files = {}) {
  for (const lod of ["high", "low"] as const) {
    const tag = `${stem}-${lod}`;
    // One file, or every chunk checked as one union (sizes and triangles summed).
    const parts = files.chunks ? files.chunks.chunks.map((c) => ({ chunk: c, name: chunkStem(stem, c, lod) })) : [{ chunk: "", name: tag }];
    let bytes = 0;
    const named: Node[] = [];
    const inChunk = new Map<string, string[]>();
    for (const part of parts) {
      const file = join(root, files.dir ?? "public/models", `${part.name}.glb`);
      const size = statSync(file).size;
      bytes += size;
      const doc = await io.read(file);
      const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!;
      // Named top-level nodes are the structures; gltfpack hangs each mesh (with
      // its dequantisation transform) on an unnamed child.
      const mine = scene.listChildren().filter((n) => n.getName() !== "");
      const unnamedRoots = scene.listChildren().length - mine.length;
      if (unnamedRoots) errors.push(`${part.name}: ${unnamedRoots} unnamed root nodes`);
      named.push(...mine);
      inChunk.set(part.chunk, mine.map((n) => n.getName()));
      if (files.chunks) console.log(`  ${part.name}: ${mine.length} nodes, ${(size / 1e3).toFixed(1)} kB`);
    }
    if (files.chunks) errors.push(...checkChunks(tag, files.chunks, inChunk));
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

const reg = await registryOption();
const { table: chunkTable, errors: tableErrors } = readChunkTable(reg);
errors.push(...tableErrors);

if (reg?.modelFiles) {
  // SKV_REGISTRY=fixture: the test layers' own files (the plain run checks the real ones).
  const layerIds = readLayerIds(reg);
  for (const [layer, where] of Object.entries(reg.modelFiles)) {
    const { models } = reg.layers.find((l) => l.id === layer)!;
    const budget = (lod: "high" | "low"): LodBudget => ({ maxBytes: models.budgets[lod].maxMiB * 1024 * 1024, targetTris: models.budgets[lod].targetTris, triTolerance: TRI_TOLERANCE });
    const expected = layerIds.filter((e) => e.layer === layer && e.meshAvailable).map((e) => e.id);
    await checkFile(models.file, expected, readJson<Manifest>(where.manifest), { high: budget("high"), low: budget("low") }, { dir: where.dir, chunks: chunkTable[layer] });
  }
} else {
  // The eager layer (the skeleton), then every lazy layer and overlay, from the registry.
  await checkFile(fileStem(EAGER_LAYER), expectedNodeNames(ids), readJson<Manifest>("assets/build/manifest.json"), {
    high: lodBudget(EAGER_LAYER, "high"),
    low: lodBudget(EAGER_LAYER, "low"),
  });
  for (const layer of LAYER_FILES) {
    const manifest = readJson<Manifest>(`assets/build/manifest-${layer}.json`);
    const src = manifest.sourceTris ?? Infinity;
    await checkFile(
      fileStem(layer),
      expectedLayerNodeNames(layer, softIds, attachmentIds),
      manifest,
      { high: layerBudget(layer, "high", src), low: layerBudget(layer, "low", src) },
      { chunks: chunkTable[layer] },
    );
  }
}

if (errors.length) {
  console.error(`check-models FAILED (${errors.length}):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log("check-models: OK");
