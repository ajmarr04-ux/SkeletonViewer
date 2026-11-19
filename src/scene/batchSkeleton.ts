import { BatchedMesh, Box3, Matrix4, Mesh, Vector3, type BufferGeometry, type Material } from "three";
import { acceleratedRaycast, computeBatchedBoundsTree, disposeBatchedBoundsTree } from "three-mesh-bvh";

// three-mesh-bvh's BatchedMesh raycast runs each instance through an internal
// Mesh, so Mesh.raycast has to be the accelerated one too (the library's
// documented prototype patch). Without a BVH both fall back to three's own.
Mesh.prototype.raycast = acceleratedRaycast;
BatchedMesh.prototype.raycast = acceleratedRaycast;

/** One bone (or tooth) from the glTF: its geometry and the mesh's world matrix. */
export type BonePart = { id: string; geometry: BufferGeometry; matrixWorld: Matrix4 };

export type BatchedSkeleton = {
  mesh: BatchedMesh;
  /** Bone ID for each instance ID (the index). */
  boneIds: string[];
  /** Instance ID for each bone ID. */
  instanceOf: Map<string, number>;
  triangles: number;
};

function counts(g: BufferGeometry): { vertices: number; indices: number } {
  const vertices = g.getAttribute("position").count;
  return { vertices, indices: g.index ? g.index.count : vertices };
}

/**
 * Pack every bone into one BatchedMesh (one draw call, spec §2 and §8).
 *
 * The vertices are copied as they are, still quantised. Each instance's matrix
 * is the glTF mesh's own world matrix (the named bone node times its unnamed
 * dequantising child), so every bone keeps its exact world position: nothing
 * is translated, rotated or re-posed (spec §12).
 */
export function batchSkeleton(parts: BonePart[], material: Material): BatchedSkeleton {
  let maxVertices = 0;
  let maxIndices = 0;
  for (const p of parts) {
    const c = counts(p.geometry);
    maxVertices += c.vertices;
    maxIndices += c.indices;
  }
  const mesh = new BatchedMesh(parts.length, maxVertices, maxIndices, material);
  mesh.name = "skeleton";
  const boneIds: string[] = [];
  const instanceOf = new Map<string, number>();
  let triangles = 0;
  for (const p of parts) {
    if (instanceOf.has(p.id)) throw new Error(`Bone ${p.id} appears twice in the model`);
    const geometryId = mesh.addGeometry(p.geometry);
    const instanceId = mesh.addInstance(geometryId);
    mesh.setMatrixAt(instanceId, p.matrixWorld);
    boneIds[instanceId] = p.id;
    instanceOf.set(p.id, instanceId);
    triangles += counts(p.geometry).indices / 3;
  }
  return { mesh, boneIds, instanceOf, triangles };
}

/** Build the raycasting BVH for every geometry (three-mesh-bvh). Safe to call twice. */
export function ensureBoundsTrees(mesh: BatchedMesh): void {
  if (mesh.boundsTrees && mesh.boundsTrees.every((t) => t)) return;
  computeBatchedBoundsTree.call(mesh, -1);
}

/**
 * Free a skeleton's GPU data. It is detached from the scene first: when the
 * viewer swaps LODs, React's effect cleanup can run before react-three-fiber
 * has removed the old `<primitive>`, and a frame drawn in between would read
 * the freed matrices texture.
 */
export function disposeBatchedSkeleton(s: BatchedSkeleton): void {
  s.mesh.removeFromParent();
  if (s.mesh.boundsTrees) disposeBatchedBoundsTree.call(s.mesh, -1);
  s.mesh.dispose();
}

const _v = new Vector3();
const _m = new Matrix4();

/**
 * Exact world-space bounds of one instance: every vertex in its geometry range,
 * through the instance matrix. Used to prove that batching moved nothing.
 */
export function instanceWorldBounds(mesh: BatchedMesh, instanceId: number, target = new Box3()): Box3 {
  target.makeEmpty();
  const geometryId = mesh.getGeometryIdAt(instanceId);
  const range = mesh.getGeometryRangeAt(geometryId);
  if (!range) return target;
  mesh.getMatrixAt(instanceId, _m);
  const pos = mesh.geometry.getAttribute("position");
  for (let i = range.vertexStart; i < range.vertexStart + range.vertexCount; i++) {
    target.expandByPoint(_v.fromBufferAttribute(pos, i).applyMatrix4(_m));
  }
  return target;
}

/** Bounds of every instance, keyed by bone ID. */
export function allInstanceBounds(s: BatchedSkeleton): Map<string, Box3> {
  const out = new Map<string, Box3>();
  s.boneIds.forEach((id, instanceId) => out.set(id, instanceWorldBounds(s.mesh, instanceId)));
  return out;
}
