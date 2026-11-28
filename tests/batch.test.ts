import { describe, expect, it } from "vitest";
import {
  Box3,
  BufferAttribute,
  Color,
  BufferGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Raycaster,
  Vector3,
} from "three";
import { allInstanceBounds, batchSkeleton, ensureBoundsTrees, type BonePart } from "../src/scene/batchSkeleton";
import {
  ACCENT_COLOUR,
  AO_COLOR_FRAGMENT,
  AO_FLOOR,
  BONE_COLOUR,
  TINT_VERTEX,
  createBoneMaterial,
  createGhostMaterial,
  tintFor,
} from "../src/scene/material";

/** A quantised box like gltfpack writes: uint16 positions, int8 normals, uint8 RGBA. */
function quantisedBox(size: number): BufferGeometry {
  const p: number[] = [];
  for (const x of [0, size]) for (const y of [0, size]) for (const z of [0, size]) p.push(x, y, z);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Uint16Array(p), 3));
  g.setAttribute("normal", new BufferAttribute(new Int8Array(p.length).fill(127), 3, true));
  g.setAttribute("color", new BufferAttribute(new Uint8Array((p.length / 3) * 4).fill(255), 4, true));
  // 12 triangles of a cube (vertex i = 4x + 2y + z).
  const idx = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  g.setIndex(idx);
  return g;
}

/** World bounds of a part straight from its own geometry and matrix. */
function partBounds(p: BonePart): Box3 {
  return new Box3().setFromBufferAttribute(p.geometry.getAttribute("position") as BufferAttribute).applyMatrix4(p.matrixWorld);
}

function parts(): BonePart[] {
  const s = 2.77e-5; // gltfpack's dequantisation scale for these models
  return [
    { id: "femur_left", geometry: quantisedBox(16000), matrixWorld: new Matrix4().compose(new Vector3(0.09, 0.66, -0.02), new Quaternion(), new Vector3(s, s, s)) },
    { id: "stapes_left", geometry: quantisedBox(120), matrixWorld: new Matrix4().compose(new Vector3(-0.06, 1.6, 0.01), new Quaternion(), new Vector3(s, s, s)) },
    { id: "tooth_11", geometry: quantisedBox(400), matrixWorld: new Matrix4().makeTranslation(0.004, 1.5, 0.08).multiply(new Matrix4().makeScale(s, s, s)) },
  ];
}

describe("batchSkeleton", () => {
  it("packs every bone into one BatchedMesh with an instance per bone", () => {
    const ps = parts();
    const b = batchSkeleton(ps, new MeshStandardMaterial());
    expect(b.boneIds).toEqual(["femur_left", "stapes_left", "tooth_11"]);
    expect(b.instanceOf.get("stapes_left")).toBe(1);
    expect(b.triangles).toBe(36);
    expect(b.mesh.instanceCount).toBe(3);
  });

  it("keeps the quantised attribute types", () => {
    const b = batchSkeleton(parts(), new MeshStandardMaterial());
    expect(b.mesh.geometry.getAttribute("position").array).toBeInstanceOf(Uint16Array);
    expect(b.mesh.geometry.getAttribute("normal").normalized).toBe(true);
    expect(b.mesh.geometry.getAttribute("color").itemSize).toBe(4);
  });

  // Instance matrices live in a float32 texture, so allow float32 rounding (well under 1 µm).
  it("moves no bone: every instance's world bounds equal the source mesh's", () => {
    const ps = parts();
    const b = batchSkeleton(ps, new MeshStandardMaterial());
    const got = allInstanceBounds(b);
    for (const p of ps) {
      const want = partBounds(p);
      const box = got.get(p.id)!;
      expect(box.min.distanceTo(want.min)).toBeLessThan(1e-6);
      expect(box.max.distanceTo(want.max)).toBeLessThan(1e-6);
    }
  });

  it("rejects a bone that appears twice", () => {
    const ps = parts();
    ps.push({ ...ps[0]! });
    expect(() => batchSkeleton(ps, new MeshStandardMaterial())).toThrow(/femur_left appears twice/);
  });

  it("raycasts through the BVH to the right instance", () => {
    const b = batchSkeleton(parts(), new MeshStandardMaterial());
    ensureBoundsTrees(b.mesh);
    ensureBoundsTrees(b.mesh); // idempotent
    expect(b.mesh.boundsTrees?.every((t) => t)).toBe(true);
    const tooth = partBounds(parts()[2]!).getCenter(new Vector3());
    const ray = new Raycaster(new Vector3(tooth.x, tooth.y, 5), new Vector3(0, 0, -1));
    const hits = ray.intersectObject(b.mesh);
    expect(hits.length).toBeGreaterThan(0);
    expect(b.boneIds[hits[0]!.batchId!]).toBe("tooth_11");
  });
});

