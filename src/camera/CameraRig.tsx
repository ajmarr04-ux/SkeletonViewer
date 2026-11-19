import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import CameraControls from "camera-controls";
import {
  Box3,
  Color,
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
import { ensureBoundsTrees, instanceWorldBounds, type BatchedSkeleton } from "../scene/batchSkeleton";
import { PROXY_RADIUS_PX, pickWithProxies, tinyObjects, type Proxy, type RealHit } from "../scene/pick";
import ids from "../../content/ids.json";
import { displayName } from "../content/names";
import { goBack, hasMesh, selectObject } from "../state/selection";
import { isPickable, isolationView } from "../scene/isolation";

/** Everything that covers the canvas for framing: the info panel, the breadcrumb and the sidebar. */
function framingInset() {
  const st = useViewer.getState();
  return st.sidebarLeft > 0 ? { ...st.panelInset, left: st.sidebarLeft } : st.panelInset;
}

/** The box around everything solid in the current isolation (tiers 1 and 2: the focus and its related bones). */
function isolationBox(boneBoxes: Map<string, Box>, sel: string | null, tier: 0 | 1 | 2, grp: string | null = null): Box | undefined {
  const view = isolationView(sel, tier, "ghost", hasMesh, grp);
  if (!view.solid) return undefined;
  const boxes = [...view.solid].map((id) => boneBoxes.get(id)).filter((b): b is Box => b !== undefined);
  return boxes.length ? unionBoxes(boxes) : undefined;
}
import { BENCH_DURATION_MS, BENCH_WARMUP_MS, benchAzimuth, labelLayoutMs, summariseFrames, summariseTimes } from "../scene/bench";
import type { Lod } from "../scene/lod";
import { useViewer, type CameraCommand } from "../state/store";
import { parseUrlState, serialiseUrlState, type CameraState, type Vec3 } from "../state/url";
import {
  INITIAL_TAP_STATE,
  NO_WHEEL_MEMORY,
  classifyWheel,
  keyAction,
  tabCursor,
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
  centreOn,
  clampCamera,
  clampDollyFactor,
  clipPlanes,
  defaultView,
  depthOf,
  directionFromAngles,
  PRESET_ANGLES,
  type Preset,
  dollyPose,
  eyeOf,
  frameBeside,
  frameFrom,
  framedHeightFraction,
  length,
  offsetOf,
  panPose,
  panelOffset,
  pointOnTargetPlane,
  presetView,
  repivot,
  sameCamera,
  scale,
  sub,
  unionBoxes,
  viewDirection,
  worldPerPixel,
  type Box,
} from "./math";

CameraControls.install({ THREE: { Vector2, Vector3, Vector4, Quaternion, Matrix4, Spherical, Box3, Sphere, Raycaster } });

const { ACTION } = CameraControls;

/** Damping (spec §6): every move eases; reduced motion makes every move a cut. */
export const SMOOTH_TIME = 0.12;
export const DRAGGING_SMOOTH_TIME = 0.06;

/** World-space boxes for the skeleton and each of its bones. */
export type SkeletonGeometry = { box: Box; boneBoxes: Map<string, Box>; radii: number[]; radiusOf: Map<string, number> };

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
  const radiusOf = new Map([...boneBoxes].map(([id, box]) => [id, boxRadius(box)] as const));
  return { box: unionBoxes(boxes), boneBoxes, radii: boxes.map(boxRadius), radiusOf };
}

const v = (a: Vec3) => new Vector3(a[0], a[1], a[2]);
const arr = (x: Vector3): Vec3 => [x.x, x.y, x.z];

