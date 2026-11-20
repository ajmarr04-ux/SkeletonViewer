import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Color, Matrix4, MeshStandardMaterial } from "three";
import ids from "../content/ids.json";
import { hideTargets, registerSoftIds, resetSoftIds, softDisplayName, softEntry, softOpposite } from "../src/content/softRegistry";
import { softAnnouncement, softPanelModel } from "../src/content/softPanel";
import { displayName } from "../src/content/names";
import { trimSoftIds, type RawSoftId } from "../src/layers/softIds";
import { batchSkeleton, type BonePart } from "../src/scene/batchSkeleton";
import {
  FULL_VIEW,
  applyLayerView,
  isolationView,
  isPickable,
  isPickableIn,
  sceneView,
  shownIn,
  viewOf,
  withJoint,
  type IsolationView,
} from "../src/scene/isolation";
import { relations } from "../src/content/relations";
import { DEFAULT_LAYERS, LAYERS, type LayerModes } from "../src/state/url";

// M7 session U, step 4 (plan decisions 6 and 8): the layer-aware view.

const boneIds = (ids as { id: string; meshAvailable: boolean }[]).filter((e) => e.meshAvailable).map((e) => e.id);
const hasBone = (id: string) => boneIds.includes(id);
const iso = (sel: string | null, tier: 0 | 1 | 2 = 0, ghost: "ghost" | "hide" = "ghost") => isolationView(sel, tier, ghost, hasBone);
const modes = (m: Partial<LayerModes>): LayerModes => ({ ...DEFAULT_LAYERS, ...m });

describe("equivalence with M6 (bones layer on, nothing hidden)", () => {
  const sample = ["femur_left", "stapes_right", "tooth_11", "c1_atlas", "sternum", "tooth_18"].filter((id) => (ids as { id: string }[]).some((e) => e.id === id));
  it("gives every bone the same place as M6's view, for every tier and ghost mode", () => {
    const cases: IsolationView[] = [FULL_VIEW];
    for (const sel of sample) for (const tier of [0, 1, 2] as const) for (const g of ["ghost", "hide"] as const) cases.push(iso(sel, tier, g));
    for (const v of cases) {
      const s = sceneView(v, DEFAULT_LAYERS);
      for (const id of boneIds) {
        const m6 = v.solid === null || v.solid.has(id) ? "solid" : v.ghosts ? "ghost" : "hidden";
        expect(shownIn(s, "bones", id), `${v.focus} ${id}`).toBe(m6);
        expect(isPickableIn(s, "bones", id)).toBe(isPickable(v, id));
      }
    }
  });
});

