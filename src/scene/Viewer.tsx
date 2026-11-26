import type { Group } from "three";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { loadContent } from "../content/loader";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import ids from "../../content/ids.json";
import { CameraRig } from "../camera/CameraRig";
import { FOV_DEG } from "../camera/math";
import { initSelectionFromUrl, watchHistory } from "../state/selection";
import { useViewer, watchReducedMotion } from "../state/store";
import { hasFlag } from "../state/url";
import { DebugOverlay, type BoundsReport, type RenderStats } from "../ui/DebugOverlay";
import {
  allInstanceBounds,
  batchSkeleton,
  disposeBatchedSkeleton,
  ensureBoundsTrees,
  type BatchedSkeleton,
} from "./batchSkeleton";
import { checkInstanceBounds } from "./boundsCheck";
import { Lighting } from "./Lighting";
import { disposeParts, loadSkeleton, prefetchModel } from "./loadSkeleton";
import { BenchPanel } from "../ui/BenchPanel";
import { benchLayersState } from "./bench";
import { Toolbar } from "../ui/Toolbar";
import { RegionPickerHost } from "../ui/RegionPickerHost";
import { LOD_SETTING_KEY, lodPlan, lodsToLoad, parseLodSetting, summariseObjects, withoutLodParam, type Lod } from "./lod";
import { createBoneMaterial, createGhostMaterial, SCENE_BACKGROUND } from "./material";
import { Explode } from "./Explode";
import { Isolation, type IsolationStats, type SkeletonScene } from "./Isolation";
import { createOutline, disposeOutline, OUTLINE } from "./outline";
import { BOTH_OUTLINE, MAX_BOTH_OUTLINES } from "./tints";
import { Tooltip } from "../ui/Tooltip";
import { InfoPanel } from "../ui/InfoPanel";
import { Breadcrumb } from "../ui/Breadcrumb";
import { Announcer } from "../ui/Announcer";
import { Sidebar } from "../ui/Sidebar";
import { LabelProbe, Labels } from "../ui/Labels";
import { Legend } from "../ui/Legend";
import { Toast } from "../ui/Toast";
import { ScreenshotService } from "./ScreenshotService";
import { probeDevice, readStoredSetting } from "./webgl";
import type { LayerFile } from "./debugLayers";
import { LAZY_LAYERS } from "../systems/registry";

// M6 debug layer view (`?debug&layers=…`): lazy chunks, never fetched without the parameter.
const DebugLayersScene = lazy(() => import("./DebugLayers").then((m) => ({ default: m.DebugLayersScene })));
const DebugLayersPanel = lazy(() => import("./DebugLayers").then((m) => ({ default: m.DebugLayersPanel })));
const debugLayersFrom = (search: string): Promise<LayerFile[] | null> =>
  import("./debugLayers").then((m) => m.parseDebugLayers(search));
// M7 soft-tissue layers: one lazy chunk, fetched the first time a layer is turned on (plan decision 3).
const LayerScenes = lazy(() => import("../layers/LayerScenes").then((m) => ({ default: m.LayerScenes })));
const LayersDebugPanel = lazy(() => import("../layers/LayerScenes").then((m) => ({ default: m.LayersDebugPanel })));

export type Shown = { lod: Lod } & SkeletonScene;

function disposeScene(s: SkeletonScene): void {
  // The outlines share the solid batch's buffers: free them together.
  disposeOutline(s.outlines.selected);
  disposeOutline(s.outlines.hover);
  s.both.forEach(disposeOutline);
  disposeBatchedSkeleton(s.ghost);
  disposeBatchedSkeleton(s.skeleton);
}

/**
 * The Milestone 2 viewer. Loads the low LOD, then (if the device or the
 * setting calls for it) the high LOD, and draws the skeleton as one
 * BatchedMesh. Bones keep their glTF world matrices exactly (spec §12).
 */
