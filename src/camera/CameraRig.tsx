import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import CameraControls from "camera-controls";
import {
  Box3,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from "three";
import type { BatchedSkeleton } from "../scene/batchSkeleton";
import { BENCH_DURATION_MS, BENCH_WARMUP_MS, benchAzimuth, summariseFrames } from "../scene/bench";
import type { Lod } from "../scene/lod";
import { useViewer, type CameraCommand } from "../state/store";
import { parseUrlState, serialiseUrlState, type CameraState, type Vec3 } from "../state/url";
import {
  INITIAL_TAP_STATE,
  NO_WHEEL_MEMORY,
  classifyWheel,
  keyAction,
  tapStep,
  zoomFactor,
  type KeyAction,
  type PointerSample,
} from "./input";
import {
  MAX_POLAR,
  MIN_POLAR,
  boxCentre,
  boxRadius,
  cameraLimits,
  clampCamera,
  clampDollyRatio,
  clipPlanes,
  defaultView,
  dollyToPoint,
  frameFrom,
  framedHeightFraction,
  length,
  pointOnTargetPlane,
  presetView,
  sameCamera,
  sub,
  unionBoxes,
  worldPerPixel,
  type Box,
} from "./math";

CameraControls.install({ THREE: { Vector2, Vector3, Vector4, Quaternion, Matrix4, Spherical, Box3, Sphere, Raycaster } });

const { ACTION } = CameraControls;

/** Damping (spec §6): every move eases; reduced motion makes every move a cut. */
export const SMOOTH_TIME = 0.12;
export const DRAGGING_SMOOTH_TIME = 0.06;

/** World-space boxes for the skeleton and each of its bones. */
export type SkeletonGeometry = { box: Box; boneBoxes: Map<string, Box>; radii: number[] };

const toBox = (b: Box3): Box => ({ min: b.min.toArray(), max: b.max.toArray() });

/**
 * Each instance's world box: its geometry's local box through the instance
 * matrix. gltfpack's matrices are scale and translation only, so this is the
 * exact box, not a loose one.
 */
export function skeletonGeometry(s: BatchedSkeleton): SkeletonGeometry {
  const boneBoxes = new Map<string, Box>();
  const m = new Matrix4();
  const b = new Box3();
  s.boneIds.forEach((id, instanceId) => {
    s.mesh.getBoundingBoxAt(s.mesh.getGeometryIdAt(instanceId), b);
    s.mesh.getMatrixAt(instanceId, m);
    boneBoxes.set(id, toBox(b.applyMatrix4(m)));
  });
  const boxes = [...boneBoxes.values()];
  return { box: unionBoxes(boxes), boneBoxes, radii: boxes.map(boxRadius) };
}

const v = (a: Vec3) => new Vector3(a[0], a[1], a[2]);
const arr = (x: Vector3): Vec3 => [x.x, x.y, x.z];

/** Hooks for the Playwright tests, only with `?debug`. */
export type ViewerDebugApi = {
  /** Camera pose now (not rounded). */
  camera: () => CameraState;
  /** A bone's box centre and where it is on screen, in client pixels. */
  bone: (id: string) => { centre: Vec3; client: { x: number; y: number } } | null;
  command: (c: CameraCommand) => void;
};
declare global {
  interface Window {
    __viewer?: ViewerDebugApi;
  }
}

type Props = {
  skeleton: BatchedSkeleton | null;
  debug: boolean;
  /** `?bench`: the LOD to run the orbit at, once it is the final one on screen; null otherwise. */
  bench?: Lod | null;
};

/**
 * The camera (spec §6), built on camera-controls: orbit around a focus point,
 * dolly toward the cursor, pan, zoom and pole clamps, damping, presets, reset,
 * re-centre on double-click or double-tap, the keyboard map, and the `cam=`
 * URL parameter.
 */
export function CameraRig({ skeleton, debug, bench = null }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const reducedMotion = useViewer((s) => s.reducedMotion);
  const geometry = useMemo(() => (skeleton ? skeletonGeometry(skeleton) : null), [skeleton]);
  const aspect = size.width / Math.max(1, size.height);
  const heightFraction = framedHeightFraction(size.height);
  const limits = useMemo(
    () => (geometry ? cameraLimits(geometry.box, geometry.radii, camera.fov, aspect, heightFraction) : null),
    [geometry, camera.fov, aspect, heightFraction],
  );

  const controlsRef = useRef<CameraControls | null>(null);
  // Everything the event handlers need, read fresh each time.
  const live = useRef({ skeleton, geometry, limits, aspect, heightFraction, reducedMotion });
  live.current = { skeleton, geometry, limits, aspect, heightFraction, reducedMotion };
  /** URL writes start with the first move the user (or a command) makes. */
  const armed = useRef(false);
  const framed = useRef(false);

  // --- create the controls and wire up every input --------------------------
  useEffect(() => {
    const el = gl.domElement;
    const controls = new CameraControls(camera, el);
    controlsRef.current = controls;
    controls.dollyToCursor = true;
    controls.minPolarAngle = MIN_POLAR;
    controls.maxPolarAngle = MAX_POLAR;
    controls.mouseButtons.left = ACTION.ROTATE;
    controls.mouseButtons.right = ACTION.TRUCK;
    controls.mouseButtons.middle = ACTION.DOLLY;
    // The wheel is classified below (mouse wheel, pinch or two-finger drag).
    controls.mouseButtons.wheel = ACTION.NONE;
    controls.touches.one = ACTION.TOUCH_ROTATE;
    controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
    controls.touches.three = ACTION.TOUCH_TRUCK;

    el.tabIndex = 0;
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "3D skeleton. Arrow keys orbit, Shift and arrows pan, plus and minus zoom, H resets the view, F frames the skeleton.",
    );
    el.style.touchAction = "none";

    const animate = () => !live.current.reducedMotion;
    const current = (end = true): CameraState => ({
      position: arr(controls.getPosition(new Vector3(), end)),
      target: arr(controls.getTarget(new Vector3(), end)),
    });
    const go = (cam: CameraState, transition = animate()) => {
      armed.current = true;
      controls.normalizeRotations();
      void controls.setLookAt(...cam.position, ...cam.target, transition);
    };
    const distance = () => length(sub(current().position, current().target));

    // Shift + left-drag pans: decide per press, before camera-controls sees it.
    const parent = el.parentElement ?? el;
    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.target !== el) return;
      controls.mouseButtons.left = e.shiftKey ? ACTION.TRUCK : ACTION.ROTATE;
    };
    parent.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    controls.addEventListener("controlstart", () => {
      armed.current = true;
    });

    // Wheel: zoom toward the cursor for a wheel or a pinch, pan for a two-finger drag.
    let wheelMemory = NO_WHEEL_MEMORY;
    const ndc = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    };
    const dollyAt = (clientX: number, clientY: number, factor: number) => {
      const lim = live.current.limits;
      if (!lim) return;
      const cam = current();
      const s = clampDollyRatio(distance(), factor, lim);
      if (Math.abs(s - 1) < 1e-9) return;
      // The cursor ray, from the camera as it will be once the move settles.
      const probe = camera.clone();
      probe.position.copy(v(cam.position));
      probe.lookAt(v(cam.target));
      probe.updateMatrixWorld();
      const ray = new Raycaster();
      ray.setFromCamera(ndc(clientX, clientY), probe);
      const point = pointOnTargetPlane(cam, arr(ray.ray.direction));
      go(clampCamera(dollyToPoint(cam, point, s), lim));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const legacy = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
      const { kind, memory } = classifyWheel(
        { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, ctrlKey: e.ctrlKey, timeStamp: e.timeStamp, wheelDeltaY: legacy },
        wheelMemory,
      );
      wheelMemory = memory;
      if (kind === "pan") {
        const k = worldPerPixel(distance(), camera.fov, el.clientHeight);
        armed.current = true;
        void controls.truck(e.deltaX * k, e.deltaY * k, animate());
      } else {
        dollyAt(e.clientX, e.clientY, zoomFactor(kind, e));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    // Safari on macOS sends trackpad pinches as gesture events, not wheel events.
    type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };
    let gestureScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureScale = (e as GestureEvent).scale || 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      if (!g.scale) return;
      dollyAt(g.clientX, g.clientY, gestureScale / g.scale);
      gestureScale = g.scale;
    };
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);

    // Keyboard: while the canvas (or nothing in particular) has focus.
    const runKey = (a: KeyAction) => {
      armed.current = true;
      switch (a.kind) {
        case "orbit":
          void controls.rotate(a.azimuth, a.polar, animate());
          break;
        case "pan": {
          const d = distance();
          void controls.truck(a.x * d, a.y * d, animate());
          break;
        }
        case "dolly":
          void controls.dollyTo(distance() * a.factor, animate());
          break;
        case "reset":
          runCommand({ kind: "reset" });
          break;
        case "frame":
          runCommand({ kind: "frame" });
          break;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.target !== el && e.target !== document.body && e.target !== document.documentElement) return;
      const a = keyAction(e);
      if (!a) return;
      e.preventDefault();
      runKey(a);
    };
    window.addEventListener("keydown", onKeyDown);

    // Presets, reset and frame.
    const runCommand = (c: CameraCommand) => {
      const { geometry: g, limits: lim, aspect: asp, heightFraction: hf } = live.current;
      if (!g || !lim) return;
      let cam: CameraState;
      if (c.kind === "preset") cam = presetView(c.preset, g.box, camera.fov, asp, hf);
      else if (c.kind === "reset") cam = defaultView(g.box, camera.fov, asp, hf);
      else {
        const now = current();
        cam = frameFrom(g.box, sub(now.position, now.target), camera.fov, asp, hf);
      }
      go(clampCamera(cam, lim));
    };
    let lastSeq = useViewer.getState().cameraRequest?.seq ?? 0;
    const unsubscribe = useViewer.subscribe((s) => {
      const r = s.cameraRequest;
      if (!r || r.seq === lastSeq) return;
      lastSeq = r.seq;
      runCommand(r.command);
    });

    // Double-click or double-tap re-centres the orbit on the bone underneath.
    let taps = INITIAL_TAP_STATE;
    const raycaster = new Raycaster();
    (raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const boneAt = (clientX: number, clientY: number): string | null => {
      const sk = live.current.skeleton;
      if (!sk) return null;
      raycaster.setFromCamera(ndc(clientX, clientY), camera);
      const hit = raycaster.intersectObject(sk.mesh, false)[0];
      return hit?.batchId !== undefined ? (sk.boneIds[hit.batchId] ?? null) : null;
    };
    const recentre = (clientX: number, clientY: number) => {
      const id = boneAt(clientX, clientY);
      const box = id ? live.current.geometry?.boneBoxes.get(id) : undefined;
      if (!box) return; // empty space: nothing happens
      armed.current = true;
      const c = boxCentre(box);
      void controls.moveTo(c[0], c[1], c[2], animate());
    };
    const onPointer = (type: PointerSample["type"]) => (e: PointerEvent) => {
      const r = tapStep(taps, { type, id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });
      taps = r.state;
      if (r.doubleTap) recentre(r.doubleTap.x, r.doubleTap.y);
    };
    const pointerHandlers = [
      ["pointerdown", onPointer("down")],
      ["pointermove", onPointer("move")],
      ["pointerup", onPointer("up")],
      ["pointercancel", onPointer("cancel")],
    ] as const;
    for (const [name, fn] of pointerHandlers) el.addEventListener(name, fn);
    // The browser's own double-click would select text or zoom the page.
    const onDblClick = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("dblclick", onDblClick);

    // Write the camera to the store and the URL when it comes to rest.
    const onRest = () => {
      if (!armed.current) return;
      const cam = current(false);
      const prev = useViewer.getState().camera;
      if (prev && sameCamera(prev, cam, 5e-5)) return;
      useViewer.getState().setCamera(cam);
      const search = serialiseUrlState({ cam }, window.location.search);
      if (search !== window.location.search) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
      }
    };
    controls.addEventListener("rest", onRest);
    // An instant cut never "rests" (it never moves slowly); it goes straight to sleep.
    controls.addEventListener("sleep", onRest);

    // Back and Forward (used by Milestone 3's isolation levels) re-read the URL.
    const onPopState = () => {
      const { geometry: g, limits: lim, aspect: asp, heightFraction: hf } = live.current;
      if (!g || !lim) return;
      const cam = parseUrlState(window.location.search).cam;
      go(clampCamera(cam ?? defaultView(g.box, camera.fov, asp, hf), lim));
    };
    window.addEventListener("popstate", onPopState);

    if (debug) {
      window.__viewer = {
        camera: () => current(false),
        bone: (id) => {
          const box = live.current.geometry?.boneBoxes.get(id);
          if (!box) return null;
          const centre = boxCentre(box);
          const p = v(centre).project(camera);
          const r = el.getBoundingClientRect();
          return { centre, client: { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height } };
        },
        command: (c) => useViewer.getState().requestCamera(c),
      };
    }

    return () => {
      controls.dispose();
      controlsRef.current = null;
      parent.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      for (const [name, fn] of pointerHandlers) el.removeEventListener(name, fn);
      el.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      unsubscribe();
      if (debug) delete window.__viewer;
    };
  }, [camera, gl, debug]);

  // --- damping, or none with reduced motion ----------------------------------
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.smoothTime = reducedMotion ? 0 : SMOOTH_TIME;
    c.draggingSmoothTime = reducedMotion ? 0 : DRAGGING_SMOOTH_TIME;
  }, [reducedMotion]);

  // --- limits follow the skeleton and the window's shape ----------------------
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || !limits) return;
    c.minDistance = limits.minDistance;
    c.maxDistance = limits.maxDistance;
    c.setBoundary(new Box3(v(limits.boundary.min), v(limits.boundary.max)));
  }, [limits]);

  // --- first view: the URL's cam if valid, else the default framing ------------
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || !geometry || !limits || framed.current) return;
    framed.current = true;
    const fromUrl = parseUrlState(window.location.search).cam;
    const cam = clampCamera(fromUrl ?? defaultView(geometry.box, camera.fov, aspect, heightFraction), limits);
    void c.setLookAt(...cam.position, ...cam.target, false);
    if (fromUrl) useViewer.getState().setCamera(cam);
  }, [geometry, limits, camera, aspect, heightFraction]);

  // --- keep the framed area above the toolbar: move the projection centre up ---
  useEffect(() => {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;
    const shift = ((1 - heightFraction) * height) / 2;
    camera.setViewOffset(width, height, 0, shift, width, height);
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
    };
  }, [camera, size, heightFraction]);

  // --- per frame: advance the controls, keep the clip planes snug -------------
  const centreRadius = useMemo(() => (geometry ? { c: boxCentre(geometry.box), r: boxRadius(geometry.box) } : null), [geometry]);
  // `?bench`: orbit 360° about the vertical axis over 10 s, timing every frame.
  const benchRun = useRef<{ lod: Lod; start: number; azimuth: number; last: number; frames: number[]; drawCalls: number } | null>(null);
  const benchDone = useRef<Lod | null>(null);
  useFrame(({ gl: renderer }, delta) => {
    const c = controlsRef.current;
    if (!c) return;
    if (bench && framed.current && benchDone.current !== bench) {
      const now = performance.now();
      let run = benchRun.current;
      if (!run || run.lod !== bench) {
        run = benchRun.current = { lod: bench, start: now, azimuth: c.azimuthAngle, last: now, frames: [], drawCalls: 0 };
        useViewer.getState().setBench(null);
      } else {
        if (now - run.start > BENCH_WARMUP_MS) run.frames.push(now - run.last);
        run.last = now;
        run.drawCalls = Math.max(run.drawCalls, renderer.info.render.calls);
      }
      const elapsed = now - run.start;
      void c.rotateTo(run.azimuth + benchAzimuth(elapsed), c.polarAngle, false);
      if (elapsed >= BENCH_DURATION_MS) {
        benchDone.current = bench;
        benchRun.current = null;
        const result = summariseFrames(run.frames);
        if (result) useViewer.getState().setBench({ ...result, lod: run.lod, drawCalls: run.drawCalls });
      }
    }
    c.update(delta);
    if (!centreRadius) return;
    const target = c.getTarget(new Vector3(), false);
    const { near, far } = clipPlanes({ position: arr(camera.position), target: arr(target) }, centreRadius.c, centreRadius.r);
    if (Math.abs(camera.near - near) > near * 0.01 || Math.abs(camera.far - far) > far * 0.01) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

