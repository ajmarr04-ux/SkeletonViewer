// M12 session BA: the runtime graph index and the tier engine on a small
// world (M12 plan decision 5): every step type, the `from` modes, the three
// orders (source by source, and a rule's own sort), parts expansion, `exclude`,
// `requires`, the Off-layer filter and memoisation across a new chunk.
import { describe, expect, it } from "vitest";
import { createGraph } from "../src/graph/graph";
import { tierEngine, type TierContext } from "../src/graph/query";
import type { Edge, EdgeTypeDescriptor, KindTiers } from "../src/graph/types";

const TYPES: EdgeTypeDescriptor[] = [
  { id: "touches", label: "touches", inverse: null, symmetric: true },
  { id: "holds", label: "holds", inverse: "held by", symmetric: false },
  { id: "part_of", label: "part of", inverse: "has part", symmetric: false },
  { id: "likes", label: "likes", inverse: null, symmetric: false },
];

// Boxes (layer "a"), gears (layer "b") made of gear parts (layer "b").
const KIND: Record<string, string> = { b1: "box", b2: "box", b3: "box", b4: "box", g1: "gear", g2: "gear", g1x: "gear_part", g1y: "gear_part", g2x: "gear_part" };
const LAYER: Record<string, string> = { box: "a", gear: "b", gear_part: "b" };
/** Index order: the boxes in a written order (not by ID), then the gears' layer by ID. */
const RANK = ["b3", "b1", "b4", "b2", "g1", "g1x", "g1y", "g2", "g2x"];

const e = (from: string, type: string, to: string, meta?: Record<string, string>): Edge => ({ from, type, to, ...(meta ? { meta } : {}) });
const BASE: Edge[] = [
  e("b1", "touches", "b4"),
  e("b1", "touches", "b3"),
  e("b2", "touches", "b4"),
  e("g1x", "part_of", "g1"),
  e("g1y", "part_of", "g1"),
  e("g2x", "part_of", "g2"),
  e("g2x", "part_of", "g1", { also: "true" }),
  e("g2", "holds", "b1"),
  e("g1y", "holds", "b4"),
  e("g1", "holds", "b4"),
  e("g1x", "holds", "b2"),
  e("b1", "likes", "b2"),
  e("b1", "likes", "b4"),
];

function world(rules: Record<string, KindTiers>, edges: Edge[] = BASE) {
  const graph = createGraph(TYPES);
  graph.add("base", edges);
  const ctx: TierContext = {
    graph,
    rulesOf: (id) => rules[KIND[id] ?? ""],
    partsOf: (id) => graph.in(id, "part_of").filter((x) => !x.meta?.also).map((x) => x.from),
    kindOf: (id) => KIND[id],
    layerOf: (id) => LAYER[KIND[id] ?? ""],
    rank: (id) => RANK.indexOf(id),
  };
  return { graph, engine: tierEngine(ctx) };
}

describe("runtime graph", () => {
  it("reads a symmetric edge from both ends, a directed one by type or inverse label, in written order", () => {
    const { graph } = world({});
    expect(graph.neighbours("b1", "touches")).toEqual(["b4", "b3"]);
    expect(graph.neighbours("b4", "touches")).toEqual(["b1", "b2"]);
    expect(graph.neighbours("b4", "held by")).toEqual(["g1y", "g1"]);
    expect(graph.neighbours("g1", "holds")).toEqual(["b4"]);
    expect(graph.neighbours("g1", "has part")).toEqual(["g1x", "g1y", "g2x"]);
    expect(graph.has("b3", "likes")).toBe(false);
    expect(() => graph.neighbours("b1", "nothing")).toThrow(/no edge type/);
  });

  it("adds a chunk once and skips an edge another chunk added", () => {
    const { graph } = world({});
    const v = graph.version;
    expect(graph.add("base", [e("b3", "likes", "b1")])).toBe(false);
    expect(graph.version).toBe(v);
    expect(graph.add("more", [e("b1", "likes", "b2"), e("b3", "likes", "b1")])).toBe(true);
    expect(graph.version).toBe(v + 1);
    expect(graph.edges()).toHaveLength(BASE.length + 1);
    expect(graph.neighbours("b1", "likes")).toEqual(["b2", "b4"]);
  });

  it("tells listeners when a chunk arrives", () => {
    const { graph } = world({});
    let n = 0;
    const off = graph.subscribe(() => n++);
    graph.add("x", []);
    off();
    graph.add("y", []);
    expect(n).toBe(1);
  });
});

