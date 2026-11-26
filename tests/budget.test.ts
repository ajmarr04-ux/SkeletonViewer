// M13 BP: the budget governor (plan decision 10, SPEC-platform.md §6.5):
// the pure decisions (src/scene/budget.ts), the store slice
// (src/state/budget.ts) and the parity test on today's real totals.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BUDGET_PROMPT,
  cappedLods,
  DESKTOP_BUDGET,
  deviceBudget,
  drawnModes,
  govern,
  heldLayers,
  PHONE_BUDGET,
  promptKey,
  type LayerLoadTotals,
} from "../src/scene/budget";
import { regionTriangles } from "../src/regions/index";
import { LAYER_IDS, DEFAULT_MODES } from "../src/systems/registry";
import { initBudget, setBudgetPlan, viewTotals, watchBudget, dismissBudgetPrompt } from "../src/state/budget";
import { useViewer } from "../src/state/store";
import { composeAnnouncement, type AnnounceState } from "../src/content/announce";
import { viewOf } from "../src/scene/isolation";
import { hasMesh } from "../src/content/index";

const L = (id: string, high: number, low: number): LayerLoadTotals => ({ id, high, low });
// Today's real whole-body totals (plan "What exists already").
const BONES = L("bones", 499_981, 149_913);
const MUSCLES = L("muscles", 799_750, 229_800);
const LIGAMENTS = L("ligaments", 119_938, 39_934);
const CARTILAGE = L("cartilage", 79_965, 29_976);
// Registry order (inside out).
const ALL = [BONES, CARTILAGE, LIGAMENTS, MUSCLES];
const auto = { planLod: "high" as const, source: "auto" as const };

describe("govern (step 1 and step 2)", () => {
  it("caps nothing when the view fits", () => {
    expect(govern({ ...auto, layers: ALL, budget: DESKTOP_BUDGET, caps: [] })).toEqual({ caps: [], drawn: 1_499_634, over: false });
  });
  it("caps the heaviest layer first, one at a time, until the total fits", () => {
    expect(govern({ ...auto, layers: ALL, budget: 1_000_000, caps: [] })).toEqual({ caps: ["muscles"], drawn: 929_684, over: false });
    expect(govern({ ...auto, layers: ALL, budget: 900_000, caps: [] })).toEqual({ caps: ["bones", "muscles"], drawn: 579_616, over: false });
  });
  it("is still over when every layer is low (step 2)", () => {
    expect(govern({ ...auto, layers: ALL, budget: 300_000, caps: [] })).toEqual({ caps: ["bones", "cartilage", "ligaments", "muscles"], drawn: 449_623, over: true });
  });
  it("lifts a cap only under 90 % of the budget (hysteresis)", () => {
    // Muscles off: 699,884 at high. Under 1M but over 90 % of 0.75M = 675k: with a 750k budget the cap on bones stays.
    const three = [BONES, CARTILAGE, LIGAMENTS];
    expect(govern({ ...auto, layers: three, budget: 750_000, caps: ["bones"] }).caps).toEqual(["bones"]);
    // From no caps, the same view fits (699,884 ≤ 750k): nothing is capped.
    expect(govern({ ...auto, layers: three, budget: 750_000, caps: [] }).caps).toEqual([]);
    // Under 90 %: lifted.
    expect(govern({ ...auto, layers: three, budget: 800_000, caps: ["bones"] }).caps).toEqual([]);
  });
  it("lifts the lightest cap first", () => {
    // 1M budget, both capped: lifting ligaments (+80k) fits under 900k, lifting muscles doesn't.
    const r = govern({ ...auto, layers: [LIGAMENTS, MUSCLES], budget: 1_000_000, caps: ["ligaments", "muscles"] });
    expect(r.caps).toEqual(["muscles"]);
    expect(r.drawn).toBe(229_800 + 119_938);
  });
  it("keeps the caps of layers not drawn (no reload while a layer is off)", () => {
    expect(govern({ ...auto, layers: [BONES], budget: 1_000_000, caps: ["muscles"] }).caps).toEqual(["muscles"]);
  });
  it("never overrides an explicit choice, and has nothing to cap at low", () => {
    for (const source of ["url", "setting"] as const) {
      expect(govern({ layers: ALL, planLod: "high", source, budget: 1_000_000, caps: ["muscles"] })).toEqual({ caps: [], drawn: 1_499_634, over: true });
    }
    expect(govern({ layers: ALL, planLod: "low", source: "auto", budget: 400_000, caps: [] })).toEqual({ caps: [], drawn: 449_623, over: true });
  });
});

