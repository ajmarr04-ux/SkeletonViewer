import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Matrix4, MeshStandardMaterial, Vector3, Vector4 } from "three";
import ids from "../content/ids.json";
import { displayName } from "../src/content/names";
import { batchSkeleton, instanceWorldBounds, type BonePart } from "../src/scene/batchSkeleton";
import { FULL_VIEW, applyIsolationView, isPickable, isolationView, visibleCount } from "../src/scene/isolation";
import { accentTint } from "../src/scene/material";
import { createOutline, setOutlineTarget } from "../src/scene/outline";

const hasMesh = (id: string) => !["tooth_18", "tooth_28", "tooth_38", "tooth_48"].includes(id);

function tri(offset: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([offset, 0, 0, offset + 1, 0, 0, offset, 1, 0]), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setIndex([0, 1, 2]);
  return g;
}
const parts = (): BonePart[] =>
  ["femur_left", "femur_right", "stapes_left"].map((id, i) => ({ id, geometry: tri(i * 2), matrixWorld: new Matrix4().makeTranslation(0, i, 0) }));

describe("isolationView", () => {
  it("nothing selected: everything solid, no ghosts", () => {
    expect(isolationView(null, 0, "ghost", hasMesh)).toEqual(FULL_VIEW);
    expect(isPickable(FULL_VIEW, "femur_left")).toBe(true);
  });
  it("tier 0 isolates the selected bone alone", () => {
    const v = isolationView("femur_left", 0, "ghost", hasMesh);
    expect(v.isolated).toBe(true);
    expect(v.focus).toBe("femur_left");
    expect([...v.solid!]).toEqual(["femur_left"]);
    expect(v.ghosts).toBe(true);
    expect(isPickable(v, "femur_left")).toBe(true);
    expect(isPickable(v, "femur_right")).toBe(false); // a ghost is not pickable
  });
  it("hide mode draws no ghosts", () => {
    expect(isolationView("femur_left", 0, "hide", hasMesh).ghosts).toBe(false);
  });
  it("a wisdom tooth (no mesh) isolates nothing", () => {
    expect(isolationView("tooth_18", 0, "ghost", hasMesh)).toEqual(FULL_VIEW);
  });
  it("tiers 1 and 2 add the related bones and the region (femur worked example)", () => {
    const t1 = isolationView("femur_left", 1, "ghost", hasMesh);
    expect(t1.focus).toBe("femur_left");
    expect([...t1.solid!].sort()).toEqual(["femur_left", "hip_bone_left", "patella_left", "tibia_left"]);
    expect(isPickable(t1, "tibia_left")).toBe(true);
    expect(isPickable(t1, "fibula_left")).toBe(false);
    const t2 = isolationView("femur_left", 2, "ghost", hasMesh);
    expect([...t2.solid!].sort()).toEqual(
      ["coccyx", "femur_left", "fibula_left", "hip_bone_left", "hip_bone_right", "patella_left", "sacrum", "tibia_left"],
    );
  });
  it("a wisdom tooth at tier 1 shows its neighbours with no focus", () => {
    const v = isolationView("tooth_18", 1, "ghost", hasMesh);
    expect(v.isolated).toBe(true);
    expect(v.focus).toBeNull();
    expect([...v.solid!].sort()).toEqual(["maxilla_right", "tooth_17"]);
  });
});

describe("applyIsolationView", () => {
  it("solid shows the isolation, ghosts the rest, focus gets the accent; back restores", () => {
    const solid = batchSkeleton(parts(), new MeshStandardMaterial(), { instanceColours: true });
    const ghost = batchSkeleton(parts(), new MeshStandardMaterial(), { name: "ghosts" });
    const before = solid.boneIds.map((_, i) => instanceWorldBounds(solid.mesh, i).clone());
    const v = isolationView("femur_right", 0, "ghost", hasMesh);
    applyIsolationView(solid, ghost, v, null);
    expect(visibleCount(solid)).toBe(1);
    expect(solid.mesh.getVisibleAt(solid.instanceOf.get("femur_right")!)).toBe(true);
    expect(visibleCount(ghost)).toBe(2);
    expect(ghost.mesh.getVisibleAt(ghost.instanceOf.get("femur_right")!)).toBe(false);
    const c = solid.mesh.getColorAt(solid.instanceOf.get("femur_right")!, new Vector4());
    const t = accentTint();
    expect([c.x, c.y, c.z]).toEqual([t.r, t.g, t.b].map((x) => Math.fround(x)));

    applyIsolationView(solid, ghost, isolationView("femur_right", 0, "hide", hasMesh), "femur_right");
    expect(visibleCount(ghost)).toBe(0); // batch not drawn

    applyIsolationView(solid, ghost, FULL_VIEW, "femur_right");
    expect(visibleCount(solid)).toBe(3);
    expect(visibleCount(ghost)).toBe(0);
    const w = solid.mesh.getColorAt(solid.instanceOf.get("femur_right")!, new Vector4());
    expect([w.x, w.y, w.z]).toEqual([1, 1, 1]);
    // Nothing moved (spec §12).
    solid.boneIds.forEach((_, i) => expect(instanceWorldBounds(solid.mesh, i).equals(before[i]!)).toBe(true));
  });
});

describe("outline", () => {
  it("shares the batch's buffers and draws one bone's index range at its instance matrix", () => {
    const solid = batchSkeleton(parts(), new MeshStandardMaterial());
    const o = createOutline(solid, "#fff", 2, "o");
    expect(o.mesh.geometry.getAttribute("position")).toBe(solid.mesh.geometry.getAttribute("position"));
    expect(o.mesh.geometry.index).toBe(solid.mesh.geometry.index);
    expect(o.mesh.visible).toBe(false);
    setOutlineTarget(o, solid, "stapes_left");
    const i = solid.instanceOf.get("stapes_left")!;
    const range = solid.mesh.getGeometryRangeAt(solid.mesh.getGeometryIdAt(i));
    expect(o.mesh.geometry.drawRange).toEqual({ start: range.start, count: range.count });
    expect(o.mesh.visible).toBe(true);
    // Its world position is the instance's: the outline's vertices land on the bone's.
    const idx = solid.mesh.geometry.index!;
    const pos = solid.mesh.geometry.getAttribute("position");
    const first = new Vector3().fromBufferAttribute(pos, idx.getX(range.start)).applyMatrix4(o.mesh.matrixWorld);
    const want = new Vector3().fromBufferAttribute(pos, idx.getX(range.start)).applyMatrix4(solid.mesh.getMatrixAt(i, new Matrix4()));
    expect(first.distanceTo(want)).toBeLessThan(1e-9);
    setOutlineTarget(o, solid, null);
    expect(o.mesh.visible).toBe(false);
  });
});

describe("displayName", () => {
  it("adds the side to paired bones only", () => {
    expect(displayName("femur_left")).toBe("Femur (left)");
    expect(displayName("sternum")).toBe("Sternum");
    expect(displayName("tooth_13")).toBe("Upper right canine");
  });
  it("names every ID", () => {
    for (const e of ids as { id: string; name: string }[]) expect(displayName(e.id)).toContain(e.name);
  });
});
