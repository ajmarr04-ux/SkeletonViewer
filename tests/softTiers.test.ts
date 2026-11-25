// M9 session AF: tiers per kind (spec §5.2; plan decisions 3 to 5), on the real
// content. The equivalence test comes first: with only the bones layer on,
// every bone's tier sets are exactly M8's, whatever soft content is loaded.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { compileAllSoftFromDisk, makeOpposite } from "../scripts/lib/content-files";
import { relations } from "../src/content/relations";
import { softEntry } from "../src/content/softRegistry";
import { hasSoftTier2, registerSoftTiers, resetSoftTiers, reverseRelated, softRelated, softTiersLoaded } from "../src/content/softRelations";
import { jointScope } from "../src/content/softTiers";
import { type RawSoftId } from "../src/layers/softIds";
import { isolationView, relatedAt, sceneView, shownIn } from "../src/scene/isolation";
import { type LayerMode, type LayerModes } from "../src/state/url";
import { DEFAULT_MODES, LAYER_IDS } from "../src/systems/registry";

const RAW = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];
const BONES = ids as { id: string; meshAvailable: boolean }[];
const BONE_MESH = new Set(BONES.filter((e) => e.meshAvailable).map((e) => e.id));
const hasMesh = (id: string) => BONE_MESH.has(id) || softEntry(id)?.mesh === true;
const SOFT = compileAllSoftFromDisk();
const TIERS = { ...SOFT.muscles.tiers!.tiers, ...SOFT.ligaments.tiers!.tiers, ...SOFT.cartilage.tiers!.tiers };

const modes = (m: Partial<LayerModes>): LayerModes => ({ ...DEFAULT_MODES, ...m });
const ALL_ON = modes({ muscles: "on", ligaments: "on", cartilage: "on" });
/** M8's solid set for a bone (relations.visibleAt), as `isolationView` drew it before M9. */
const m8Solid = (id: string, tier: 0 | 1 | 2) => new Set(relations.visibleAt(id, tier).filter(hasMesh));
const solidOf = (sel: string, tier: 0 | 1 | 2, m: LayerModes) => isolationView(sel, tier, "ghost", hasMesh, null, undefined, undefined, m).solid;
const layerOf = (id: string) => (BONES.some((b) => b.id === id) ? "bones" : softEntry(id)?.layer);

afterAll(() => {
  resetSoftTiers();
});

describe("bones-only equivalence (risk 1: written first)", () => {
  const check = (m: LayerModes) => {
    for (const { id } of BONES)
      for (const tier of [0, 1, 2] as const) {
        const want = m8Solid(id, tier);
        const got = solidOf(id, tier, m);
        expect(got ?? new Set(), `${id} tier ${tier}`).toEqual(want.size === 0 ? new Set() : want);
      }
  };
  it("before any soft content is loaded", () => {
    resetSoftTiers();
    check(DEFAULT_MODES);
    check(ALL_ON); // nothing registered: no layer adds anything yet
  });
  it("with every layer's content loaded and only the bones layer on", () => {
    for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftTiers(l, SOFT[l].tiers);
    check(DEFAULT_MODES);
    check(modes({ muscles: "off", ligaments: "off", cartilage: "off" }));
  });
  it("the default modes of isolationView are M8's (bones only)", () => {
    expect(isolationView("femur_left", 1, "ghost", hasMesh).solid).toEqual(m8Solid("femur_left", 1));
  });
});