describe("tier engine", () => {
  const allOn = { a: "on", b: "on" } as const;

  it("follows edge types and inverse labels; the structure itself is never in the result", () => {
    const { engine } = world({ box: { t1: { steps: [{ self: true }, { follow: ["touches", "held by"] }] } } });
    expect(engine.evaluate("b4", "t1")).toEqual(["b1", "b2", "g1y", "g1", "g1x"]);
  });

  it("orders each source's targets: written, by ID, or in index order", () => {
    const rules = (order: "written" | "id" | "anatomical"): Record<string, KindTiers> => ({ box: { t1: { steps: [{ follow: "touches", order }] } } });
    expect(world(rules("written")).engine.evaluate("b1", "t1")).toEqual(["b4", "b3"]);
    expect(world(rules("id")).engine.evaluate("b1", "t1")).toEqual(["b3", "b4"]);
    expect(world(rules("anatomical")).engine.evaluate("b1", "t1")).toEqual(["b3", "b4"]);
    expect(world(rules("anatomical")).engine.evaluate("b4", "t1")).toEqual(["b1", "b2"]);
  });

  it("lists a step's targets source by source", () => {
    // From the result so far (b1, then b4, b3): b1's holders, then b4's, each sorted by ID (one merged sort would put g1 first).
    const { engine } = world({
      box: { t1: { steps: [{ follow: "touches" }, { follow: ["held by"], from: "result", order: "id" }] } },
    });
    expect(engine.evaluate("b1", "t1")).toEqual(["b4", "b3", "g2", "g2x", "g1", "g1x", "g1y"]);
  });

  it("starts a step from self, self+parts, previous or result", () => {
    const rules = (from: "self" | "self+parts" | "previous" | "result"): Record<string, KindTiers> => ({
      gear: { t1: { steps: [{ follow: "holds" }, { follow: "touches", from }] } },
    });
    // g1 holds b4; its parts g1x, g1y hold b2, b4. touches: b4 – b1, b2; b2 – b4.
    expect(world(rules("self")).engine.evaluate("g1", "t1")).toEqual(["b4"]);
    expect(world(rules("previous")).engine.evaluate("g1", "t1")).toEqual(["b4", "b1", "b2"]);
    expect(world(rules("result")).engine.evaluate("g1", "t1")).toEqual(["b4", "b1", "b2"]);
    const parts = world({ gear: { t1: { steps: [{ follow: "holds", from: "self+parts" }] } } });
    expect(parts.engine.evaluate("g1", "t1")).toEqual(["b4", "b2"]);
  });

  it("expands a structure with parts: followed by its parts, or replaced by them", () => {
    const rule = { steps: [{ follow: "held by" }] };
    // b4 is held by g1y (a part) and g1 (a gear with parts g1x, g1y; not g2x, which only also serves it).
    expect(world({ box: { t1: rule } }).engine.evaluate("b4", "t1")).toEqual(["g1y", "g1", "g1x"]);
    expect(world({ box: { t1: { ...rule, parts: "instead" } } }).engine.evaluate("b4", "t1")).toEqual(["g1y", "g1x"]);
    // `self` expands too.
    expect(world({ gear: { t1: { steps: [{ self: true }] } } }).engine.evaluate("g1", "t1")).toEqual(["g1x", "g1y"]);
  });

  it("includes another tier first, excludes what it holds, and sorts only its own additions", () => {
    const { engine } = world({
      box: {
        t1: { steps: [{ follow: "touches" }] },
        t2: { steps: [{ tier: "t1" }, { follow: ["likes", "held by"] }], order: "id" },
      },
    });
    expect(engine.evaluate("b1", "t1")).toEqual(["b4", "b3"]);
    expect(engine.evaluate("b1", "t2")).toEqual(["b4", "b3", "b2", "g2", "g2x"]);
  });

  it("leaves out what an exclude reaches from the structure, with its parts", () => {
    const { engine } = world({ box: { t1: { steps: [{ follow: ["held by", "touches"], exclude: "likes" }] } } });
    // b1 likes b2 and b4: neither is in the result.
    expect(engine.evaluate("b1", "t1")).toEqual(["g2", "g2x", "b3"]);
  });

  it("filters everything so far by kind or layer", () => {
    const { engine } = world({
      box: {
        t1: { steps: [{ follow: ["held by"] }, { filter: { kind: ["gear"] } }, { follow: "touches" }] },
        t2: { steps: [{ follow: ["held by", "touches"] }, { filter: { layer: ["a"] } }] },
      },
    });
    expect(engine.evaluate("b4", "t1")).toEqual(["g1", "b1", "b2"]);
    expect(engine.evaluate("b4", "t2")).toEqual(["b1", "b2"]);
  });

  it("has a tier only when the kind has the rule and its requirement holds", () => {
    const { engine } = world({ box: { t1: { steps: [{ follow: "touches" }] }, t2: { steps: [{ tier: "t1" }], requires: "likes" } } });
    expect(engine.hasTier("b1", "t2")).toBe(true);
    expect(engine.hasTier("b2", "t2")).toBe(false);
    expect(engine.evaluate("b2", "t2")).toBeNull();
    expect(engine.evaluate("b2", "t9")).toBeNull();
    expect(engine.evaluate("g1x", "t1")).toBeNull();
    expect(engine.evaluate("nobody", "t1")).toBeNull();
  });

  it("refuses a tier that includes itself", () => {
    const { engine } = world({ box: { t1: { steps: [{ tier: "t2" }] }, t2: { steps: [{ tier: "t1" }] } } });
    expect(() => engine.evaluate("b1", "t1")).toThrow(/includes itself/);
  });

  it("adds nothing from a layer that is Off (Ghost counts as showing)", () => {
    const { engine } = world({ box: { t1: { steps: [{ follow: ["touches", "held by"] }] } } });
    expect(engine.related("b4", "t1", allOn)).toEqual(["b1", "b2", "g1y", "g1", "g1x"]);
    expect(engine.related("b4", "t1", { a: "on", b: "off" })).toEqual(["b1", "b2"]);
    expect(engine.related("b4", "t1", { a: "off", b: "ghost" })).toEqual(["g1y", "g1", "g1x"]);
  });

  it("memoises per graph version: a new chunk's edges show up", () => {
    const { graph, engine } = world({ box: { t1: { steps: [{ follow: "touches" }] } } });
    const first = engine.related("b3", "t1", allOn);
    expect(first).toEqual(["b1"]);
    expect(engine.related("b3", "t1", allOn)).toBe(first);
    expect(engine.evaluate("b3", "t1")).toBe(engine.evaluate("b3", "t1"));
    graph.add("more", [e("b3", "touches", "b2")]);
    expect(engine.related("b3", "t1", allOn)).toEqual(["b1", "b2"]);
  });
});