describe("layer modes and isolation (plan decision 6)", () => {
  it("nothing isolated: On is solid, Ghost is a ghost, Off is hidden", () => {
    const v = sceneView(FULL_VIEW, modes({ muscles: "on", ligaments: "ghost", cartilage: "off" }));
    expect(shownIn(v, "muscles", "biceps_brachii_left")).toBe("solid");
    expect(shownIn(v, "ligaments", "inguinal_ligament_left")).toBe("ghost");
    expect(isPickableIn(v, "ligaments", "inguinal_ligament_left")).toBe(false);
    expect(shownIn(v, "cartilage", "x")).toBe("hidden");
    expect(shownIn(v, "bones", "femur_left")).toBe("solid");
  });
  it("selecting a bone ghosts the other layers' structures with ghost mode, hides them without", () => {
    const v = sceneView(iso("femur_left"), modes({ muscles: "on" }));
    expect(shownIn(v, "bones", "femur_left")).toBe("solid");
    expect(shownIn(v, "muscles", "biceps_brachii_left")).toBe("ghost");
    expect(shownIn(sceneView(iso("femur_left", 0, "hide"), modes({ muscles: "on" })), "muscles", "biceps_brachii_left")).toBe("hidden");
  });
  it("a Ghost layer stays ghosted under isolation even in hide mode; an Off layer stays hidden", () => {
    const v = sceneView(iso("femur_left", 0, "hide"), modes({ muscles: "ghost", ligaments: "off" }));
    expect(shownIn(v, "muscles", "biceps_brachii_left")).toBe("ghost");
    expect(shownIn(v, "ligaments", "inguinal_ligament_left")).toBe("hidden");
  });
  it("isolation overrides the layer toggles: an isolated bone shows with the bones layer Ghost or Off", () => {
    for (const mode of ["ghost", "off"] as const) {
      const v = sceneView(iso("femur_left", 1), modes({ bones: mode }));
      expect(shownIn(v, "bones", "femur_left")).toBe("solid");
      for (const r of relations.tier1("femur_left")) expect(shownIn(v, "bones", r)).toBe("solid");
      expect(shownIn(v, "bones", "humerus_left")).toBe(mode === "ghost" ? "ghost" : "hidden");
    }
  });
  it("hidden structures are never drawn, except the focus itself and a highlighted joint's bones", () => {
    const hidden = new Set(["femur_left", "tibia_left", "humerus_left", "biceps_brachii_left"]);
    const v = sceneView(withJoint(iso("femur_left", 1), { a: "femur_left", b: "hip_bone_left" }, hasBone), modes({ muscles: "on" }), hidden);
    expect(shownIn(v, "bones", "femur_left")).toBe("solid"); // the focus
    expect(shownIn(v, "bones", "tibia_left")).toBe("hidden"); // related, but hidden
    expect(shownIn(v, "bones", "humerus_left")).toBe("hidden"); // would be a ghost
    expect(shownIn(v, "muscles", "biceps_brachii_left")).toBe("hidden");
    const joint = sceneView(withJoint(iso("femur_left", 1), { a: "femur_left", b: "tibia_left" }, hasBone), DEFAULT_LAYERS, hidden);
    expect(shownIn(joint, "bones", "tibia_left")).toBe("solid");
    const plain = sceneView(FULL_VIEW, DEFAULT_LAYERS, hidden);
    expect(shownIn(plain, "bones", "femur_left")).toBe("hidden");
    expect(isPickableIn(plain, "bones", "femur_left")).toBe(false);
  });
  it("has an empty tints map for M9", () => {
    expect(sceneView(FULL_VIEW, DEFAULT_LAYERS).tints.size).toBe(0);
  });
  it("viewOf reads the store's fields", () => {
    const v = viewOf(
      { sel: "femur_left", tier: 0, ghostMode: "ghost", grp: null, joint: null, layers: modes({ bones: "off" }), hidden: new Set() },
      hasBone,
    );
    expect(v.focus).toBe("femur_left");
    expect(LAYERS.every((l) => v.layers[l] !== undefined)).toBe(true);
    expect(shownIn(v, "bones", "femur_right")).toBe("hidden");
  });
});

describe("applyLayerView", () => {
  const tri = (o: number) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([o, 0, 0, o + 1, 0, 0, o, 1, 0]), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    g.setIndex([0, 1, 2]);
    return g;
  };
  const parts = (): BonePart[] => ["biceps_brachii_left", "biceps_brachii_right", "deltoid_left"].map((id, i) => ({ id, geometry: tri(i * 2), matrixWorld: new Matrix4() }));
  const white = new Color(1, 1, 1);
  const accent = new Color(0, 0, 1);
  it("splits a layer between its two batches and switches off an empty batch (no draw call)", () => {
    const solid = batchSkeleton(parts(), new MeshStandardMaterial(), { instanceColours: true });
    const ghost = batchSkeleton(parts(), new MeshStandardMaterial());
    const sel = isolationView("biceps_brachii_left", 0, "ghost", () => true);
    const counts = applyLayerView("muscles", solid, ghost, sceneView(sel, modes({ muscles: "on" }), new Set(["deltoid_left"])), [], () => white, accent);
    expect(counts).toEqual({ solid: 1, ghost: 1 });
    expect(solid.mesh.getVisibleAt(0)).toBe(true);
    expect(ghost.mesh.getVisibleAt(1)).toBe(true);
    expect(ghost.mesh.getVisibleAt(2)).toBe(false); // hidden: neither batch
    expect(solid.mesh.getColorAt(0, new Color()).b).toBe(1);
    // Layer Off, nothing isolated: both batches off.
    const off = applyLayerView("muscles", solid, ghost, sceneView(FULL_VIEW, DEFAULT_LAYERS), ["biceps_brachii_left"], () => white, accent);
    expect(off).toEqual({ solid: 0, ghost: 0 });
    expect(solid.mesh.visible).toBe(false);
    expect(ghost.mesh.visible).toBe(false);
    expect(solid.mesh.getColorAt(0, new Color()).r).toBe(1); // the old focus is back to its base colour
  });
});