describe("helpers", () => {
  it("cappedLods", () => {
    expect(cappedLods(["low", "high"], false)).toEqual(["low", "high"]);
    expect(cappedLods(["low", "high"], true)).toEqual(["low"]);
    expect(cappedLods(["high"], true)).toEqual(["low"]);
  });
  it("deviceBudget: the device class, `?budget=` only with `?debug`", () => {
    expect(deviceBudget(false, "")).toEqual({ budget: DESKTOP_BUDGET, source: "device" });
    expect(deviceBudget(true, "")).toEqual({ budget: PHONE_BUDGET, source: "device" });
    expect(deviceBudget(false, "?budget=900000")).toEqual({ budget: DESKTOP_BUDGET, source: "device" });
    expect(deviceBudget(true, "?debug&budget=900000")).toEqual({ budget: 900_000, source: "url" });
    expect(deviceBudget(false, "?debug&budget=-5")).toEqual({ budget: DESKTOP_BUDGET, source: "device" });
    expect(deviceBudget(false, "?debug&budget=abc")).toEqual({ budget: DESKTOP_BUDGET, source: "device" });
  });
  it("heldLayers: the first layer over the budget and every one after it", () => {
    expect(heldLayers(ALL, "low", PHONE_BUDGET)).toEqual([]);
    expect(heldLayers(ALL, "low", 300_000)).toEqual(["muscles"]);
    expect(heldLayers(ALL, "low", 200_000)).toEqual(["ligaments", "muscles"]);
    expect(heldLayers(ALL, "low", 100_000)).toEqual(["bones", "cartilage", "ligaments", "muscles"]);
  });
  it("drawnModes and promptKey", () => {
    const modes = { bones: "on", muscles: "ghost" };
    expect(drawnModes(modes, [])).toBe(modes);
    expect(drawnModes(modes, ["muscles"])).toEqual({ bones: "on", muscles: "off" });
    expect(promptKey(["b:on", "m:off"], null)).not.toBe(promptKey(["b:on", "m:off"], "forearm_left"));
  });
});

describe("parity: today's content never triggers the governor", () => {
  const real = LAYER_IDS.map((id) => ({ id, high: regionTriangles(id, "high", null), low: regionTriangles(id, "low", null) }));
  it("the index's whole-layer totals are the manifests'", () => {
    expect(real).toEqual(ALL);
  });
  it("all four layers fit both budgets", () => {
    expect(real.reduce((a, l) => a + l.high, 0)).toBeLessThanOrEqual(DESKTOP_BUDGET);
    expect(real.reduce((a, l) => a + l.low, 0)).toBeLessThanOrEqual(PHONE_BUDGET);
    expect(govern({ ...auto, layers: real, budget: DESKTOP_BUDGET, caps: [] })).toMatchObject({ caps: [], over: false });
    expect(govern({ layers: real, planLod: "low", source: "auto", budget: PHONE_BUDGET, caps: [] })).toMatchObject({ caps: [], over: false });
    expect(heldLayers(real, "low", PHONE_BUDGET)).toEqual([]);
  });
  it("a region's totals are the members' (smaller than the whole layer)", () => {
    const t = viewTotals({ ...DEFAULT_MODES, muscles: "on" }, "forearm_left");
    expect(t.map((x) => x.id)).toEqual(["bones", "muscles"]);
    for (const x of t) expect(x.high).toBeLessThan(regionTriangles(x.id, "high", null));
  });
});

