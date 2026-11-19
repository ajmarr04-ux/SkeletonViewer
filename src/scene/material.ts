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

/** GLSL for the remap, kept separate so the replacement can be checked in tests. */
export const AO_COLOR_FRAGMENT = /* glsl */ `
#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
  diffuseColor.rgb *= mix( vec3( ${AO_FLOOR.toFixed(3)} ), vec3( 1.0 ), vColor.rgb );
#endif
`;

/** The one material every bone shares. */
export function createBoneMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(BONE_COLOUR),
    roughness: 0.6,
    metalness: 0,
    vertexColors: true,
  });
  m.name = "bone";
  m.onBeforeCompile = (shader) => {
    if (!shader.fragmentShader.includes("#include <color_fragment>")) {
      throw new Error("three.js shader chunk <color_fragment> not found: AO remap cannot be applied");
    }
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", AO_COLOR_FRAGMENT);
  };
  // Every material compiled with this hook shares one program.
  m.customProgramCacheKey = () => `bone-ao-${AO_FLOOR}`;
  return m;
}
