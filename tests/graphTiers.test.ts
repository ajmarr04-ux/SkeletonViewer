// M12 session BA: the tier engine over the graph compiled from disk gives
// tests/golden/tiers.json exactly, for every one of the 1,138 IDs (M12 plan
// step 2): tiers 1 and 2 with every layer On, tiers 1 and 2 with only the
// eager layer on (bones and teeth), and the antagonist set (`ant`) of every
// muscle and part. The app still runs on the old tier code until BC.
//
// A structure without a tier 2 (a ligament or cartilage with no joint) shows
// its tier 1 at tier 2, as `relatedAt` does today; `hasTier` says which.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileGraphFromDisk, readIds, readSoftIds } from "../scripts/lib/content-files";
import { createGraph } from "../src/graph/graph";
import { tierEngine, type LayerModes } from "../src/graph/query";
import { DEFAULT_MODES, EDGE_TYPES, LAYER_IDS, indexRank, tierContext } from "../src/systems/registry";

type GoldenTiers = Record<string, { t1: string[]; t2: string[]; bonesOnly?: { t1: string[]; t2: string[] }; ant?: string[] }>;
const golden = JSON.parse(readFileSync(new URL("./golden/tiers.json", import.meta.url), "utf8")) as GoldenTiers;

const entries = [...readIds(), ...readSoftIds()].map((e) => ({ id: e.id, kind: e.kind as string }));
const kinds = new Map(entries.map((e) => [e.id, e.kind]));
const compiled = compileGraphFromDisk();
const graph = createGraph(EDGE_TYPES);
graph.add("all", compiled.edges);
const engine = tierEngine(tierContext(graph, { kindOf: (id) => kinds.get(id), rank: indexRank(entries) }));

const allOn: LayerModes = Object.fromEntries(LAYER_IDS.map((l) => [l, "on"]));
/** A missing tier shows the tier below it (today's `t2: null`). */
const at = (id: string, tier: "t1" | "t2", modes: LayerModes) => engine.related(id, tier, modes) ?? (tier === "t2" ? engine.related(id, "t1", modes) : null);

describe("tier engine against tiers.json", () => {
  it("covers every ID the golden holds", () => {
    expect(compiled.errors).toEqual([]);
    expect(Object.keys(golden)).toHaveLength(1138);
    expect(Object.keys(golden).sort()).toEqual(entries.map((e) => e.id).sort());
  });

  it("gives tiers 1 and 2 with every layer On", () => {
    const got: Record<string, unknown> = {};
    const want: Record<string, unknown> = {};
    for (const [id, g] of Object.entries(golden)) {
      got[id] = { t1: at(id, "t1", allOn), t2: at(id, "t2", allOn) };
      want[id] = { t1: g.t1, t2: g.t2 };
    }
    expect(got).toEqual(want);
  });

  it("gives the bones and teeth their tiers with only the bones layer on", () => {
    const got: Record<string, unknown> = {};
    const want: Record<string, unknown> = {};
    for (const [id, g] of Object.entries(golden)) {
      if (!g.bonesOnly) continue;
      got[id] = { t1: at(id, "t1", DEFAULT_MODES), t2: at(id, "t2", DEFAULT_MODES) };
      want[id] = g.bonesOnly;
    }
    expect(Object.keys(want)).toHaveLength(238);
    expect(got).toEqual(want);
  });

  it("gives every muscle's and part's antagonist set, and no other structure one", () => {
    const got: Record<string, unknown> = {};
    const want: Record<string, unknown> = {};
    for (const [id, g] of Object.entries(golden)) {
      if (g.ant) want[id] = g.ant;
      if (engine.hasTier(id, "ant")) got[id] = engine.evaluate(id, "ant");
    }
    expect(Object.keys(want).length).toBeGreaterThan(500);
    expect(got).toEqual(want);
  });

  it("has a tier 2 for a ligament or cartilage only when it is at a joint", () => {
    expect(engine.hasTier("anterior_cruciate_ligament_left", "t2")).toBe(true);
    const jointless = entries.filter((e) => engine.hasTier(e.id, "t1") && !engine.hasTier(e.id, "t2")).map((e) => e.id);
    expect(jointless.length).toBeGreaterThan(0);
    for (const id of jointless) expect(graph.has(id, "member_of_joint")).toBe(false);
  });
});