describe("the store slice", () => {
  const allOn = Object.fromEntries(LAYER_IDS.map((l) => [l, "on"])) as typeof DEFAULT_MODES;
  const initial = useViewer.getState();
  let stop: () => void = () => {};
  beforeEach(() => {
    useViewer.setState({ ...initial, layers: allOn, reg: null, budget: null, budgetHeld: [], budgetPrompt: null, budgetDismissed: null, regionPickerOpen: false });
  });
  afterEach(() => {
    stop();
    useViewer.setState(initial, true);
  });
  const plan = { lods: ["low", "high"] as const, source: "auto" as const };

  it("desktop on Auto: a budget of 1M caps the muscles; a region lifts the cap", () => {
    initBudget(false, "?debug&budget=1000000", { ...plan, lods: [...plan.lods] });
    stop = watchBudget();
    expect(useViewer.getState().budget).toMatchObject({ limit: 1_000_000, limitSource: "url", caps: ["muscles"], over: false });
    useViewer.setState({ reg: "forearm_left" });
    expect(useViewer.getState().budget?.caps).toEqual([]);
    // A Settings choice is never overridden.
    useViewer.setState({ reg: null });
    expect(useViewer.getState().budget?.caps).toEqual(["muscles"]);
    setBudgetPlan({ lods: ["low", "high"], source: "setting" });
    expect(useViewer.getState().budget?.caps).toEqual([]);
  });

  it("still over: the prompt, once per view; dismissed until the layers or region change; the picker answers it", () => {
    initBudget(false, "?debug&budget=300000", { ...plan, lods: [...plan.lods] });
    stop = watchBudget();
    const key = useViewer.getState().budgetPrompt;
    expect(key).not.toBeNull();
    expect(useViewer.getState().budget?.over).toBe(true);
    dismissBudgetPrompt();
    expect(useViewer.getState().budgetPrompt).toBeNull();
    useViewer.setState({ sel: "femur_left" });
    expect(useViewer.getState().budgetPrompt).toBeNull();
    // A new view (cartilage off) that is still over: shown again.
    useViewer.setState({ layers: { ...allOn, cartilage: "off" } });
    expect(useViewer.getState().budgetPrompt).not.toBeNull();
    // The prompt's button opens the picker: dismissed for this view, hidden while the picker is open.
    useViewer.setState({ regionPickerOpen: true });
    expect(useViewer.getState().budgetPrompt).toBeNull();
    useViewer.setState({ regionPickerOpen: false });
    expect(useViewer.getState().budgetPrompt).toBeNull();
    // A region that fits: no prompt.
    useViewer.setState({ reg: "forearm_left" });
    expect(useViewer.getState().budget?.over).toBe(false);
    expect(useViewer.getState().budgetPrompt).toBeNull();
  });

  it("phone start: an explicit LOD (Settings or ?lod=) holds nothing and opens no picker, even over budget", () => {
    useViewer.setState({ layers: { ...DEFAULT_MODES } });
    for (const source of ["setting", "url"] as const) {
      initBudget(true, "", { lods: ["low", "high"], source });
      const s = useViewer.getState();
      expect(s.budget?.over).toBe(true); // the bones alone at high pass the phone budget
      expect(s.budgetHeld).toEqual([]);
      expect(s.regionPickerOpen).toBe(false);
    }
  });

  it("phone start: over budget with no region holds the layers that don't fit and opens the picker", () => {
    initBudget(true, "?debug&budget=300000", { lods: ["low"], source: "auto" });
    stop = watchBudget();
    let s = useViewer.getState();
    expect(s.budgetHeld).toEqual(["muscles"]);
    expect(s.regionPickerOpen).toBe(true);
    expect(s.budgetPrompt).toBeNull();
    // Held layers are drawn as Off.
    const v = viewOf(s, hasMesh);
    expect(v.layers.muscles).toEqual({ solid: new Set(), rest: "hidden" });
    expect(v.layers.bones).not.toEqual({ solid: new Set(), rest: "hidden" });
    // "Whole body": the picker closes, the layers draw, and the prompt follows (never a silent drop).
    useViewer.setState({ regionPickerOpen: false });
    s = useViewer.getState();
    expect(s.budgetHeld).toEqual([]);
    expect(s.budgetPrompt).not.toBeNull();
  });

  it("phone start with a region in the link, or a view that fits: nothing held", () => {
    useViewer.setState({ reg: "forearm_left" });
    initBudget(true, "?debug&budget=300000", { lods: ["low"], source: "auto" });
    expect(useViewer.getState().budgetHeld).toEqual([]);
    useViewer.setState({ reg: null, regionPickerOpen: false });
    initBudget(true, "", { lods: ["low"], source: "auto" });
    expect(useViewer.getState().budgetHeld).toEqual([]);
    expect(useViewer.getState().regionPickerOpen).toBe(false);
  });
});

describe("announcement", () => {
  const base: AnnounceState = { sel: null, tier: 0, grp: null, reg: null, antagonists: false, layers: DEFAULT_MODES, depth: 0, load: {}, prompt: null };
  const deps = { isolation: () => "iso", antagonists: () => 0, peeled: () => 0 };
  it("the prompt is said once, last, when it appears", () => {
    expect(composeAnnouncement(base, { ...base, prompt: "k" }, null, deps, new Set())).toBe(BUDGET_PROMPT);
    expect(composeAnnouncement({ ...base, prompt: "k" }, { ...base, prompt: "k" }, null, deps, new Set())).toBeNull();
    expect(composeAnnouncement(base, { ...base, reg: "forearm_left", prompt: "k" }, null, deps, new Set())).toBe(`iso ${BUDGET_PROMPT}`);
  });
});
