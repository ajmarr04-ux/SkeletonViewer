// M12 session AZ: the relationship graph's core (SPEC-platform §4.1–4.4, §10;
// M12 plan decisions 1, 2 and 4). The generic compiler's checks on bad inputs;
// the derived-edge rules on a small fixture (the M8 synergist/antagonist rule's
// tests, moved here from tests/softContent.test.ts with src/content/derive.ts);
// the real content compiled with no errors, checked on a few fixed IDs. The
// acceptance comparison (every muscle's and part's synergists, antagonists and
// attached muscles, every ligament's and cartilage's same-joint set, every
// tooth's neighbours, all equal to the M11 code's) ran in AZ before the old
// code was deleted (plan session notes).
import { describe, expect, it } from "vitest";
import { compileGraphFromDisk } from "../scripts/lib/content-files";
import { compileGraph, edgeCounts } from "../src/graph/compile";
import { edgeTypeIndex } from "../src/graph/edgeTypes";
import type { Edge, EdgeTypeDescriptor } from "../src/graph/types";
import { EDGE_TYPES, REGIONS } from "../src/systems/registry";
import { compileContentGraph } from "../src/systems/registry.content";

const TYPES: EdgeTypeDescriptor[] = [
  { id: "touches", label: "touches", inverse: null, symmetric: true },
  { id: "holds", label: "holds", inverse: "held by", symmetric: false },
  { id: "likes", label: "likes", inverse: null, symmetric: false, derived: true },
];

describe("edge types", () => {
  it("finds a type by ID or inverse label", () => {
    const t = edgeTypeIndex(TYPES);
    expect(t.byLabel("held by")).toEqual({ type: TYPES[1], inverse: true });
    expect(t.byLabel("holds")).toEqual({ type: TYPES[1], inverse: false });
    expect(t.byLabel("nothing")).toBeUndefined();
    expect(t.isSymmetric("touches")).toBe(true);
  });
  it("refuses a type registered twice, a name used twice, and a symmetric type with an inverse", () => {
    expect(() => edgeTypeIndex([TYPES[0]!, TYPES[0]!])).toThrow(/registered twice/);
    expect(() => edgeTypeIndex([TYPES[1]!, { id: "held by", label: "x", inverse: null, symmetric: false }])).toThrow(/used twice/);
    expect(() => edgeTypeIndex([{ id: "x", label: "x", inverse: "y", symmetric: true }])).toThrow(/no inverse/);
  });
  it("the registry's types are a valid set", () => {
    expect(() => edgeTypeIndex(EDGE_TYPES)).not.toThrow();
  });
});

describe("compileGraph (spec §10)", () => {
  const nodes = ["a", "b", "c"];
  const compile = (edges: Edge[], rules: { where: string; derive: (e: readonly Edge[]) => Edge[] }[] = []) =>
    compileGraph({ nodes, types: TYPES, sources: [{ where: "f.md", edges }], rules });
  it("rejects an unknown endpoint, an unregistered type, a derived type in a file and a self edge", () => {
    const { edges, errors } = compile([
      { from: "a", type: "holds", to: "z" },
      { from: "a", type: "grips", to: "b" },
      { from: "a", type: "likes", to: "b" },
      { from: "c", type: "holds", to: "c" },
    ]);
    expect(edges).toEqual([]);
    expect(errors).toEqual([
      "f.md: holds a → z: z not known",
      "f.md: edge type grips is not registered",
      "f.md: likes is derived and can't be written by a file",
      "f.md: holds c → itself",
    ]);
  });
  it("stores a symmetric edge once, as from < to, and drops exact duplicates, keeping the written order", () => {
    const { edges, errors } = compile([
      { from: "c", type: "touches", to: "a" },
      { from: "b", type: "holds", to: "a" },
      { from: "a", type: "touches", to: "c" },
      { from: "b", type: "holds", to: "a" },
      { from: "b", type: "holds", to: "a", meta: { at: "top" } },
    ]);
    expect(errors).toEqual([]);
    expect(edges).toEqual([
      { from: "a", type: "touches", to: "c" },
      { from: "b", type: "holds", to: "a" },
      { from: "b", type: "holds", to: "a", meta: { at: "top" } },
    ]);
  });
  it("runs rules in order on the edges so far, and checks what they return", () => {
    const { edges, errors } = compile(
      [{ from: "a", type: "holds", to: "b" }],
      [
        { where: "r1", derive: (e) => e.filter((x) => x.type === "holds").map((x) => ({ from: x.to, type: "likes", to: x.from })) },
        { where: "r2", derive: (e) => [{ from: "a", type: "likes", to: "q" }, ...(e.some((x) => x.type === "likes") ? [{ from: "c", type: "likes", to: "a" }] : [])] },
      ],
    );
    expect(edges.map((e) => `${e.from} ${e.type} ${e.to}`)).toEqual(["a holds b", "b likes a", "c likes a"]);
    expect(errors).toEqual(["r2: likes a → q: q not known"]);
  });
  it("counts edges per type in registered order", () => {
    expect(edgeCounts([{ from: "a", type: "holds", to: "b" }, { from: "a", type: "touches", to: "b" }, { from: "c", type: "holds", to: "b" }], TYPES)).toEqual([
      ["touches", 1],
      ["holds", 2],
    ]);
  });
});

