// Load (once) the soft-tissue table's lazy chunk, which registers it with
// `softRegistry.ts`. Kept apart from the registry so the build scripts, which
// import `names.ts`, never resolve the virtual module.
let loading: Promise<void> | null = null;
export function loadSoftIds(): Promise<void> {
  loading ??= import("../layers/softTable").then(() => undefined);
  return loading;
}
