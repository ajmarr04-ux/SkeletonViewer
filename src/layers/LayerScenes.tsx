// The soft-tissue layers in the scene (M7 plan decisions 3 to 7). A lazy
// chunk, imported the first time any of them is turned on, so the default
// load never fetches it. Each layer is one solid and one ghost BatchedMesh,
// built exactly like the bones' (instance matrix = the glTF world matrix,
// vertices untouched). Only visibility and colours ever change here.

import { useEffect, useRef, useState } from "react";
import { Color, type MeshStandardMaterial } from "three";
import { create } from "zustand";
import type { Bounds } from "../../scripts/lib/model-checks";
import { allInstanceBounds, batchLayer, disposeBatchedSkeleton, ensureBoundsTrees } from "../scene/batchSkeleton";
import { layerReport, type LayerManifest, type LayerReport } from "../scene/debugLayers";
import { disposeParts } from "../scene/loadSkeleton";
import { lodsToLoad, type Lod } from "../scene/lod";
import { accentTint, createBoneMaterial, createGhostMaterial, tintFor } from "../scene/material";
import { useLayerBatches, type LayerBatches } from "../scene/layerRegistry";
import { createOutline, disposeOutline, OUTLINE } from "../scene/outline";
import { useViewer } from "../state/store";
import { TISSUE_LAYERS, type TissueLayer } from "../state/url";
import { LAYER_COLOURS, TENDON_COLOUR } from "./colours";
import { loadLayerParts } from "./loadLayer";
import { isTendinous, type SoftId } from "./softIds";
import { SOFT_IDS } from "./softTable";

export { SOFT_IDS };
const BY_ID = new Map(SOFT_IDS.map((e) => [e.id, e]));
export const softIdOf = (id: string): SoftId | undefined => BY_ID.get(id);

export const LAYER_NAMES: Record<TissueLayer, string> = { cartilage: "Cartilage", ligaments: "Ligaments", muscles: "Muscles" };

/**
 * Ghosts draw after every solid (they are transparent) and in a fixed order
 * (plan decision 7): the bones' ghost first (renderOrder 0), then cartilage,
 * ligaments and muscles, the outermost last.
 */
const GHOST_ORDER: Record<TissueLayer, number> = { cartilage: 1, ligaments: 2, muscles: 3 };

/** `?debug`: one bounds report per layer (the overlay line). */
export const useLayerReports = create<Partial<Record<TissueLayer, LayerReport>>>(() => ({}));

/** Each manifest is its own chunk, fetched only in `?debug`. */
function loadManifest(layer: TissueLayer): Promise<LayerManifest> {
  const m =
    layer === "muscles"
      ? import("../../assets/build/manifest-muscles.json")
      : layer === "ligaments"
        ? import("../../assets/build/manifest-ligaments.json")
        : import("../../assets/build/manifest-cartilage.json");
  return m.then((x) => x.default as unknown as LayerManifest);
}

type Materials = Record<TissueLayer, { solid: MeshStandardMaterial; ghost: MeshStandardMaterial }>;

function createMaterials(opacity: number): Materials {
  const out = {} as Materials;
  for (const layer of TISSUE_LAYERS) {
    out[layer] = {
      solid: createBoneMaterial(LAYER_COLOURS[layer], `layer-${layer}`),
      ghost: createGhostMaterial(opacity, LAYER_COLOURS[layer], `ghost-${layer}`),
    };
  }
  return out;
}

/** Instance colour of a structure in its layer: white, or the tendon tint for tendons and aponeuroses. */
const TENDON_TINT = tintFor(TENDON_COLOUR, LAYER_COLOURS.muscles);
const WHITE = new Color(1, 1, 1);
const ACCENTS = Object.fromEntries(TISSUE_LAYERS.map((l) => [l, accentTint(LAYER_COLOURS[l])])) as Record<TissueLayer, Color>;
export function layerBaseTint(id: string): Color {
  return isTendinous(softIdOf(id)) ? TENDON_TINT : WHITE;
}

/**
 * In the Canvas. `lods` is the viewer's LOD plan (the same for every layer,
 * plan decision 3); `ready` is true once the bones are on screen, so a layer
 * asked for in the URL never delays the first skeleton.
 */
export function LayerScenes({ lods, ready, debug }: { lods: Lod[]; ready: boolean; debug: boolean }) {
  const [materials] = useState(() => createMaterials(useViewer.getState().ghostOpacity));
  // A layer is loaded the first time it is not Off, and kept (hidden) after that.
  const [wanted, setWanted] = useState<TissueLayer[]>([]);
  useEffect(() => {
    const update = () => {
      const layers = useViewer.getState().layers;
      setWanted((w) => {
        const add = TISSUE_LAYERS.filter((l) => layers[l] !== "off" && !w.includes(l));
        return add.length ? TISSUE_LAYERS.filter((l) => w.includes(l) || add.includes(l)) : w;
      });
    };
    update();
    return useViewer.subscribe((s, p) => s.layers !== p.layers && update());
  }, []);
  useEffect(
    () => () => {
      for (const m of Object.values(materials)) {
        m.solid.dispose();
        m.ghost.dispose();
      }
    },
    [materials],
  );
  return (
    <>
      {wanted.map((layer) => (
        <TissueLayerScene key={layer} layer={layer} lods={lods} ready={ready} debug={debug} materials={materials[layer]} />
      ))}
    </>
  );
}

