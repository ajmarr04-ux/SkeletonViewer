import { describe, expect, it } from "vitest";
import articulations from "../content/articulations.json";
import ids from "../content/ids.json";
import { oppositeOf } from "../src/content/placeholder";
import { appGraph } from "../src/content/appGraph";
import { EAGER_ONLY, relatedAt } from "../src/scene/isolation";
import { adjacentTeeth } from "../src/systems/musculoskeletal/bones/teeth";

// M12 BC: the bones' tiers come from their tier rules over the graph (was src/content/relations.ts); with only bones showing they are M8's sets.
const relations = {
  tier1: (id: string) => relatedAt(id, 1, EAGER_ONLY),
  regionOf: (id: string) => relatedAt(id, 2, EAGER_ONLY).filter((x) => !relatedAt(id, 1, EAGER_ONLY).includes(x)),
  visibleAt: (id: string, tier: 0 | 1 | 2) => [id, ...relatedAt(id, tier, EAGER_ONLY)],
  articulationsOf: (id: string) =>
    appGraph()
      .out(id, "articulates_with")
      .map((e) => ({ joint: e.meta?.joint, other: e.from === id ? e.to : e.from })),
};

const sorted = (a: string[]) => [...a].sort();
const ALL = (ids as { id: string; side: string }[]).map((e) => e.id);

describe("tier sets (spec §6)", () => {
  it("matches the femur worked example", () => {
    expect(sorted(relations.tier1("femur_left"))).toEqual(sorted(["hip_bone_left", "patella_left", "tibia_left"]));
    expect(sorted(relations.regionOf("femur_left"))).toEqual(sorted(["sacrum", "coccyx", "hip_bone_right", "fibula_left"]));
    expect(relations.tier1("femur_left")).not.toContain("fibula_left");
    expect(relations.visibleAt("femur_left", 0)).toEqual(["femur_left"]);
    expect(relations.visibleAt("femur_left", 2)).toHaveLength(8);
    expect(relations.visibleAt("femur_left", 2)[0]).toBe("femur_left");
  });

  it("spot checks per region", () => {
    expect(sorted(relations.tier1("vertebra_c1"))).toEqual(["occipital_bone", "vertebra_c2"]);
    expect(sorted(relations.tier1("rib_5_left"))).toEqual(["sternum", "vertebra_t4", "vertebra_t5"]);
    expect(sorted(relations.tier1("rib_12_right"))).toEqual(["vertebra_t12"]);
    expect(sorted(relations.tier1("stapes_left"))).toEqual(["incus_left", "temporal_bone_left"]);
    expect(sorted(relations.tier1("pisiform_right"))).toEqual(["triquetrum_right"]);
    expect(sorted(relations.tier1("scaphoid_left"))).toEqual(
      sorted(["radius_left", "lunate_left", "trapezium_left", "trapezoid_left", "capitate_left"]),
    );
    expect(sorted(relations.tier1("talus_left"))).toEqual(sorted(["tibia_left", "fibula_left", "calcaneus_left", "navicular_left"]));
    expect(relations.tier1("hyoid_bone")).toEqual([]);
  });

  it("teeth: alveolar bone plus the neighbours in the arch", () => {
    expect(sorted(relations.tier1("tooth_11"))).toEqual(["maxilla_right", "tooth_12", "tooth_21"]);
    expect(sorted(relations.tier1("tooth_23"))).toEqual(["maxilla_left", "tooth_22", "tooth_24"]);
    expect(sorted(relations.tier1("tooth_38"))).toEqual(["mandible", "tooth_37"]);
    expect(sorted(relations.tier1("tooth_41"))).toEqual(["mandible", "tooth_31", "tooth_42"]);
    expect(adjacentTeeth("femur_left")).toEqual([]);
    // Tier 2 for a tooth: the whole skull and both arches.
    const t2 = new Set(relations.visibleAt("tooth_36", 2));
    for (const id of ["frontal_bone", "mandible", "maxilla_right", "tooth_11", "tooth_48", "sphenoid_bone"]) expect(t2.has(id)).toBe(true);
  });

  it("is symmetric: a pair is found from both sides", () => {
    for (const a of articulations) {
      expect(relations.tier1(a.a)).toContain(a.b);
      expect(relations.tier1(a.b)).toContain(a.a);
      expect(relations.articulationsOf(a.b).find((x) => x.joint === a.joint)?.other).toBe(a.a);
    }
  });

  it("left and right tier sets mirror each other", () => {
    const flip = (id: string) => oppositeOf(id) ?? id;
    for (const id of ALL) {
      const o = oppositeOf(id);
      if (o === null) continue;
      expect(sorted(relations.tier1(o)), id).toEqual(sorted(relations.tier1(id).map(flip)));
      expect(sorted(relations.regionOf(o)), id).toEqual(sorted(relations.regionOf(id).map(flip)));
    }
  });

});
