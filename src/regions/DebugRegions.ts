// `?debug&regions` (M13 step 1): each fine body region's resolved shapes as
// translucent coloured wireframes with their names, drawn over everything.
// `?debug&regions=<key>` draws one region (a fine key, or a coarse key for its
// fine regions). A lazy chunk, never fetched without the parameter; nothing here
// is pickable.

import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  SRGBColorSpace,
  Vector3,
} from "three";
import volumesJson from "../../assets/build/region-volumes.json";
import type { RegionVolumes, ResolvedRegion, Shape } from "./volume";
import { debugRegionsShown } from "./debug";

export { parseDebugRegions } from "./debug";

const VOLUMES = volumesJson as unknown as RegionVolumes;

/** A distinct, stable hue per region (golden-angle steps). */
const colourOf = (i: number) => new Color().setHSL(((i * 137.508) % 360) / 360, 0.85, 0.5);

function shapeObject(s: Shape, colour: Color): Group {
  const g = new Group();
  const geo =
    s.type === "box"
      ? new BoxGeometry(2 * s.half[0], 2 * s.half[1], 2 * s.half[2])
      : new CapsuleGeometry(s.radius, new Vector3(...s.b).distanceTo(new Vector3(...s.a)), 6, 16);
  const fill = new Mesh(geo, new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.07, depthWrite: false, depthTest: false }));
  const edges = new LineSegments(
    new EdgesGeometry(geo, 20),
    new LineBasicMaterial({ color: colour, transparent: true, opacity: 0.9, depthTest: false }),
  );
  fill.renderOrder = 10;
  edges.renderOrder = 11;
  fill.raycast = () => {};
  edges.raycast = () => {};
  g.add(fill, edges);
  if (s.type === "box") {
    const [x, y, z] = s.axes.map((a) => new Vector3(...a));
    g.matrix.makeBasis(x!, y!, z!).setPosition(...s.center);
  } else {
    const a = new Vector3(...s.a);
    const b = new Vector3(...s.b);
    const dir = b.clone().sub(a);
    const q = dir.lengthSq() > 0 ? new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()) : new Quaternion();
    g.matrix.compose(a.add(b).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
  }
  g.matrixAutoUpdate = false;
  return g;
}

/** A name tag that keeps its screen size (no drei: it would pull shared code into the main chunk). */
function labelSprite(text: string, colour: Color, at: [number, number, number]): Sprite {
  const scale = 2;
  const font = `${12 * scale}px system-ui, sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 12 * scale;
  const h = 18 * scale;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = `#${colour.getHexString()}`;
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(scale, scale, w - 2 * scale, h - 2 * scale);
  ctx.fillStyle = "#111";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 6 * scale, h / 2 + scale / 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  // sizeAttenuation off: the scale is a fraction of the viewport height.
  const px = 1 / 900;
  sprite.scale.set((w / scale) * px, (h / scale) * px, 1);
  sprite.position.set(...at);
  sprite.renderOrder = 12;
  sprite.raycast = () => {};
  return sprite;
}

function dispose(g: Group): void {
  g.traverse((o) => {
    if (o instanceof Mesh || o instanceof LineSegments || o instanceof Sprite) {
      o.geometry.dispose();
      const m = o.material as MeshBasicMaterial | SpriteMaterial;
      if ("map" in m && m.map) m.map.dispose();
      m.dispose();
    }
  });
}

const centreOf = (r: ResolvedRegion): [number, number, number] => {
  const c = new Vector3();
  for (const s of r.shapes) c.add(s.type === "box" ? new Vector3(...s.center) : new Vector3(...s.a).add(new Vector3(...s.b)).multiplyScalar(0.5));
  return c.multiplyScalar(1 / r.shapes.length).toArray();
};

/**
 * The debug view for a `parseDebugRegions` value: a group to add to the scene (the
 * caller disposes it with `disposeDebugRegions`), and the drawn keys for the overlay.
 * Plain three.js, no React: a React import here moves shared code into the main chunk.
 */
export function debugRegionsView(which: string): { group: Group; keys: string[]; total: number } {
  const regions = debugRegionsShown(VOLUMES, which);
  const group = new Group();
  group.name = "debug-regions";
  VOLUMES.regions.forEach((r, i) => {
    if (!regions.includes(r)) return;
    for (const s of r.shapes) group.add(shapeObject(s, colourOf(i)));
    group.add(labelSprite(r.name, colourOf(i), centreOf(r)));
  });
  return { group, keys: regions.map((r) => r.key), total: VOLUMES.regions.length };
}

export const disposeDebugRegions = dispose;
