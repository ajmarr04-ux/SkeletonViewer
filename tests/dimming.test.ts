// M14 BY (plan decision 9; SPEC-platform §7.3): context dimming. Which
// structures dim for a selection at each tier with every layer on, on the real
// content; the colour rule itself; and that the batch colour pass writes it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BatchedMesh, BoxGeometry, Color, MeshStandardMaterial, Vector4 } from "three";
import ids from "../content/ids.json";
import { compileAllSoftFromDisk } from "../scripts/lib/content-files";
import { softEntry, softLayerOf } from "../src/content/softRegistry";
import { resetAppGraph } from "../src/content/appGraph";
import { registerSoftContent, resetSoftContent } from "../src/content/softContentLoader";
import { applyLayerView, viewOf } from "../src/scene/isolation";
import { desaturate, dimAmount, dimHex, dimmedIn, dimTint } from "../src/scene/dimming";
import type { BatchedSkeleton } from "../src/scene/batchSkeleton";
import { type LayerModes } from "../src/state/url";
import { LAYER_IDS, layerColour } from "../src/systems/registry";

const BONES = ids as { id: string; meshAvailable: boolean }[];
const BONE_MESH = new Set(BONES.filter((e) => e.meshAvailable).map((e) => e.id));
const hasMesh = (id: string) => BONE_MESH.has(id) || softEntry(id)?.mesh === true;
const SOFT = compileAllSoftFromDisk();
const ALL_ON = Object.fromEntries(LAYER_IDS.map((l) => [l, "on"])) as LayerModes;
const layerOf = (id: string) => (BONE_MESH.has(id) ? "bones" : softLayerOf(id));

const view = (sel: string | null, tier: 0 | 1 | 2, extra: { antagonists?: boolean; colourMode?: "bone" | "region"; joint?: { a: string; b: string } | null } = {}) =>
  viewOf(
    { sel, tier, ghostMode: "ghost", grp: null, joint: extra.joint ?? null, layers: ALL_ON, hidden: new Set(), antagonists: extra.antagonists, colourMode: extra.colourMode },
    hasMesh,
    () => new Set(),
  );

beforeAll(() => {
  for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftContent(l, SOFT[l]);
});
afterAll(() => {
  resetSoftContent();
  resetAppGraph();
});

describe("which structures dim (plan decision 9, amounts from BW)", () => {
  it("only the muscles have a dim amount (35 %)", () => {
    expect(Object.fromEntries(LAYER_IDS.map((l) => [l, dimAmount(l)]))).toEqual({ bones: 0, cartilage: 0, ligaments: 0, muscles: 0.35 });
  });

  it("a bone at tier 1 and 2 with every layer on: exactly its related muscles dim; bones, ligaments and cartilage don't", () => {
    for (const tier of [1, 2] as const) {
      const v = view("femur_left", tier);
      const solidMuscles = [...v.layers.muscles.solid!].filter((id) => layerOf(id) === "muscles");
      expect(solidMuscles.length).toBeGreaterThan(10);
      expect([...v.dimmed].sort()).toEqual(solidMuscles.sort());
      expect(v.dimmed.has("vastus_lateralis_left")).toBe(true);
      expect([...v.dimmed].some((id) => layerOf(id) !== "muscles")).toBe(false);
    }
  });

  it("a muscle at tier 1 and 2 (antagonists on): nothing dims, since its related bones, ligaments and cartilage have no amount", () => {
    for (const tier of [1, 2] as const) {
      const v = view("biceps_brachii_left", tier, { antagonists: true });
      expect(v.tints.size).toBeGreaterThan(0);
      expect(v.dimmed.size).toBe(0);
    }
  });

  it("a ligament at tier 1: its related muscles dim, the ligament (focus) doesn't", () => {
    const v = view("tibial_collateral_ligament_superficial_part_left", 1);
    expect([...v.dimmed].every((id) => layerOf(id) === "muscles")).toBe(true);
    expect(v.dimmed.has("tibial_collateral_ligament_superficial_part_left")).toBe(false);
  });

  it("off with no selection, at tier 0 and while colour-by-region is drawn", () => {
    expect(view(null, 0).dimmed.size).toBe(0);
    expect(view("femur_left", 0).dimmed.size).toBe(0);
    expect(view("femur_left", 1, { colourMode: "region" }).dimmed.size).toBe(0);
    // A muscle's tints pause colour-by-region, so the view is drawn in the plain colours: dimming may run (nothing dims for a muscle anyway).
    expect(view("femur_left", 1, { colourMode: "bone" }).dimmed.size).toBeGreaterThan(0);
  });

  it("the focus layer's own structures, tints and a highlighted joint's structures never dim", () => {
    const solid = new Set(["a", "b", "c", "d", "e"]);
    const layer = (id: string) => (id === "a" ? "bones" : "muscles") as never;
    const amount = () => 0.5;
    expect([...dimmedIn({ solid, focusIds: ["a"], joint: ["d"], tints: new Map([["c", "origin"]]) }, "bones" as never, layer, true, amount)].sort()).toEqual(["b", "e"]);
    // A muscle focus: the other muscles are its own layer, so only the bone dims.
    expect([...dimmedIn({ solid, focusIds: ["b"], joint: [] }, "muscles" as never, layer, true, amount)]).toEqual(["a"]);
    // Off: nothing.
    expect(dimmedIn({ solid, focusIds: ["a"], joint: [] }, "bones" as never, layer, false, amount).size).toBe(0);
    // Nothing focused (a wisdom tooth at tier 1): nothing.
    expect(dimmedIn({ solid, focusIds: [], joint: [] }, "bones" as never, layer, true, amount).size).toBe(0);
  });
});

