import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Box3, Vector3, type Object3D } from "three";
import ids from "../../content/ids.json";
import { DebugOverlay, type RenderStats } from "../ui/DebugOverlay";
import { disposeSkeleton, loadSkeleton, type LoadedSkeleton } from "./loadSkeleton";
import { lodPlan, summariseObjects, type Lod } from "./lod";

/**
 * Milestone 1 bare viewer: loads the low LOD, then streams in the high LOD and
 * swaps it in. `?lod=low|high` loads only that file. Objects are added to the
 * scene exactly as exported: no transform is ever applied to a bone.
 */
export function BareViewer() {
  const [plan] = useState(() => lodPlan(window.location.search));
  const [current, setCurrent] = useState<LoadedSkeleton | null>(null);
  const [loadTimes, setLoadTimes] = useState<Partial<Record<Lod, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RenderStats>({ drawCalls: 0, renderedTriangles: 0, fps: 0 });

  useEffect(() => {
    let cancelled = false;
    let shown: LoadedSkeleton | null = null;
    (async () => {
      for (const lod of plan) {
        const model = await loadSkeleton(lod);
        if (cancelled) {
          disposeSkeleton(model.scene);
          return;
        }
        const previous = shown;
        shown = model;
        setCurrent(model);
        setLoadTimes((t) => ({ ...t, [lod]: model.loadedAtMs }));
        if (previous) setTimeout(() => disposeSkeleton(previous.scene), 0);
      }
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      if (shown) disposeSkeleton(shown.scene);
    };
  }, [plan]);

  const objects = current ? summariseObjects(current.objectNames, ids) : null;

  return (
    <>
      <Canvas
        className="viewport"
        camera={{ fov: 35, near: 0.01, far: 50, position: [0, 1, 4] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#1d2126"]} />
        <hemisphereLight args={["#ffffff", "#5a5248", 1.2]} />
        <directionalLight position={[1.5, 3, 2.5]} intensity={1.6} />
        {current && <primitive object={current.scene} />}
        <FrameOnFirstModel model={current?.scene ?? null} />
        <StatsProbe onStats={setStats} />
      </Canvas>
      <DebugOverlay
        plan={plan}
        current={current?.lod ?? null}
        loadTimes={loadTimes}
        objects={objects}
        modelTriangles={current?.triangles ?? 0}
        stats={stats}
        error={error}
      />
    </>
  );
}

/** Point the camera at the skeleton once, when the first LOD arrives. */
function FrameOnFirstModel({ model }: { model: Object3D | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const framed = useRef(false);
  useEffect(() => {
    if (!model || framed.current || !controls.current) return;
    framed.current = true;
    const box = new Box3().setFromObject(model);
    const centre = box.getCenter(new Vector3());
    const height = box.getSize(new Vector3()).y;
    // The skeleton faces +Z, so view it from the front.
    const fov = (35 * Math.PI) / 180;
    const distance = (height * 0.6) / Math.tan(fov / 2);
    camera.position.set(centre.x, centre.y, centre.z + distance);
    controls.current.target.copy(centre);
    controls.current.update();
  }, [model, camera]);
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
