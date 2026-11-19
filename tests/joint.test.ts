import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Color, Matrix4, MeshStandardMaterial, Vector4 } from "three";
import { jointAnnouncement } from "../src/content/placeholder";
import { batchSkeleton, type BonePart } from "../src/scene/batchSkeleton";
import { JOINT_GAIN, applyIsolationView, isolationView, withJoint } from "../src/scene/isolation";
import { accentTint } from "../src/scene/material";
import { useViewer } from "../src/state/store";

const hasMesh = (id: string) => !["tooth_18", "tooth_28", "tooth_38", "tooth_48"].includes(id);
function tri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setIndex([0, 1, 2]);
  return g;
}
const ids = ["femur_left", "hip_bone_left", "tibia_left", "maxilla_right"];
const parts = (): BonePart[] => ids.map((id, i) => ({ id, geometry: tri(), matrixWorld: new Matrix4().makeTranslation(i, 0, 0) }));
const colour = (sk: ReturnType<typeof batchSkeleton>, id: string) => {
  const c = sk.mesh.getColorAt(sk.instanceOf.get(id)!, new Vector4());
  return [c.x, c.y, c.z];
};
const f = (c: Color, k = 1) => [c.r * k, c.g * k, c.b * k].map((x) => Math.fround(x));

describe("joint highlighting (plan step 7)", () => {
  it("withJoint shows a ghosted partner solid and names it as the outlined partner", () => {
    const base = isolationView("femur_left", 0, "ghost", hasMesh);
    expect(base.solid!.has("hip_bone_left")).toBe(false);
    const v = withJoint(base, { a: "femur_left", b: "hip_bone_left" }, hasMesh);
    expect([...v.solid!].sort()).toEqual(["femur_left", "hip_bone_left"]);
    expect(v.joint).toEqual(["femur_left", "hip_bone_left"]);
    expect(v.jointPartner).toBe("hip_bone_left");
    expect(v.focus).toBe("femur_left");
    expect(withJoint(base, null, hasMesh)).toBe(base);
  });
  it("a wisdom tooth's joint highlights the alveolar bone only", () => {
    const v = withJoint(isolationView("tooth_18", 1, "ghost", hasMesh), { a: "tooth_18", b: "maxilla_right" }, hasMesh);
    expect(v.joint).toEqual(["maxilla_right"]);
    expect(v.jointPartner).toBe("maxilla_right");
  });
  it("tints both bones brighter, then puts the accent and white back", () => {
    const sk = batchSkeleton(parts(), new MeshStandardMaterial(), { instanceColours: true });
    const base = isolationView("femur_left", 1, "ghost", hasMesh);
    applyIsolationView(sk, null, base, null);
    const on = withJoint(base, { a: "femur_left", b: "hip_bone_left" }, hasMesh);
    applyIsolationView(sk, null, on, "femur_left", []);
    expect(colour(sk, "femur_left")).toEqual(f(accentTint(), JOINT_GAIN));
    expect(colour(sk, "hip_bone_left")).toEqual(f(new Color(1, 1, 1), JOINT_GAIN));
    expect(colour(sk, "tibia_left")).toEqual([1, 1, 1]);
    applyIsolationView(sk, null, base, "femur_left", on.joint);
    expect(colour(sk, "femur_left")).toEqual(f(accentTint()));
    expect(colour(sk, "hip_bone_left")).toEqual([1, 1, 1]);
  });
  it("announces the joint and both bones", () => {
    expect(jointAnnouncement("Hip joint", "femur_left", "hip_bone_left")).toBe("Hip joint: femur and hip bone highlighted.");
    expect(jointAnnouncement("Sternoclavicular joint", "clavicle_left", "sternum")).toBe("Sternoclavicular joint: clavicle and sternum highlighted.");
    expect(jointAnnouncement("Pubic symphysis", "hip_bone_left", "hip_bone_right")).toBe("Pubic symphysis: hip bone and hip bone (right) highlighted.");
  });
  it("the store clears the joint when the selection changes", () => {
    const st = useViewer.getState();
    st.setIsolation({ sel: "femur_left", tier: 0 });
    st.setJoint({ a: "femur_left", b: "tibia_left", name: "Knee joint" });
    const j = useViewer.getState().joint;
    st.setJoint({ a: "femur_left", b: "tibia_left", name: "Knee joint" });
    expect(useViewer.getState().joint).toBe(j); // same joint: no new state
    st.setIsolation({ sel: "femur_left", tier: 0 });
    expect(useViewer.getState().joint).toBe(j); // nothing changed
    st.setIsolation({ sel: "tibia_left", tier: 0 });
    expect(useViewer.getState().joint).toBeNull();
    st.setIsolation({ sel: null, tier: 0 });
  });
});
