// World-space vertex positions per named node of a compressed layer file
// (M13 plan decision 2; BL's membership reuses it for every layer). Decoded with
// gltf-transform and the Meshopt decoder, as `check-models` does: each named
// top-level node is a structure, and gltfpack hangs its quantised mesh on an
// unnamed child whose transform dequantises it, so world = node world matrix ×
// stored position (under 1 mm of error, the bounds check's tolerance).
import { NodeIO, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

let io: NodeIO | null = null;
async function reader(): Promise<NodeIO> {
  if (io) return io;
  await MeshoptDecoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  return io;
}

function collect(node: Node, out: number[]): void {
  const mesh = node.getMesh();
  if (mesh) {
    const m = node.getWorldMatrix();
    const v = [0, 0, 0];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const [x, y, z] = v as [number, number, number];
        out.push(
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14],
        );
      }
    }
  }
  for (const c of node.listChildren()) collect(c, out);
}

/** Every named top-level node's world vertices, as flat xyz arrays. */
export async function readNodePoints(file: string): Promise<Map<string, Float64Array>> {
  const doc = await (await reader()).read(file);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!;
  const out = new Map<string, Float64Array>();
  for (const n of scene.listChildren()) {
    if (!n.getName()) continue;
    const pts: number[] = [];
    collect(n, pts);
    out.set(n.getName(), Float64Array.from(pts));
  }
  return out;
}
