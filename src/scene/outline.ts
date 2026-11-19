// Outlines for the selected and hovered bones (spec §6, §10): an inverted
// hull drawn in a constant screen width.
//
// Why not postprocessing's OutlineEffect (spec §2 allows "or the equivalent"):
// it adds a depth pass over the whole skeleton plus mask, edge and blur passes
// at full resolution, and swaps the renderer's own MSAA for the composer's.
// The hull is one extra draw call per outline over that bone's triangles only,
// so it costs next to nothing on a phone (plan step 4's fallback, chosen up
// front; see docs/PLAN-milestone-3.md, session H notes).
//
// The outline mesh shares the BatchedMesh's own vertex and index buffers: its
// geometry points at the same BufferAttributes, with a draw range over one
// bone's indices, and its matrix is that bone's instance matrix. Nothing is
// copied and nothing moves (spec §12).

import { BackSide, BufferGeometry, Color, Matrix4, Mesh, ShaderMaterial, Vector2 } from "three";
import type { BatchedSkeleton } from "./batchSkeleton";
import { SELECTION_OUTLINE_COLOUR } from "./material";

/** Outline widths in CSS pixels and colours (sRGB). */
export const OUTLINE = {
  selected: { widthPx: 3, colour: SELECTION_OUTLINE_COLOUR },
  hover: { widthPx: 1.5, colour: "#f1f3f4" },
} as const;

const VERTEX = /* glsl */ `
uniform vec2 uPixel;   // clip-space units per device pixel, x and y
uniform float uWidth;  // device pixels
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vec4 clip = projectionMatrix * mv;
  // Screen direction of the normal: project a point a little way along it.
  vec3 n = normalize( normalMatrix * normal );
  vec4 clip2 = projectionMatrix * ( mv + vec4( n * 0.001 * max( -mv.z, 1e-3 ), 0.0 ) );
  vec2 dir = clip2.xy / clip2.w - clip.xy / clip.w;
  float len = length( dir );
  if ( len > 1e-9 ) clip.xy += ( dir / len ) * uWidth * uPixel * clip.w;
  gl_Position = clip;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4( uColor, 1.0 );
  #include <colorspace_fragment>
}
`;

export function createOutlineMaterial(colour: string, widthPx: number): ShaderMaterial {
  const m = new ShaderMaterial({
    name: "outline",
    uniforms: {
      uColor: { value: new Color(colour) },
      uWidth: { value: widthPx },
      uPixel: { value: new Vector2(0.001, 0.001) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: BackSide,
    depthTest: true,
    depthWrite: true,
  });
  return m;
}

export type Outline = {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  /** The bone outlined now, or null (the mesh is then hidden). */
  target: string | null;
  widthPx: number;
};

/**
 * An outline mesh over `skeleton`'s buffers. Its geometry must be disposed
 * together with the skeleton (disposing it frees the shared GPU buffers).
 */
export function createOutline(skeleton: BatchedSkeleton, colour: string, widthPx: number, name: string): Outline {
  const src = skeleton.mesh.geometry;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", src.getAttribute("position"));
  geometry.setAttribute("normal", src.getAttribute("normal"));
  geometry.setIndex(src.index);
  geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, createOutlineMaterial(colour, widthPx));
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  mesh.raycast = () => {}; // never picked
  return { mesh, target: null, widthPx };
}

const _m = new Matrix4();

/** Point the outline at a bone (or hide it with null). */
export function setOutlineTarget(o: Outline, skeleton: BatchedSkeleton, id: string | null): void {
  o.target = id;
  const instanceId = id === null ? undefined : skeleton.instanceOf.get(id);
  if (instanceId === undefined) {
    o.mesh.visible = false;
    o.mesh.geometry.setDrawRange(0, 0);
    return;
  }
  const range = skeleton.mesh.getGeometryRangeAt(skeleton.mesh.getGeometryIdAt(instanceId));
  o.mesh.geometry.setDrawRange(range.start, range.count);
  skeleton.mesh.getMatrixAt(instanceId, _m);
  o.mesh.matrix.copy(skeleton.mesh.matrixWorld).multiply(_m);
  o.mesh.matrixWorld.copy(o.mesh.matrix);
  o.mesh.visible = true;
}

/** Keep the width constant in CSS pixels: call when the canvas size or pixel ratio changes. */
export function setOutlineViewport(o: Outline, widthPx: number, heightPx: number, dpr: number): void {
  const u = o.mesh.material.uniforms;
  (u.uPixel!.value as Vector2).set(2 / Math.max(1, widthPx * dpr), 2 / Math.max(1, heightPx * dpr));
  u.uWidth!.value = o.widthPx * dpr;
}

export function disposeOutline(o: Outline): void {
  o.mesh.removeFromParent();
  o.mesh.geometry.dispose();
  o.mesh.material.dispose();
}
