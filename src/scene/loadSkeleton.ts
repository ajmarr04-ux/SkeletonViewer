import type { Object3D } from "three";
import { Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import type { Lod } from "./lod";

export type LoadedSkeleton = {
  lod: Lod;
  scene: Object3D;
  /** Milliseconds from page start (performance.now) to the model being parsed. */
  loadedAtMs: number;
  /** Names of nodes that carry a mesh, directly or through their unnamed child. */
  objectNames: string[];
  triangles: number;
};

export function modelUrl(lod: Lod): string {
  return `${import.meta.env.BASE_URL}models/skeleton-${lod}.glb`;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadSkeleton(lod: Lod): Promise<LoadedSkeleton> {
  const gltf = await loader.loadAsync(modelUrl(lod));
  const scene = gltf.scene;
  const json = gltf.parser.json as { nodes?: { name?: string }[] };
  // Name as written in the glTF node (three.js may fill blank names from the mesh).
  const gltfNodeName = (o: Object3D): string | undefined => {
    const idx = gltf.parser.associations.get(o)?.nodes;
    return idx === undefined ? undefined : json.nodes?.[idx]?.name || undefined;
  };
  const objectNames = new Set<string>();
  let triangles = 0;
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const geo = o.geometry;
    triangles += (geo.index ? geo.index.count : geo.attributes.position!.count) / 3;
    // Each bone is a named node; gltfpack puts the mesh on an unnamed child.
    for (let n: Object3D | null = o; n && n !== scene; n = n.parent) {
      const name = gltfNodeName(n);
      if (name) {
        objectNames.add(name);
        break;
      }
    }
  });
  return { lod, scene, loadedAtMs: performance.now(), objectNames: [...objectNames], triangles };
}

/** Free GPU memory held by a model that has been swapped out. */
export function disposeSkeleton(scene: Object3D): void {
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.dispose();
  });
}
