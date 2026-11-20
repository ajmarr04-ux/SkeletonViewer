// Soft-tissue content (M8 session X): the validation rules (spec §10, plan
// decisions 2 to 10) on small fixtures, the derived synergists, antagonists and
// attachments (plan decision 9), the compiler, and the real seed files.
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { compileSoftFromDisk, makeOpposite, readJson } from "../scripts/lib/content-files";
import { derive, type DeriveMuscle } from "../src/content/derive";
import { mirrorFile } from "../src/content/frontmatter";
import { compileSoftLayer } from "../src/content/softCompile";
import { validateSoftContent, type SoftContentInput, type SoftIdEntry } from "../src/content/softValidate";
import type { SoftLayer } from "../src/content/softSchema";

// --- Fixture: a two-headed flexor, a helper flexor, an extensor, a ligament, a meniscus ---
const L = (id: string, kind: string, layer: SoftLayer, extra: Partial<SoftIdEntry> = {}): SoftIdEntry => ({
  id,
  name: extra.name ?? id.replace(/_left$/, ""),
  latin: null,
  kind,
  layer,
  side: "left",
  group: [],
  meshAvailable: true,
  ...extra,
});
const R = (e: SoftIdEntry): SoftIdEntry => ({
  ...e,
  id: e.id.replace(/_left$/, "_right"),
  side: "right",
  parent: e.parent?.replace(/_left$/, "_right"),
  parts: e.parts?.map((p) => p.replace(/_left$/, "_right")),
});
const LEFT: SoftIdEntry[] = [
  L("flexor_left", "muscle", "muscles", { parts: ["flexor_head_a_left", "flexor_head_b_left"], meshAvailable: false }),
  L("flexor_head_a_left", "muscle_part", "muscles", { parent: "flexor_left", partType: "head" }),
  L("flexor_head_b_left", "muscle_part", "muscles", { parent: "flexor_left", partType: "head" }),
  L("helper_left", "muscle", "muscles"),
  L("extensor_left", "muscle", "muscles"),
  L("band_left", "ligament", "ligaments"),
  L("inguinal_ligament_left", "ligament", "ligaments"),
  L("pad_left", "meniscus", "cartilage"),
];
const SOFT = [...LEFT, ...LEFT.map(R)];
const BONES = ["bone_a_left", "bone_b_left", "bone_a_right", "bone_b_right"];

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const file = (fm: Record<string, unknown>, body = words(50)) => `---\n${stringify(fm, { lineWidth: 0 }).trimEnd()}\n---\n${body}\n`;

const muscle = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "muscle",
  name: id.replace(/_left$/, ""),
  latin: "Musculus testis",
  commonName: null,
  side: "left",
  region: ["limb"],
  compartment: "front",
  parts: [],
  origin: [{ structure: "bone_a_left", landmark: "top" }],
  insertion: [{ structure: "bone_b_left" }],
  actions: [{ joint: "elbow_left", movement: "flexion", role: "prime" }],
  innervation: "Test nerve (C5–C6)",
  clinicalNote: null,
  reviewed: false,
  ...over,
});
const part = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "muscle_part",
  partType: "head",
  parent: "flexor_left",
  alsoServes: [],
  name: id.replace(/_left$/, ""),
  latin: "Caput testis",
  side: "left",
  origin: [{ structure: "bone_a_left" }],
  insertion: "inherit",
  actions: [],
  reviewed: false,
  ...over,
});
const ligament = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "ligament",
  name: id.replace(/_left$/, ""),
  latin: "Ligamentum testis",
  commonName: null,
  side: "left",
  joint: "hinge_left",
  connects: ["bone_a_left", "bone_b_left"],
  functions: ["Holds the bones together"],
  clinicalNote: null,
  reviewed: false,
  ...over,
});
const meniscus = (over: Record<string, unknown> = {}) => ({
  id: "pad_left",
  kind: "meniscus",
  name: "pad",
  latin: "Meniscus testis",
  side: "left",
  joint: "elbow_left",
  attachedTo: ["bone_b_left"],
  functions: ["Spreads load"],
  clinicalNote: null,
  reviewed: false,
  ...over,
});