describe("bone material", () => {
  it("remaps AO to [floor, 1] in place of the colour chunk", () => {
    const m = createBoneMaterial();
    expect(m.vertexColors).toBe(true);
    const shader = {
      fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}",
      vertexShader: "#include <common>\nvoid main() {\n#include <color_vertex>\n#include <project_vertex>\n}",
      uniforms: {},
    };
    m.onBeforeCompile(shader as never, undefined as never);
    expect(shader.fragmentShader).toContain(AO_COLOR_FRAGMENT);
    expect(shader.fragmentShader).not.toContain("#include <color_fragment>");
    expect(AO_COLOR_FRAGMENT).toContain(`vec3( ${AO_FLOOR.toFixed(3)} )`);
  });
  it("keeps the instance tint out of the AO remap", () => {
    const m = createBoneMaterial();
    const shader = {
      fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}",
      vertexShader: "#include <common>\nvoid main() {\n#include <color_vertex>\n#include <project_vertex>\n}",
      uniforms: {},
    };
    m.onBeforeCompile(shader as never, undefined as never);
    expect(shader.vertexShader).toContain(TINT_VERTEX);
    expect(shader.vertexShader).toContain("varying vec4 vTint;");
    expect(shader.fragmentShader).toContain("varying vec4 vTint;");
    // The batching colour goes to vTint, never into vColor (which carries the AO).
    expect(TINT_VERTEX).toMatch(/vTint = getBatchingColor/);
    expect(TINT_VERTEX).not.toMatch(/vColor \*= getBatchingColor/);
    expect(AO_COLOR_FRAGMENT).toContain("diffuseColor.rgb *= vTint.rgb;");
  });
  it("fails loudly if three.js renames the colour chunk", () => {
    const m = createBoneMaterial();
    expect(() => m.onBeforeCompile({ fragmentShader: "", vertexShader: "", uniforms: {} } as never, undefined as never)).toThrow(/color_fragment/);
    expect(() =>
      m.onBeforeCompile({ fragmentShader: "#include <common>\n#include <color_fragment>", vertexShader: "#include <common>", uniforms: {} } as never, undefined as never),
    ).toThrow(/color_vertex/);
  });
});

describe("tint and ghost material", () => {
  it("the accent tint times ivory gives the accent", () => {
    const t = tintFor(ACCENT_COLOUR);
    const ivory = new Color(BONE_COLOUR);
    const got = new Color(ivory.r * t.r, ivory.g * t.g, ivory.b * t.b);
    const want = new Color(ACCENT_COLOUR);
    expect(got.r).toBeCloseTo(want.r, 6);
    expect(got.g).toBeCloseTo(want.g, 6);
    expect(got.b).toBeCloseTo(want.b, 6);
  });
  it("ghosts are translucent, write no depth and skip the AO", () => {
    const m = createGhostMaterial(0.2);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.vertexColors).toBe(false);
    expect(m.opacity).toBe(0.2);
  });
});