/** Hooks for the Playwright tests, only with `?debug`. */
export type ViewerDebugApi = {
  /** Camera pose now (not rounded), with the focal offset. */
  camera: () => CameraState;
  /** Where the eye really is. */
  eye: () => Vec3;
  /** A bone's box centre and where it is on screen, in client pixels. */
  bone: (id: string) => { centre: Vec3; client: { x: number; y: number } } | null;
  /** Where a world point is on screen, in client pixels. */
  project: (p: Vec3) => { x: number; y: number };
  /** What a click (or a tap, with `touch`) at these client pixels would pick. */
  pick: (x: number, y: number, touch?: boolean) => string | null;
  command: (c: CameraCommand) => void;
  select: (id: string) => void;
  /** Step back one isolation level (as Esc). */
  back: () => void;
  /**
   * Frame a bone without selecting it (instant, as `F` would): from a preset
   * direction, or the current one. For the all-objects e2e test.
   */
  frameBone: (id: string | string[], from?: Preset) => boolean;
  state: () => { sel: string | null; tier: number; grp: string | null; hovered: string | null; cursor: string | null };
  /** A bone's box centre where it is drawn now (moves with Explode; `bone` gives the rest position). */
  boneNow: (id: string) => Vec3 | null;
  /** A bone's instance colour in the solid batch (linear RGB), for the colour-by-region tests. */
  instanceColour: (id: string) => [number, number, number] | null;
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

/** Mouse buttons (PointerEvent.button) that pan: middle and right. Shift + left pans too. */
const PAN_BUTTONS = new Set([1, 2]);

/**
 * The camera (spec §6), built on camera-controls, with a fixed orbit pivot
 * (backlog 1): camera-controls' target is the pivot, and only rotation goes
 * through camera-controls' own input. Pan (right, middle or Shift + left drag,
 * two-finger drag, Shift + arrows) and zoom toward the cursor (wheel, pinch,
 * + / -) move the eye with a focal offset, worked out by the pure functions in
 * `math.ts`, so the pivot stays where it is. Selecting a bone moves the pivot
 * to it without moving the picture; double-click / double-tap and `F` bring
 * it to the middle. Also: clicks and taps (select, empty click = back),
 * hover, hit proxies for tiny objects, damping, presets, reset, the keyboard
 * map and the `cam=` URL parameter.
 */
export function CameraRig({ skeleton, debug, bench = null }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const reducedMotion = useViewer((s) => s.reducedMotion);
  const geometry = useMemo(() => (skeleton ? skeletonGeometry(skeleton) : null), [skeleton]);
  const tiny = useMemo(() => (geometry ? tinyObjects(geometry.radiusOf) : new Set<string>()), [geometry]);
  const aspect = size.width / Math.max(1, size.height);
  const heightFraction = framedHeightFraction(size.height);
  const limits = useMemo(
    () => (geometry ? cameraLimits(geometry.box, geometry.radii, camera.fov, aspect, heightFraction) : null),
    [geometry, camera.fov, aspect, heightFraction],
  );

  const controlsRef = useRef<CameraControls | null>(null);
  // Everything the event handlers need, read fresh each time.
  const live = useRef({ skeleton, geometry, tiny, limits, aspect, heightFraction, reducedMotion, size });
  live.current = { skeleton, geometry, tiny, limits, aspect, heightFraction, reducedMotion, size };
  /** URL writes start with the first move the user (or a command) makes. */
  const armed = useRef(false);
  const framed = useRef(false);
  /** Depth of the last point zoomed toward (for the near plane); Infinity after a reset. */
  const focusDepth = useRef(Infinity);
  /** Latest mouse position over the canvas for hover, picked once per frame. */
  const hoverAt = useRef<{ x: number; y: number } | null>(null);
  const userMoving = useRef(false);
  const pickRef = useRef<(x: number, y: number, touch: boolean) => string | null>(() => null);

  // --- create the controls and wire up every input --------------------------
  useEffect(() => {
    const el = gl.domElement;
    const controls = new CameraControls(camera, el);
    controlsRef.current = controls;
    controls.dollyToCursor = false;
    controls.minPolarAngle = MIN_POLAR;
    controls.maxPolarAngle = MAX_POLAR;
    // camera-controls only rotates; pan and zoom are handled below.
    controls.mouseButtons.left = ACTION.ROTATE;
    controls.mouseButtons.right = ACTION.NONE;
    controls.mouseButtons.middle = ACTION.NONE;
    controls.mouseButtons.wheel = ACTION.NONE;
    controls.touches.one = ACTION.TOUCH_ROTATE;
    controls.touches.two = ACTION.NONE;
    controls.touches.three = ACTION.NONE;

    el.tabIndex = 0;
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "3D skeleton. Click a bone to select it, Escape to go back. Arrow keys orbit, Shift and arrows pan, plus and minus zoom, H resets the view, F frames the selection. Tab moves through the visible bones and Enter selects one; Escape then Tab leaves the view.",
    );
    el.style.touchAction = "none";

    const animate = () => !live.current.reducedMotion;
    /** The pose camera-controls is heading for (end = true) or showing now. */
    const pose = (end = true): CameraState => {
      const o = controls.getFocalOffset(new Vector3(), end);
      const cam: CameraState = {
        position: arr(controls.getPosition(new Vector3(), end)),
        target: arr(controls.getTarget(new Vector3(), end)),
      };
      return o.x === 0 && o.y === 0 ? cam : { ...cam, offset: [o.x, -o.y] };
    };
    const go = (cam: CameraState, transition = animate()) => {
      armed.current = true;
      controls.normalizeRotations();
      const [ox, oy] = offsetOf(cam);
      void controls.setLookAt(...cam.position, ...cam.target, transition);
      void controls.setFocalOffset(ox, -oy, 0, transition);
    };
    const clamped = (cam: CameraState) => {
      const lim = live.current.limits;
      return lim ? clampCamera(cam, lim) : cam;
    };
    const pivotDepth = () => length(sub(pose().position, pose().target));

    // A camera at the pose camera-controls is heading for, with this camera's
    // projection (view offset included), for rays that match the settled view.
    const probe = camera.clone();
    const placeProbe = (cam: CameraState) => {
      probe.copy(camera);
      probe.position.copy(v(eyeOf(cam)));
      probe.lookAt(v(sub(eyeOf(cam), viewDirection(cam))));
      probe.updateMatrixWorld();
      return probe;
    };
    const ndc = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    };

    const raycaster = new Raycaster();
    (raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    /** Nearest bone surface under a client point, seen from `cam` (default: what is on screen). */
    const surfaceAt = (clientX: number, clientY: number, cam: PerspectiveCamera = camera, needBvh = false) => {
      const sk = live.current.skeleton;
      if (!sk) return null;
      if (needBvh && !(sk.mesh.boundsTrees && sk.mesh.boundsTrees.every(Boolean))) return null;
      raycaster.setFromCamera(ndc(clientX, clientY), cam);
      const hit = raycaster.intersectObject(sk.mesh, false)[0];
      if (!hit || hit.batchId === undefined) return null;
      const id = sk.boneIds[hit.batchId];
      return id ? { id, point: arr(hit.point) } : null;
    };

    // --- zoom toward the cursor (wheel, pinch, + / -) ---------------------------
    const dollyAt = (clientX: number, clientY: number, factor: number) => {
      const lim = live.current.limits;
      if (!lim) return;
      const cam = pose();
      const p = placeProbe(cam);
      // Toward the bone under the cursor (once the BVH is built), else the pivot's plane.
      const surface = surfaceAt(clientX, clientY, p, true);
      let point = surface?.point;
      if (!point) {
        raycaster.setFromCamera(ndc(clientX, clientY), p);
        point = pointOnTargetPlane({ position: eyeOf(cam), target: sub(eyeOf(cam), scale(viewDirection(cam), length(sub(cam.position, cam.target)))) }, arr(raycaster.ray.direction));
      }
      const f = clampDollyFactor(cam, point, factor, lim);
      if (Math.abs(f - 1) < 1e-9) return;
      const next = clamped(dollyPose(cam, point, f));
      focusDepth.current = depthOf(next, point);
      go(next);
    };
    const centreClient = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    // --- pan: the picture follows the pointer at the depth of what was grabbed ---
    /** World size of one CSS pixel at the depth of the bone under the pointer (or the pivot's). */
    const grabScale = (clientX: number, clientY: number) => {
      const cam = pose();
      const surface = surfaceAt(clientX, clientY, placeProbe(cam), true);
      const depth = surface ? depthOf(cam, surface.point) : length(sub(cam.position, cam.target));
      return worldPerPixel(Math.max(depth, live.current.limits?.minDistance ?? 0), camera.fov, el.clientHeight);
    };
    const panBy = (dxPx: number, dyPx: number, k: number) => {
      if (dxPx === 0 && dyPx === 0) return;
      go(clamped(panPose(pose(), dxPx, dyPx, k)));
    };
    const dragging = (on: boolean) => {
      userMoving.current = on;
      const reduced = live.current.reducedMotion;
      controls.smoothTime = reduced ? 0 : on ? DRAGGING_SMOOTH_TIME : SMOOTH_TIME;
    };

    // Mouse pan drags (right, middle, Shift + left) and two-finger touch (pan + pinch).
    let mousePan: { id: number; x: number; y: number; k: number } | null = null;
    const touches = new Map<number, { x: number; y: number }>();
    let twoFinger: { k: number; mid: { x: number; y: number }; spread: number } | null = null;
    const midSpread = () => {
      const [a, b] = [...touches.values()];
      return { mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, spread: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
    };
    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.target !== el) return;
      if (e.pointerType === "mouse") {
        // Shift + left-drag pans: decide per press, before camera-controls sees it.
        controls.mouseButtons.left = e.shiftKey ? ACTION.NONE : ACTION.ROTATE;
        if (PAN_BUTTONS.has(e.button) || (e.button === 0 && e.shiftKey)) {
          mousePan = { id: e.pointerId, x: e.clientX, y: e.clientY, k: grabScale(e.clientX, e.clientY) };
          armed.current = true;
          dragging(true);
        }
        return;
      }
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          const { mid, spread } = midSpread();
          twoFinger = { k: grabScale(mid.x, mid.y), mid, spread };
          armed.current = true;
          dragging(true);
        } else twoFinger = null;
      }
    };
    const onWindowPointerMove = (e: PointerEvent) => {
      if (mousePan && e.pointerId === mousePan.id) {
        panBy(e.clientX - mousePan.x, e.clientY - mousePan.y, mousePan.k);
        mousePan.x = e.clientX;
        mousePan.y = e.clientY;
        return;
      }
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!twoFinger || touches.size !== 2) return;
      const { mid, spread } = midSpread();
      // Pinch toward the fingers' midpoint, then follow the midpoint.
      if (twoFinger.spread > 0 && spread > 0) dollyAt(twoFinger.mid.x, twoFinger.mid.y, twoFinger.spread / spread);
      twoFinger.k *= twoFinger.spread > 0 && spread > 0 ? twoFinger.spread / spread : 1;
      panBy(mid.x - twoFinger.mid.x, mid.y - twoFinger.mid.y, twoFinger.k);
      twoFinger.mid = mid;
      twoFinger.spread = spread;
    };
    const onWindowPointerEnd = (e: PointerEvent) => {
      if (mousePan && e.pointerId === mousePan.id) {
        mousePan = null;
        dragging(false);
      }
      if (touches.delete(e.pointerId)) {
        if (twoFinger) dragging(false);
        twoFinger = null;
      }
    };
    const parent = el.parentElement ?? el;
    parent.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);
    // Right-drag pans, so no context menu over the canvas.
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", onContextMenu);
    controls.addEventListener("controlstart", () => {
      armed.current = true;
      userMoving.current = true;
    });
    controls.addEventListener("controlend", () => {
      userMoving.current = false;
    });

    // Wheel: zoom toward the cursor for a wheel or a pinch, pan for a two-finger drag.
    let wheelMemory = NO_WHEEL_MEMORY;
    let wheelPan: { k: number; at: number } | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const legacy = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
      const { kind, memory } = classifyWheel(
        { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, ctrlKey: e.ctrlKey, timeStamp: e.timeStamp, wheelDeltaY: legacy },
        wheelMemory,
      );
      wheelMemory = memory;
      if (kind === "pan") {
        // A trackpad scroll moves the picture the other way to a drag (as in Milestone 2).
        if (!wheelPan || e.timeStamp - wheelPan.at > 120) wheelPan = { k: grabScale(e.clientX, e.clientY), at: e.timeStamp };
        wheelPan.at = e.timeStamp;
        armed.current = true;
        panBy(-e.deltaX, -e.deltaY, wheelPan.k);
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
          // As in Milestone 2: 2% of the distance per press.
          const d = pivotDepth();
          const [ox, oy] = offsetOf(pose());
          go(clamped({ ...pose(), offset: [ox + a.x * d, oy - a.y * d] }));
          break;
        }
        case "dolly": {
          const c = centreClient();
          dollyAt(c.x, c.y, a.factor);
          break;
        }
        case "reset":
          runCommand({ kind: "reset" });
          break;
        case "frame":
          runCommand({ kind: "frame" });
          break;
      }
    };
    // --- Tab through the visible objects (spec §10, plan decision 6) ---------------
    /** After Escape clears the cursor, the next Tab leaves the canvas instead of starting again. */
    let passThrough = false;
    const cursorNow = () => useViewer.getState().keyCursor?.id ?? null;
    const clearCursor = () => {
      const st = useViewer.getState();
      if (!st.keyCursor) return;
      if (st.hovered === st.keyCursor.id) st.setHovered(null);
      st.setKeyCursor(null);
    };
    const visibleIds = () => {
      const st = useViewer.getState();
      const view = isolationView(st.sel, st.tier, st.ghostMode, hasMesh, st.grp);
      const present = live.current.geometry?.boneBoxes;
      return (ids as { id: string }[]).map((e) => e.id).filter((id) => hasMesh(id) && present?.has(id) && isPickable(view, id));
    };
    /** Where a bone's box centre is on screen (client px), and whether it is in view. */
    const onScreen = (id: string) => {
      const box = live.current.geometry?.boneBoxes.get(id);
      if (!box) return null;
      camera.updateMatrixWorld();
      const p = v(boxCentre(box)).project(camera);
      const r = el.getBoundingClientRect();
      const inView = p.z > -1 && p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, inView };
    };
    const spokenName = (id: string) => displayName(id).replace(/ \((left|right)\)$/, ", $1");
    const moveCursor = (id: string, list: string[]) => {
      const st = useViewer.getState();
      const at = onScreen(id);
      st.setKeyCursor({ id, x: at?.x ?? 0, y: at?.y ?? 0 });
      st.setHovered(id);
      const off = at && !at.inView ? " Off screen: press F to frame it." : "";
      st.say(`${spokenName(id)}. ${list.indexOf(id) + 1} of ${list.length}.${off}`);
    };
    const onTabKey = (e: KeyboardEvent): boolean => {
      if (e.target !== el || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key === "Tab") {
        if (passThrough) {
          passThrough = false;
          return false; // let focus leave the canvas
        }
        const list = visibleIds();
        const next = tabCursor(list, cursorNow(), e.shiftKey);
        if (next === null) {
          clearCursor();
          return false;
        }
        e.preventDefault();
        moveCursor(next, list);
        return true;
      }
      const cur = cursorNow();
      if (cur === null) return false;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        clearCursor();
        selectObject(cur);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        clearCursor();
        passThrough = true;
        useViewer.getState().say("Left the bones. Tab moves on.");
        return true;
      }
      if (e.key === "f" || e.key === "F") {
        // F frames the cursor's bone (it may be off screen), without selecting it.
        e.preventDefault();
        const box = boneBox(cur);
        const { size: sz, heightFraction: hf } = live.current;
        if (!box) return true;
        armed.current = true;
        focusDepth.current = Infinity;
        const now = pose();
        go(clamped(frameBeside(box, sub(now.position, now.target), camera.fov, sz.width, sz.height, hf, framingInset())));
        return true;
      }
      return false;
    };
    const onBlur = () => {
      clearCursor();
      passThrough = false;
    };
    el.addEventListener("blur", onBlur);
    const onCursorPointer = () => clearCursor();
    el.addEventListener("pointermove", onCursorPointer);
    el.addEventListener("pointerdown", onCursorPointer);
    const unsubscribeCursor = useViewer.subscribe((s, prev) => {
      if (s.sel !== prev.sel || s.tier !== prev.tier || s.grp !== prev.grp) clearCursor();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (onTabKey(e)) return;
      if (e.key === "Tab") return;
      if (e.target !== el && e.target !== document.body && e.target !== document.documentElement) return;
      if (e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        goBack();
        return;
      }
      const a = keyAction(e);
      if (!a) return;
      e.preventDefault();
      runKey(a);
    };
    window.addEventListener("keydown", onKeyDown);

    const writeCam = (cam: CameraState) => {
      useViewer.getState().setCamera(cam);
      const search = serialiseUrlState({ cam }, window.location.search);
      if (search !== window.location.search) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
      }
    };
    const boneBox = (id: string | null) => (id && hasMesh(id) ? live.current.geometry?.boneBoxes.get(id) : undefined);

    // Presets, reset, frame, repivot, centre and goto.
    const runCommand = (c: CameraCommand) => {
      const { geometry: g, limits: lim, aspect: asp, heightFraction: hf, size: sz } = live.current;
      const inset = framingInset();
      if (!g || !lim) return;
      const now = pose();
      let cam: CameraState;
      focusDepth.current = Infinity;
      switch (c.kind) {
        case "preset":
          cam = presetView(c.preset, g.box, camera.fov, asp, hf);
          break;
        case "reset":
          cam = defaultView(g.box, camera.fov, asp, hf);
          break;
        case "frame": {
          // The isolation (the selection, plus its related bones at tiers 1 and 2) is framed beside the info
          // panel; the skeleton (nothing selected) as before.
          const st = useViewer.getState();
          const box = g ? isolationBox(g.boneBoxes, st.sel, st.tier, st.grp) : undefined;
          const dir = sub(now.position, now.target);
          cam = box ? frameBeside(box, dir, camera.fov, sz.width, sz.height, hf, inset) : frameFrom(g.box, dir, camera.fov, asp, hf);
          break;
        }
        case "goto":
          cam = c.cam ?? defaultView(g.box, camera.fov, asp, hf);
          break;
        case "centre": {
          const box = boneBox(c.id);
          if (!box) return;
          cam = centreOn(now, boxCentre(box));
          // In the middle of the area the info panel leaves free.
          const depth = length(sub(cam.position, cam.target));
          const offset = panelOffset(inset, depth, camera.fov, sz.width, sz.height, hf);
          if (offset[0] !== 0 || offset[1] !== 0) cam = { ...cam, offset };
          break;
        }
        case "repivot": {
          const box = boneBox(c.id);
          if (!box) return;
          // The picture doesn't move, so no transition: only the pivot changes.
          const next = clamped(repivot(now, boxCentre(box), lim.minDistance));
          go(next, false);
          writeCam(next);
          return;
        }
      }
      go(clamped(cam));
    };
    let lastSeq = useViewer.getState().cameraRequest?.seq ?? 0;
    const unsubscribe = useViewer.subscribe((s) => {
      const r = s.cameraRequest;
      if (!r || r.seq === lastSeq) return;
      lastSeq = r.seq;
      runCommand(r.command);
    });

    // --- picking: clicks and taps select, double-click / double-tap centres ------
    const pick = (clientX: number, clientY: number, touch: boolean): string | null => {
      const { skeleton: sk, geometry: g, tiny: tinyIds } = live.current;
      if (!sk || !g) return null;
      if (useViewer.getState().explode > 0) return null; // picking is off while exploded (plan step 8)
      ensureBoundsTrees(sk.mesh); // normally already built in an idle callback
      camera.updateMatrixWorld();
      const now: CameraState = { position: arr(camera.position), target: arr(camera.position.clone().add(camera.getWorldDirection(new Vector3()))) };
      const surface = surfaceAt(clientX, clientY);
      const real: RealHit | null = surface ? { id: surface.id, depth: depthOf(now, surface.point) } : null;
      const r = el.getBoundingClientRect();
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const proxies: Proxy[] = [];
      // Ghosts and hidden bones are not pickable (the raycast already skips hidden instances).
      const st = useViewer.getState();
      const view = isolationView(st.sel, st.tier, st.ghostMode, hasMesh, st.grp);
      for (const id of tinyIds) {
        if (!isPickable(view, id)) continue;
        const box = g.boneBoxes.get(id);
        const radius = g.radiusOf.get(id);
        if (!box || radius === undefined) continue;
        const centre = boxCentre(box);
        const depth = depthOf(now, centre);
        if (!(depth > 0)) continue;
        const p = v(centre).project(camera);
        proxies.push({
          id,
          x: r.left + ((p.x + 1) / 2) * r.width,
          y: r.top + ((1 - p.y) / 2) * r.height,
          depth,
          radius,
          radiusPx: (radius / (depth * tanHalf)) * (r.height / 2),
        });
      }
      const hitPx = touch ? PROXY_RADIUS_PX.touch : PROXY_RADIUS_PX.mouse;
      return pickWithProxies(real, proxies, { x: clientX, y: clientY }, hitPx, (id) => tinyIds.has(id));
    };
    pickRef.current = pick;

    let taps = INITIAL_TAP_STATE;
    let lastPointerType = "mouse";
    const onPointer = (type: PointerSample["type"]) => (e: PointerEvent) => {
      // Only the primary button selects (a right or middle press pans).
      if (type === "down" && e.pointerType === "mouse" && e.button !== 0) return;
      if (type === "down") lastPointerType = e.pointerType;
      const r = tapStep(taps, { type, id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });
      taps = r.state;
      // Picking is off while the bones are exploded (plan step 8).
      const exploded = useViewer.getState().explode > 0;
      if (r.tap && !exploded) {
        const id = pick(r.tap.x, r.tap.y, lastPointerType !== "mouse");
        useViewer.getState().markInput(e.timeStamp);
        if (id) selectObject(id);
        else goBack(); // empty space (spec §6)
        useViewer.getState().markInput(null); // consumed by the highlight if anything changed
      }
      if (r.doubleTap && !exploded) {
        const id = pick(r.doubleTap.x, r.doubleTap.y, lastPointerType !== "mouse");
        if (id) runCommand({ kind: "centre", id }); // empty space: nothing more happens
      }
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

    // Hover (mouse only): remember where the pointer is; it is picked once per frame.
    const onHoverMove = (e: PointerEvent) => {
      hoverAt.current = e.pointerType === "mouse" && e.buttons === 0 ? { x: e.clientX, y: e.clientY } : null;
      if (!hoverAt.current) useViewer.getState().setHovered(null);
    };
    const onLeave = () => {
      hoverAt.current = null;
      useViewer.getState().setHovered(null);
    };
    el.addEventListener("pointermove", onHoverMove);
    el.addEventListener("pointerleave", onLeave);

    // Write the camera to the store and the URL when it comes to rest.
    const onRest = () => {
      if (!armed.current) return;
      const cam = pose(false);
      const prev = useViewer.getState().camera;
      if (prev && sameCamera(prev, cam, 5e-5)) return;
      writeCam(cam);
    };
    controls.addEventListener("rest", onRest);
    // An instant cut never "rests" (it never moves slowly); it goes straight to sleep.
    controls.addEventListener("sleep", onRest);

    if (debug) {
      const project = (p: Vec3) => {
        const q = v(p).project(camera);
        const r = el.getBoundingClientRect();
        return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height };
      };
      window.__viewer = {
        camera: () => pose(false),
        eye: () => arr(camera.position),
        bone: (id) => {
          const box = live.current.geometry?.boneBoxes.get(id);
          if (!box) return null;
          const centre = boxCentre(box);
          return { centre, client: project(centre) };
        },
        project,
        pick: (x, y, touch = false) => pick(x, y, touch),
        command: (c) => useViewer.getState().requestCamera(c),
        select: (id) => selectObject(id),
        back: () => goBack(),
        frameBone: (id, from) => {
          const boxes = (Array.isArray(id) ? id : [id]).map((i) => live.current.geometry?.boneBoxes.get(i));
          if (boxes.length === 0 || boxes.some((b) => !b)) return false;
          const box = unionBoxes(boxes as Box[]);
          const now = pose();
          const dir = from ? directionFromAngles(PRESET_ANGLES[from].azimuth, PRESET_ANGLES[from].polar) : sub(now.position, now.target);
          focusDepth.current = Infinity;
          const cam = clamped(frameFrom(box, dir, camera.fov, live.current.aspect, live.current.heightFraction));
          go(cam, false);
          return true;
        },
        state: () => {
          const s = useViewer.getState();
          return { sel: s.sel, tier: s.tier, grp: s.grp, hovered: s.hovered, cursor: s.keyCursor?.id ?? null };
        },
        boneNow: (id) => {
          const sk = live.current.skeleton;
          const i = sk?.instanceOf.get(id);
          if (!sk || i === undefined) return null;
          const b = instanceWorldBounds(sk.mesh, i);
          return [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2];
        },
        instanceColour: (id) => {
          const sk = live.current.skeleton;
          const i = sk?.instanceOf.get(id);
          if (!sk || i === undefined) return null;
          const c = sk.mesh.getColorAt(i, new Color());
          return [c.r, c.g, c.b];
        },
      };
    }

    return () => {
      controls.dispose();
      controlsRef.current = null;
      parent.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerEnd);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      for (const [name, fn] of pointerHandlers) el.removeEventListener(name, fn);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("pointermove", onHoverMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("pointermove", onCursorPointer);
      el.removeEventListener("pointerdown", onCursorPointer);
      unsubscribeCursor();
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

  // --- first view: the URL's cam if valid, else the selection, else the default framing ---
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || !geometry || !limits || framed.current) return;
    framed.current = true;
    const url = parseUrlState(window.location.search);
    const st = useViewer.getState();
    const selBox = isolationBox(geometry.boneBoxes, st.sel, st.tier, st.grp);
    const home = defaultView(geometry.box, camera.fov, aspect, heightFraction);
    const inset = framingInset();
    const start = url.cam ?? (selBox ? frameBeside(selBox, sub(home.position, home.target), camera.fov, size.width, size.height, heightFraction, inset) : home);
    const cam = clampCamera(start, limits);
    const [ox, oy] = offsetOf(cam);
    void c.setLookAt(...cam.position, ...cam.target, false);
    void c.setFocalOffset(ox, -oy, 0, false);
    if (url.cam) useViewer.getState().setCamera(cam);
  }, [geometry, limits, camera, aspect, heightFraction, size]);

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

  // --- per frame: advance the controls, keep the clip planes snug, hover -------
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
        labelLayoutMs.length = 0;
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
        if (result) useViewer.getState().setBench({ ...result, lod: run.lod, drawCalls: run.drawCalls, labels: summariseTimes(labelLayoutMs) });
      }
    }
    c.update(delta);
    // The Tab cursor's tooltip follows its bone on screen.
    const kc = useViewer.getState().keyCursor;
    if (kc && geometry) {
      const box = geometry.boneBoxes.get(kc.id);
      if (box) {
        const p = v(boxCentre(box)).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        const x = Math.round(r.left + ((p.x + 1) / 2) * r.width);
        const y = Math.round(r.top + ((1 - p.y) / 2) * r.height);
        if (Math.abs(x - kc.x) > 1 || Math.abs(y - kc.y) > 1) useViewer.getState().setKeyCursor({ id: kc.id, x, y });
      }
    }
    // Hover: one pick per frame at most, never while the camera is being moved.
    const at = hoverAt.current;
    if (at && skeleton?.mesh.boundsTrees?.every(Boolean)) {
      hoverAt.current = null;
      const st = useViewer.getState();
      st.setHovered(userMoving.current || st.explode > 0 ? null : pickRef.current(at.x, at.y, false));
    }
    if (!centreRadius) return;
    const o = c.getFocalOffset(new Vector3(), false);
    const now: CameraState = {
      position: arr(c.getPosition(new Vector3(), false)),
      target: arr(c.getTarget(new Vector3(), false)),
      offset: [o.x, -o.y],
    };
    const { near, far } = clipPlanes(now, centreRadius.c, centreRadius.r, focusDepth.current);
    if (Math.abs(camera.near - near) > near * 0.01 || Math.abs(camera.far - far) > far * 0.01) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
