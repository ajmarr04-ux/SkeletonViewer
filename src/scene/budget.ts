// The budget governor (M13 plan decision 10, SPEC-platform.md §6.5). Pure:
// no store, no three.js, no registry. The wiring is src/state/budget.ts.
//
// It counts the triangles of the layers drawn (On or Ghost) at each layer's
// LOD, from the index's per-region totals (the members of the body region in
// focus, or the whole layer). Overlays (the attachment patches) are not
// counted: the budgets were set for the layer files.

import type { Lod } from "./lod";

/** The spec's device budgets (§6.5, unchanged from M1). */
export const DESKTOP_BUDGET = 1_500_000;
export const PHONE_BUDGET = 450_000;
/** A cap is lifted only when the layer at high would fit under this share of the budget. */
export const LIFT_SHARE = 0.9;

export type LodSource = "url" | "setting" | "auto";

/** One drawn layer's triangles at each LOD (index totals for the view). */
export type LayerLoadTotals = { id: string; low: number; high: number };

export type GovernorInput = {
  /** The layers drawn (On or Ghost), in registry order. */
  layers: readonly LayerLoadTotals[];
  /** The final LOD of the viewer's plan. */
  planLod: Lod;
  /** Where the plan came from: only "auto" may be capped (an explicit choice is never overridden). */
  source: LodSource;
  budget: number;
  /** The layers capped to low now (any layer, drawn or not). */
  caps: readonly string[];
};

export type GovernorResult = {
  /** The layers capped to low (registry order of `layers`, then any undrawn caps kept). */
  caps: string[];
  /** The drawn total with those caps. */
  drawn: number;
  /** Still over the budget after capping (step 2: the prompt). */
  over: boolean;
};

const lodOf = (l: LayerLoadTotals, planLod: Lod, capped: boolean): Lod => (capped ? "low" : planLod);

/** The drawn total with a set of caps. */
export function drawnTotal(layers: readonly LayerLoadTotals[], planLod: Lod, caps: ReadonlySet<string>): number {
  let t = 0;
  for (const l of layers) t += l[lodOf(l, planLod, caps.has(l.id))];
  return t;
}

/**
 * Step 1: over budget, on Auto with high planned, cap the heaviest drawn
 * layers (by their high total) to low, one at a time, until the total fits.
 * A cap is lifted only when the total with that layer at high fits under 90 %
 * of the budget (lightest first), so turning a layer on and off doesn't flap.
 * Caps of layers not drawn are kept as they are (they count nothing), so a
 * layer turned off and on again doesn't reload high in between.
 */
export function govern(inp: GovernorInput): GovernorResult {
  const { layers, planLod, source, budget } = inp;
  if (source !== "auto" || planLod === "low") {
    const drawn = drawnTotal(layers, planLod, new Set());
    return { caps: [], drawn, over: drawn > budget };
  }
  const drawnIds = new Set(layers.map((l) => l.id));
  const caps = new Set(inp.caps);
  // Lift: lightest capped drawn layer first.
  const lift = layers.filter((l) => caps.has(l.id)).sort((a, b) => a.high - b.high);
  for (const l of lift) {
    caps.delete(l.id);
    if (drawnTotal(layers, planLod, caps) > LIFT_SHARE * budget) caps.add(l.id);
  }
  // Cap: heaviest uncapped drawn layer first (ties: registry order).
  let total = drawnTotal(layers, planLod, caps);
  while (total > budget) {
    let pick: LayerLoadTotals | null = null;
    for (const l of layers) if (!caps.has(l.id) && l.high > l.low && (!pick || l.high > pick.high)) pick = l;
    if (!pick) break;
    caps.add(pick.id);
    total = drawnTotal(layers, planLod, caps);
  }
  const ordered = [...layers.filter((l) => caps.has(l.id)).map((l) => l.id), ...inp.caps.filter((c) => !drawnIds.has(c) && caps.has(c))];
  return { caps: ordered, drawn: total, over: total > budget };
}

/** A layer's LOD plan with its cap applied: low only (`lodsToLoad` swaps a high batch down). */
export function cappedLods(lods: readonly Lod[], capped: boolean): Lod[] {
  if (!capped) return [...lods];
  const low = lods.filter((l) => l === "low");
  return low.length ? low : ["low"];
}

/** The device budget: the phone's for the small-screen class, else the desktop's; `?budget=` (with `?debug` only) overrides it. */
export function deviceBudget(phone: boolean, search: string): { budget: number; source: "device" | "url" } {
  const p = new URLSearchParams(search);
  const raw = p.has("debug") ? p.get("budget") : null;
  const n = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (Number.isSafeInteger(n) && n > 0) return { budget: n, source: "url" };
  return { budget: phone ? PHONE_BUDGET : DESKTOP_BUDGET, source: "device" };
}

/**
 * The phone's start (decision 10): with no body region, the layers held back
 * (not drawn) until a region or "Whole body" is chosen. Layers are added in
 * registry order at the planned LOD; the first that takes the total over the
 * budget and every layer after it are held. Empty when all fit.
 */
export function heldLayers(layers: readonly LayerLoadTotals[], planLod: Lod, budget: number): string[] {
  let t = 0;
  const held: string[] = [];
  for (const l of layers) {
    t += l[planLod];
    if (held.length > 0 || t > budget) held.push(l.id);
  }
  return held;
}

/** The layers as drawn: a held layer (the phone's start) is drawn as Off. The same object when nothing is held. */
export function drawnModes<M extends Record<string, string>>(modes: M, held: readonly string[] | undefined): M {
  if (!held || held.length === 0) return modes;
  const out = { ...modes };
  for (const l of held) if (l in out) (out as Record<string, string>)[l] = "off";
  return out;
}

/** The prompt's key: shown at most once per change of layers or region. */
export const promptKey = (layers: readonly string[], reg: string | null): string => `${layers.join(",")}|${reg ?? ""}`;

export const BUDGET_PROMPT = "This view is heavy for this device. Focus on a body region?";
