// Pure helpers for the `?debug&regions` view (M13 step 1).

/**
 * Which regions the debug view draws, or null when it is off. Needs both `debug`
 * and `regions`. `regions`, `regions=` or `regions=all` draws every fine region;
 * otherwise the value is one fine or coarse key.
 */
export function parseDebugRegions(search: string): string | null {
  const q = new URLSearchParams(search);
  const debug = q.get("debug");
  if (debug === null || debug === "0" || debug === "false") return null;
  const raw = q.get("regions");
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  return v === "" || v === "1" || v === "all" ? "all" : v;
}

/** The fine regions drawn for a `parseDebugRegions` value: all, one fine key, or a coarse key's fine regions. */
export function debugRegionsShown<R extends { key: string; coarse: string }>(volumes: { regions: R[] }, which: string): R[] {
  if (which === "all") return volumes.regions;
  return volumes.regions.filter((r) => r.key === which || r.coarse === which);
}
