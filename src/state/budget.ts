// The budget governor's store slice (M13 plan decision 10): keeps
// `budget`, `budgetHeld` and `budgetPrompt` in step with the layers, the
// body region and the viewer's LOD plan. The decisions are the pure
// src/scene/budget.ts; this file only reads the store and writes it back.

import { regionTriangles } from "../regions/index";
import { cappedLods, deviceBudget, govern, heldLayers, promptKey, type LayerLoadTotals, type LodSource } from "../scene/budget";
import type { Lod } from "../scene/lod";
import { LAYER_IDS, type LayerId } from "../systems/registry";
import { useViewer, type BudgetState, type ViewerState } from "./store";

type Plan = { lods: readonly Lod[]; source: LodSource };

/** Each drawn layer's index totals for the view (the body region's members, or the whole layer). */
export function viewTotals(modes: ViewerState["layers"], reg: string | null, held: readonly LayerId[] = []): LayerLoadTotals[] {
  return LAYER_IDS.filter((l) => modes[l] !== "off" && !held.includes(l)).map((id) => ({
    id,
    low: regionTriangles(id, "low", reg),
    high: regionTriangles(id, "high", reg),
  }));
}

const viewKey = (s: ViewerState): string => promptKey(LAYER_IDS.map((l) => `${l}:${s.layers[l]}`), s.reg);

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** The LODs a layer loads: the viewer's plan with the governor's cap applied. */
export const layerLods = (lods: readonly Lod[], layer: LayerId, caps: readonly string[]): Lod[] => cappedLods(lods, caps.includes(layer));

function evaluate(plan: Plan, limit: { budget: number; source: "device" | "url" }, phone: boolean): void {
  const s = useViewer.getState();
  const planLod = plan.lods[plan.lods.length - 1] ?? "low";
  const r = govern({ layers: viewTotals(s.layers, s.reg, s.budgetHeld), planLod, source: plan.source, budget: limit.budget, caps: s.budget?.caps ?? [] });
  const prev = s.budget;
  const next: BudgetState = { limit: limit.budget, limitSource: limit.source, phone, planLod, source: plan.source, caps: r.caps as LayerId[], drawn: r.drawn, over: r.over };
  const patch: Partial<ViewerState> = {};
  if (
    !prev ||
    prev.limit !== next.limit ||
    prev.planLod !== next.planLod ||
    prev.source !== next.source ||
    prev.drawn !== next.drawn ||
    prev.over !== next.over ||
    !sameList(prev.caps, next.caps)
  ) {
    patch.budget = prev && sameList(prev.caps, next.caps) ? { ...next, caps: prev.caps } : next;
  }
  // Step 2: the prompt, at most once per view (layers and region), never while the phone's start holds layers or the picker is open.
  const key = viewKey(s);
  const prompt = r.over && s.budgetHeld.length === 0 && !s.regionPickerOpen && s.budgetDismissed !== key ? key : null;
  if (prompt !== s.budgetPrompt) patch.budgetPrompt = prompt;
  if (Object.keys(patch).length > 0) useViewer.setState(patch);
}

/** The governor's inputs that don't live in the store: the device class, the budget and the viewer's plan. */
let config: { phone: boolean; limit: { budget: number; source: "device" | "url" }; plan: Plan } | null = null;

/**
 * Start the governor (the Viewer, once, before the first render of the
 * layers). `phone` is the small-screen class; `search` gives
 * `?debug&budget=`. With no body region on a phone and the requested layers
 * over budget, the layers that don't fit are held back and the picker opens;
 * closing it any way (a region, "Whole body", Esc) lets them draw.
 */
export function initBudget(phone: boolean, search: string, plan: Plan): void {
  config = { phone, limit: deviceBudget(phone, search), plan };
  const st = useViewer.getState();
  if (phone && st.reg === null) {
    const held = heldLayers(viewTotals(st.layers, null), plan.lods[plan.lods.length - 1] ?? "low", config.limit.budget) as LayerId[];
    if (held.length > 0) useViewer.setState({ budgetHeld: held, regionPickerOpen: true });
  }
  evaluate(plan, config.limit, phone);
}

/** A new LOD plan (Settings): call before the viewer draws with it. */
export function setBudgetPlan(plan: Plan): void {
  if (!config) return;
  config.plan = plan;
  evaluate(plan, config.limit, config.phone);
}

/** Keep the governor in step with the store. Returns an unsubscribe function. */
export function watchBudget(): () => void {
  let busy = false;
  return useViewer.subscribe((s, p) => {
    if (busy || !config) return;
    busy = true;
    try {
      // The picker closed: a region or the whole body was chosen; the held layers draw now.
      if (s.budgetHeld.length > 0 && p.regionPickerOpen && !s.regionPickerOpen) useViewer.setState({ budgetHeld: [] });
      // The prompt was answered by opening the picker: it counts as dismissed for this view.
      const now = useViewer.getState();
      if (now.regionPickerOpen && !p.regionPickerOpen && now.budgetPrompt !== null) useViewer.setState({ budgetDismissed: now.budgetPrompt });
      const after = useViewer.getState();
      if (
        after.layers !== p.layers ||
        after.reg !== p.reg ||
        after.budgetHeld !== p.budgetHeld ||
        after.regionPickerOpen !== p.regionPickerOpen ||
        after.budgetDismissed !== p.budgetDismissed
      ) {
        evaluate(config.plan, config.limit, config.phone);
      }
    } finally {
      busy = false;
    }
  });
}

/** The prompt's buttons. */
export function dismissBudgetPrompt(): void {
  const s = useViewer.getState();
  if (s.budgetPrompt !== null) useViewer.setState({ budgetDismissed: s.budgetPrompt, budgetPrompt: null });
}
