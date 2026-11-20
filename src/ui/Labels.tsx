import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Matrix4, Sphere, Vector3, type PerspectiveCamera } from "three";
import { displayName } from "../content/names";
import { relations } from "../content/relations";
import type { BatchedSkeleton } from "../scene/batchSkeleton";
import { isolationView, withBonesLayer } from "../scene/isolation";
import { recordLabelLayout } from "../scene/bench";
import { LABEL, labelPriority, layoutLabels, leaderEnd, type LabelCandidate, type PlacedLabel, type Rect } from "../scene/labels";
import { hasMesh } from "../state/selection";
import { useViewer } from "../state/store";

/** Re-layout at most this often while the camera moves (plan decision 7). */
const MOVING_INTERVAL_MS = 100;
/** And every so often at rest, for panels and the legend opening or closing. */
const REST_INTERVAL_MS = 500;
/** Screen elements labels keep off. */
const OBSTACLES = ".toolbar, .breadcrumb, .legend, .info-panel, .sheet, .sidebar, .footer, .toast";
export const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureText(text: string): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = LABEL_FONT;
  }
  return measureCtx ? measureCtx.measureText(text).width : text.length * 7;
}

/** Each instance's bounding-sphere centre and radius in its own geometry space, read once per skeleton. */
function localSpheres(s: BatchedSkeleton): Sphere[] {
  const box = new Box3();
  return s.boneIds.map((_, i) => {
    s.mesh.getBoundingBoxAt(s.mesh.getGeometryIdAt(i), box);
    return box.getBoundingSphere(new Sphere());
  });
}

const _m = new Matrix4();
const _c = new Vector3();
const _sphere = new Sphere();
const _camPos = new Vector3();

/**
 * Lays out the floating labels (plan decision 7), inside the Canvas: projects
 * the visible solid objects (ghosts get none), then runs the greedy layout,
 * when the camera comes to rest and at most every 100 ms while it moves. The
 * result goes to the store; `Labels` draws it. Instance matrices are read, so
 * labels follow Explode; nothing is written to the scene.
 */
export function LabelProbe({ skeleton }: { skeleton: BatchedSkeleton | null }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const spheres = useMemo(() => (skeleton ? localSpheres(skeleton) : null), [skeleton]);
  const last = useRef({ at: 0, key: "", dirty: true });
  const labelsOn = useViewer((s) => s.labelsOn);

  useEffect(() => {
    last.current.dirty = true;
    if (!labelsOn) useViewer.getState().setLabelLayout([]);
  }, [labelsOn, skeleton]);
  useEffect(
    () =>
      useViewer.subscribe((s, p) => {
        if (s.sel !== p.sel || s.tier !== p.tier || s.grp !== p.grp || s.ghostMode !== p.ghostMode || s.explode !== p.explode || s.panelInset !== p.panelInset || s.sidebarLeft !== p.sidebarLeft || s.colourMode !== p.colourMode || s.layers !== p.layers) last.current.dirty = true;
      }),
    [],
  );

  useFrame(() => {
    const st = useViewer.getState();
    if (!st.labelsOn || !skeleton || !spheres) return;
    const now = performance.now();
    const e = camera.matrixWorld.elements;
    const p = camera.projectionMatrix.elements;
    const key = `${e.join(",")}|${p[0]},${p[5]},${p[9]}`;
    const moved = key !== last.current.key;
    if (moved) last.current.dirty = true;
    const since = now - last.current.at;
    // At rest: lay out at once; moving: throttled; nothing new: a slow refresh for panels and the legend.
    if (last.current.dirty ? moved && since < MOVING_INTERVAL_MS : since < REST_INTERVAL_MS) {
      last.current.key = key;
      return;
    }
    last.current = { at: now, key, dirty: false };
    const next = computeLayout(skeleton, spheres, camera, gl.domElement);
    if (!sameLayout(st.labelLayout, next)) st.setLabelLayout(next);
    recordLabelLayout(performance.now() - now); // for ?bench (plan step 12)
  });
  return null;
}

function sameLayout(a: readonly PlacedLabel[], b: readonly PlacedLabel[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i]!;
    return x.id === y.id && Math.abs(x.x - y.x) < 0.5 && Math.abs(x.y - y.y) < 0.5 && Math.abs(x.ax - y.ax) < 0.5 && Math.abs(x.ay - y.ay) < 0.5;
  });
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function computeLayout(skeleton: BatchedSkeleton, spheres: Sphere[], camera: PerspectiveCamera, canvas: HTMLCanvasElement): PlacedLabel[] {
  const st = useViewer.getState();
  const view = withBonesLayer(isolationView(st.sel, st.tier, st.ghostMode, hasMesh, st.grp), st.layers.bones);
  const tier1 = new Set(st.sel && view.isolated ? relations.visibleAt(st.sel, 1) : []);
  const tier2 = new Set(st.sel && view.isolated ? relations.visibleAt(st.sel, 2) : []);
  const area = rectOf(canvas);
  const width = area.right - area.left;
  const height = area.bottom - area.top;
  const pxPerUnit = height / 2 / Math.tan((camera.fov * Math.PI) / 360);
  camera.getWorldPosition(_camPos);
  const candidates: LabelCandidate[] = [];
  skeleton.boneIds.forEach((id, i) => {
    if (!skeleton.mesh.getVisibleAt(i)) return;
    skeleton.mesh.getMatrixAt(i, _m);
    _sphere.copy(spheres[i]!).applyMatrix4(_m);
    _c.copy(_sphere.center).project(camera);
    if (_c.z < -1 || _c.z > 1) return;
    const dist = _camPos.distanceTo(_sphere.center);
    candidates.push({
      id,
      text: displayName(id),
      x: area.left + ((_c.x + 1) / 2) * width,
      y: area.top + ((1 - _c.y) / 2) * height,
      sizePx: dist > 0 ? (_sphere.radius / dist) * pxPerUnit : Infinity,
      priority: labelPriority(id, view.focus, tier1, tier2),
    });
  });
  const obstacles = [...document.querySelectorAll(OBSTACLES)].map(rectOf).filter((r) => r.right > r.left && r.bottom > r.top);
  return layoutLabels(candidates, area, {
    minSizePx: view.isolated ? LABEL.minSizeIsolatedPx : LABEL.minSizePx,
    measure: measureText,
    obstacles,
  });
}

/**
 * The label overlay (plan decision 7): a box per placed label and a leader line
 * to its object's centre. `aria-hidden` (the sidebar's tree is the accessible
 * twin of the view) and never in the way of the pointer.
 */
export function Labels() {
  const on = useViewer((s) => s.labelsOn);
  const layout = useViewer((s) => s.labelLayout);
  const focus = useViewer((s) => s.sel);
  if (!on || layout.length === 0) return null;
  return (
    <div className="labels" aria-hidden="true" data-testid="labels">
      <svg className="label-leaders" width="100%" height="100%">
        {layout.map((l) => {
          const end = leaderEnd(l);
          return (
            <g key={l.id}>
              <line x1={l.ax} y1={l.ay} x2={end.x} y2={end.y} />
              <circle cx={l.ax} cy={l.ay} r={2.5} />
            </g>
          );
        })}
      </svg>
      {layout.map((l) => (
        <div
          key={l.id}
          className={l.id === focus ? "label label-focus" : "label"}
          data-label={l.id}
          style={{ transform: `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px)`, width: l.w, height: l.h }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}
