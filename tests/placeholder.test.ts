import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { groupTrail, regionLabel } from "../src/content/labels";
import { relations } from "../src/content/relations";
import { announcement, NO_MODEL_NOTE, NOT_WRITTEN, oppositeOf, panelModel, SECTION_TITLES, type IdEntry } from "../src/content/placeholder";
import { nearestSnap, nextSnap, PEEK_PX, snapHeights } from "../src/ui/InfoPanel";
import { boxCentre, fitDistance, frameBeside, frameFrom, FOV_DEG, NO_PANEL, panelFractions, panelOffset, type Box } from "../src/camera/math";

const ENTRIES = ids as IdEntry[];

describe("placeholder panel content", () => {
  it("every ID has a panel model with the spec §7 sections, all unwritten", () => {
    for (const e of ENTRIES) {
      const m = panelModel(e.id)!;
      expect(m, e.id).not.toBeNull();
      expect(m.name).toBe(e.name);
      expect(m.latin).toBeNull();
      expect(m.common).toBeNull();
      expect(m.badges.draft).toBe(true);
      expect(m.sections.map((s) => s.title)).toEqual([...SECTION_TITLES]);
      expect(m.sections.every((s) => s.text === NOT_WRITTEN)).toBe(true);
      expect(m.trail[m.trail.length - 1]).toBe(e.name);
      expect(m.badges.region).not.toBe("");
    }
  });

  it("flags exactly the four wisdom teeth as having no model", () => {
    const noModel = ENTRIES.filter((e) => panelModel(e.id)!.note !== null).map((e) => e.id);
    expect(noModel.sort()).toEqual(["tooth_18", "tooth_28", "tooth_38", "tooth_48"]);
    expect(panelModel("tooth_18")!.note).toBe(NO_MODEL_NOTE);
    expect(panelModel("tooth_18")!.meshAvailable).toBe(false);
  });

  it("returns null for an unknown ID", () => {
    expect(panelModel("not_a_bone")).toBeNull();
  });

  it("badges: region and bone or tooth type", () => {
    expect(panelModel("femur_left")!.badges).toEqual({ region: "Lower limb", type: "Bone", draft: true });
    expect(panelModel("tooth_16")!.badges).toMatchObject({ region: "Teeth", type: "Molar" });
    expect(panelModel("tooth_13")!.badges).toMatchObject({ type: "Canine" });
  });
});

describe("opposite side", () => {
  it("every left/right object has exactly one opposite, which points back", () => {
    const lateral = ENTRIES.filter((e) => e.side !== "midline");
    expect(lateral.length).toBe(204);
    const seen = new Set<string>();
    for (const e of lateral) {
      const o = oppositeOf(e.id);
      expect(o, e.id).not.toBeNull();
      const oe = ENTRIES.find((x) => x.id === o)!;
      expect(oe.side).toBe(e.side === "left" ? "right" : "left");
      expect(oe.kind).toBe(e.kind);
      expect(oppositeOf(o!)).toBe(e.id);
      expect(seen.has(o!), `${o} claimed twice`).toBe(false);
      seen.add(o!);
    }
  });

  it("midline objects have none", () => {
    for (const e of ENTRIES.filter((x) => x.side === "midline")) expect(oppositeOf(e.id), e.id).toBeNull();
  });

  it("pairs examples: femur, teeth (FDI quadrants), wisdom teeth", () => {
    expect(oppositeOf("femur_left")).toBe("femur_right");
    expect(oppositeOf("tooth_13")).toBe("tooth_23");
    expect(oppositeOf("tooth_36")).toBe("tooth_46");
    expect(oppositeOf("tooth_18")).toBe("tooth_28");
    expect(panelModel("femur_right")!.pair).toEqual({ left: "femur_left", right: "femur_right" });
    expect(panelModel("sternum")!.pair).toBeNull();
  });
});

describe("labels and breadcrumb", () => {
  it("skips axial/appendicular and labels each level", () => {
    expect(groupTrail(["appendicular", "lower_limb"])).toEqual(["Lower limb"]);
    expect(groupTrail(["axial", "vertebral_column", "cervical"])).toEqual(["Vertebral column", "Cervical vertebrae"]);
    expect(groupTrail(["dentition", "upper", "right", "molars"])).toEqual(["Teeth", "Upper right", "Molars"]);
    expect(panelModel("femur_left")!.trail).toEqual(["Lower limb", "Femur"]);
  });

  it("every group segment in ids.json has a label (no raw IDs shown)", () => {
    for (const e of ENTRIES) {
      for (const label of groupTrail(e.group)) expect(label, e.id).not.toMatch(/_/);
      expect(regionLabel(e.group)).not.toBe("Skeleton");
    }
  });
});

