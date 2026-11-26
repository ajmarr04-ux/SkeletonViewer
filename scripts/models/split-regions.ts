// Region chunking, the build step (SPEC-platform §6.3; M13 plan decision 9).
// Splits one layer's built, uncompressed GLB into one file per coarse body
// region: each structure goes in its home region's file (the chunk table,
// src/regions/chunks.ts, from assets/build/located-in.json), keeping its node,
// name, transform and mesh exactly. Run by scripts/compress-models.sh before
// gltfpack, for every file stem; a layer whose descriptor says
// `chunking: "single"` (every musculoskeletal layer) prints nothing, and the
// script then packs its one file as before.
//
//   npx tsx scripts/models/split-regions.ts <build_dir> <stem> <lod> <out_dir>
//   SKV_REGISTRY=fixture …   the test registry (the fixture's widgets)
//
// Prints the path of each chunk it wrote, one per line.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { NodeIO, type Document, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { chunkStem } from "../../src/regions/chunks";
import { readChunkTable } from "../lib/index-plugin";
import { registryOption } from "../lib/registry-option";

const [build, stem, lod, out] = process.argv.slice(2);
if (!build || !stem || !lod || !out) {
  console.error("usage: split-regions.ts <build_dir> <stem> <lod> <out_dir>");
  process.exit(2);
}

const reg = await registryOption();
const { table, errors } = readChunkTable(reg);
if (errors.length) {
  console.error(`split-regions: ${errors.join("\n  ")}`);
  process.exit(1);
}
const layer = Object.values(table).find((c) => c.file === stem);
if (!layer) process.exit(0); // one file: nothing to split

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const input = join(build, `${stem}-${lod}.glb`);

/** Free a node's subtree and whatever only it used (meshes, primitives, accessors). */
function dropNode(node: Node): void {
  for (const c of node.listChildren()) dropNode(c);
  const mesh = node.getMesh();
  node.dispose();
  if (mesh && mesh.listParents().every((p) => p.propertyType === "Root")) {
    for (const prim of mesh.listPrimitives()) {
      const used = [...prim.listAttributes(), prim.getIndices()].filter((a) => a !== null);
      prim.dispose();
      for (const a of used) if (a.listParents().every((p) => p.propertyType === "Root")) a.dispose();
    }
    mesh.dispose();
  }
}

const roots = (doc: Document) => (doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!).listChildren();
const all = new Set(layer.ids.flat());
const names = roots(await io.read(input)).map((n) => n.getName());
const problems = [
  ...names.filter((n) => !all.has(n)).map((n) => `${input}: node ${n || "(unnamed)"} is in no chunk`),
  ...[...all].filter((id) => !names.includes(id)).map((id) => `${input}: ${id} is missing`),
];
if (problems.length) {
  console.error(`split-regions:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const [i, chunk] of layer.chunks.entries()) {
  const keep = new Set(layer.ids[i]);
  const doc = await io.read(input); // a fresh copy per chunk
  for (const n of roots(doc)) if (!keep.has(n.getName())) dropNode(n);
  const path = join(out, `${chunkStem(stem, chunk, lod)}.glb`);
  await io.write(path, doc);
  console.log(path);
}
