/** Return keyboard focus to the 3D view (after Back in the panel, spec §10). */
export function focusCanvas(): void {
  document.querySelector<HTMLCanvasElement>(".viewport canvas")?.focus({ preventScroll: true });
}