describe("announcements (aria-live)", () => {
  it("names the bone, side and isolation", () => {
    expect(announcement({ sel: "femur_left", tier: 0 })).toBe("Femur, left, selected. Isolated.");
    expect(announcement({ sel: "sternum", tier: 0 })).toBe("Sternum, selected. Isolated.");
    expect(announcement({ sel: "tooth_13", tier: 0 })).toBe("Upper right canine, selected. Isolated.");
    expect(announcement({ sel: "tooth_18", tier: 0 })).toMatch(/No 3D model/);
    expect(announcement({ sel: null, tier: 0 })).toBe("Full skeleton");
  });
  it("names the related bones and the region (tiers 1 and 2)", () => {
    const rel = (id: string) => relations.tier1(id);
    expect(announcement({ sel: "femur_left", tier: 1 }, null, rel)).toBe("Femur, left: related bones shown. Hip bone, patella, tibia.");
    expect(announcement({ sel: "hip_bone_left", tier: 1 }, null, rel)).toBe(
      "Hip bone, left: related bones shown. Sacrum, hip bone (right), femur.",
    );
    expect(announcement({ sel: "rib_5_left", tier: 1 }, null, rel)).toBe("Rib 5, left: related bones shown. T4 vertebra, T5 vertebra, sternum.");
    expect(announcement({ sel: "hyoid_bone", tier: 1 }, null, rel)).toBe("Hyoid bone: related bones shown. None.");
    expect(announcement({ sel: "femur_left", tier: 2 }, null, rel, 8)).toBe("Femur, left: region shown, 8 bones.");
    expect(announcement({ sel: "femur_left", tier: 0 }, { sel: "femur_left", tier: 1 })).toBe("Femur, left, isolated.");
    expect(announcement({ sel: "tibia_left", tier: 0 }, { sel: "femur_left", tier: 1 })).toBe("Tibia, left, selected. Isolated.");
  });
});

describe("bottom sheet snaps", () => {
  it("peek, half and full heights for a phone", () => {
    expect(snapHeights(844)).toEqual({ peek: PEEK_PX, half: 422, full: 796 });
  });
  it("snaps a drag to the nearest point and taps cycle", () => {
    const h = snapHeights(844);
    expect(nearestSnap(100, h)).toBe("peek");
    expect(nearestSnap(380, h)).toBe("half");
    expect(nearestSnap(700, h)).toBe("full");
    expect(nextSnap("peek")).toBe("half");
    expect(nextSnap("half")).toBe("full");
    expect(nextSnap("full")).toBe("peek");
  });
});

describe("framing beside the info panel", () => {
  const box: Box = { min: [-0.05, 0.4, -0.05], max: [0.05, 0.9, 0.05] };
  const dir: [number, number, number] = [0, 0, 1];
  const W = 1280;
  const H = 800;
  const hf = 0.875;

  it("without a panel, it is frameFrom", () => {
    const a = frameBeside(box, dir, FOV_DEG, W, H, hf, NO_PANEL);
    const b = frameFrom(box, dir, FOV_DEG, W / H, hf);
    expect(a).toEqual(b);
  });

  it("a right panel shifts the bone left by half the panel width, at the right scale", () => {
    const inset = { right: 372, bottom: 0 };
    const cam = frameBeside(box, dir, FOV_DEG, W, H, hf, inset);
    expect(cam.target).toEqual(boxCentre(box));
    const depth = cam.position[2] - cam.target[2];
    const mpp = (2 * depth * Math.tan((FOV_DEG * Math.PI) / 360)) / H;
    expect(cam.offset![0]).toBeCloseTo((372 / 2) * mpp, 9);
    expect(cam.offset![1]).toBeCloseTo(0, 12);
    // Fits in the narrower area: at least as far back as without the panel.
    expect(depth).toBeGreaterThanOrEqual(fitDistance(box, boxCentre(box), dir, FOV_DEG, W / H, undefined, hf) - 1e-12);
  });

  it("a bottom sheet moves the bone up; the breadcrumb moves it down", () => {
    const up = panelOffset({ right: 0, bottom: 200 }, 1, FOV_DEG, 390, 844, 0.88);
    expect(up[0]).toBe(0);
    expect(up[1]).toBeLessThan(0); // eye goes down, picture goes up
    const both = panelOffset({ right: 0, bottom: 200, top: 56 }, 1, FOV_DEG, 390, 844, 0.88);
    expect(both[1]).toBeGreaterThan(up[1]);
    const mpp = (2 * Math.tan((FOV_DEG * Math.PI) / 360)) / 844;
    expect(both[1]).toBeCloseTo(-((200 - 56) / 2) * mpp, 12);
  });

  it("never leaves less than 35% of the view to frame in", () => {
    const f = panelFractions({ right: 5000, bottom: 5000 }, 1000, 800, 0.9);
    expect(f.w).toBeCloseTo(0.35);
    expect(f.h).toBeCloseTo(0.35 * 0.9);
  });
});
