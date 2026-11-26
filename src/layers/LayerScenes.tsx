// The soft-tissue layers in the scene (M7 plan decisions 3 to 7). A lazy
// chunk, imported the first time any of them is turned on, so the default
// load never fetches it. Each layer is one solid and one ghost BatchedMesh,
// built exactly like the bones' (instance matrix = the glTF world matrix,
// vertices untouched). Only visibility and colours ever change here.

import { useEffect, useRef, useState } from "react";
import { Color, type MeshStandardMaterial } from "three";
import { create } from "zustand";
import type { Bounds } from "../../scripts/lib/model-checks";
import { allInstanceBounds, batchLayer, disposeBatchedSkeleton, ensureBoundsTrees, type BonePart } from "../scene/batchSkeleton";
import { layerReport, loadLayerManifest, type LayerManifest, type LayerReport } from "../scene/debugLayers";
import { disposeParts } from "../scene/loadSkeleton";
import { lodsToLoad, type Lod } from "../scene/lod";
import { accentTint, createBoneMaterial, createGhostMaterial, tintFor } from "../scene/material";
import { useLayerBatches, usePatchBatch, type LayerBatches, type PatchBatch } from "../scene/layerRegistry";
import { TINT_COLOURS, TINT_ROLES, type TintRole } from "../scene/tints";
import { layerOfId } from "../state/selection";
import { createOutline, disposeOutline, OUTLINE } from "../scene/outline";
import { useViewer } from "../state/store";
import { LAZY_LAYERS, layerColour, layerDescriptor, maxPartsOf, OVERLAYS, type LazyLayerId } from "../systems/registry";
import { TENDON_COLOUR } from "./colours";
import { loadSoftContent } from "../content/softContentLoader";
import { loadLayerParts } from "./loadLayer";
import { layerChunksOf } from "./urls";
import { chunksFor, type LayerChunks } from "../regions/chunks";
import { membersOf } from "../regions/index";
import { isTendinous } from "./softIds";
import { lazyEntry } from "../content/index";

/** `?debug`: one bounds report per layer (the overlay line). */
export const useLayerReports = create<Partial<Record<LazyLayerId, LayerReport>>>(() => ({}));

type LayerMaterials = { solid: MeshStandardMaterial; ghost: MeshStandardMaterial };
type Materials = Partial<Record<LazyLayerId, LayerMaterials>>;

function createMaterials(opacity: number): Materials {
  const out = {} as Materials;
  for (const layer of LAZY_LAYERS) {
    out[layer] = {
      solid: createBoneMaterial(layerColour(layer), `layer-${layer}`),
      ghost: createGhostMaterial(opacity, layerColour(layer), `ghost-${layer}`),
    };
  }
  return out;
}

/** Instance colour of a structure in its layer: white, or the tendon tint (a lighter muscle colour) for tendons and aponeuroses. */
const TENDON_TINTS = Object.fromEntries(LAZY_LAYERS.map((l) => [l, tintFor(TENDON_COLOUR, layerColour(l))])) as Record<LazyLayerId, Color>;
const WHITE = new Color(1, 1, 1);
const ACCENTS = Object.fromEntries(LAZY_LAYERS.map((l) => [l, accentTint(layerColour(l))])) as Record<LazyLayerId, Color>;
const TINTS = Object.fromEntries(
  LAZY_LAYERS.map((l) => [l, Object.fromEntries(TINT_ROLES.map((r) => [r, tintFor(TINT_COLOURS[r], layerColour(l))])) as Record<TintRole, Color>]),
) as Record<LazyLayerId, Record<TintRole, Color>>;
export function layerBaseTint(id: string): Color {
  const e = lazyEntry(id);
  return e && isTendinous(e) ? TENDON_TINTS[e.layer] : WHITE;
}

/**
 * In the Canvas. `lods` is the viewer's LOD plan (the same for every layer,
 * plan decision 3); `ready` is true once the bones are on screen, so a layer
 * asked for in the URL never delays the first skeleton.
 */
