// M9 session AE: nested muscle → part selection (spec §5.1; plan decisions 1 and 2).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import hierarchy from "../content/muscle-hierarchy.json";
import { MUSCLE_REGION_LABELS, partLabel, softAnnouncement, softPanelModel } from "../src/content/softPanel";
import type { SoftLayerContent } from "../src/content/softCompile";
import { type RawSoftId } from "../src/layers/softIds";
import { maxPartsOf, NESTED_LAYER } from "../src/systems/registry";
import { isolationView, sceneView, shownIn } from "../src/scene/isolation";
import { FULL_SKELETON, isolationStep, levelOf, resolveClick, type Isolation, type IsolationAction, type ParentOf } from "../src/state/isolation";
import { DEFAULT_MODES } from "../src/systems/registry";

const RAW = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];

// Triceps (three heads), biceps (two heads) and a muscle without parts.
const PARENTS: Record<string, string> = {
  triceps_long: "triceps",
  triceps_lateral: "triceps",
  triceps_medial: "triceps",
  biceps_long: "biceps",
  biceps_short: "biceps",
};
const parentOf: ParentOf = (id) => PARENTS[id] ?? null;
const s = (sel: string, tier: 0 | 1 | 2 = 0): Isolation => ({ sel, tier, grp: null });

describe("resolveClick (spec §5.1 rules 1, 3 and 6)", () => {
  it("a part selects its whole muscle first", () => {
    expect(resolveClick("triceps_long", null, parentOf)).toBe("triceps");
    expect(resolveClick("triceps_long", "femur_left", parentOf)).toBe("triceps");
    expect(resolveClick("triceps_long", "biceps", parentOf)).toBe("triceps");
    expect(resolveClick("triceps_long", "biceps_short", parentOf)).toBe("triceps");
  });
  it("the part itself once its muscle or a sibling part is selected", () => {
    expect(resolveClick("triceps_long", "triceps", parentOf)).toBe("triceps_long");
    expect(resolveClick("triceps_long", "triceps_medial", parentOf)).toBe("triceps_long");
    expect(resolveClick("triceps_long", "triceps_long", parentOf)).toBe("triceps_long");
  });
  it("everything without a parent selects itself", () => {
    expect(resolveClick("femur_left", null, parentOf)).toBe("femur_left");
    expect(resolveClick("brachialis", "triceps", parentOf)).toBe("brachialis");
  });
});

describe("the reducer's part level (plan decision 2)", () => {
  type Row = [string, Isolation, IsolationAction, Isolation, string, Isolation?];
  const table: Row[] = [
    ["muscle → its part is a push", s("triceps"), { type: "select", id: "triceps_long" }, s("triceps_long"), "push"],
    ["part → sibling part is a replace", s("triceps_long"), { type: "select", id: "triceps_medial" }, s("triceps_medial"), "replace"],
    ["Back from a part goes to its muscle", s("triceps_long"), { type: "back" }, s("triceps"), "pop"],
    ["Back from the muscle goes to the full view", s("triceps"), { type: "back" }, FULL_SKELETON, "pop"],
    ["the muscle from its part (a Part of link) is Back", s("triceps_long"), { type: "select", id: "triceps" }, s("triceps"), "pop"],
    ["Back steps down the tiers first", s("triceps_long", 2), { type: "back" }, s("triceps_long", 1), "pop"],
    ["… to the part at tier 0", s("triceps_long", 1), { type: "back" }, s("triceps_long"), "pop"],
    ["a part from the full view goes via its muscle", FULL_SKELETON, { type: "select", id: "triceps_long" }, s("triceps_long"), "push", s("triceps")],
    ["a part from a bone at tier 0 replaces via its muscle", s("femur_left"), { type: "select", id: "triceps_long" }, s("triceps_long"), "replace", s("triceps")],
    ["a part from its muscle at tier 1 goes via the muscle at tier 0", s("triceps", 1), { type: "select", id: "triceps_long" }, s("triceps_long"), "push", s("triceps")],
    ["a part of another muscle goes via its muscle", s("biceps_long"), { type: "select", id: "triceps_long" }, s("triceps_long"), "replace", s("triceps")],
    ["a sibling from tier 1 goes via the muscle", s("triceps_medial", 1), { type: "select", id: "triceps_long" }, s("triceps_long"), "push", s("triceps")],
    ["muscles without parts behave like bones", s("triceps"), { type: "select", id: "brachialis" }, s("brachialis"), "replace"],
    ["the same part again changes nothing", s("triceps_long"), { type: "select", id: "triceps_long" }, s("triceps_long"), "none"],
  ];
  for (const [name, from, action, to, history, via] of table) {
    it(name, () => {
      const r = isolationStep(from, action, parentOf);
      expect(r.state).toEqual(to);
      expect(r.history).toBe(history);
      expect(r.via).toEqual(via);
    });
  }

  it("levels: a part is one deeper than its muscle; pops go up one, replaces stay", () => {
    expect(levelOf(s("triceps"), parentOf)).toBe(1);
    expect(levelOf(s("triceps_long"), parentOf)).toBe(2);
    expect(levelOf(s("triceps_long", 2), parentOf)).toBe(4);
    for (const [, from, action] of table) {
      const r = isolationStep(from, action, parentOf);
      const d = levelOf(r.state, parentOf) - levelOf(r.via ?? from, parentOf);
      if (r.history === "pop") expect(d).toBe(-1);
      if (r.history === "replace" && !r.via) expect(d).toBe(0);
      if (r.via) expect(levelOf(r.state, parentOf) - levelOf(r.via, parentOf)).toBe(1); // the part's own push
    }
  });

  it("bones keep their M8 behaviour without a parentOf", () => {
    expect(isolationStep(s("femur_left"), { type: "back" })).toEqual({ state: FULL_SKELETON, history: "pop" });
    expect(isolationStep(FULL_SKELETON, { type: "select", id: "femur_left" })).toEqual({ state: s("femur_left"), history: "push" });
  });
});

