import { describe, expect, it } from "vitest";
import { focusLayerOf, labelKey, labelOrder, labelPriority, layoutLabels, leaderEnd, LABEL, MAX_LABEL_CANDIDATES, thinCandidates, type LabelCandidate, type PlacedLabel } from "../src/scene/labels";

const AREA = { left: 0, top: 0, right: 800, bottom: 600 };

/** A deterministic pseudo-random crowd of candidates. */
function crowd(n: number, seed = 1): LabelCandidate[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, (_, i) => ({
    id: `bone_${i}`,
    text: `Bone number ${i}`,
    x: rnd() * 800,
    y: rnd() * 600,
    sizePx: 10 + rnd() * 90,
    priority: i === 0 ? 0 : i < 6 ? 1 : i < 20 ? 2 : 3,
  }));
}

const overlap = (a: PlacedLabel, b: PlacedLabel) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("label layout", () => {
  it("never overlaps two labels, and keeps every label inside the area", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const placed = layoutLabels(crowd(230, seed), AREA, { minSizePx: 0 });
      expect(placed.length).toBeGreaterThan(10);
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i]!;
        if (p.id !== "bone_0") {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x + p.w).toBeLessThanOrEqual(800);
          expect(p.y + p.h).toBeLessThanOrEqual(600);
        }
        for (let j = i + 1; j < placed.length; j++) expect(overlap(p, placed[j]!), `${p.id} / ${placed[j]!.id}`).toBe(false);
      }
    }
  });

  it("always places the focus, even pressed into a corner, and places by priority", () => {
    const cands = crowd(230, 7);
    cands[0] = { ...cands[0]!, x: 798, y: 2 };
    const placed = layoutLabels(cands, AREA, { minSizePx: 0 });
    expect(placed[0]!.id).toBe("bone_0");
    const p = placed[0]!;
    expect(p.x + p.w).toBeLessThanOrEqual(800);
    expect(p.y).toBeGreaterThanOrEqual(0);
    const prio = new Map(cands.map((c) => [c.id, c.priority]));
    const order = placed.map((q) => prio.get(q.id)!);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("a lower-priority label gives way to a higher one in the same spot", () => {
    const a: LabelCandidate = { id: "small", text: "Small", x: 400, y: 300, sizePx: 200, priority: 3 };
    const b: LabelCandidate = { id: "focus", text: "Focus", x: 400, y: 300, sizePx: 5, priority: 0 };
    const placed = layoutLabels([a, b], AREA);
    expect(placed[0]!.id).toBe("focus");
    expect(placed).toHaveLength(2); // the other one finds another spot
    expect(overlap(placed[0]!, placed[1]!)).toBe(false);
  });

  it("drops small objects unless isolated, and anchors outside the area or on an obstacle", () => {
    const c = (id: string, x: number, sizePx: number, priority = 3): LabelCandidate => ({ id, text: id, x, y: 300, sizePx, priority });
    const placed = layoutLabels([c("big", 100, LABEL.minSizePx), c("tiny", 300, 3), c("tinyRelated", 500, 3, 1), c("off", 900, 100)], AREA);
    expect(placed.map((p) => p.id).sort()).toEqual(["big", "tinyRelated"]);
    const blocked = layoutLabels([c("big", 100, 100)], AREA, { obstacles: [{ left: 50, top: 250, right: 150, bottom: 350 }] });
    expect(blocked).toHaveLength(0);
    // A label never covers an obstacle.
    const ob = { left: 0, top: 0, right: 800, bottom: 280 };
    const below = layoutLabels([c("big", 400, 100)], AREA, { obstacles: [ob] });
    expect(below).toHaveLength(1);
    expect(below[0]!.y).toBeGreaterThanOrEqual(280);
  });

  it("ends the leader line on the box edge nearest the anchor", () => {
    const p: PlacedLabel = { id: "a", text: "a", ax: 100, ay: 100, x: 114, y: 64, w: 50, h: 22 };
    expect(leaderEnd(p)).toEqual({ x: 114, y: 86 });
  });

  it("ranks the focus, then tier 1, then tier 2", () => {
    const t1 = new Set(["a", "b"]);
    const t2 = new Set(["a", "b", "c"]);
    expect(labelPriority("a", "a", t1, t2)).toBe(0);
    expect(labelPriority("b", "a", t1, t2)).toBe(1);
    expect(labelPriority("c", "a", t1, t2)).toBe(2);
    expect(labelPriority("d", "a", t1, t2)).toBe(3);
  });
});