export function LayerScenes({ lods, ready, debug }: { lods: Lod[]; ready: boolean; debug: boolean }) {
  const [materials] = useState(() => createMaterials(useViewer.getState().ghostOpacity));
  // A layer is loaded the first time it is not Off, and kept (hidden) after that.
  const [wanted, setWanted] = useState<LazyLayerId[]>([]);
  useEffect(() => {
    const update = () => {
      const layers = useViewer.getState().layers;
      setWanted((w) => {
        const add = LAZY_LAYERS.filter((l) => layers[l] !== "off" && !w.includes(l));
        return add.length ? LAZY_LAYERS.filter((l) => w.includes(l) || add.includes(l)) : w;
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
        <TissueLayerScene key={layer} layer={layer} lods={lods} ready={ready} debug={debug} materials={materials[layer]!} />
      ))}
      <PatchScene lods={lods} ready={ready} />
    </>
  );
}

/** The attachment patches' layer (the muscles): the one whose descriptor has the overlay. */
const PATCHES = OVERLAYS.find((o) => o.when === "selected-tier")!;
/** A structure of the patches' layer (a muscle or part) at tier 1 or 2: the patches are wanted (M9 plan decision 6). */
const wantsPatches = (s: { sel: string | null; tier: number }): boolean => s.tier > 0 && s.sel !== null && layerOfId(s.sel) === PATCHES.layer;

/**
 * The attachment patches (M9 plan decision 6): `attachments-<lod>.glb`, the
 * final LOD of the plan only, fetched the first time a muscle or part reaches
 * tier 1 and kept after that. One solid batch, white material (the instance
 * colour is the tint), drawn in front of the bone it lies on (polygon offset,
 * as in M6's debug view). `Isolation` shows only the patches the view wants.
 */
function PatchScene({ lods, ready }: { lods: Lod[]; ready: boolean }) {
  const want = useViewer((s) => wantsPatches(s));
  const [wanted, setWanted] = useState(false);
  if (want && !wanted) setWanted(true);
  const [shown, setShown] = useState<PatchBatch | null>(null);
  const lod = lods[lods.length - 1] ?? "low";
  const [material] = useState(() => {
    const m = createBoneMaterial("#ffffff", "patches");
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -4;
    return m;
  });
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    if (!wanted || !ready || shown?.lod === lod) return;
    let cancelled = false;
    void (async () => {
      const parts = await loadLayerParts(PATCHES.file, lod, () => {});
      if (cancelled) {
        disposeParts(parts);
        return;
      }
      const solid = batchLayer(parts, material, { name: "patches", instanceColours: true });
      disposeParts(parts);
      solid.boneIds.forEach((_, i) => solid.mesh.setVisibleAt(i, false));
      solid.mesh.visible = false;
      solid.mesh.raycast = () => {}; // never picked: a click goes to the bone or muscle under it
      const batch: PatchBatch = { lod, solid, tint: { origin: tintFor(TINT_COLOURS.origin, "#ffffff"), insertion: tintFor(TINT_COLOURS.insertion, "#ffffff") } };
      setShown(batch);
      usePatchBatch.setState({ batch });
    })().catch(() => {
      // Without the patch file, every origin and insertion falls back to the whole-structure tint (`withTints`).
      if (!cancelled) usePatchBatch.setState({ failed: true });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, ready, lod, material, shown?.lod]);
  useEffect(() => {
    if (!shown) return;
    return () => {
      disposeBatchedSkeleton(shown.solid);
      if (usePatchBatch.getState().batch === shown) usePatchBatch.setState({ batch: null });
    };
  }, [shown]);
  return shown ? <primitive object={shown.solid.mesh} /> : null;
}

/** Structures to draw from the chunks a layer has fetched at one LOD: chunk ("" for a single-file layer) → parts. */
type LoadedParts = Map<Lod, Map<string, BonePart[]>>;

/**
 * The chunks a layer wants now (M13 plan decision 9), as a key: "" for a
 * single-file layer; for a chunked one, the chunks holding a member of the
 * body region in focus (all of them without one) plus the selection's.
 */
function wantedChunks(layer: LazyLayerId, reg: string | null, sel: string | null): string {
  return chunksFor(layerChunksOf(layer), reg, reg === null ? [] : membersOf(reg), [sel])?.join(",") ?? "";
}

function TissueLayerScene({
  layer,
  lods,
  ready,
  debug,
  materials,
}: {
  layer: LazyLayerId;
  lods: Lod[];
  ready: boolean;
  debug: boolean;
  materials: LayerMaterials;
}) {
  const [shown, setShown] = useState<LayerBatches | null>(null);
  const shownRef = useRef<LayerBatches | null>(null);
  shownRef.current = shown;
  const attempt = useViewer((s) => s.layerLoad[layer]?.attempt ?? 0);
  const lodKey = lods.join(",");
  const chunked = layerChunksOf(layer) !== undefined;
  const wantKey = useViewer((s) => (chunked ? wantedChunks(layer, s.reg, s.sel) : ""));
  // A chunked layer keeps the parts it has fetched at the LOD on screen, so a
  // chunk that arrives later is batched with them (the batches are rebuilt and
  // swapped, as a LOD change swaps them). A single-file layer frees them at once.
  const loaded = useRef<LoadedParts>(new Map());
  const pending = useRef(new Map<string, Promise<BonePart[]>>());
  const progress = useRef(new Map<string, { received: number; total: number }>());
  useEffect(
    () => () => {
      for (const byChunk of loaded.current.values()) for (const parts of byChunk.values()) disposeParts(parts);
      loaded.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const st = useViewer.getState();
    const want = chunked ? (wantKey === "" ? [] : wantKey.split(",")) : [""];
    const have = (lod: Lod) => loaded.current.get(lod) ?? new Map<string, BonePart[]>();
    const shownLod = shownRef.current?.lod ?? null;
    let queue = lodsToLoad(lods, shownLod);
    // On the final LOD already: a new body region may still want more chunks at it.
    if (chunked && queue.length === 0 && shownLod !== null && want.some((c) => !have(shownLod).has(c))) queue = [shownLod];
    if (queue.length === 0) return;
    // The layer's text chunk (M8 plan decision 11), in parallel with its model file.
    void loadSoftContent(layer).catch(() => undefined);
    const file = layerDescriptor(layer).models.file;
    /** One chunk at one LOD, fetched once even if the wanted set changes while it downloads; kept in `loaded` when it arrives. */
    const fetchChunk = (lod: Lod, chunk: string): Promise<BonePart[]> => {
      const key = `${lod}:${chunk}`;
      let p = pending.current.get(key);
      if (!p) {
        p = loadLayerParts(
          file,
          lod,
          (received, total) => {
            progress.current.set(key, { received, total });
            let r = 0;
            let t = 0;
            for (const [k, v] of progress.current) if (k.startsWith(`${lod}:`)) (r += v.received), (t += v.total);
            if (!cancelled) useViewer.getState().setLayerLoad(layer, { received: r, total: t });
          },
          chunk || undefined,
        ).then(
          (parts) => {
            pending.current.delete(key);
            if (!loaded.current.has(lod)) loaded.current.set(lod, new Map());
            loaded.current.get(lod)!.set(chunk, parts);
            return parts;
          },
          (e: unknown) => {
            pending.current.delete(key);
            progress.current.delete(key);
            throw e;
          },
        );
        pending.current.set(key, p);
      }
      return p;
    };
    (async () => {
      let last: LayerBatches | null = null;
      for (const lod of queue) {
        const need = want.filter((c) => !have(lod).has(c));
        if (need.length > 0) {
          st.setLayerLoad(layer, { status: "loading", fetching: lod, received: 0, total: 0, error: null });
          await Promise.all(need.map((c) => fetchChunk(lod, c)));
          if (cancelled) return;
        }
        // Every chunk fetched at this LOD (earlier regions' included), in the layer's chunk order.
        const byChunk = have(lod);
        const order = chunked ? layerChunksOf(layer)!.chunks.filter((c) => byChunk.has(c)) : [""];
        if (order.length === 0) {
          // Nothing of this layer in the body region: nothing to draw, nothing loading.
          st.setLayerLoad(layer, { status: "ready", fetching: null });
          continue;
        }
        const parts = order.flatMap((c) => byChunk.get(c)!);
        for (const c of order) progress.current.delete(`${lod}:${c}`);
        const solid = batchLayer(parts, materials.solid, { name: `layer-${layer}`, instanceColours: true });
        solid.boneIds.forEach((id, i) => solid.mesh.setColorAt(i, layerBaseTint(id)));
        const ghost = batchLayer(parts, materials.ghost, { name: `ghost-${layer}` });
        // Ghosts draw after every solid (they are transparent), in the descriptors' order (plan decision 7): the outermost last.
        ghost.mesh.renderOrder = layerDescriptor(layer).ghostOrder;
        ghost.mesh.visible = false;
        // The batches hold their own copy: a single-file layer's parts go now, a chunked layer's when another LOD replaces them.
        for (const [l, m] of [...loaded.current]) {
          if (chunked && l === lod) continue;
          for (const p of m.values()) disposeParts(p);
          loaded.current.delete(l);
        }
        const outlines = {
          selected: createOutline(solid, OUTLINE.selected.colour, OUTLINE.selected.widthPx, `outline-selected-${layer}`),
          hover: createOutline(solid, OUTLINE.hover.colour, OUTLINE.hover.widthPx, `outline-hover-${layer}`),
        };
        const moreSelected = Array.from({ length: Math.max(0, maxPartsOf(layer) - 1) }, (_, i) =>
          createOutline(solid, OUTLINE.selected.colour, OUTLINE.selected.widthPx, `outline-selected-${layer}-${i + 2}`),
        );
        const batches: LayerBatches = { lod, solid, ghost, outlines, moreSelected, base: layerBaseTint, accent: ACCENTS[layer]!, tint: TINTS[layer]! };
        last = batches;
        setShown(batches);
        // Isolation (main chunk) applies the view to the new batches as soon as they are registered.
        useLayerBatches.setState({ [layer]: batches });
        const now = useViewer.getState();
        const prev = now.layerLoad[layer];
        now.setLayerLoad(layer, { status: "ready", lod, fetching: null, shownAt: { ...prev?.shownAt, [lod]: prev?.shownAt[lod] ?? performance.now() } });
        if (debug) {
          const manifest = await loadLayerManifest(layer);
          const actual = new Map<string, Bounds>();
          for (const [id, b] of allInstanceBounds(solid)) actual.set(id, { min: b.min.toArray(), max: b.max.toArray() });
          // A chunked layer is checked against the chunks it has fetched.
          const expected = chunked ? loadedManifest(manifest, layerChunksOf(layer)!, order) : manifest;
          if (!cancelled) useLayerReports.setState({ [layer]: layerReport(layer, lod, actual, solid.triangles, expected) });
        }
      }
      // Raycasting trees for picking (session U), once the final LOD is on screen, off the critical path.
      const final = last;
      if (final && !cancelled) idle(() => !cancelled && ensureBoundsTrees(final.solid.mesh));
    })().catch((e: unknown) => {
      if (!cancelled) useViewer.getState().setLayerLoad(layer, { status: "error", fetching: null, error: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
    // `lodKey` stands for `lods` (a new array on each plan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, lodKey, ready, attempt, materials, debug, wantKey]);

  // Free a LOD's batches once the next one has replaced it (or on unmount).
  useEffect(() => {
    if (!shown) return;
    return () => {
      // The outlines share the solid batch's buffers: free them together.
      disposeOutline(shown.outlines.selected);
      disposeOutline(shown.outlines.hover);
      shown.moreSelected.forEach(disposeOutline);
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
      {shown.moreSelected.map((o) => (
        <primitive key={o.mesh.name} object={o.mesh} />
      ))}
      <primitive object={shown.ghost.mesh} />
    </>
  );
}

/** The manifest cut to the structures of the chunks fetched (`?debug`'s bounds line for a chunked layer). */
function loadedManifest(manifest: LayerManifest, c: LayerChunks, chunks: readonly string[]): LayerManifest {
  const keep = new Set(chunks.flatMap((k) => c.ids[c.chunks.indexOf(k)] ?? []));
  return { ...manifest, objects: Object.fromEntries(Object.entries(manifest.objects).filter(([id]) => keep.has(id))) };
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
  const layers = LAZY_LAYERS.filter((l) => reports[l]);
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
                <span className="swatch" style={{ background: layerColour(layer) }} aria-hidden="true" /> {layer}
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