describe("views, panel and announcements with the real table", () => {
  const meshes = new Set(RAW.filter((e) => e.meshAvailable).map((e) => e.id));
  const hasMesh = (id: string) => meshes.has(id) || id === "femur_left";
  const heads = ["triceps_brachii_lateral_head_left", "triceps_brachii_long_head_left", "triceps_brachii_medial_head_left"];

  it("no muscle has more parts than the outlines cover", () => {
    expect(Math.max(...RAW.map((e) => e.parts?.length ?? 0))).toBeLessThanOrEqual(maxPartsOf(NESTED_LAYER));
  });

  it("a muscle with parts is drawn as its parts, all focused (rule 1)", () => {
    const v = isolationView("triceps_brachii_left", 0, "ghost", hasMesh);
    expect(v.focus).toBe("triceps_brachii_left");
    expect([...v.focusIds].sort()).toEqual(heads);
    expect([...v.solid!].sort()).toEqual(heads);
    const scene = sceneView(v, { ...DEFAULT_MODES, muscles: "on" });
    for (const h of heads) expect(shownIn(scene, "muscles", h)).toBe("solid");
  });

  it("a selected part is the only focus; its siblings stay solid in the muscle colour (rule 2)", () => {
    const v = isolationView("triceps_brachii_long_head_left", 0, "ghost", hasMesh);
    expect(v.focusIds).toEqual(["triceps_brachii_long_head_left"]);
    expect([...v.solid!].sort()).toEqual(heads);
  });

  it("the breadcrumb trail: region once the content is loaded, the part's short name", () => {
    const content = { entries: { triceps_brachii_left: { fm: { region: ["upper_limb", "arm"] } } }, derived: null } as unknown as SoftLayerContent;
    const part = softPanelModel("triceps_brachii_long_head_left", content)!;
    expect(part.trail).toEqual(["Muscles", "Upper limb", "Triceps brachii", "Long head"]);
    expect(part.parentCrumb).toBe(2);
    expect(softPanelModel("triceps_brachii_long_head_left")!.trail).toEqual(["Muscles", "Triceps brachii", "Long head"]);
    const muscle = softPanelModel("triceps_brachii_left", content)!;
    expect(muscle.trail).toEqual(["Muscles", "Upper limb", "Triceps brachii"]);
    expect(muscle.parentCrumb).toBeNull();
    expect(muscle.meshAvailable).toBe(true); // drawn through its parts, so it can be hidden
    expect(softPanelModel("inguinal_ligament_left")!.trail).toEqual(["Ligaments", "Inguinal ligament"]);
  });

  it("a muscle with parts is announced as isolated", () => {
    expect(softAnnouncement("triceps_brachii_left")).toBe("Triceps brachii, left, selected. Isolated.");
  });
});

describe("crumb labels", () => {
  it("region labels match content/muscle-hierarchy.json", () => {
    expect(Object.fromEntries((hierarchy as { key: string; label: string }[]).map((r) => [r.key, r.label]))).toEqual(MUSCLE_REGION_LABELS);
  });
  it("a part's name without 'of <muscle>'", () => {
    expect(partLabel("Long head of triceps brachii", "Triceps brachii")).toBe("Long head");
    expect(partLabel("Calcaneal tendon", "Gastrocnemius")).toBe("Calcaneal tendon");
    expect(partLabel("Epicranial aponeurosis", "Occipitofrontalis")).toBe("Epicranial aponeurosis");
  });
});
