// Check the compressed models in public/models against the canonical ID list
// and the Blender manifest (Milestone 1, step 4). Exits non-zero on failure.
//   npx tsx scripts/check-models.ts      (npm run check-models)
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  LOD_BUDGETS,
  checkSize,
  checkTriangles,
  compareBounds,
  compareNames,
  expectedNodeNames,
  type Bounds,
  type IdEntry,
  type Vec3,
} from "./lib/model-checks";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = JSON.parse(readFileSync(join(root, "content/ids.json"), "utf8")) as IdEntry[];
type ManifestLod = { tris: number; bboxMin: Vec3; bboxMax: Vec3 };
const manifest = JSON.parse(readFileSync(join(root, "assets/build/manifest.json"), "utf8")) as {
  objects: Record<string, { lods: Record<string, ManifestLod> }>;
};

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
const expected = expectedNodeNames(ids);
for (const lod of ["high", "low"] as const) {
  const file = join(root, `public/models/skeleton-${lod}.glb`);
  const bytes = statSync(file).size;
  const doc = await io.read(file);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!;
  // Named top-level nodes are the bones; gltfpack hangs each mesh (with its
  // dequantisation transform) on an unnamed child.
  const named = scene.listChildren().filter((n) => n.getName() !== "");
  const unnamedRoots = scene.listChildren().length - named.length;
  if (unnamedRoots) errors.push(`${lod}: ${unnamedRoots} unnamed root nodes`);
  errors.push(...compareNames(expected, named.map((n) => n.getName())).map((e) => `${lod}: ${e}`));

  let tris = 0;
  const bounds = new Map<string, Bounds>();
  for (const n of named) {
    const t = subtreeTriangles(n);
    if (t === 0) errors.push(`${lod}: node ${n.getName()} has no triangles`);
    if (primitivesWithoutAO(n)) errors.push(`${lod}: node ${n.getName()} has no COLOR_0 (baked AO)`);
    tris += t;
    const b = getBounds(n);
    bounds.set(n.getName(), { min: b.min as Vec3, max: b.max as Vec3 });
  }
  const mb: Record<string, Bounds | undefined> = {};
  for (const [id, o] of Object.entries(manifest.objects)) {
    const l = o.lods[lod];
    if (l) mb[id] = { min: l.bboxMin, max: l.bboxMax };
  }
  const cmp = compareBounds(lod, bounds, mb);
  errors.push(...checkSize(lod, bytes, LOD_BUDGETS[lod]), ...checkTriangles(lod, tris, LOD_BUDGETS[lod]), ...cmp.errors);
  console.log(
    `${lod}: ${named.length} nodes, ${tris} triangles, ${(bytes / 1e6).toFixed(2)} MB, ` +
      `max bounds drift ${(cmp.maxDelta * 1000).toFixed(3)} mm`,
  );
}

if (errors.length) {
  console.error(`check-models FAILED (${errors.length}):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log("check-models: OK");
