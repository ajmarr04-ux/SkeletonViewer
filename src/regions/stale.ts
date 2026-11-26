// The "stale file" check for generated region files (M13 step 1): the committed
// file must equal what the generator writes now. Returns null when up to date,
// else a one-line reason.

export function volumesStale(committed: string, fresh: string): string | null {
  if (committed === fresh) return null;
  let a: { sourceHash?: string; regions?: { key: string }[] };
  let b: typeof a;
  try {
    a = JSON.parse(committed) as typeof a;
    b = JSON.parse(fresh) as typeof a;
  } catch {
    return "not valid JSON";
  }
  if (a.sourceHash !== b.sourceHash) return "regions.json changed since it was generated";
  const keysA = (a.regions ?? []).map((r) => r.key).join(",");
  const keysB = (b.regions ?? []).map((r) => r.key).join(",");
  if (keysA !== keysB) return "the region list differs";
  return "the resolved shapes differ (anchor geometry or the fitting code changed)";
}
