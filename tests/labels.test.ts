import { describe, expect, it } from "vitest";
import { labelPriority, layoutLabels, leaderEnd, LABEL, type LabelCandidate, type PlacedLabel } from "../src/scene/labels";

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
