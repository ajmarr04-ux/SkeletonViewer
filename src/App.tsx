import { Viewer } from "./scene/Viewer";
import { hasWebGL2 } from "./scene/webgl";
import { Footer } from "./ui/Footer";
import { WebGLFallback } from "./ui/WebGLFallback";

export function App() {
  const webgl2 = !new URLSearchParams(window.location.search).has("nowebgl") && hasWebGL2();
  return (
    <>
      {webgl2 ? <Viewer /> : <WebGLFallback />}
      <Footer />
    </>
  );
}
