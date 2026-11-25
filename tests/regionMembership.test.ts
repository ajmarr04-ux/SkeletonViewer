// M13 BL: body-region membership (plan decisions 4 to 6): the pure rules, the
// spec §10 checks on bad inputs, the main chunk's wire format and the runtime lookups.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { appGraph } from "../src/content/appGraph";
import { lazyEntries } from "../src/content/index";
import { decodeRegions, encodeRegions } from "../src/regions/codec";
import { isInRegion, membersOf, regionInfo, regionList, regionsOf, regionTriangles } from "../src/regions/index";
import {
  applyOverrides,
  checkMembership,
  checkOverrides,
  inheritRegions,
  memberIndices,
  triangleTotals,
  vertexShares,
  type LocatedInFile,
  type MemberRegion,
  type Overrides,
  type StructureMembership,
} from "../src/regions/membership";
import type { OBox, Vec3 } from "../src/regions/volume";
import { LAYER_IDS, REGIONS } from "../src/systems/registry";

const box = (center: Vec3, half: Vec3): OBox => ({ type: "box", center, axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], half });
// Two fine regions side by side (x < 0 and x > 0) in coarse "a", one above them in coarse "b".
const REGS: MemberRegion[] = [
  { key: "west", coarse: "a", shapes: [box([-1, 0, 0], [1, 1, 1])] },
  { key: "east", coarse: "a", shapes: [box([1, 0, 0], [1, 1, 1])] },
  { key: "up", coarse: "b", shapes: [box([0, 3, 0], [2, 1, 1])] },
];
const ORDER = REGS.map((r) => r.key);

describe("vertex shares and the threshold rule", () => {
  it("counts the share per fine region and picks the coarse region with most vertices", () => {
    // 3 points west, 1 east, 4 up.
    const pts = [-1, 0, 0, -1.5, 0, 0, -0.5, 0.5, 0, 1, 0, 0, 0, 3, 0, 1, 3, 0, -1, 3, 0, 0.5, 3.5, 0];
    const { shares, home } = vertexShares(pts, REGS, ["a", "b"]);
    expect(shares).toEqual([3 / 8, 1 / 8, 4 / 8]);
    expect(home).toBe("a"); // a tie (4 and 4) goes to the earlier coarse region
  });
  it("a vertex on a shared face counts in both fine regions, once in their coarse region", () => {
    const { shares, home } = vertexShares([0, 0, 0], REGS, ["a", "b"]);
    expect(shares).toEqual([1, 1, 0]);
    expect(home).toBe("a");
  });
  it("is located in every region at the threshold, else the single best, else none", () => {
    expect(memberIndices([0.15, 0.149, 0.7], 0.15)).toEqual([0, 2]);
    expect(memberIndices([0.05, 0.1, 0.02], 0.15)).toEqual([1]);
    expect(memberIndices([0, 0, 0], 0.15)).toEqual([]);
  });
});

describe("overrides and inheritance", () => {
  const fresh = () =>
    new Map<string, StructureMembership>([
      ["x", { regions: ["west", "up"], home: "a" }],
      ["y", { regions: ["east"], home: "a" }],
    ]);
  it("adds in region order and removes, keeping what was computed", () => {
    const m = fresh();
    const o: Overrides = { add: [{ id: "y", region: "west", reason: "r" }], remove: [{ id: "x", region: "up", reason: "r" }] };
    expect(applyOverrides(m, o, ORDER, () => true)).toEqual([]);
    expect(m.get("y")).toEqual({ regions: ["west", "east"], home: "a", computed: ["east"] });
    expect(m.get("x")).toEqual({ regions: ["west"], home: "a", computed: ["west", "up"] });
  });
  it("refuses an override that changes nothing", () => {
    const o: Overrides = { add: [{ id: "x", region: "west", reason: "r" }], remove: [{ id: "y", region: "up", reason: "r" }] };
    expect(applyOverrides(fresh(), o, ORDER, () => true)).toEqual([
      "overrides add x → west: changes nothing (already in it)",
      "overrides remove y → up: changes nothing (not in it)",
    ]);
  });
  it("checks each override's reason, structure and region", () => {
    const o: Overrides = {
      add: [
        { id: "x", region: "west", reason: " " },
        { id: "nope", region: "west", reason: "r" },
      ],
      remove: [{ id: "x", region: "south", reason: "r" }],
    };
    expect(checkOverrides(o, (id) => id === "x", new Set(ORDER))).toEqual([
      "overrides add x → west: no reason",
      "overrides add nope → west: unknown structure",
      "overrides remove x → south: unknown fine region",
    ]);
  });
  it("a structure with parts takes their union; any other the regions most neighbours share", () => {
    const of = (id: string) => ({ p: ["west"], q: ["east", "up"], j: ["west", "east", "up"], t: ["east"] })[id];
    expect(inheritRegions(["p", "q"], () => [], of, ORDER)).toEqual({ regions: ["west", "east", "up"], home: null, inherited: "parts", from: ["p", "q"] });
    // A wisdom tooth: its jaw is in three regions, its neighbouring tooth in one; both share "east".
    expect(inheritRegions([], () => ["j", "t", "unknown"], of, ORDER)).toEqual({ regions: ["east"], home: null, inherited: "neighbours", from: ["j", "t"] });
    expect(inheritRegions([], () => ["p", "t"], of, ORDER).regions).toEqual(["west", "east"]); // no majority: all of them
  });
});

