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

/** Downloads started ahead of time (plan step 12), by LOD. */
const downloads = new Map<Lod, Promise<ArrayBuffer>>();

/**
 * Start downloading a LOD's file without parsing it, so the next level arrives
 * while the current one is batched and first drawn. The low file's request
 * matches index.html's `<link rel="preload">`, so it isn't fetched twice.
 */
export function prefetchModel(lod: Lod): Promise<ArrayBuffer> {
  let p = downloads.get(lod);
  if (!p) {
    p = fetch(modelUrl(lod), { credentials: "same-origin" }).then((r) => {
      if (!r.ok) throw new Error(`skeleton-${lod}.glb: HTTP ${r.status}`);
      return r.arrayBuffer();
    });
    // A failed download can be tried again.
    p.catch(() => downloads.delete(lod));
    downloads.set(lod, p);
  }
  return p;
}

/**
 * Load one LOD and return each bone's geometry with its world matrix. The glTF
 * scene graph itself is dropped: the viewer draws the bones as one BatchedMesh.
 */
export async function loadSkeleton(lod: Lod): Promise<LoadedParts> {
  const data = await prefetchModel(lod);
  downloads.delete(lod); // parsed once; a later reload of this LOD fetches again (from the HTTP cache)
  const parts = await partsFromGlb(data, `skeleton-${lod}.glb`, modelUrl(lod).replace(/[^/]*$/, ""));
  return { lod, parts, loadedAtMs: performance.now() };
}

/**
 * Parse a model file (bones, or a soft-tissue layer, M7) into one part per
 * named node: its geometry and the mesh's world matrix. The glTF scene graph
 * and its materials are dropped. A node with several meshes would give
 * several parts with the same ID, which the batcher refuses.
 */
export async function partsFromGlb(data: ArrayBuffer, label: string, baseUrl: string): Promise<BonePart[]> {
  const gltf = await loader.parseAsync(data, baseUrl);
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
    // Each object is a named node; gltfpack puts the mesh on an unnamed child.
    let id: string | undefined;
    for (let n: Object3D | null = o; n && n !== scene && !id; n = n.parent) id = gltfNodeName(n);
    if (!id) throw new Error(`A mesh in ${label} has no named node`);
    parts.push({ id, geometry: o.geometry, matrixWorld: o.matrixWorld.clone() });
  });
  // The glTF's own materials are not used.
  scene.traverse((o) => {
    if (o instanceof Mesh) for (const m of [o.material].flat()) m.dispose();
  });
  return parts;
}

/** Free the per-bone geometries once they have been copied into a BatchedMesh. */
export function disposeParts(parts: BonePart[]): void {
  for (const p of parts) p.geometry.dispose();
}
