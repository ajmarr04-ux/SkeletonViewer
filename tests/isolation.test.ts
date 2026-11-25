import { describe, expect, it } from "vitest";
import { FULL_SKELETON, isolationStep, levelOf, type Isolation, type IsolationAction } from "../src/state/isolation";

const s = (sel: string | null, tier: 0 | 1 | 2 = 0): Isolation => ({ sel, tier, grp: null, reg: null });
const g = (grp: string): Isolation => ({ sel: null, tier: 0, grp, reg: null });

describe("isolation reducer (spec §6 state diagram)", () => {
  const table: [string, Isolation, IsolationAction, Isolation, string][] = [
    ["select from the full skeleton", FULL_SKELETON, { type: "select", id: "femur_left" }, s("femur_left"), "push"],
    ["select the same bone again", s("femur_left"), { type: "select", id: "femur_left" }, s("femur_left"), "none"],
    ["select the focus again at tier 1", s("femur_left", 1), { type: "select", id: "femur_left" }, s("femur_left", 1), "none"],
    ["switch side at tier 2 keeps the tier", s("femur_left", 2), { type: "switchSide", id: "femur_right" }, s("femur_right", 2), "replace"],
    ["switch side at tier 0", s("femur_left"), { type: "switchSide", id: "femur_right" }, s("femur_right"), "replace"],
    ["switch side to the same bone", s("femur_left", 1), { type: "switchSide", id: "femur_left" }, s("femur_left", 1), "none"],
    ["switch side from the full skeleton selects", FULL_SKELETON, { type: "switchSide", id: "femur_right" }, s("femur_right"), "push"],
    ["switch focus at tier 0", s("femur_left"), { type: "select", id: "tibia_left" }, s("tibia_left"), "replace"],
    ["new focus from tier 1", s("femur_left", 1), { type: "select", id: "tibia_left" }, s("tibia_left"), "push"],
    ["new focus from tier 2", s("femur_left", 2), { type: "select", id: "tibia_left" }, s("tibia_left"), "push"],
    ["show related", s("femur_left"), { type: "related" }, s("femur_left", 1), "push"],
    ["expand region", s("femur_left", 1), { type: "region" }, s("femur_left", 2), "push"],
    ["related with nothing selected", FULL_SKELETON, { type: "related" }, FULL_SKELETON, "none"],
    ["region from tier 0", s("femur_left"), { type: "region" }, s("femur_left"), "none"],
    ["back from tier 2", s("femur_left", 2), { type: "back" }, s("femur_left", 1), "pop"],
    ["back from tier 1", s("femur_left", 1), { type: "back" }, s("femur_left"), "pop"],
    ["back from tier 0", s("femur_left"), { type: "back" }, FULL_SKELETON, "pop"],
    ["back at the full skeleton", FULL_SKELETON, { type: "back" }, FULL_SKELETON, "none"],
    ["isolate a group", FULL_SKELETON, { type: "group", key: "axial.skull.ossicles" }, g("axial.skull.ossicles"), "push"],
    ["the same group again", g("axial.skull.ossicles"), { type: "group", key: "axial.skull.ossicles" }, g("axial.skull.ossicles"), "none"],
    ["another group from a group", g("axial.skull.ossicles"), { type: "group", key: "dentition.type.molars" }, g("dentition.type.molars"), "replace"],
    ["a group from a selection", s("femur_left", 2), { type: "group", key: "dentition.type.molars" }, g("dentition.type.molars"), "push"],
    ["a member from a group", g("dentition.type.molars"), { type: "select", id: "tooth_36" }, s("tooth_36"), "push"],
    ["back from a group", g("dentition.type.molars"), { type: "back" }, FULL_SKELETON, "pop"],
    ["no tiers for a group", g("dentition.type.molars"), { type: "related" }, g("dentition.type.molars"), "none"],
  ];
  for (const [name, from, action, to, history] of table) {
    it(name, () => {
      const r = isolationStep(from, action);
      expect(r.state).toEqual(to);
      expect(r.history).toBe(history);
    });
  }

  it("pop goes back one level, replace keeps the level", () => {
    for (const [, from, action] of table) {
      const r = isolationStep(from, action);
      const d = levelOf(r.state) - levelOf(from);
      if (r.history === "pop") expect(d).toBe(-1);
      if (r.history === "replace" || r.history === "none") expect(d).toBe(0);
    }
  });
});