// --- The derived-edge rules on a fixture (was the `derive` describe in softContent.test.ts) ---
const M = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: "muscle", parts: [], origin: [], insertion: [], actions: [], ...over });
const P = (id: string, parent: string, over: Record<string, unknown> = {}) => ({ id, kind: "muscle_part", parent, alsoServes: [], origin: [], insertion: "inherit", actions: [], ...over });
const act = (joint: string, movement: string, role = "prime") => ({ joint, movement, role });
const FM: Record<string, unknown> = {
  flexor: M("flexor", { parts: ["flexor_a", "flexor_b"], insertion: [{ structure: "bone_b" }], actions: [act("elbow", "flexion")] }),
  flexor_a: P("flexor_a", "flexor", { origin: [{ structure: "bone_a", landmark: "top" }] }),
  flexor_b: P("flexor_b", "flexor", { origin: [{ structure: "bone_a" }], actions: [act("shoulder", "flexion", "assist")] }),
  helper: M("helper", { origin: [{ structure: "bone_a" }], insertion: [{ structure: "bone_c" }], actions: [act("hinge", "flexion", "assist")] }),
  extensor: M("extensor", { origin: [{ soft: "fascia" }], insertion: [{ structure: "bone_b" }], actions: [act("elbow", "extension")] }),
  steady: M("steady", { actions: [act("elbow", "flexion", "stabiliser")] }),
  shoulder_flexor: M("shoulder_flexor", { actions: [act("shoulder", "flexion")] }),
  other_joint: M("other_joint", { actions: [act("knee", "flexion")] }),
  pair2_only: M("pair2_only", { actions: [act("pair2", "flexion")] }),
};
const JSON_FILES: Record<string, unknown> = {
  "content/articulations.json": [
    { a: "bone_a", b: "bone_b", joint: "hinge", name: "Hinge" },
    { a: "bone_a", b: "bone_c", joint: "pair2", name: "Pair 2" },
    { a: "bone_b", b: "bone_c", joint: "shoulder", name: "Shoulder" },
    { a: "bone_c", b: "bone_d", joint: "knee", name: "Knee" },
  ],
  "content/regions.json": { bone_a: ["bone_d"] },
  "content/joints.json": [{ id: "elbow", name: "Elbow", side: "midline", articulations: ["hinge", "pair2"] }],
  "content/movements.json": { movements: [], antagonistPairs: [["flexion", "extension"]] },
};
const compileFixture = (fm: Record<string, unknown>) =>
  compileContentGraph({
    fm,
    structures: [...Object.entries(fm).map(([id, f]) => ({ id, kind: (f as { kind: string }).kind })), ...["bone_a", "bone_b", "bone_c", "bone_d"].map((id) => ({ id, kind: "bone" }))],
    readJson: (rel) => JSON_FILES[rel],
  });
const fixture = compileFixture(FM);
const outOf = (g: ReturnType<typeof compileFixture>) => (from: string, type: string) => g.edges.filter((e) => e.from === from && e.type === type).map((e) => e.to);
const out = outOf(fixture);

