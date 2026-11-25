// M12 session BC: the graph shipped in the chunks (plan decision 3). The wire
// format round-trips; each chunk carries the edges whose `from` is in its
// layer plus, as the reverse index, those whose `to` is (a symmetric edge with
// both ends' layers); and the app's tiers equal tests/golden/tiers.json
// whatever order the lazy chunks register in.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { compileAllSoftFromDisk, compileGraphFromDisk, readEagerEdges, readIds, readSoftIds, shippedEdges } from "../scripts/lib/content-files";
import { resetAppGraph, rolesOf } from "../src/content/appGraph";
import { registerSoftContent, resetSoftContent } from "../src/content/softContentLoader";
import { decodeEdges, encodeEdges } from "../src/graph/codec";
import { shipEdges } from "../src/graph/ship";
import type { Edge } from "../src/graph/types";
import { relatedAt } from "../src/scene/isolation";
import { EAGER_LAYER, EDGE_TYPES, LAZY_LAYERS, LAYER_IDS, layerOfKind, type LazyLayerId } from "../src/systems/registry";

type GoldenTiers = Record<string, { t1: string[]; t2: string[]; ant?: string[] }>;
const golden = JSON.parse(readFileSync(new URL("./golden/tiers.json", import.meta.url), "utf8")) as GoldenTiers;
const SOFT = compileAllSoftFromDisk();
const EDGES = compileGraphFromDisk(SOFT).edges;
const LAYER = new Map([...readIds(), ...readSoftIds()].map((e) => [e.id, layerOfKind(e.kind as string)]));
const SYMMETRIC = new Set(EDGE_TYPES.filter((t) => t.symmetric).map((t) => t.id));
const key = (e: Edge) => `${e.from}|${e.type}|${e.to}|${JSON.stringify(e.meta ?? {})}`;
const byType = (es: readonly Edge[]) => {
  const m: Record<string, string[]> = {};
  for (const e of es) (m[e.type] ??= []).push(key(e));
  return m;
};

afterAll(() => {
  resetSoftContent();
  resetAppGraph();
});

describe("edge wire format", () => {
  it("round-trips every edge, in order within each type, meta included", () => {
    const wire = encodeEdges(EDGES);
    expect(byType(decodeEdges(wire))).toEqual(byType(EDGES));
    expect(decodeEdges(encodeEdges([]))).toEqual([]);
  });
  it("refuses meta it can't write", () => {
    expect(() => encodeEdges([{ from: "a", type: "t", to: "b", meta: { k: "x=y" } }])).toThrow(/contains/);
  });
  it("what the chunks ship decodes to the shipping rule's edges", () => {
    const shipped = shippedEdges(EDGES);
    expect(byType(decodeEdges(readEagerEdges()))).toEqual(byType(shipped[EAGER_LAYER]!));
    for (const l of LAZY_LAYERS) expect(byType(decodeEdges(SOFT[l].edges!)), l).toEqual(byType(shipped[l]!));
  });
});

describe("shipping rule", () => {
  it("on a fixture: from's layer (eager for none), to's lazy layer, both ends when symmetric", () => {
    const layerOf = (id: string) => ({ b1: "bones", b2: "bones", m1: "muscles", l1: "ligaments" })[id];
    const out = shipEdges(
      [
        { from: "b1", type: "art", to: "b2" },
        { from: "m1", type: "on", to: "b1" },
        { from: "m1", type: "on", to: "l1" },
        { from: "l1", type: "joint", to: "j1" },
        { from: "j1", type: "joint", to: "j2" },
        { from: "l1", type: "same", to: "m1" },
      ],
      { eager: "bones", lazy: ["muscles", "ligaments"], layerOf, isSymmetric: (t) => t === "same" },
    );
    const names = (es: Edge[]) => es.map((e) => `${e.from}-${e.to}`);
    expect(names(out.bones!)).toEqual(["b1-b2", "j1-j2"]);
    expect(names(out.muscles!)).toEqual(["m1-b1", "m1-l1", "l1-m1"]);
    expect(names(out.ligaments!)).toEqual(["m1-l1", "l1-j1", "l1-m1"]);
  });
  it("on the real graph: every edge ships with its from's layer, and with its to's lazy layer", () => {
    const shipped = shippedEdges(EDGES);
    const has = Object.fromEntries(Object.entries(shipped).map(([c, es]) => [c, new Set(es.map(key))]));
    const home = (id: string) => {
      const l = LAYER.get(id);
      return l && l !== EAGER_LAYER ? l : EAGER_LAYER;
    };
    for (const e of EDGES) {
      expect(has[home(e.from)]!.has(key(e)), key(e)).toBe(true);
      const to = LAYER.get(e.to);
      if (to && (to !== EAGER_LAYER || SYMMETRIC.has(e.type))) expect(has[to]!.has(key(e)), key(e)).toBe(true);
    }
    // Nothing else: the eager chunk holds only edges from the eager layer or from a joint node.
    for (const e of shipped[EAGER_LAYER]!) expect([undefined, EAGER_LAYER]).toContain(LAYER.get(e.from));
  });
});

describe("tiers whatever order the chunks load in", () => {
  const allOn = Object.fromEntries(LAYER_IDS.map((l) => [l, "on"])) as Parameters<typeof relatedAt>[2];
  const orders: LazyLayerId[][] = [[...LAZY_LAYERS], [...LAZY_LAYERS].reverse(), [LAZY_LAYERS[1]!, LAZY_LAYERS[2]!, LAZY_LAYERS[0]!]];
  for (const order of orders)
    it(`registered as ${order.join(", ")}`, () => {
      resetSoftContent();
      resetAppGraph();
      for (const l of order) registerSoftContent(l, SOFT[l]);
      const got: Record<string, unknown> = {};
      const want: Record<string, unknown> = {};
      for (const [id, g] of Object.entries(golden)) {
        const ant = rolesOf(id)?.ant;
        got[id] = { t1: relatedAt(id, 1, allOn), t2: relatedAt(id, 2, allOn), ...(ant ? { ant } : {}) };
        want[id] = { t1: g.t1, t2: g.t2, ...(g.ant ? { ant: g.ant } : {}) };
      }
      expect(got).toEqual(want);
    });
});
