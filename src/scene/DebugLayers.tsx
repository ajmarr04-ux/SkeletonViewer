// M6 debug layer view (plan decision 13): `?debug&layers=all` loads the
// soft-tissue layer files after the bones and draws them as plain glTF scenes
// in flat layer colours. Debug only: nothing is pickable or batched, and this
// module is a lazy chunk the default load never requests.

import { useEffect, useState } from "react";
import { Box3, Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { create } from "zustand";
import type { Bounds } from "../../scripts/lib/model-checks";
import { DEBUG_LAYER_COLOURS, layerReport, loadLayerManifest, type LayerManifest, type LayerReport, type SoftLayer } from "./debugLayers";
import type { Lod } from "./lod";
import { layerUrl } from "../layers/urls";
import { OVERLAYS } from "../systems/registry";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

type Loaded = { group: Group; report: LayerReport };

async function loadLayer(layer: SoftLayer, lod: Lod, material: MeshStandardMaterial): Promise<Loaded> {
  const [gltf, manifest] = await Promise.all([loader.loadAsync(layerUrl(layer, lod)), loadLayerManifest(layer)]);
  const scene = gltf.scene;
  scene.name = `layer-${layer}-${lod}`;
  scene.updateMatrixWorld(true);
  const json = gltf.parser.json as { nodes?: { name?: string }[] };
  const nodeName = (o: Object3D): string | undefined => {
    const idx = gltf.parser.associations.get(o)?.nodes;
    return idx === undefined ? undefined : json.nodes?.[idx]?.name || undefined;
  };
  const boxes = new Map<string, Box3>();
  let triangles = 0;
  const unnamed: string[] = [];
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    let id: string | undefined;
    for (let n: Object3D | null = o; n && n !== scene && !id; n = n.parent) id = nodeName(n);
    for (const m of [o.material].flat()) m.dispose();
    o.material = material;
    o.raycast = () => {}; // not pickable
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    if (!id) {
      unnamed.push(o.name || "(mesh)");
      return;
    }
    if (!g.boundingBox) g.computeBoundingBox();
    const box = g.boundingBox!.clone().applyMatrix4(o.matrixWorld);
    const prev = boxes.get(id);
    boxes.set(id, prev ? prev.union(box) : box);
  });
  const actual = new Map<string, Bounds>();
  for (const [id, b] of boxes) actual.set(id, { min: b.min.toArray(), max: b.max.toArray() });
  const report = layerReport(layer, lod, actual, triangles, manifest);
  report.errors.push(...unnamed.map((n) => `${layer} ${lod}: mesh ${n} has no named node`));
  return { group: scene, report };
}

function disposeGroup(g: Group): void {
  g.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
}

type Status = { reports: Partial<Record<SoftLayer, LayerReport>>; error: string | null; done: boolean };
const useLayerStatus = create<Status>(() => ({ reports: {}, error: null, done: false }));

/**
 * In the Canvas: once the bones show `lod`, load the same LOD of every layer
 * asked for and swap it in (so low, then high, as for the bones).
 */
export function DebugLayersScene({ layers, lod }: { layers: SoftLayer[]; lod: Lod | null }) {
  const [materials] = useState(() => {
    const out = {} as Record<SoftLayer, MeshStandardMaterial>;
    for (const [layer, colour] of Object.entries(DEBUG_LAYER_COLOURS) as [SoftLayer, string][]) {
      out[layer] = new MeshStandardMaterial({
        name: `debug-${layer}`,
        color: colour,
        vertexColors: true, // the baked AO in COLOR_0
        roughness: 0.7,
        // Patches lie on the bone surface: draw them just in front of it.
        ...(OVERLAYS.some((o) => o.id === layer) ? { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 } : {}),
      });
    }
    return out;
  });
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const key = layers.join(",");
  useEffect(() => {
    if (!lod) return;
    let cancelled = false;
    useLayerStatus.setState({ done: false });
    Promise.all(
      layers.map((layer) =>
        loadLayer(layer, lod, materials[layer]).then((l) => {
          if (!cancelled) useLayerStatus.setState((s) => ({ reports: { ...s.reports, [layer]: l.report } }));
          return l;
        }),
      ),
    )
      .then((loaded) => {
        if (cancelled) return loaded.forEach((l) => disposeGroup(l.group));
        setGroups(loaded.map((l) => l.group));
        useLayerStatus.setState({ done: true });
      })
      .catch((e: unknown) => {
        if (!cancelled) useLayerStatus.setState({ error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
    // `key` stands for `layers` (a new array each render).
  }, [key, lod, materials]);

  // Free a set of layers once the next one has replaced it.
  useEffect(() => () => groups.forEach(disposeGroup), [groups]);

  return (
    <>
      {groups.map((g) => (
        <primitive key={g.uuid} object={g} />
      ))}
    </>
  );
}

/** In the debug overlay: one line per layer. data-* attributes are read by `layers-debug.spec.ts`. */
export function DebugLayersPanel({ layers, lod }: { layers: SoftLayer[]; lod: Lod | null }) {
  const { reports, error, done } = useLayerStatus();
  const current = layers.map((l) => reports[l]).filter((r): r is LayerReport => !!r && r.lod === lod);
  const complete = done && current.length === layers.length;
  return (
    <div
      className="debug-layers"
      data-testid="debug-layers"
      data-layers={layers.join(",")}
      data-complete={complete ? "true" : "false"}
      data-error={error ?? ""}
    >
      {error && <p className="error">Layers failed: {error}</p>}
      <dl>
        {layers.map((layer) => {
          const r = reports[layer];
          const ok = r ? r.errors.length === 0 : false;
          return (
            <div
              key={layer}
              className="row"
              data-layer={layer}
              data-lod={r?.lod ?? ""}
              data-nodes={r?.nodes ?? ""}
              data-triangles={r?.triangles ?? ""}
              data-bounds-checked={r?.checked ?? ""}
              data-bounds-ok={r ? String(ok) : ""}
              data-bounds-max-delta-mm={r ? (r.maxDelta * 1000).toFixed(4) : ""}
              data-errors={r ? r.errors.slice(0, 20).join(" | ") : ""}
            >
              <dt>
                <span className="swatch" style={{ background: DEBUG_LAYER_COLOURS[layer] }} aria-hidden="true" /> {layer}
              </dt>
              <dd className={r && !ok ? "error" : undefined}>
                {!r
                  ? "loading…"
                  : `${r.lod}: ${r.nodes} nodes, ${r.triangles.toLocaleString("en")} tris, ` +
                    (ok
                      ? `bounds max ${(r.maxDelta * 1000).toFixed(3)} mm`
                      : `${r.errors.length} errors: ${r.errors.slice(0, 2).join("; ")}`)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