describe("derived edges (fixture)", () => {
  it("compiles with no errors; the joints are nodes", () => {
    expect(fixture.errors).toEqual([]);
    expect(fixture.joints.map((j) => j.id)).toEqual(["hinge", "pair2", "shoulder", "knee", "elbow"]);
    expect(out("bone_a", "region_neighbour")).toEqual(["bone_d"]);
    expect(out("pair2", "member_of_joint")).toEqual(["elbow"]);
  });
  it("gives a part its muscle's attachments where it says inherit, marked inherited", () => {
    expect(fixture.edges.filter((e) => e.from === "flexor_a" && !["synergist_of", "antagonist_of"].includes(e.type))).toEqual([
      { from: "flexor_a", type: "part_of", to: "flexor" },
      { from: "flexor_a", type: "originates_on", to: "bone_a", meta: { landmark: "top" } },
      { from: "flexor_a", type: "inserts_on", to: "bone_b", meta: { inherited: "true" } },
    ]);
  });
  it("finds synergists across a functional joint and its pairs, never in the same muscle", () => {
    expect(out("helper", "synergist_of")).toEqual(["flexor"]);
    expect(out("flexor", "synergist_of")).toEqual(["helper", "pair2_only"]);
  });
  it("treats two pairs of one functional joint as different joints", () => {
    expect(out("pair2_only", "synergist_of")).toEqual(["flexor"]);
    expect(out("helper", "synergist_of")).not.toContain("pair2_only");
  });
  it("gives a part its muscle's actions plus its own, and lists a part only when its own action matches", () => {
    expect(out("flexor_b", "synergist_of")).toEqual(["helper", "pair2_only", "shoulder_flexor"]);
    expect(out("shoulder_flexor", "synergist_of")).toEqual(["flexor_b"]);
    expect(out("flexor_a", "synergist_of")).toEqual(["helper", "pair2_only"]);
  });
  it("leaves stabilisers out", () => {
    expect(out("steady", "synergist_of")).toEqual([]);
    expect(out("helper", "synergist_of")).not.toContain("steady");
  });
  it("finds antagonists by the paired movement on the same joint", () => {
    expect(out("extensor", "antagonist_of")).toEqual(["flexor", "helper", "pair2_only"]);
    expect(out("helper", "antagonist_of")).toEqual(["extensor"]);
    expect(out("other_joint", "antagonist_of")).toEqual([]);
  });
  it("applies synergistOverrides last", () => {
    const g = compileFixture({ a: M("a", { actions: [act("hinge", "flexion")], synergistOverrides: { add: ["c"], remove: ["b"] } }), b: M("b", { actions: [act("hinge", "flexion")] }), c: M("c") });
    expect(g.errors).toEqual([]);
    expect(outOf(g)("a", "synergist_of")).toEqual(["c"]);
  });
});

// --- The real content ---
describe("the real content's graph", () => {
  const g = compileGraphFromDisk();
  const real = (from: string, type: string) => g.edges.filter((e) => e.from === from && e.type === type).map((e) => e.to);
  const either = (id: string, type: string) => g.edges.flatMap((e) => (e.type === type ? (e.from === id ? [e.to] : e.to === id ? [e.from] : []) : []));
  it("compiles with no errors, every registered type has edges, and symmetric ones are stored once as from < to", () => {
    expect(g.errors).toEqual([]);
    // The body regions' located_in isn't compiled from the content (M13: generated, shipped with the index).
    const contentTypes = EDGE_TYPES.filter((t) => t.id !== REGIONS.edgeType.id);
    expect(edgeCounts(g.edges, contentTypes).map(([t]) => t)).toEqual(contentTypes.map((t) => t.id));
    for (const e of g.edges) if (edgeTypeIndex(EDGE_TYPES).isSymmetric(e.type)) expect(e.from < e.to, `${e.from} ${e.type} ${e.to}`).toBe(true);
  });
  it("teeth: neighbours in the arch, mesial first, across the midline for central incisors", () => {
    expect(real("tooth_11", "adjacent_tooth")).toEqual(["tooth_21", "tooth_12"]);
    expect(real("tooth_48", "adjacent_tooth")).toEqual(["tooth_47"]);
  });
  it("muscles: synergists, antagonists, a part's inherited insertion (fixed IDs)", () => {
    expect(real("temporalis_left", "synergist_of")).toEqual(expect.arrayContaining(["masseter_left", "medial_pterygoid_left"]));
    expect(real("temporalis_left", "synergist_of")).not.toContain("masseter_right");
    expect(real("temporalis_left", "antagonist_of")).toEqual(expect.arrayContaining(["digastric_left", "lateral_pterygoid_left"]));
    expect(real("triceps_brachii_long_head_left", "part_of")).toEqual(["triceps_brachii_left"]);
    expect(real("triceps_brachii_long_head_left", "originates_on")).toContain("scapula_left");
    expect(g.edges.filter((e) => e.from === "triceps_brachii_long_head_left" && e.type === "inserts_on").every((e) => e.meta?.inherited === "true")).toBe(true);
  });
  it("ligaments and cartilage: connects, joint membership, and the same-joint set", () => {
    expect(real("anterior_cruciate_ligament_left", "connects")).toEqual(["femur_left", "tibia_left"]);
    expect(real("anterior_cruciate_ligament_left", "member_of_joint")).toEqual(["knee_joint_left"]);
    expect(either("anterior_cruciate_ligament_left", "shares_joint_with")).toEqual(expect.arrayContaining(["posterior_cruciate_ligament_left", "lateral_meniscus_left"]));
    expect(either("anterior_cruciate_ligament_left", "shares_joint_with")).not.toContain("anterior_cruciate_ligament_right");
  });
});
