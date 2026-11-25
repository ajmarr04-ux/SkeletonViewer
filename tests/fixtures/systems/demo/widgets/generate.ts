// Generates the fixture layer's files (M11 plan decision 8; no Blender):
//   models/widgets-{low,high}.glb  12 boxes, one named node per structure
//   models/manifest.json           world bounds per ID and LOD (the `?debug` bounds check)
//   ids.json                       the ID table the soft-ids plugin reads (`idsFile`)
// Run: npx tsx tests/fixtures/systems/demo/widgets/generate.ts
// Deterministic, so re-running it leaves the committed files unchanged.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { WIDGET_IDS, widgets } from "./layer";

const here = import.meta.dirname;
/** Half the box's edge, metres. */
const HALF = 0.03;
/** Box centre (glTF: Y up, facing +Z): one row per kind in front of the chest, four columns. */
export function centreOf(i: number): [number, number, number] {
  const row = Math.floor(i / 4);
  const col = i % 4;
  return [-0.27 + col * 0.18, 1.0 + row * 0.18, 0.3];
}

/** A unit box's 24 vertices (flat normals) and 36 indices, scaled by HALF. */
function box() {
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (const [n, u, v] of faces) {
    const base = pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
      for (let k = 0; k < 3; k++) pos.push(HALF * (n[k]! + a * u[k]! + b * v[k]!));
    for (let j = 0; j < 4; j++) nor.push(...n);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(pos.length).fill(1), idx: new Uint16Array(idx) };
}

async function main() {
  const io = new NodeIO();
  const manifest: { layer: string; objects: Record<string, { lods: Record<string, { bboxMin: number[]; bboxMax: number[] }> }> } = {
    layer: widgets.id,
    objects: {},
  };
  for (const lod of ["low", "high"] as const) {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const scene = doc.createScene();
    const g = box();
    WIDGET_IDS.forEach((id, i) => {
      const prim = doc
        .createPrimitive()
        .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(g.pos).setBuffer(buffer))
        .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(g.nor).setBuffer(buffer))
        .setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(g.col).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType("SCALAR").setArray(g.idx).setBuffer(buffer));
      const c = centreOf(i);
      scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)).setTranslation(c));
      manifest.objects[id] ??= { lods: {} };
      manifest.objects[id].lods[lod] = { bboxMin: c.map((x) => x - HALF), bboxMax: c.map((x) => x + HALF) };
    });
    writeFileSync(join(here, `models/${widgets.models.file}-${lod}.glb`), await io.writeBinary(doc));
  }
  writeFileSync(join(here, "models/manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  const ids = WIDGET_IDS.map((id) => {
    const [, kind, n] = id.split("_");
    return { id, name: `${kind![0]!.toUpperCase()}${kind!.slice(1)} ${n}`, kind, layer: widgets.id, side: "midline", meshAvailable: true };
  });
  writeFileSync(join(here, "ids.json"), JSON.stringify(ids, null, 1) + "\n");
}

if (process.argv[1]?.endsWith("generate.ts")) void main();