describe("soft-tissue registry and placeholder (plan decisions 12, 13)", () => {
  const raw = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];
  beforeAll(() => registerSoftIds(trimSoftIds(raw)));
  afterAll(() => resetSoftIds());
  it("names, opposite side and hide targets", () => {
    expect(displayName("biceps_brachii_left")).toBe("Biceps brachii (left)");
    expect(displayName("linea_alba")).toBe("Linea alba");
    expect(softDisplayName(softEntry("inguinal_ligament_right")!)).toBe("Inguinal ligament (right)");
    expect(softOpposite("inguinal_ligament_left")).toBe("inguinal_ligament_right");
    expect(softOpposite("linea_alba")).toBeNull();
    expect(hideTargets("cricothyroid_left")).toEqual(["cricothyroid_oblique_part_left", "cricothyroid_straight_part_left"]);
    expect(hideTargets("inguinal_ligament_left")).toEqual(["inguinal_ligament_left"]);
  });
  it("the placeholder panel: layer, kind, part of, breadcrumb, side pair", () => {
    const m = softPanelModel("cricothyroid_oblique_part_left")!;
    expect(m.badges).toEqual({ layer: "Muscles", kind: "Muscle part: portion" });
    expect(m.partOf).toEqual({ id: "cricothyroid_left", name: "Cricothyroid" });
    expect(m.trail).toEqual(["Muscles", "Oblique part of cricothyroid"]);
    expect(m.pair).toEqual({ left: "cricothyroid_oblique_part_left", right: "cricothyroid_oblique_part_right" });
    expect(softPanelModel("inguinal_ligament_left")!.trail[0]).toBe("Ligaments");
    expect(softPanelModel("femur_left")).toBeNull();
    expect(softAnnouncement("linea_alba")).toBe("Linea alba, selected. Isolated.");
  });
  it("every soft-tissue ID differs from every bone ID (one ID space for sel= and hid=)", () => {
    const bones = new Set((ids as { id: string }[]).map((e) => e.id));
    expect(raw.filter((e) => bones.has(e.id))).toEqual([]);
  });
});

describe("picking across layers (plan decision 11)", async () => {
  const { nearestPickable, pickWithProxies } = await import("../src/scene/pick");
  const hits = [
    { layer: "bones", id: "humerus_left", distance: 2.1 },
    { layer: "muscles", id: "biceps_brachii_long_head_left", distance: 2.0 },
    { layer: "ligaments", id: "x_ligament", distance: 1.9 },
  ];
  it("the nearest pickable hit wins, whatever its layer", () => {
    expect(nearestPickable(hits, () => true)?.id).toBe("x_ligament");
    expect(nearestPickable(hits, (l) => l !== "ligaments")?.id).toBe("biceps_brachii_long_head_left");
    expect(nearestPickable(hits, (l) => l === "bones")?.id).toBe("humerus_left");
    expect(nearestPickable(hits, () => false)).toBeNull();
  });
  it("a muscle surface nearer than a tiny ligament's front keeps the tap", () => {
    const real = { id: "biceps_brachii_long_head_left", depth: 1.0 };
    const proxy = { id: "tiny_ligament", x: 100, y: 100, depth: 1.2, radius: 0.005, radiusPx: 3 };
    expect(pickWithProxies(real, [proxy], { x: 101, y: 100 }, 22, (id) => id === "tiny_ligament")).toBe("biceps_brachii_long_head_left");
    expect(pickWithProxies(real, [{ ...proxy, depth: 0.9 }], { x: 101, y: 100 }, 22, (id) => id === "tiny_ligament")).toBe("tiny_ligament");
  });
});