const opposite = (id: string) => {
  const m = /_(left|right)$/.exec(id);
  if (!m) return null;
  const other = m[1] === "left" ? id.replace(/_left$/, "_right") : id.replace(/_right$/, "_left");
  const known = SOFT.some((e) => e.id === other) || BONES.includes(other) || /^(hinge|pair2|elbow)_/.test(other);
  return known ? other : null;
};

function input(over: Partial<SoftContentInput> = {}, files: Partial<Record<SoftLayer, Record<string, string>>> = {}): SoftContentInput {
  const base: Record<SoftLayer, Record<string, string>> = {
    muscles: {
      flexor_left: file(muscle("flexor_left", { parts: ["flexor_head_a_left", "flexor_head_b_left"], origin: [] })),
      flexor_head_a_left: file(part("flexor_head_a_left"), words(30)),
      flexor_head_b_left: file(part("flexor_head_b_left", { actions: [{ joint: "pair2_left", movement: "flexion", role: "assist" }] }), words(30)),
      helper_left: file(muscle("helper_left", { actions: [{ joint: "hinge_left", movement: "flexion", role: "assist" }] })),
      extensor_left: file(muscle("extensor_left", { compartment: "back", actions: [{ joint: "elbow_left", movement: "extension", role: "prime" }] })),
    },
    ligaments: { band_left: file(ligament("band_left")) },
    cartilage: { pad_left: file(meniscus()) },
  };
  const merged = { muscles: { ...base.muscles, ...files.muscles }, ligaments: { ...base.ligaments, ...files.ligaments }, cartilage: { ...base.cartilage, ...files.cartilage } };
  return {
    softIds: SOFT,
    boneIds: BONES,
    boneLandmarks: new Map([
      ["bone_a_left", new Set(["top"])],
      ["bone_b_left", new Set<string>()],
    ]),
    files: {
      muscles: new Map(Object.entries(merged.muscles)),
      ligaments: new Map(Object.entries(merged.ligaments)),
      cartilage: new Map(Object.entries(merged.cartilage)),
    },
    meshes: {},
    articulations: [{ joint: "hinge_left" }, { joint: "hinge_right" }, { joint: "pair2_left" }, { joint: "pair2_right" }],
    joints: [
      { id: "elbow_left", name: "Elbow", side: "left", articulations: ["hinge_left", "pair2_left"] },
      { id: "elbow_right", name: "Elbow", side: "right", articulations: ["hinge_right", "pair2_right"] },
    ],
    movements: readJson("content/movements.json"),
    muscleHierarchy: [{ key: "limb", label: "Limb", children: [{ key: "front", label: "Front", children: ["flexor_left", "helper_left"] }, { key: "back", label: "Back", children: ["extensor_left"] }] }],
    opposite,
    questions: "",
    ...over,
  };
}
const errorsOf = (i: SoftContentInput, allowMissingSoft = true) => validateSoftContent(i, { allowMissingSoft }).errors;
const withMuscle = (id: string, fm: Record<string, unknown>, body?: string) => input({}, { muscles: { [id]: file(fm, body) } });

describe("validateSoftContent: the fixture", () => {
  it("passes with missing files allowed, and counts them", () => {
    const r = validateSoftContent(input(), { allowMissingSoft: true });
    expect(r.errors).toEqual([]);
    expect(r.files).toBe(7);
    expect(r.warnings[0]).toMatch(/9 of 16 soft-tissue structures have no content file yet/);
  });
  it("fails strictly on the missing files (the right side and the inguinal ligament)", () => {
    expect(errorsOf(input(), false).join("\n")).toMatch(/9 soft-tissue structure\(s\) without a content file/);
  });
});

