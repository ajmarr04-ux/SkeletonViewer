import type { Object3D } from "three";
import { Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import type { BonePart } from "./batchSkeleton";
import type { Lod } from "./lod";

export type LoadedParts = {
  lod: Lod;
  /** One entry per bone, in file order. */
  parts: BonePart[];
  /** Milliseconds from page start (performance.now) to the model being parsed. */
  loadedAtMs: number;
};

export function modelUrl(lod: Lod): string {
  return `${import.meta.env.BASE_URL}models/skeleton-${lod}.glb`;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/**
 * Load one LOD and return each bone's geometry with its world matrix. The glTF
 * scene graph itself is dropped: the viewer draws the bones as one BatchedMesh.
 */
export async function loadSkeleton(lod: Lod): Promise<LoadedParts> {
  const gltf = await loader.loadAsync(modelUrl(lod));
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const json = gltf.parser.json as { nodes?: { name?: string }[] };
  // Name as written in the glTF node (three.js may fill blank names from the mesh).
  const gltfNodeName = (o: Object3D): string | undefined => {
    const idx = gltf.parser.associations.get(o)?.nodes;
    return idx === undefined ? undefined : json.nodes?.[idx]?.name || undefined;
  };
  const parts: BonePart[] = [];
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    // Each bone is a named node; gltfpack puts the mesh on an unnamed child.
    let id: string | undefined;
    for (let n: Object3D | null = o; n && n !== scene && !id; n = n.parent) id = gltfNodeName(n);
    if (!id) throw new Error(`A mesh in skeleton-${lod}.glb has no named bone node`);
    parts.push({ id, geometry: o.geometry, matrixWorld: o.matrixWorld.clone() });
  });
  // The glTF's own materials are not used.
  scene.traverse((o) => {
    if (o instanceof Mesh) for (const m of [o.material].flat()) m.dispose();
  });
  return { lod, parts, loadedAtMs: performance.now() };
}

/** Free the per-bone geometries once they have been copied into a BatchedMesh. */
export function disposeParts(parts: BonePart[]): void {
  for (const p of parts) p.geometry.dispose();
}