function TissueLayerScene({
  layer,
  lods,
  ready,
  debug,
  materials,
}: {
  layer: TissueLayer;
  lods: Lod[];
  ready: boolean;
  debug: boolean;
  materials: Materials[TissueLayer];
}) {
  const [shown, setShown] = useState<LayerBatches | null>(null);
  const shownRef = useRef<LayerBatches | null>(null);
  shownRef.current = shown;
  const attempt = useViewer((s) => s.layerLoad[layer]?.attempt ?? 0);
  const lodKey = lods.join(",");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const st = useViewer.getState();
    const queue = lodsToLoad(lods, shownRef.current?.lod ?? null);
    if (queue.length === 0) return;
    (async () => {
      for (const lod of queue) {
        st.setLayerLoad(layer, { status: "loading", fetching: lod, received: 0, total: 0, error: null });
        const parts = await loadLayerParts(layer, lod, (received, total) => {
          if (!cancelled) useViewer.getState().setLayerLoad(layer, { received, total });
        });
        if (cancelled) {
          disposeParts(parts);
          return;
        }
        const solid = batchLayer(parts, materials.solid, { name: `layer-${layer}`, instanceColours: true });
        solid.boneIds.forEach((id, i) => solid.mesh.setColorAt(i, layerBaseTint(id)));
        const ghost = batchLayer(parts, materials.ghost, { name: `ghost-${layer}` });
        ghost.mesh.renderOrder = GHOST_ORDER[layer];
        ghost.mesh.visible = false;
        disposeParts(parts);
        const outlines = {
          selected: createOutline(solid, OUTLINE.selected.colour, OUTLINE.selected.widthPx, `outline-selected-${layer}`),
          hover: createOutline(solid, OUTLINE.hover.colour, OUTLINE.hover.widthPx, `outline-hover-${layer}`),
        };
        const batches: LayerBatches = { lod, solid, ghost, outlines, base: layerBaseTint, accent: ACCENTS[layer] };
        setShown(batches);
        // Isolation (main chunk) applies the view to the new batches as soon as they are registered.
        useLayerBatches.setState({ [layer]: batches });
        const now = useViewer.getState();
        const prev = now.layerLoad[layer];
        const first = !prev?.lod;
        now.setLayerLoad(layer, { status: "ready", lod, fetching: null, shownAt: { ...prev?.shownAt, [lod]: performance.now() } });
        if (first) now.say(`${LAYER_NAMES[layer]} loaded`);
        if (debug) {
          const manifest = await loadManifest(layer);
          const actual = new Map<string, Bounds>();
          for (const [id, b] of allInstanceBounds(solid)) actual.set(id, { min: b.min.toArray(), max: b.max.toArray() });
          if (!cancelled) useLayerReports.setState({ [layer]: layerReport(layer, lod, actual, solid.triangles, manifest) });
        }
      }
      // Raycasting trees for picking (session U), once the final LOD is on screen, off the critical path.
      const final = shownRef.current;
      if (final && !cancelled) idle(() => !cancelled && ensureBoundsTrees(final.solid.mesh));
    })().catch((e: unknown) => {
      if (!cancelled) useViewer.getState().setLayerLoad(layer, { status: "error", fetching: null, error: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
    // `lodKey` stands for `lods` (a new array on each plan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, lodKey, ready, attempt, materials, debug]);

  // Free a LOD's batches once the next one has replaced it (or on unmount).
  useEffect(() => {
    if (!shown) return;
    return () => {
      // The outlines share the solid batch's buffers: free them together.
      disposeOutline(shown.outlines.selected);
      disposeOutline(shown.outlines.hover);
      disposeBatchedSkeleton(shown.solid);
      disposeBatchedSkeleton(shown.ghost);
      if (useLayerBatches.getState()[layer] === shown) useLayerBatches.setState({ [layer]: undefined });
    };
  }, [shown, layer]);

  if (!shown) return null;
  return (
    <>
      <primitive object={shown.solid.mesh} />
      <primitive object={shown.outlines.selected.mesh} />
      <primitive object={shown.outlines.hover.mesh} />
      <primitive object={shown.ghost.mesh} />
    </>
  );
}

function idle(fn: () => void): void {
  if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}

/** `?debug`: one overlay line per loaded layer (LOD, nodes, triangles, bounds against the manifest). */
export function LayersDebugPanel() {
  const reports = useLayerReports();
  const onAt = useViewer((s) => s.layerOnAt);
  const load = useViewer((s) => s.layerLoad);
  const layers = TISSUE_LAYERS.filter((l) => reports[l]);
  if (layers.length === 0) return null;
  return (
    <div className="debug-layers" data-testid="layers-report">
      <dl>
        {layers.map((layer) => {
          const r = reports[layer]!;
          const ok = r.errors.length === 0;
          // Turned on → low LOD on screen (perf-load's measure, on the real device).
          const lowShown = load[layer]?.shownAt.low;
          const start = onAt[layer] ?? 0;
          const lowMs = lowShown !== undefined ? Math.max(0, lowShown - start) : null;
          return (
            <div
              key={layer}
              className="row"
              data-layer={layer}
              data-lod={r.lod}
              data-nodes={r.nodes}
              data-triangles={r.triangles}
              data-bounds-ok={String(ok)}
              data-bounds-max-delta-mm={(r.maxDelta * 1000).toFixed(4)}
              data-errors={r.errors.slice(0, 20).join(" | ")}
              data-low-shown-ms={lowMs !== null ? lowMs.toFixed(0) : ""}
            >
              <dt>
                <span className="swatch" style={{ background: LAYER_COLOURS[layer] }} aria-hidden="true" /> {layer}
              </dt>
              <dd className={ok ? undefined : "error"}>
                {`${r.lod}: ${r.nodes} nodes, ${r.triangles.toLocaleString("en")} tris, ` +
                  (ok ? `bounds max ${(r.maxDelta * 1000).toFixed(3)} mm` : `${r.errors.length} errors: ${r.errors.slice(0, 2).join("; ")}`) +
                  (lowMs !== null ? `; low shown ${(lowMs / 1000).toFixed(2)} s after turned on` : "")}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