describe("validateSoftContent: rules", () => {
  it("rejects a file for an unknown ID, or in the wrong folder", () => {
    expect(errorsOf(input({}, { muscles: { nobody_left: file(muscle("nobody_left")) } }))).toContain("content/muscles/nobody_left.md: no such ID in content/soft-ids.json");
    expect(errorsOf(input({}, { muscles: { band_left: file(ligament("band_left")) } })).join()).toMatch(/move it to content\/ligaments/);
  });
  it("checks the name, side and kind against soft-ids.json", () => {
    expect(errorsOf(withMuscle("helper_left", muscle("helper_left", { name: "Helper" }))).join()).toMatch(/name is "Helper"; soft-ids.json says "helper"/);
  });
  it("checks the summary length per kind", () => {
    expect(errorsOf(withMuscle("helper_left", muscle("helper_left"), words(20))).join()).toMatch(/summary is 20 words \(40 to 80 for muscle\)/);
    expect(errorsOf(input({}, { muscles: { flexor_head_a_left: file(part("flexor_head_a_left"), words(10)) } })).join()).toMatch(/20 to 60 for muscle_part/);
    expect(errorsOf(input({}, { ligaments: { band_left: file(ligament("band_left"), words(30)) } })).join()).toMatch(/40 to 80 for ligament/);
  });
  it("rejects unknown structures, wrong-side references and bad landmarks", () => {
    const e = (origin: unknown) => errorsOf(withMuscle("helper_left", muscle("helper_left", { origin }))).join("\n");
    expect(e([{ structure: "bone_z_left" }])).toMatch(/origin\[0\] bone_z_left doesn't exist/);
    expect(e([{ structure: "bone_a_right" }])).toMatch(/origin\[0\] bone_a_right is on the other side/);
    expect(e([{ structure: "bone_a_left", landmark: "bottom" }])).toMatch(/bone_a_left has no landmark bottom/);
    expect(e([{ structure: "band_left", landmark: "top" }])).toMatch(/only bones have landmarks/);
    expect(e([{ soft: "fascia lata" }])).toBe("");
  });
  it("checks joints and movements against the vocabularies", () => {
    const e = (actions: unknown) => errorsOf(withMuscle("helper_left", muscle("helper_left", { actions }))).join("\n");
    expect(e([{ joint: "knee_left", movement: "flexion", role: "prime" }])).toMatch(/joint knee_left is in neither articulations.json nor joints.json/);
    expect(e([{ joint: "elbow_right", movement: "flexion", role: "prime" }])).toMatch(/joint elbow_right is on the other side/);
    expect(e([{ joint: "elbow_left", movement: "wiggling", role: "prime" }])).toMatch(/movement wiggling is not in movements.json/);
    expect(e([{ joint: "elbow_left", movement: "flexion", role: "hero" }])).toMatch(/actions\.0\.role/);
    expect(e([{ joint: "hinge_left", movement: "flexion", role: "prime" }])).toBe("");
  });
  it("needs functions when a muscle has no actions (spec §4.3)", () => {
    expect(errorsOf(withMuscle("helper_left", muscle("helper_left", { actions: [] }))).join()).toMatch(/actions is empty, so functions is required/);
    expect(errorsOf(withMuscle("helper_left", muscle("helper_left", { actions: [], functions: ["Moves the skin"] })))).toEqual([]);
  });
  it("checks parts against soft-ids.json both ways", () => {
    expect(errorsOf(input({}, { muscles: { flexor_left: file(muscle("flexor_left", { parts: ["flexor_head_a_left"], origin: [] })) } })).join()).toMatch(/parts are \[flexor_head_a_left\]/);
    expect(errorsOf(input({}, { muscles: { flexor_head_a_left: file(part("flexor_head_a_left", { parent: "helper_left" }), words(30)) } })).join()).toMatch(/parent is helper_left; soft-ids.json says flexor_left/);
  });
  it("needs an origin and an insertion on the muscle or its parts (spec §10)", () => {
    const noOrigin = input({}, {
      muscles: {
        flexor_head_a_left: file(part("flexor_head_a_left", { origin: "inherit" }), words(30)),
        flexor_head_b_left: file(part("flexor_head_b_left", { origin: "inherit" }), words(30)),
      },
    });
    const errs = errorsOf(noOrigin).join("\n");
    expect(errs).toMatch(/flexor_left: no origin on the muscle or any of its parts/);
    expect(errs).toMatch(/flexor_head_a_left: inherits the origin of flexor_left, which is empty/);
    expect(errorsOf(withMuscle("helper_left", muscle("helper_left", { insertion: [{ soft: "skin" }] })))).toEqual([]);
  });
  it("allows joint: null only for the listed ligaments (plan decision 3)", () => {
    expect(errorsOf(input({}, { ligaments: { band_left: file(ligament("band_left", { joint: null })) } })).join()).toMatch(/band isn't on the no-joint list/);
    expect(errorsOf(input({}, { ligaments: { inguinal_ligament_left: file(ligament("inguinal_ligament_left", { joint: null })) } }))).toEqual([]);
    expect(errorsOf(input({}, { cartilage: { pad_left: file(meniscus({ attachedTo: ["bone_q_left"] })) } })).join()).toMatch(/attachedTo\[0\] bone_q_left doesn't exist/);
  });
  it("needs a QUESTIONS.md entry for synergistOverrides", () => {
    const fm = muscle("helper_left", { synergistOverrides: { add: ["extensor_left"], remove: [] } });
    expect(errorsOf(withMuscle("helper_left", fm)).join()).toMatch(/needs a QUESTIONS.md entry/);
    expect(errorsOf({ ...withMuscle("helper_left", fm), questions: "99. helper: synergistOverrides adds the extensor" })).toEqual([]);
  });
  it("checks the muscle hierarchy (plan decision 8)", () => {
    const moved = errorsOf(withMuscle("helper_left", muscle("helper_left", { compartment: "back" }))).join();
    expect(moved).toMatch(/region\/compartment limb › back doesn't match its place in muscle-hierarchy.json \(limb › front\)/);
    const tree = [{ key: "limb", label: "Limb", children: [{ key: "front", label: "Front", children: ["flexor_left"] }, { key: "back", label: "Back", children: ["extensor_left", "extensor_left"] }] }];
    const errs = errorsOf(input({ muscleHierarchy: tree })).join("\n");
    expect(errs).toMatch(/muscle-hierarchy.json: helper_left is missing/);
    expect(errs).toMatch(/extensor_left appears twice/);
    const empty = [{ key: "limb", label: "Limb", children: [{ key: "front", label: "Front", children: ["flexor_left", "helper_left", "extensor_left"] }, { key: "side", label: "Side", children: [] }] }];
    expect(errorsOf(input({ muscleHierarchy: empty }), false).join()).toMatch(/side has no muscles/);
  });
  it("checks the right side is the mirror of the left", () => {
    const left = file(ligament("band_left"));
    const good = mirrorFile(left, "band_left", opposite);
    expect(good).toMatch(/joint: hinge_right/);
    expect(good).toMatch(/- bone_a_right/);
    expect(errorsOf(input({}, { ligaments: { band_right: good } }))).toEqual([]);
    expect(errorsOf(input({}, { ligaments: { band_right: good.replace("Holds", "Keeps") } })).join()).toMatch(/differs from the mirror of band_left.md/);
  });
  it("checks joints.json (plan decision 2)", () => {
    const joints = [
      { id: "elbow_left", name: "Elbow", side: "left", articulations: ["hinge_left", "wrist_left"] },
      { id: "knee_right", name: "Knee", side: "right", articulations: ["hinge_right", "pair2_right"] },
    ];
    const errs = errorsOf(input({ joints })).join("\n");
    expect(errs).toMatch(/joints.json elbow_left: wrist_left is not a joint in articulations.json/);
    expect(errs).toMatch(/joints.json elbow_left: no right-side twin/);
    expect(errs).toMatch(/joints.json knee_right: no left-side twin/);
  });
  it("checks every mesh has an entry and every entry with a mesh has a node", () => {
    const errs = errorsOf(input({ meshes: { "ligaments-low": ["band_left", "band_right", "ghost_left"] } })).join("\n");
    expect(errs).toMatch(/ligaments-low: mesh ghost_left is not in content\/soft-ids.json/);
    expect(errs).toMatch(/ligaments-low: no mesh for inguinal_ligament_left/);
  });
});

// --- Derived data (plan decision 9) ---
const D = (over: Partial<DeriveMuscle>): DeriveMuscle => ({ kind: "muscle", parent: null, parts: [], origin: [], insertion: [], actions: [], ...over });
const act = (joint: string, movement: string, role: "prime" | "assist" | "stabiliser" = "prime") => ({ joint, movement, role });
const fixture = derive({
  muscles: {
    flexor: D({ parts: ["flexor_a", "flexor_b"], insertion: [{ structure: "bone_b" }], actions: [act("elbow", "flexion")] }),
    flexor_a: D({ kind: "muscle_part", parent: "flexor", origin: [{ structure: "bone_a" }], insertion: "inherit" }),
    flexor_b: D({ kind: "muscle_part", parent: "flexor", origin: [{ structure: "bone_a" }], insertion: "inherit", actions: [act("shoulder", "flexion", "assist")] }),
    helper: D({ origin: [{ structure: "bone_a" }], insertion: [{ structure: "bone_c" }], actions: [act("hinge", "flexion", "assist")] }),
    extensor: D({ origin: [{ soft: "fascia" }], insertion: [{ structure: "bone_b" }], actions: [act("elbow", "extension")] }),
    steady: D({ actions: [act("elbow", "flexion", "stabiliser")] }),
    shoulder_flexor: D({ actions: [act("shoulder", "flexion")] }),
    other_joint: D({ actions: [act("knee", "flexion")] }),
  },
  pairJoints: ["hinge", "pair2", "shoulder", "knee"],
  functionalJoints: { elbow: ["hinge", "pair2"] },
  antagonistPairs: [["flexion", "extension"]],
});

describe("derive", () => {
  it("resolves joints: a pair is itself; a functional joint is its pairs; overlap is the same joint", () => {
    expect([...fixture.pairsOf("elbow")]).toEqual(["hinge", "pair2"]);
    expect(fixture.sameJoint("elbow", "hinge")).toBe(true);
    expect(fixture.sameJoint("hinge", "pair2")).toBe(false);
    expect(fixture.sameJoint("nowhere", "nowhere")).toBe(false);
  });
  it("gives a part its parent's actions plus its own", () => {
    expect(fixture.actionsOf("flexor_b").map((a) => `${a.joint}:${a.movement}`)).toEqual(["elbow:flexion", "shoulder:flexion"]);
  });
  it("finds synergists across a functional joint and its pairs, never in the same muscle", () => {
    expect(fixture.synergistsOf("helper")).toEqual(["flexor"]);
    expect(fixture.synergistsOf("flexor")).toEqual(["helper"]);
  });
  it("lists a part only when its own action matches", () => {
    expect(fixture.synergistsOf("shoulder_flexor")).toEqual(["flexor_b"]);
    expect(fixture.synergistsOf("flexor_a")).toEqual(["helper"]);
  });
  it("leaves stabilisers out", () => {
    expect(fixture.synergistsOf("steady")).toEqual([]);
    expect(fixture.synergistsOf("helper")).not.toContain("steady");
  });
  it("finds antagonists by the paired movement on the same joint", () => {
    expect(fixture.antagonistsOf("extensor")).toEqual(["flexor", "helper"]);
    expect(fixture.antagonistsOf("helper")).toEqual(["extensor"]);
    expect(fixture.antagonistsOf("other_joint")).toEqual([]);
  });
  it("lists each structure's attached muscles by their own declarations", () => {
    expect(fixture.attachedMuscles("bone_a")).toEqual({ origins: ["flexor_a", "flexor_b", "helper"], insertions: [] });
    expect(fixture.attachedMuscles("bone_b")).toEqual({ origins: [], insertions: ["extensor", "flexor"] });
    expect(fixture.attachedMuscles("bone_z")).toEqual({ origins: [], insertions: [] });
  });
  it("applies synergistOverrides last", () => {
    const d = derive({
      muscles: { a: D({ actions: [act("hinge", "flexion")], synergistOverrides: { add: ["c"], remove: ["b"] } }), b: D({ actions: [act("hinge", "flexion")] }), c: D({}) },
      pairJoints: ["hinge"],
      functionalJoints: {},
      antagonistPairs: [],
    });
    expect(d.synergistsOf("a")).toEqual(["c"]);
  });
});

describe("compileSoftLayer", () => {
  it("renders the summary and derives the muscles layer's relationships", () => {
    const i = input();
    const c = compileSoftLayer("muscles", i.files.muscles, {
      kindOf: (id) => SOFT.find((e) => e.id === id)?.kind,
      pairJoints: ["hinge_left", "pair2_left"],
      functionalJoints: { elbow_left: ["hinge_left", "pair2_left"] },
      antagonistPairs: [["flexion", "extension"]],
    });
    expect(c.entries.helper_left!.summary).toMatch(/^<p>word0 /);
    expect(c.entries.helper_left!.latin).toBe("Musculus testis");
    expect(c.derived!.synergists.helper_left).toEqual(["flexor_left"]);
    // head b lists its own (pair2) flexion, so it is named beside its muscle.
    expect(c.derived!.antagonists.extensor_left).toEqual(["flexor_head_b_left", "flexor_left", "helper_left"]);
    expect(c.derived!.attached.bone_a_left!.origins).toEqual(["extensor_left", "flexor_head_a_left", "flexor_head_b_left", "helper_left"]);
  });
  it("has no derived data for the other layers", () => {
    const c = compileSoftLayer("ligaments", input().files.ligaments, { kindOf: () => "ligament", pairJoints: [], functionalJoints: {}, antagonistPairs: [] });
    expect(c.derived).toBeNull();
    expect(Object.keys(c.entries)).toEqual(["band_left"]);
  });
});

// --- The real files ---
describe("real soft-tissue content", () => {
  it("mirrors joint IDs too", () => {
    const opp = makeOpposite();
    expect(opp("elbow_joint_left")).toBe("elbow_joint_right");
    expect(opp("knee_joint_right")).toBe("knee_joint_left");
    expect(opp("triceps_brachii_long_head_left")).toBe("triceps_brachii_long_head_right");
    expect(opp("humerus_left")).toBe("humerus_right");
    expect(opp("vertebral_column")).toBeNull();
  });
  it("derives jaw-closing synergists and jaw-opening antagonists (session Y)", () => {
    const m = compileSoftFromDisk("muscles");
    expect(m.derived!.synergists.temporalis_left).toEqual(expect.arrayContaining(["masseter_left", "medial_pterygoid_left"]));
    expect(m.derived!.synergists.temporalis_left).not.toContain("masseter_right");
    expect(m.derived!.antagonists.temporalis_left).toEqual(expect.arrayContaining(["digastric_left", "lateral_pterygoid_left"]));
    expect(m.derived!.attached.hyoid_bone!.insertions).toEqual(expect.arrayContaining(["digastric_intermediate_tendon_left", "sternohyoid_right"]));
  });
  it("derives trunk and girdle relationships through the functional joints (session Z)", () => {
    const m = compileSoftFromDisk("muscles");
    // Rib elevation: the costovertebral_joints set overlaps the scalenes' single pairs.
    expect(m.derived!.synergists.external_intercostal_left).toEqual(expect.arrayContaining(["scalenus_anterior_left", "levatores_breves_costarum_left"]));
    expect(m.derived!.antagonists.external_intercostal_left).toContain("internal_intercostal_left");
    // Scapular upward rotation: serratus anterior with trapezius; rhomboids oppose.
    expect(m.derived!.synergists.serratus_anterior_left).toContain("trapezius_left");
    expect(m.derived!.antagonists.serratus_anterior_left).toEqual(expect.arrayContaining(["rhomboid_major_left", "trapezius_transverse_part_left"]));
    // A part's own action: the clavicular head of pectoralis major flexes the shoulder, against latissimus dorsi.
    expect(m.derived!.antagonists.latissimus_dorsi_left).toContain("pectoralis_major_clavicular_head_left");
    expect(m.derived!.attached.vertebra_l2!.origins).toContain("diaphragm");
  });
  it("derives elbow, forearm and hand relationships (session AA, spec §10)", () => {
    const m = compileSoftFromDisk("muscles");
    const d = m.derived!;
    // Spec §10's own example: biceps synergists include brachialis; antagonists include triceps.
    expect(d.synergists.biceps_brachii_left).toEqual(expect.arrayContaining(["brachialis_left", "brachioradialis_left", "supinator_left"]));
    expect(d.synergists.biceps_brachii_left).not.toContain("brachialis_right");
    expect(d.antagonists.biceps_brachii_left).toEqual(expect.arrayContaining(["triceps_brachii_left", "pronator_quadratus_left"]));
    // Wrist: ulnar deviation (adduction) pairs the ulnar flexor and extensor; the radial extensors oppose.
    expect(d.synergists.flexor_carpi_ulnaris_left).toContain("extensor_carpi_ulnaris_left");
    expect(d.antagonists.flexor_carpi_ulnaris_left).toContain("extensor_carpi_radialis_longus_left");
    // Fingers: dorsal interossei abduct, palmar interossei adduct, across the MCP functional joint.
    expect(d.antagonists.dorsal_interossei_hand_left).toContain("palmar_interossei_left");
    // Attachments: the common flexor origin lists parts by their own ID; the lumbricals arise from a muscle.
    expect(d.attached.humerus_left!.origins).toEqual(
      expect.arrayContaining(["pronator_teres_superficial_head_left", "flexor_carpi_ulnaris_humeral_head_left", "flexor_carpi_radialis_left"]),
    );
    expect(d.attached.radius_right!.insertions).toEqual(expect.arrayContaining(["biceps_brachii_right", "supinator_right", "pronator_quadratus_right"]));
    expect(d.attached.flexor_digitorum_profundus_left!.origins).toContain("lumbrical_hand_left");
  });
  it("derives the triceps' attachments on the scapula, humerus and ulna", () => {
    const m = compileSoftFromDisk("muscles");
    expect(m.derived!.attached.scapula_left!.origins).toContain("triceps_brachii_long_head_left");
    expect(m.derived!.attached.humerus_right!.origins).toEqual(expect.arrayContaining(["triceps_brachii_lateral_head_right", "triceps_brachii_medial_head_right"]));
    expect(m.derived!.attached.ulna_left!.insertions).toContain("triceps_brachii_left");
  });
});

// --- The muscleAttachments migration matcher (plan decision 13) ---
import { matchAttachment, nameIndex } from "../scripts/content/attachment-match";
import { readSoftIds } from "../scripts/lib/content-files";

describe("matchAttachment", () => {
  const names = nameIndex(readSoftIds());
  it("matches source names exactly, case-insensitively", () => {
    expect(matchAttachment("Gluteus maximus", "femur_left", names)).toEqual({ ids: ["gluteus_maximus"], rule: "name" });
  });
  it("resolves heads to parts and grouped names to their muscles", () => {
    expect(matchAttachment("Biceps femoris (short head)", "femur_left", names).ids).toEqual(["biceps_femoris_short_head"]);
    expect(matchAttachment("Iliopsoas", "femur_left", names).ids).toEqual(["psoas_major", "iliacus"]);
  });
  it("picks the hand or foot muscle by the bone", () => {
    expect(matchAttachment("Abductor digiti minimi", "pisiform_left", names).ids).toEqual(["abductor_digiti_minimi_hand"]);
    expect(matchAttachment("Abductor digiti minimi", "calcaneus_left", names).ids).toEqual(["abductor_digiti_minimi_foot"]);
    expect(matchAttachment("Second dorsal interosseous", "metatarsal_2_left", names).ids).toEqual(["dorsal_interossei_foot"]);
  });
  it("marks attachments made through another structure as indirect", () => {
    expect(matchAttachment("Rectus abdominis (through its costal cartilage)", "rib_7_left", names)).toMatchObject({ ids: ["rectus_abdominis"], indirect: true });
  });
  it("reports muscles absent from the source as unmatched, with a question", () => {
    expect(matchAttachment("Stapedius", "stapes_left", names)).toMatchObject({ ids: [], rule: "unmatched", question: 70 });
    expect(matchAttachment("Musculus imaginarius", "femur_left", names).rule).toBe("unmatched");
  });
});
