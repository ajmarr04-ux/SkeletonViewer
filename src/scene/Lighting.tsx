import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Strength of the environment map (image-based light). */
export const ENVIRONMENT_INTENSITY = 0.25;
/** Strength of the single key light. */
export const KEY_LIGHT_INTENSITY = 2.2;

/**
 * Spec §8: one soft key light, an environment map and the baked AO. No
 * real-time shadows. The environment is three's procedural RoomEnvironment,
 * so no HDR file is downloaded.
 */
export function Lighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return (
    // Upper front-left of the viewer, as in a lit anatomy plate.
    <directionalLight position={[-2.5, 3, 2]} intensity={KEY_LIGHT_INTENSITY} />
  );
}
