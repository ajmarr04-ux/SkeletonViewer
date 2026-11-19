import { Color, MeshStandardMaterial } from "three";

/**
 * Baked AO (COLOR_0, 1 = unoccluded) is remapped to [AO_FLOOR, 1] before it
 * darkens the bone. Inner surfaces that are never seen from outside bake to 0
 * (the mandible's sockets, the inner ear, molar pulp chambers), and would
 * otherwise render pure black when a bone is isolated (assets/build/REPORT.md).
 */
export const AO_FLOOR = 0.4;

/** Ivory bone colour (sRGB). */
export const BONE_COLOUR = "#d8cdb8";

/**
 * Accent colour for the selected bone (sRGB). A mid blue: against ivory it
 * stays distinct for deuteranopes and protanopes (the blue–yellow axis is the
 * one they keep), and selection is also shown by an outline (spec §10).
 */
export const ACCENT_COLOUR = "#3d8bfd";

/**
 * GLSL for the AO remap and the per-instance tint, kept separate so the
 * replacement can be checked in tests. three.js folds the BatchedMesh instance
 * colour into `vColor` along with the vertex colour, which would put the tint
 * through the AO remap; `TINT_VERTEX` keeps them apart (`vTint`).
 */
export const AO_COLOR_FRAGMENT = /* glsl */ `
#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
  diffuseColor.rgb *= mix( vec3( ${AO_FLOOR.toFixed(3)} ), vec3( 1.0 ), vColor.rgb );
#endif
  diffuseColor.rgb *= vTint.rgb;
`;

export const TINT_VERTEX = /* glsl */ `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
  vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
  vColor *= color;
#elif defined( USE_COLOR )
  vColor.rgb *= color;
#endif
#ifdef USE_BATCHING_COLOR
  vTint = getBatchingColor( getIndirectIndex( gl_DrawID ) );
#else
  vTint = vec4( 1.0 );
#endif
`;

const VARYING = "\nvarying vec4 vTint;\n";

function replaceChunk(source: string, chunk: string, by: string, where: string): string {
  const include = `#include <${chunk}>`;
  if (!source.includes(include)) {
    throw new Error(`three.js shader chunk <${chunk}> not found in the ${where} shader: AO remap cannot be applied`);
  }
  return source.replace(include, by);
}

/** The one material every opaque bone shares (instance colours tint it: the accent on the selection). */
export function createBoneMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(BONE_COLOUR),
    roughness: 0.6,
    metalness: 0,
    vertexColors: true,
  });
  m.name = "bone";
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = replaceChunk(shader.fragmentShader, "color_fragment", AO_COLOR_FRAGMENT, "fragment");
    shader.fragmentShader = replaceChunk(shader.fragmentShader, "common", `#include <common>${VARYING}`, "fragment");
    shader.vertexShader = replaceChunk(shader.vertexShader, "color_vertex", TINT_VERTEX, "vertex");
    shader.vertexShader = replaceChunk(shader.vertexShader, "common", `#include <common>${VARYING}`, "vertex");
  };
  // Every material compiled with this hook shares one program.
  m.customProgramCacheKey = () => `bone-ao-tint-${AO_FLOOR}`;
  return m;
}

/**
 * The instance colour that turns the ivory material into `target` (both sRGB):
 * the material colour is multiplied by the instance colour, so divide it out,
 * channel by channel, in linear space. Channels may exceed 1 (the colours
 * texture is float).
 */
export function tintFor(target: string, base: string = BONE_COLOUR): Color {
  const t = new Color(target);
  const b = new Color(base);
  return new Color(t.r / Math.max(b.r, 1e-4), t.g / Math.max(b.g, 1e-4), t.b / Math.max(b.b, 1e-4));
}

/**
 * Ghosts (spec §6 Isolation): translucent, depth-sorted, no depth writes, and
 * no baked AO (vertex colours off), so they stay light and even.
 */
export function createGhostMaterial(opacity: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(BONE_COLOUR),
    roughness: 0.8,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    vertexColors: false,
  });
  m.name = "ghost";
  return m;
}