describe("the spec §10 region checks", () => {
  const file = (structures: Record<string, StructureMembership>): LocatedInFile => ({
    $comment: "",
    threshold: 0.15,
    sourceHash: "",
    regions: ORDER,
    coarse: [
      { key: "a", regions: ["west", "east"] },
      { key: "b", regions: ["up"] },
    ],
    structures,
    triangles: {},
  });
  const none: Overrides = { add: [], remove: [] };
  const input = (structures: Record<string, StructureMembership>, overrides = none) => ({
    file: file(structures),
    overrides,
    ids: Object.keys(structures),
    meshIds: new Set(["m1", "m2"]),
    regionKeys: ORDER,
  });
  it("passes a good file", () => {
    expect(checkMembership(input({ m1: { regions: ["west", "east"], home: "a" }, m2: { regions: ["up"], home: "b" } }))).toEqual([]);
  });
  it("every structure with a mesh has a region; one without a mesh may not", () => {
    const errors = checkMembership(input({ m1: { regions: ["west", "east", "up"], home: "a" }, m2: { regions: [], home: null }, n: { regions: [], home: null } }));
    expect(errors).toEqual(["m2: has a mesh but no located_in region"]);
  });
  it("every region contains a structure", () => {
    expect(checkMembership(input({ m1: { regions: ["west"], home: "a" }, m2: { regions: ["up"], home: "b" } }))).toEqual(["region east: contains no structure"]);
  });
  it("every override has a reason, and has been applied", () => {
    const s = { m1: { regions: ["west", "east"], home: "a" }, m2: { regions: ["up"], home: "b" } };
    expect(checkMembership(input(s, { add: [], remove: [{ id: "m1", region: "up", reason: "" }] }))).toEqual([
      "overrides remove m1 → up: no reason",
      "overrides remove m1 → up: not applied, or changes nothing (run npm run regions)",
    ]);
  });
  it("names unknown structures and regions", () => {
    const errors = checkMembership({ ...input({ m1: { regions: ["west", "north"], home: "a" }, m2: { regions: ["east", "up"], home: "a" } }), ids: ["m1"] });
    expect(errors).toEqual(["m1: located in unknown region north", "m2: in located-in.json but not a structure"]);
  });
});

describe("triangle totals", () => {
  it("sums each region's members and counts a structure once per coarse region", () => {
    const regions: Record<string, string[]> = { s: ["west", "east"], t: ["up"] };
    const t = triangleTotals(["s", "t"], (id) => regions[id]!, { high: (id) => (id === "s" ? 100 : 10), low: (id) => (id === "s" ? 50 : 5) }, [
      { key: "a", regions: ["west", "east"] },
      { key: "b", regions: ["up"] },
    ]);
    expect(t.high).toEqual({ west: 100, east: 100, up: 10, a: 100, b: 10 });
    expect(t.low.a).toBe(50);
    expect(t.total).toEqual({ high: 110, low: 55 });
  });
});

// ---------------------------------------------------------------- the real data

const real = JSON.parse(readFileSync(REGIONS.membershipFile, "utf8")) as LocatedInFile;
const order = [...(ids as { id: string }[]).map((e) => e.id), ...lazyEntries().map((e) => e.id)];

describe("the shipped index (main chunk)", () => {
  it("round-trips every structure's regions, mirroring right sides", () => {
    const packed = encodeRegions(real, {}, order);
    expect(packed.loc.filter((x) => x === 0).length).toBeGreaterThan(400);
    const back = decodeRegions(packed, order);
    for (const id of order) expect(back.located.get(id) ?? [], id).toEqual(real.structures[id]!.regions);
  });
  it("answers regionsOf, membersOf and the totals from the first frame", () => {
    for (const id of order) expect(regionsOf(id)).toEqual(real.structures[id]!.regions);
    expect(regionList().filter((r) => r.fine).map((r) => r.key)).toEqual(real.regions);
    expect(regionInfo("forearm_left")).toEqual({ key: "forearm_left", name: "Forearm (left)", fine: true, coarse: "upper_limb_left", side: "left" });
    expect(regionInfo("head")?.fine).toBe(false);
    expect(membersOf("forearm_left")).toContain("radius_left");
    expect(membersOf("forearm_left")).not.toContain("radius_right");
    // A coarse region: each member of its fine regions once.
    const limb = membersOf("upper_limb_left");
    expect(new Set(limb).size).toBe(limb.length);
    expect(limb).toEqual(expect.arrayContaining([...membersOf("arm_left"), ...membersOf("wrist_hand_left")]));
    expect(isInRegion("tooth_18", "oral_cavity")).toBe(true);
    expect(isInRegion("tooth_18", "head")).toBe(true);
    expect(isInRegion("tooth_18", "neck")).toBe(false);
    for (const layer of LAYER_IDS) {
      expect(regionTriangles(layer, "high", null)).toBe(real.triangles[layer]!.total.high);
      expect(regionTriangles(layer, "low", "thorax")).toBe(real.triangles[layer]!.low.thorax);
    }
    expect(regionTriangles("nope", "high", null)).toBe(0);
  });
  it("the graph follows located_in both ways", () => {
    const g = appGraph();
    expect(g.neighbours("radius_left", REGIONS.edgeType.id)).toEqual(regionsOf("radius_left"));
    expect(g.neighbours("forearm_left", REGIONS.edgeType.inverse!)).toEqual(expect.arrayContaining(["radius_left", "ulna_left"]));
  });
  it("whole-layer totals are the build manifests' (the governor's estimate, decision 10)", () => {
    const sum = LAYER_IDS.reduce((s, l) => s + regionTriangles(l, "high", null), 0);
    expect(sum).toBe(1_499_634);
    expect(LAYER_IDS.reduce((s, l) => s + regionTriangles(l, "low", null), 0)).toBe(449_623);
  });
});
