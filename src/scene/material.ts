import { Color, MeshStandardMaterial } from "three";
import { EAGER_LAYER, layerColour } from "../systems/registry";
import { PATTERN_FRAGMENT, PATTERN_FRAGMENT_PARS, PATTERN_MIN_PX_UNIFORM, PATTERN_VERTEX, PATTERN_VERTEX_PARS } from "./patterns";

/**
 * Baked AO (COLOR_0, 1 = unoccluded) is remapped to [AO_FLOOR, 1] before it
 * darkens the bone. Inner surfaces that are never seen from outside bake to 0
 * (the mandible's sockets, the inner ear, molar pulp chambers), and would
 * otherwise render pure black when a bone is isolated (assets/build/REPORT.md).
 */
export const AO_FLOOR = 0.4;

/** The scene's background (sRGB): ghosts are seen over it (tests/colourVision.test.ts). */
export const SCENE_BACKGROUND = "#1d2126";

/** Ivory bone colour (sRGB): the eager layer's descriptor colour. */
export const BONE_COLOUR = layerColour(EAGER_LAYER);

/**
 * Accent colour for the selected bone (sRGB). A pale blue (the user found the
 * mid blue `#3d8bfd` too aggressive on the white bone). Pale blue on ivory is
 * weaker for deuteranopes and protanopes, so the selection outline keeps the
 * stronger `SELECTION_OUTLINE_COLOUR`: selection shows by outline and colour
 * (spec §10).
 */
export const ACCENT_COLOUR = "#a7caf2";

/**
 * Per-channel gain on the accent tint (linear), measured on screenshots: the
 * key light, environment and tone mapping make a bone tinted exactly to the
 * accent read greyer (about #adc2d4 for #a7caf2), so the tint is
 * lifted until the lit shaft of a selected femur reads close to the accent.
 * Only the tint changes, never the lighting (plan step 6b).
 */
export const ACCENT_GAIN: readonly [number, number, number] = [0.62, 1.2, 2.9];

/**
 * The instance colour for the selected bone: `tintFor(ACCENT_COLOUR)` with
 * `ACCENT_GAIN`. M7: `base` is the layer's material colour for a soft-tissue
 * structure (the same accent on a muscle; M10 revisits the colours).
 */
export function accentTint(base: string = BONE_COLOUR): Color {
  const t = tintFor(ACCENT_COLOUR, base);
  return new Color(t.r * ACCENT_GAIN[0], t.g * ACCENT_GAIN[1], t.b * ACCENT_GAIN[2]);
}

/** The selection outline's colour (sRGB): the stronger blue, for contrast. */
export const SELECTION_OUTLINE_COLOUR = "#3d8bfd";

/**
 * GLSL for the AO remap and the per-instance tint, kept separate so the
 * replacement can be checked in tests. three.js folds the BatchedMesh instance
 * colour into `vColor` along with the vertex colour, which would put the tint
 * through the AO remap; `TINT_VERTEX` keeps them apart (`vTint`). The tint's
 * alpha carries the role pattern (M14 BX, `patterns.ts`).
 */
export const AO_COLOR_FRAGMENT = /* glsl */ `
#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
  diffuseColor.rgb *= mix( vec3( ${AO_FLOOR.toFixed(3)} ), vec3( 1.0 ), vColor.rgb );
#endif
  diffuseColor.rgb *= vTint.rgb;
${PATTERN_FRAGMENT}`;

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

/**
 * The one material every opaque bone shares (instance colours tint it: the
 * accent on the selection). The soft-tissue layers (M7) use the same material
 * in their own colour, so they share its shader program and AO remap.
 */
export function createBoneMaterial(colour: string = BONE_COLOUR, name = "bone"): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(colour),
    roughness: 0.6,
    metalness: 0,
    vertexColors: true,
  });
  m.name = name;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = replaceChunk(shader.fragmentShader, "color_fragment", AO_COLOR_FRAGMENT, "fragment");
    shader.fragmentShader = replaceChunk(shader.fragmentShader, "common", `#include <common>${VARYING}${PATTERN_FRAGMENT_PARS}`, "fragment");
    shader.uniforms.uPatternMinPx = PATTERN_MIN_PX_UNIFORM;
    shader.vertexShader = replaceChunk(shader.vertexShader, "color_vertex", TINT_VERTEX, "vertex");
    shader.vertexShader = replaceChunk(shader.vertexShader, "project_vertex", `${PATTERN_VERTEX}#include <project_vertex>`, "vertex");
    shader.vertexShader = replaceChunk(shader.vertexShader, "common", `#include <common>${VARYING}${PATTERN_VERTEX_PARS}`, "vertex");
  };
  // Every material compiled with this hook shares one program.
  m.customProgramCacheKey = () => `bone-ao-tint-pattern-surface-${AO_FLOOR}`;
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
export function createGhostMaterial(opacity: number, colour: string = BONE_COLOUR, name = "ghost"): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(colour),
    roughness: 0.8,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    vertexColors: false,
  });
  m.name = name;
  return m;
}