describe("labels for every kind (M10 plan decisions 1 and 2)", () => {
  /** M5's sort, as it was before the focus-layer tie-break. */
  const m5Order = (cs: readonly LabelCandidate[]) =>
    [...cs].sort((a, b) => a.priority - b.priority || b.sizePx - a.sizePx || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((c) => c.id);

  it("keeps M5's order with every layer off (no focus layer, or every candidate a bone)", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
      const cs = crowd(234, seed);
      expect(labelOrder(cs).map((c) => c.id)).toEqual(m5Order(cs));
      const bones = cs.map((c) => ({ ...c, layer: "bones" }));
      expect(labelOrder(bones, "bones").map((c) => c.id)).toEqual(m5Order(bones));
      // And the layout itself is the same as without the option.
      expect(layoutLabels(bones, AREA, { minSizePx: 0, focusLayer: "bones" })).toEqual(layoutLabels(cs, AREA, { minSizePx: 0 }));
    }
  });

  it("places the focus layer first among candidates of equal size (within 10 %)", () => {
    const c = (id: string, sizePx: number, layer: string, priority = 3): LabelCandidate => ({ id, text: id, x: 400, y: 300, sizePx, priority, layer });
    const cs = [c("bone_a", 100, "bones"), c("muscle_b", 95, "muscles"), c("bone_c", 80, "bones"), c("muscle_d", 79, "muscles"), c("lig_e", 79.5, "ligaments")];
    expect(labelOrder(cs, "muscles").map((x) => x.id)).toEqual(["muscle_b", "bone_a", "muscle_d", "bone_c", "lig_e"]);
    expect(labelOrder(cs, "bones").map((x) => x.id)).toEqual(["bone_a", "muscle_b", "bone_c", "lig_e", "muscle_d"]);
    // Not equal (≥ 10 % apart): size wins whatever the layer.
    expect(labelOrder([c("bone", 100, "bones"), c("muscle", 89, "muscles")], "muscles").map((x) => x.id)).toEqual(["bone", "muscle"]);
    // Priority always comes before the layer.
    expect(labelOrder([c("muscle", 100, "muscles", 3), c("bone", 100, "bones", 1)], "muscles").map((x) => x.id)).toEqual(["bone", "muscle"]);
    // In the same spot, the focus layer's label takes it.
    const placed = layoutLabels([c("bone_x", 50, "bones"), c("muscle_y", 48, "muscles")], AREA, { focusLayer: "muscles" });
    expect(placed[0]!.id).toBe("muscle_y");
  });

  it("labels a part as its muscle, except the selected part's muscle at the part level", () => {
    const parent: Record<string, string> = { triceps_long_left: "triceps_left", triceps_lateral_left: "triceps_left", biceps_long_left: "biceps_left" };
    const parentOf = (id: string) => parent[id] ?? null;
    expect(labelKey("triceps_long_left", parentOf, null)).toBe("triceps_left");
    expect(labelKey("triceps_lateral_left", parentOf, null)).toBe("triceps_left");
    expect(labelKey("femur_left", parentOf, null)).toBe("femur_left");
    expect(labelKey("deltoid_left", parentOf, null)).toBe("deltoid_left");
    // Part level (a triceps part selected): the triceps' parts are labelled one by one; other muscles still as one.
    expect(labelKey("triceps_long_left", parentOf, "triceps_left")).toBe("triceps_long_left");
    expect(labelKey("biceps_long_left", parentOf, "triceps_left")).toBe("biceps_left");
  });

  it("ranks a muscle's attachments and a part's siblings by the kind-aware sets", () => {
    // Triceps at tier 1: its bones (from relatedAt) rank 1; its parts are grouped into it (the focus).
    const t1 = new Set(["scapula_left", "humerus_left", "ulna_left"]);
    expect(labelPriority("triceps_left", "triceps_left", t1, t1)).toBe(0);
    expect(labelPriority("ulna_left", "triceps_left", t1, t1)).toBe(1);
    expect(labelPriority("radius_left", "triceps_left", t1, t1)).toBe(3);
  });

  it("takes the selection's layer as the focus layer, else the topmost layer on", () => {
    const modes = { bones: "on", cartilage: "off", ligaments: "on", muscles: "ghost" } as const;
    expect(focusLayerOf("cartilage", modes)).toBe("cartilage");
    expect(focusLayerOf(null, modes)).toBe("ligaments");
    expect(focusLayerOf(null, { ...modes, muscles: "on" })).toBe("muscles");
    expect(focusLayerOf(null, { bones: "on", cartilage: "off", ligaments: "off", muscles: "off" })).toBe("bones");
  });
});

describe("thinCandidates (M13 plan decision 12)", () => {
  const c = (id: string, priority: number, sizePx: number, layer = "b") => ({ id, priority, sizePx, layer });
  it("drops small priority-3 candidates as the layout would, keeping order", () => {
    const all = [c("a", 3, 40), c("b", 3, 10), c("f", 0, 1), c("t", 1, 5)];
    expect(thinCandidates(all, 10, 32).map((x) => x.id)).toEqual(["a", "f", "t"]);
  });
  it("keeps the best `max` in labelOrder's order, input order among them", () => {
    const all = [c("small", 3, 50), c("big", 3, 90), c("focus", 0, 1), c("mid", 3, 70), c("tier1", 1, 2)];
    expect(thinCandidates(all, 3, 32).map((x) => x.id)).toEqual(["big", "focus", "tier1"]);
  });
  it("the focus layer wins ties of equal size", () => {
    const all = [c("bone", 3, 50, "b"), c("muscle", 3, 49, "m")];
    expect(thinCandidates(all, 1, 0, "m").map((x) => x.id)).toEqual(["muscle"]);
    expect(thinCandidates(all, 1, 0, null).map((x) => x.id)).toEqual(["bone"]);
  });
  it("under the cap, the layout is exactly what it was without thinning", () => {
    const all = crowd(150);
    const minSizePx = 32;
    const kept = thinCandidates(all, MAX_LABEL_CANDIDATES * 10, minSizePx);
    expect(layoutLabels(kept, AREA, { minSizePx })).toEqual(layoutLabels(all, AREA, { minSizePx }));
  });
  it("cut to N, the first N the layout tries are unchanged", () => {
    const all = crowd(300).map((x, i) => ({ ...x, priority: i % 7 === 0 ? 1 : 3 }));
    const kept = thinCandidates(all, 40, 0);
    expect(kept).toHaveLength(40);
    expect(labelOrder(kept)).toEqual(labelOrder(all).slice(0, 40));
  });
});
