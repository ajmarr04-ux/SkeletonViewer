import { describe, expect, it } from "vitest";
import { Box3, BufferAttribute, BufferGeometry, Matrix4, MeshStandardMaterial, Vector3 } from "three";
import { batchSkeleton, instanceWorldBounds, type BonePart } from "../src/scene/batchSkeleton";
import { explodeMovers } from "../src/scene/Explode";
import { EXPLODE, beginExplode, boneBox, easeOut, endExplode, explodeOffsets, releaseValue, setExplode, type BoneBox } from "../src/scene/explode";
import { useViewer } from "../src/state/store";

function cube(): BufferGeometry {
  const g = new BufferGeometry();
  const p = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1];
  g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(p.map(() => 0)), 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2]);
  return g;
}
// Awkward, non-round matrices so an inexact restore would show.
const parts = (): BonePart[] =>
  ["femur_left", "hip_bone_left", "patella_left", "tibia_left"].map((id, i) => ({
    id,
    geometry: cube(),
    matrixWorld: new Matrix4().makeRotationY(0.123 * (i + 1)).setPosition(0.1 * i + 0.0371, -0.3 * i + 0.913, 0.017 * i),
  }));

describe("explode offsets (plan decision 10)", () => {
  const focus: BoneBox = { centre: [0, 1, 0], radius: 0.2 };
  it("moves each bone away from the focus centre by its radius × scale", () => {
    const off = explodeOffsets(focus, new Map([
      ["above", { centre: [0, 2, 0], radius: 0.1 }],
      ["side", { centre: [3, 1, 4], radius: 0.4 }],
    ]));
    expect(off.get("above")).toEqual([0, 0.1 * EXPLODE.scale, 0]);
    const s = off.get("side")!;
    expect(Math.hypot(...s)).toBeCloseTo(0.4 * EXPLODE.scale, 12);
    expect(s[0] / s[2]).toBeCloseTo(3 / 4, 12); // along the line between the centres
    expect(s[1]).toBe(0);
  });
  it("gives no offset to a bone centred on the focus", () => {
    expect(explodeOffsets(focus, new Map([["same", { centre: [0, 1, 0], radius: 1 }]])).get("same")).toEqual([0, 0, 0]);
  });
  it("box centre and radius", () => {
    const b = boneBox(new Box3(new Vector3(0, 0, 0), new Vector3(2, 2, 1)));
    expect(b.centre).toEqual([1, 1, 0.5]);
    expect(b.radius).toBeCloseTo(1.5, 12);
  });
  it("the release eases to exactly zero", () => {
    expect(releaseValue(0.8, 0)).toBe(0.8);
    expect(releaseValue(0.8, EXPLODE.releaseMs / 2)).toBeLessThan(0.8 / 2); // ease-out: most of the way back by half time
    expect(releaseValue(0.8, EXPLODE.releaseMs)).toBe(0);
    expect(releaseValue(0.8, 10, 0)).toBe(0); // reduced motion
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
  });
});

describe("explode on a batch", () => {
  it("moves only the tier-1 bones, by the offset × slider, and restores every matrix bit for bit", () => {
    const sk = batchSkeleton(parts(), new MeshStandardMaterial());
    const rest = sk.boneIds.map((_, i) => sk.mesh.getMatrixAt(i, new Matrix4()).toArray());
    const before = sk.boneIds.map((_, i) => instanceWorldBounds(sk.mesh, i).clone());
    const offsets = new Map([
      ["hip_bone_left", [0, 0.1, 0] as [number, number, number]],
      ["tibia_left", [0.02, -0.2, 0.03] as [number, number, number]],
      ["not_in_batch", [1, 1, 1] as [number, number, number]],
    ]);
    const run = beginExplode(sk, offsets);
    expect(run.base.size).toBe(2);
    for (const s of [0.3, 1, 0.55]) {
      setExplode(sk, run, s);
      const hip = sk.instanceOf.get("hip_bone_left")!;
      const tib = sk.instanceOf.get("tibia_left")!;
      const fem = sk.instanceOf.get("femur_left")!;
      const moved = (i: number) => instanceWorldBounds(sk.mesh, i).min.clone().sub(before[i]!.min);
      // The matrices texture is float32, so compare to 1e-6 m.
      const h = moved(hip);
      expect(h.x).toBeCloseTo(0, 6);
      expect(h.y).toBeCloseTo(0.1 * s, 6);
      expect(h.z).toBeCloseTo(0, 6);
      expect(moved(tib).y).toBeCloseTo(-0.2 * s, 6);
      expect(moved(fem).length()).toBe(0); // the focus stays still
    }
    endExplode(sk, run);
    sk.boneIds.forEach((_, i) => {
      expect(sk.mesh.getMatrixAt(i, new Matrix4()).toArray()).toEqual(rest[i]);
      expect(instanceWorldBounds(sk.mesh, i).equals(before[i]!)).toBe(true);
    });
  });
});

describe("which bones explode", () => {
  it("the focus's tier-1 bones at tiers 1 and 2, nothing at tier 0", () => {
    expect(explodeMovers("femur_left", 0)).toBeNull();
    expect(explodeMovers(null, 1)).toBeNull();
    const m = explodeMovers("femur_left", 2)!;
    expect(m.focus).toBe("femur_left");
    expect([...m.movers].sort()).toEqual(["hip_bone_left", "patella_left", "tibia_left"]); // not the tier-2 fibula or sacrum
  });
  it("a wisdom tooth (no mesh) has no focus to explode from", () => {
    expect(explodeMovers("tooth_18", 1)).toBeNull();
  });
  it("the store clamps the value and resets it with the selection", () => {
    const st = useViewer.getState();
    st.setIsolation({ sel: "femur_left", tier: 1 });
    st.setExplode(3);
    expect(useViewer.getState().explode).toBe(1);
    st.setExplode(Number.NaN);
    expect(useViewer.getState().explode).toBe(0);
    st.setExplode(0.4);
    st.setIsolation({ sel: "femur_left", tier: 2 });
    expect(useViewer.getState().explode).toBe(0);
    st.setIsolation({ sel: null, tier: 0 });
  });
});
