/** Shown instead of the 3D view when the browser has no WebGL 2. */
export function WebGLFallback() {
  return (
    <main className="fallback" role="alert">
      <img src={`${import.meta.env.BASE_URL}fallback.png`} alt="Front view of the skeleton model" />
      <h1>3D view unavailable</h1>
      <p>
        This atlas needs WebGL 2, which this browser or device doesn't provide (or has turned off). Try a
        current version of Chrome, Edge, Firefox or Safari, and check that hardware acceleration is on.
      </p>
    </main>
  );
}
