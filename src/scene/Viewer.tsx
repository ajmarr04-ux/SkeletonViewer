import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Box3, Vector3, type BatchedMesh } from "three";
import ids from "../../content/ids.json";
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
import { disposeParts, loadSkeleton } from "./loadSkeleton";
import { LOD_SETTING_KEY, lodPlan, parseLodSetting, summariseObjects, type Lod } from "./lod";
import { createBoneMaterial } from "./material";
import { probeDevice, readStoredSetting } from "./webgl";

export type Shown = { lod: Lod; skeleton: BatchedSkeleton };

/**
 * The Milestone 2 viewer. Loads the low LOD, then (if the device or the
 * setting calls for it) the high LOD, and draws the skeleton as one
 * BatchedMesh. Bones keep their glTF world matrices exactly (spec §12).
 */
export function Viewer() {
  const debug = hasFlag(window.location.search, "debug");
  const [plan] = useState(() => {
    const setting = parseLodSetting(readStoredSetting(LOD_SETTING_KEY));
    useViewer.getState().setLodSetting(setting);
    return lodPlan(window.location.search, setting, probeDevice());
  });
  const [material] = useState(createBoneMaterial);
  const [shown, setShown] = useState<Shown | null>(null);
  const [loadTimes, setLoadTimes] = useState<Partial<Record<Lod, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RenderStats>({ drawCalls: 0, renderedTriangles: 0, fps: 0 });
  const [bounds, setBounds] = useState<BoundsReport | null>(null);

  useEffect(() => watchReducedMotion(), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    let cancelled = false;
    let current: BatchedSkeleton | null = null;
    (async () => {
      for (const lod of plan.lods) {
        const loaded = await loadSkeleton(lod);
        if (cancelled) {
          disposeParts(loaded.parts);
          return;
        }
        const skeleton = batchSkeleton(loaded.parts, material);
        disposeParts(loaded.parts); // the BatchedMesh holds its own copy
        current = skeleton;
        setShown({ lod, skeleton });
        useViewer.getState().setLodActive(lod);
        setLoadTimes((t) => ({ ...t, [lod]: loaded.loadedAtMs }));
        if (debug) {
          setBounds(null);
          setBounds(await checkInstanceBounds(lod, allInstanceBounds(skeleton)));
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
  }, [plan, material, debug]);

  // Free a skeleton once it is off screen: this cleanup runs after the commit
  // that swapped the next one into the scene (or on unmount), never while it
  // can still be drawn.
  useEffect(() => {
    if (!shown) return;
    return () => disposeBatchedSkeleton(shown.skeleton);
  }, [shown]);

  const objects = shown ? summariseObjects(shown.skeleton.boneIds, ids) : null;

  return (
    <>
      <Canvas
        className="viewport"
        camera={{ fov: 35, near: 0.01, far: 50, position: [0, 1, 4] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#1d2126"]} />
        <Lighting />
        {shown && <primitive object={shown.skeleton.mesh} />}
        <FrameOnFirstModel mesh={shown?.skeleton.mesh ?? null} />
        <StatsProbe onStats={setStats} />
      </Canvas>
      <DebugOverlay
        plan={plan}
        current={shown?.lod ?? null}
        loadTimes={loadTimes}
        objects={objects}
        instances={shown?.skeleton.boneIds.length ?? 0}
        modelTriangles={shown?.skeleton.triangles ?? 0}
        stats={stats}
        bounds={debug ? bounds : undefined}
        error={error}
      />
    </>
  );
}

function idle(fn: () => void): void {
  if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}

/** Point the camera at the skeleton once, when the first LOD arrives. (Replaced by the camera rig in session E.) */
function FrameOnFirstModel({ mesh }: { mesh: BatchedMesh | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const framed = useRef(false);
  useEffect(() => {
    if (!mesh || framed.current || !controls.current) return;
    framed.current = true;
    mesh.computeBoundingBox();
    const box = mesh.boundingBox ?? new Box3();
    const centre = box.getCenter(new Vector3());
    const height = box.getSize(new Vector3()).y;
    // The skeleton faces +Z, so view it from the front.
    const fov = (35 * Math.PI) / 180;
    const distance = (height * 0.6) / Math.tan(fov / 2);
    camera.position.set(centre.x, centre.y, centre.z + distance);
    controls.current.target.copy(centre);
    controls.current.update();
  }, [mesh, camera]);
  return <OrbitControls ref={controls} makeDefault enableDamping />;
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
