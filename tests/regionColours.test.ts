import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { GROUPS } from "../src/content/groups";
import { contrastRatio, deltaE2000, parseHex, REGIONS, regionColour, regionOf, simulateCvd, toLab, type Rgb } from "../src/scene/regionColours";

/** Minimum CIEDE2000 between any two region colours, with and without simulated CVD. */
const MIN_DELTA_E = 8;

describe("colour-by-region", () => {
  it("gives every object a region, and each region is a group of the tree", () => {
    for (const e of ids as { id: string }[]) expect(regionOf(e.id), e.id).toBeDefined();
    for (const r of REGIONS) expect(GROUPS.has(r.group), r.group).toBe(true);
    const members = new Set(REGIONS.flatMap((r) => GROUPS.get(r.group)!.members));
    expect(members.size).toBe((ids as unknown[]).length);
    expect(regionOf("femur_left")).toBe("lower_limb");
    expect(regionOf("malleus_left")).toBe("skull");
    expect(regionOf("hyoid_bone")).toBe("skull");
    expect(regionOf("sternum")).toBe("thorax");
    expect(regionOf("tooth_36")).toBe("teeth");
  });

  it("CIEDE2000 matches the published reference pairs (Sharma 2005)", () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, -1.3802, -84.2814], [50, 0, -82.7485])).toBeCloseTo(1.0, 3);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
  });

  for (const kind of [null, "deuteranopia", "protanopia"] as const) {
    it(`keeps every pair of regions apart (ΔE2000 ≥ ${MIN_DELTA_E}) ${kind ? `with ${kind}` : "with normal vision"}`, () => {
      const seen = REGIONS.map((r) => {
        const c = parseHex(regionColour(r.region));
        return { name: r.name, lab: toLab(kind ? simulateCvd(c, kind) : c) };
      });
      for (let i = 0; i < seen.length; i++) {
        for (let j = i + 1; j < seen.length; j++) {
          const d = deltaE2000(seen[i]!.lab, seen[j]!.lab);
          expect(d, `${seen[i]!.name} / ${seen[j]!.name}`).toBeGreaterThanOrEqual(MIN_DELTA_E);
        }
      }
    });
  }

  it("legend swatches keep 3:1 contrast against the legend background", () => {
    const bg: Rgb = parseHex("#202328");
    for (const r of REGIONS) expect(contrastRatio(parseHex(regionColour(r.region)), bg), r.name).toBeGreaterThanOrEqual(3);
  });
});
