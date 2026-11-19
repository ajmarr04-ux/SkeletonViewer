import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { registerFrameGrabber } from "../ui/capture";

/**
 * Lets the Screenshot action render one frame on demand and copy it at once
 * (plan decision 9): `preserveDrawingBuffer` stays off, so the copy has to
 * happen in the same task as the render.
 */
export function ScreenshotService() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    registerFrameGrabber(() => {
      gl.render(scene, camera);
      return gl.domElement;
    });
    return () => registerFrameGrabber(null);
  }, [gl, scene, camera]);
  return null;
}
