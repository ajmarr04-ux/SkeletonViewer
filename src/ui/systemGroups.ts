// The Layers panel's system groups (M11 plan decision 5): pure helpers for the
// expanded state kept in `localStorage` (`SYSTEMS_KEY`), not in the URL.

/** Collapsed systems, from the stored JSON (`{ "musculoskeletal": false }`); anything unreadable: all expanded. */
export function parseCollapsed(raw: string | null): ReadonlySet<string> {
  if (raw === null) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return new Set();
    return new Set(Object.entries(v).filter(([, open]) => open === false).map(([id]) => id));
  } catch {
    return new Set();
  }
}

/** The stored value: null (remove the key) when every system is expanded, the default. */
export function formatCollapsed(collapsed: ReadonlySet<string>): string | null {
  if (collapsed.size === 0) return null;
  return JSON.stringify(Object.fromEntries([...collapsed].sort().map((id) => [id, false])));
}

/** Toggle one system's expanded state. */
export function toggleCollapsed(collapsed: ReadonlySet<string>, system: string): ReadonlySet<string> {
  const next = new Set(collapsed);
  if (!next.delete(system)) next.add(system);
  return next;
}