describe("the dimmed colour", () => {
  it("keeps the luminance (linear light) and lowers the saturation", () => {
    const c = new Color("#b44d43");
    const y = (x: Color) => 0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b;
    const d = desaturate(c.clone(), 0.35);
    expect(y(d)).toBeCloseTo(y(c), 6);
    const sat = (x: Color) => x.getHSL({ h: 0, s: 0, l: 0 }).s;
    expect(sat(d)).toBeLessThan(sat(c));
    expect(dimHex("#808080", 0.35)).toBe("#808080");
    expect(dimHex("#b44d43", 0)).toBe("#b44d43");
  });

  it("the instance colour times the material gives the dimmed colour, for the material and the tendon shade", () => {
    const m = layerColour("muscles");
    for (const target of [m, "#c18274"]) {
      const t = dimTint("muscles", target, m);
      const drawn = new Color(m).multiply(t);
      expect(`#${drawn.getHexString()}`).toBe(dimHex(target, 0.35));
    }
  });
});

describe("the colour pass (applyLayerView)", () => {
  it("writes the dimmed colour with no pattern, and restores the base colour when the dimming ends", () => {
    const mesh = new BatchedMesh(2, 100, 100, new MeshStandardMaterial());
    const g = mesh.addGeometry(new BoxGeometry());
    mesh.addInstance(g);
    mesh.addInstance(g);
    const batch = { mesh, boneIds: ["m1", "m2"], instanceOf: new Map([["m1", 0], ["m2", 1]]) } as unknown as BatchedSkeleton;
    const white = new Color(1, 1, 1);
    const grey = new Color(0.5, 0.5, 0.5);
    const base = view("femur_left", 1);
    const dimmedView = { ...base, layers: { ...base.layers, muscles: { solid: new Set(["m1", "m2"]), rest: "hidden" as const } }, dimmed: new Set(["m1"]) };
    applyLayerView("muscles", batch, null, dimmedView, [], () => white, white, undefined, () => grey);
    const at = (i: number) => mesh.getColorAt(i, new Vector4());
    expect(at(0).toArray()).toEqual([0.5, 0.5, 0.5, 1]);
    expect(at(1).toArray().slice(0, 3)).not.toEqual([0.5, 0.5, 0.5]);
    applyLayerView("muscles", batch, null, { ...dimmedView, dimmed: new Set() }, ["m1"], () => white, white, undefined, () => grey);
    expect(at(0).toArray()).toEqual([1, 1, 1, 1]);
  });
});