describe("tier sets on the real content (plan decision 4)", () => {
  beforeAll(() => {
    for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftTiers(l, SOFT[l].tiers);
  });

  it("every structure has tiers, and every ID they name is a bone or a soft structure", () => {
    expect(Object.keys(TIERS).sort()).toEqual(RAW.map((e) => e.id).sort());
    const known = new Set([...BONES.map((b) => b.id), ...RAW.map((e) => e.id)]);
    for (const [id, e] of Object.entries(TIERS)) {
      for (const x of [...e.t1, ...(e.t2 ?? [])]) expect(known.has(x), `${id} → ${x}`).toBe(true);
      expect(e.t1).not.toContain(id);
      expect(e.t2 ?? []).not.toContain(id);
      for (const x of e.t2 ?? []) expect(e.t1, `${id}: ${x} in both tiers`).not.toContain(x);
    }
    for (const l of ["muscles", "ligaments", "cartilage"] as const)
      for (const [s, list] of Object.entries(SOFT[l].tiers!.reverse)) for (const x of list) expect(known.has(x) && known.has(s)).toBe(true);
  });

  it("left and right mirror each other", () => {
    const opp = makeOpposite();
    const mirror = (xs: readonly string[]) => xs.map((x) => opp(x) ?? x).sort();
    for (const [id, e] of Object.entries(TIERS)) {
      const o = opp(id);
      if (!o) continue;
      const f = TIERS[o]!;
      expect(mirror(e.t1), id).toEqual([...f.t1].sort());
      expect(e.t2 === null ? null : mirror(e.t2), id).toEqual(f.t2 === null ? null : [...f.t2].sort());
    }
  });

  it("muscle: tier 1 is its parts and the structures of its own and its parts' attachments", () => {
    expect(softRelated("triceps_brachii_left", 1)).toEqual([
      "humerus_left",
      "scapula_left",
      "triceps_brachii_lateral_head_left",
      "triceps_brachii_long_head_left",
      "triceps_brachii_medial_head_left",
      "ulna_left",
    ]);
  });
  it("part: its own origin plus the inherited insertion (risk 4: scapula and ulna for the long head)", () => {
    expect(softRelated("triceps_brachii_long_head_left", 1)).toEqual(["scapula_left", "ulna_left"]);
  });
  it("muscle tier 2: + its synergists (a muscle with parts as its parts) and their tier-1 structures", () => {
    const t2 = softRelated("triceps_brachii_left", 2);
    expect(t2).toContain("anconeus_left");
    const t2long = softRelated("triceps_brachii_long_head_left", 2);
    expect(t2long).toEqual(expect.arrayContaining(["teres_major_left", "latissimus_dorsi_left", "pectoralis_major_clavicular_head_left", "pectoralis_major_sternocostal_head_left"]));
    expect(hasSoftTier2("triceps_brachii_left")).toBe(true);
  });
  it("ligament: tier 1 its `connects`, tier 2 the joint's other ligaments and cartilage (functional joint)", () => {
    expect(softRelated("anterior_cruciate_ligament_left", 1)).toEqual(["femur_left", "tibia_left"]);
    const t2 = softRelated("anterior_cruciate_ligament_left", 2);
    expect(t2).toEqual(expect.arrayContaining(["posterior_cruciate_ligament_left", "medial_meniscus_left", "lateral_meniscus_left"]));
    expect(t2.some((x) => x.endsWith("_right"))).toBe(false);
    // The shoulder girdle's functional joint joins the acromioclavicular and sternoclavicular joints.
    expect(softRelated("acromioclavicular_ligament_left", 2)).toEqual(expect.arrayContaining(["conoid_ligament_left", "articular_disc_sternoclavicular_joint_left"]));
  });
  it("cartilage: tier 1 its `attachedTo`, tier 2 as ligaments", () => {
    expect(softRelated("medial_meniscus_left", 1)).toEqual(["tibia_left", "tibial_collateral_ligament_deep_part_left"]);
    expect(softRelated("medial_meniscus_left", 2)).toContain("anterior_cruciate_ligament_left");
  });
  it("no joint, no tier 2 (costal cartilages 8–10, the allow-listed ligaments)", () => {
    for (const id of ["costal_cartilage_8_left", "costal_cartilage_10_right", "sacrotuberous_ligament_left", "nuchal_ligament"]) {
      expect(hasSoftTier2(id), id).toBe(false);
      expect(softRelated(id, 2), id).toEqual(softRelated(id, 1));
    }
  });
  it("reverse edges: a bone's attached muscles, connecting ligaments and attached cartilage", () => {
    const r = reverseRelated("scapula_left");
    expect(r).toEqual(expect.arrayContaining(["triceps_brachii_long_head_left", "acromioclavicular_ligament_left"]));
    // A muscle with parts declared on a bone stands for its parts (they have the meshes).
    expect(reverseRelated("ulna_left")).toEqual(expect.arrayContaining(["triceps_brachii_long_head_left", "triceps_brachii_medial_head_left"]));
    expect(reverseRelated("rib_8_left")).toContain("costal_cartilage_8_left");
  });
  it("jointScope: a pair inside a functional joint stands for the whole functional joint", () => {
    const scope = jointScope(["a", "b", "c", "d"], { fj: ["a", "b"] });
    expect([...scope("a")].sort()).toEqual(["a", "b"]);
    expect([...scope("fj")].sort()).toEqual(["a", "b"]);
    expect([...scope("c")]).toEqual(["c"]);
    expect(scope("nope").size).toBe(0);
  });
});

