// Pure helpers for the bare viewer: LOD choice and model statistics.
// Kept free of three.js and React so Vitest can cover them directly.

export type Lod = "low" | "high";

/** The LODs to load, in order. `?lod=low|high` pins one; otherwise low then high. */
export function lodPlan(search: string): Lod[] {
  const lod = new URLSearchParams(search).get("lod");
  if (lod === "low" || lod === "high") return [lod];
  return ["low", "high"];
}

export type IdEntry = { id: string; meshAvailable: boolean };

export type ObjectSummary = {
  /** Named nodes in the model that are canonical IDs. */
  found: number;
  /** IDs flagged meshAvailable: false (the four third molars). */
  knownMissing: string[];
  /** IDs flagged meshAvailable: true that the model lacks. */
  unexpectedMissing: string[];
  /** Named mesh nodes that are not canonical IDs. */
  unknown: string[];
};

/** Compare the model's object names against content/ids.json. */
export function summariseObjects(nodeNames: Iterable<string>, ids: IdEntry[]): ObjectSummary {
  const names = new Set(nodeNames);
  const known = new Set(ids.map((e) => e.id));
  return {
    found: ids.filter((e) => names.has(e.id)).length,
    knownMissing: ids.filter((e) => !e.meshAvailable).map((e) => e.id),
    unexpectedMissing: ids.filter((e) => e.meshAvailable && !names.has(e.id)).map((e) => e.id),
    unknown: [...names].filter((n) => !known.has(n)).sort(),
  };
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "…";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