export function Viewer() {
  const debug = hasFlag(window.location.search, "debug");
  const bench = hasFlag(window.location.search, "bench");
  const [probe] = useState(probeDevice);
  const [layers, setLayers] = useState<LayerFile[] | null>(null);
  useEffect(() => {
    if (debug && useViewer.getState().debugLayersView) {
      void debugLayersFrom(window.location.search).then(setLayers);
    }
  }, [debug]);
  // M13 debug body-region view (`?debug&regions[=key]`): in the debug layers' lazy chunk (the same
  // vendor imports, so the main chunk's split is unchanged), fetched only with `?debug`.
  const [debugRegions, setDebugRegions] = useState<{ group: Group; keys: string[]; total: number; which: string } | null>(null);
  useEffect(() => {
    // Only with `regions` too: `?debug` alone must fetch no debug chunk (`layers-debug.spec.ts`).
    if (!debug || !new URLSearchParams(window.location.search).has("regions")) return;
    let view: { group: Group } | null = null;
    let dispose: ((g: Group) => void) | null = null;
    let live = true;
    void import("./DebugLayers").then((m) => {
      const which = m.parseDebugRegions(window.location.search);
      if (!live || !which) return;
      dispose = m.disposeDebugRegions;
      const v = m.debugRegionsView(which);
      view = v;
      setDebugRegions({ ...v, which });
    });
    return () => {
      live = false;
      if (view && dispose) dispose(view.group);
    };
  }, [debug]);
  // Selection, tier and ghost mode from the URL, before the first render of the scene.
  useState(initSelectionFromUrl);
  const [plan, setPlan] = useState(() => {
    const setting = parseLodSetting(readStoredSetting(LOD_SETTING_KEY));
    useViewer.getState().setLodSetting(setting);
    return lodPlan(window.location.search, setting, probe);
  });
  const [material] = useState(createBoneMaterial);
  const [ghostMaterial] = useState(() => createGhostMaterial(useViewer.getState().ghostOpacity));
  const [isoStats, setIsoStats] = useState<IsolationStats | null>(null);
  // Sticky: once any soft-tissue layer has been on, its chunk stays mounted (turned-off layers keep their batches, hidden).
  const anyTissue = useViewer((s) => LAZY_LAYERS.some((l) => s.layers[l] !== "off"));
  const [tissueWanted, setTissueWanted] = useState(anyTissue);
  useEffect(() => {
    if (anyTissue) setTissueWanted(true);
  }, [anyTissue]);
  const [shown, setShown] = useState<Shown | null>(null);
  const shownRef = useRef<Shown | null>(null);
  shownRef.current = shown;
  const [loadTimes, setLoadTimes] = useState<Partial<Record<Lod, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RenderStats>({ drawCalls: 0, renderedTriangles: 0, fps: 0 });
  const [bounds, setBounds] = useState<BoundsReport | null>(null);

  // `?debug`: after Explode puts the bones back, every bone's bounds are checked again (plan step 8).
  const recheckBounds = useCallback(() => {
    const s = shownRef.current;
    if (!s) return;
    setBounds(null);
    void boundsReport(s.lod, s.skeleton, s.ghost).then((r) => shownRef.current === s && setBounds(r));
  }, []);

  useEffect(() => watchReducedMotion(), []);
  useEffect(() => watchHistory(), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => ghostMaterial.dispose(), [ghostMaterial]);

  // A new choice in Settings re-plans. It overrides `?lod=`, which is dropped from the URL.
  useEffect(
    () =>
      useViewer.subscribe((s, prev) => {
        if (s.lodSetting === prev.lodSetting) return;
        const search = withoutLodParam(window.location.search);
        if (search !== window.location.search) {
          window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
        }
        setPlan(lodPlan(search, s.lodSetting, probe));
      }),
    [probe],
  );

  useEffect(() => {
    let cancelled = false;
    let current: BatchedSkeleton | null = shownRef.current?.skeleton ?? null;
    (async () => {
      const queue = lodsToLoad(plan.lods, shownRef.current?.lod ?? null);
      for (const [i, lod] of queue.entries()) {
        const loaded = await loadSkeleton(lod);
        // Fetch the next level now, while this one is batched and drawn (plan step 12).
        const next = queue[i + 1];
        if (next && !cancelled) void prefetchModel(next).catch(() => {});
        if (cancelled) {
          disposeParts(loaded.parts);
          return;
        }
        const skeleton = batchSkeleton(loaded.parts, material, { instanceColours: true });
        // Ghosts (spec §6): a second batch from the same parts, drawn translucent.
        const ghost = batchSkeleton(loaded.parts, ghostMaterial, { name: "ghosts" });
        ghost.mesh.visible = false;
        disposeParts(loaded.parts); // the BatchedMeshes hold their own copies
        current = skeleton;
        const outlines = {
          selected: createOutline(skeleton, OUTLINE.selected.colour, OUTLINE.selected.widthPx, "outline-selected"),
          hover: createOutline(skeleton, OUTLINE.hover.colour, OUTLINE.hover.widthPx, "outline-hover"),
        };
        // Origin-and-insertion bones with no patch (M9): the origin tint plus an outline (spec §5.3).
        const both = Array.from({ length: MAX_BOTH_OUTLINES }, (_, i) =>
          createOutline(skeleton, BOTH_OUTLINE.colour, BOTH_OUTLINE.widthPx, `outline-both-${i + 1}`),
        );
        setShown({ lod, skeleton, ghost, outlines, both });
        useViewer.getState().setLodActive(lod);
        void loadContent(); // the panel text, off the first frame's path (plan step 4)
        setLoadTimes((t) => ({ ...t, [lod]: loaded.loadedAtMs }));
        if (debug) {
          setBounds(null);
          setBounds(await boundsReport(lod, skeleton, ghost));
        }
      }
      // Build the raycasting BVH once the final LOD is on screen, off the critical path.
      const final = current;
      if (final && !cancelled) idle(() => !cancelled && ensureBoundsTrees(final.mesh));
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [plan, material, ghostMaterial, debug]);

  // Free a skeleton once it is off screen: this cleanup runs after the commit
  // that swapped the next one into the scene (or on unmount), never while it
  // can still be drawn.
  useEffect(() => {
    if (!shown) return;
    return () => disposeScene(shown);
  }, [shown]);

  const objects = shown ? summariseObjects(shown.skeleton.boneIds, ids) : null;
  const finalLod = plan.lods[plan.lods.length - 1] ?? null;
  const finalShown = shown !== null && shown.lod === finalLod;
  // `?bench` (M7 step 9): the orbit starts once every layer the link turns on has its final LOD on screen too.
  const benchLayers = useViewer((s) => (bench ? benchLayersState(s.layers, s.layerLoad, finalLod) : "ready"));

  return (
    <>
      <Canvas
        className="viewport"
        camera={{ fov: FOV_DEG, near: 0.01, far: 50, position: [0, 0.9, 3] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <Lighting />
        {shown && <primitive object={shown.skeleton.mesh} />}
        {shown && <primitive object={shown.outlines.selected.mesh} />}
        {shown && <primitive object={shown.outlines.hover.mesh} />}
        {shown?.both.map((o) => <primitive key={o.mesh.name} object={o.mesh} />)}
        {shown && <primitive object={shown.ghost.mesh} />}
        <Isolation scene={shown} onStats={debug ? setIsoStats : undefined} />
        <Explode scene={shown} onRestored={debug ? recheckBounds : undefined} />
        <CameraRig
          skeleton={shown?.skeleton ?? null}
          debug={debug}
          bench={bench && finalShown && benchLayers === "ready" ? shown.lod : null}
        />
        <LabelProbe skeleton={shown?.skeleton ?? null} />
        <ScreenshotService />
        {tissueWanted && (
          <Suspense fallback={null}>
            <LayerScenes lods={plan.lods} ready={shown !== null} debug={debug} />
          </Suspense>
        )}
        {layers && layers.length > 0 && (
          <Suspense fallback={null}>
            <DebugLayersScene layers={layers} lod={shown?.lod ?? null} />
          </Suspense>
        )}
        {debugRegions && <primitive object={debugRegions.group} />}
        <StatsProbe onStats={setStats} />
      </Canvas>
      <Labels />
      <Breadcrumb />
      <Sidebar />
      <InfoPanel />
      <Toolbar />
      <RegionPickerHost />
      <Legend />
      <Toast />
      <Tooltip />
      <Announcer />
      {error && !debug && (
        <p className="load-error" role="alert">
          The skeleton could not be loaded: {error}
        </p>
      )}
      {bench && <BenchPanel layersState={benchLayers} />}
      {debug && (
      <DebugOverlay
        plan={plan}
        current={shown?.lod ?? null}
        loadTimes={loadTimes}
        objects={objects}
        instances={shown?.skeleton.boneIds.length ?? 0}
        modelTriangles={shown?.skeleton.triangles ?? 0}
        stats={stats}
        bounds={debug ? bounds : undefined}
        isolation={isoStats}
        error={error}
      >
        {tissueWanted && (
          <Suspense fallback={null}>
            <LayersDebugPanel />
          </Suspense>
        )}
        {layers && layers.length > 0 && (
          <Suspense fallback={null}>
            <DebugLayersPanel layers={layers} lod={shown?.lod ?? null} />
          </Suspense>
        )}
        {debugRegions && (
          <p className="debug-regions" data-testid="debug-regions" data-regions={debugRegions.keys.join(",")}>
            Body regions: {debugRegions.keys.length} of {debugRegions.total} drawn
            {debugRegions.keys.length === 0 ? ` (unknown key "${debugRegions.which}")` : ""}
          </p>
        )}
      </DebugOverlay>
      )}
    </>
  );
}

function idle(fn: () => void): void {
  if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}

/** Read renderer counters each frame and report them twice a second. */
function StatsProbe({ onStats }: { onStats: (s: RenderStats) => void }) {
  const acc = useRef({ frames: 0, since: performance.now() });
  useFrame(({ gl }) => {
    // useFrame runs before render, so info still holds the previous frame.
    acc.current.frames++;
    const now = performance.now();
    const elapsed = now - acc.current.since;
    if (elapsed < 500) return;
    onStats({
      drawCalls: gl.info.render.calls,
      renderedTriangles: gl.info.render.triangles,
      fps: (acc.current.frames * 1000) / elapsed,
    });
    acc.current = { frames: 0, since: now };
  });
  return null;
}

/** The `?debug` bounds check of both batches against the manifest (nothing moved). */
async function boundsReport(lod: Lod, skeleton: BatchedSkeleton, ghost: BatchedSkeleton): Promise<BoundsReport> {
  const [solidReport, ghostReport] = await Promise.all([
    checkInstanceBounds(lod, allInstanceBounds(skeleton)),
    checkInstanceBounds(lod, allInstanceBounds(ghost)),
  ]);
  return {
    ...solidReport,
    ghostChecked: ghostReport.checked,
    maxDelta: Math.max(solidReport.maxDelta, ghostReport.maxDelta),
    errors: [...solidReport.errors, ...ghostReport.errors.map((e) => `ghost ${e}`)],
  };
}