describe("layer filter (plan decision 3)", () => {
  beforeAll(() => {
    for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftTiers(l, SOFT[l].tiers);
  });
  const MODES: LayerMode[] = ["on", "ghost", "off"];
  const COMBOS: LayerModes[] = [];
  for (const b of MODES) for (const m of MODES) for (const l of MODES) for (const c of MODES) COMBOS.push({ bones: b, muscles: m, ligaments: l, cartilage: c });

  it("every addition comes from a layer that is On or Ghost; every related structure of those layers is in", () => {
    const samples = ["femur_left", "scapula_left", "triceps_brachii_left", "triceps_brachii_long_head_left", "anterior_cruciate_ligament_left", "medial_meniscus_left", "costal_cartilage_1_left"];
    for (const m of COMBOS)
      for (const id of samples)
        for (const tier of [1, 2] as const) {
          const got = relatedAt(id, tier, m);
          for (const x of got) expect(m[layerOf(x)!], `${id} t${tier} ${x}`).not.toBe("off");
          const all = relatedAt(id, tier, { bones: "on", muscles: "on", ligaments: "on", cartilage: "on" });
          expect(new Set(got)).toEqual(new Set(all.filter((x) => m[layerOf(x)!] !== "off")));
        }
  });
  it("a muscle's tier 1: bones with the skeleton on, none with it off; the focus always shows", () => {
    const on = solidOf("triceps_brachii_long_head_left", 1, modes({ muscles: "on" }))!;
    expect(on.has("scapula_left") && on.has("ulna_left")).toBe(true);
    expect(on.has("triceps_brachii_long_head_left")).toBe(true);
    const off = solidOf("triceps_brachii_long_head_left", 1, modes({ bones: "off", muscles: "on" }))!;
    expect([...off].filter((x) => layerOf(x) === "bones")).toEqual([]);
    expect(off.has("triceps_brachii_long_head_left")).toBe(true);
    // Even with its own layer Off (a stale URL): the focus is drawn.
    expect(solidOf("triceps_brachii_long_head_left", 1, modes({}))!.has("triceps_brachii_long_head_left")).toBe(true);
  });
  it("a bone's tier 1 gains its muscles with the muscles layer on (decision 3, bone half), none with it off", () => {
    const off = solidOf("scapula_left", 1, DEFAULT_MODES)!;
    expect(off).toEqual(m8Solid("scapula_left", 1));
    const on = solidOf("scapula_left", 1, modes({ muscles: "on" }))!;
    expect(on.has("triceps_brachii_long_head_left")).toBe(true);
    for (const b of m8Solid("scapula_left", 1)) expect(on.has(b)).toBe(true);
    expect([...on].some((x) => layerOf(x) === "ligaments")).toBe(false);
  });
  it("a bone's tier 2 gains the soft structures of every bone in its tier-2 set", () => {
    const t2 = new Set(relatedAt("humerus_left", 2, modes({ muscles: "on" })));
    for (const b of relations.visibleAt("humerus_left", 2)) for (const x of reverseRelated(b)) if (layerOf(x) === "muscles") expect(t2.has(x), `${b} → ${x}`).toBe(true);
  });
  it("related structures in a Ghost layer are drawn solid; the rest of that layer stays a ghost", () => {
    const m = modes({ muscles: "ghost" });
    const view = sceneView(isolationView("scapula_left", 1, "ghost", hasMesh, null, undefined, undefined, m), m);
    expect(shownIn(view, "muscles", "triceps_brachii_long_head_left")).toBe("solid");
    expect(shownIn(view, "muscles", "rectus_femoris_left")).toBe("ghost");
  });
  it("hidden structures stay hidden inside a related set", () => {
    const m = modes({ muscles: "on" });
    const view = sceneView(isolationView("scapula_left", 1, "ghost", hasMesh, null, undefined, undefined, m), m, new Set(["triceps_brachii_long_head_left"]));
    expect(shownIn(view, "muscles", "triceps_brachii_long_head_left")).toBe("hidden");
  });
  it("tiers are reported loaded per structure", () => {
    expect(softTiersLoaded("triceps_brachii_left")).toBe(true);
    expect(LAYER_IDS).toContain("muscles");
  });
});
