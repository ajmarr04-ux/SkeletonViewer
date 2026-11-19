import { describe, expect, it } from "vitest";
import manifest from "../assets/build/manifest.json";
import { PROXY_RADIUS_PX, TINY_RADIUS_M, pickWithProxies, tinyObjects, type Proxy } from "../src/scene/pick";

type Lod = { bboxMin: number[]; bboxMax: number[] };
const radii = new Map(
  Object.entries((manifest as unknown as { objects: Record<string, { lods: { high: Lod } }> }).objects).map(([id, o]) => {
    const h = o.lods.high;
    return [id, Math.hypot(...h.bboxMax.map((x, i) => x - h.bboxMin[i]!)) / 2] as const;
  }),
);

describe("tiny objects", () => {
  const tiny = tinyObjects(radii);

  it("cover every object the spec names: ossicles, distal phalanges, sesamoids and teeth", () => {
    for (const side of ["left", "right"]) {
      for (const o of ["malleus", "incus", "stapes", "pisiform"]) expect(tiny.has(`${o}_${side}`)).toBe(true);
      for (let d = 1; d <= 5; d++) {
        expect(tiny.has(`distal_phalanx_hand_${d}_${side}`)).toBe(true);
        expect(tiny.has(`distal_phalanx_foot_${d}_${side}`)).toBe(true);
      }
    }
    const teeth = [...radii.keys()].filter((id) => id.startsWith("tooth_"));
    expect(teeth).toHaveLength(28);
    for (const t of teeth) expect(tiny.has(t)).toBe(true);
  });

  it("leave out bigger bones such as the patella and the femur", () => {
    expect(tiny.has("patella_left")).toBe(false);
    expect(tiny.has("femur_left")).toBe(false);
    expect(tiny.size).toBe(100);
    for (const id of tiny) expect(radii.get(id)!).toBeLessThan(TINY_RADIUS_M);
  });
});

describe("pickWithProxies", () => {
  const tiny = new Set(["tooth_36", "tooth_37", "stapes_left"]);
  const isTiny = (id: string) => tiny.has(id);
  const tooth = (id: string, x: number, y: number, depth = 1, radiusPx = 4): Proxy => ({ id, x, y, depth, radius: 0.0135, radiusPx });
  const hit = PROXY_RADIUS_PX.touch;

  it("a real hit on a tiny object wins", () => {
    expect(pickWithProxies({ id: "tooth_36", depth: 1 }, [tooth("tooth_37", 100, 100)], { x: 100, y: 100 }, hit, isTiny)).toBe("tooth_36");
  });

  it("a tap near a tiny object picks it, even over a bigger bone", () => {
    expect(pickWithProxies({ id: "mandible", depth: 1.0 }, [tooth("tooth_36", 110, 100)], { x: 100, y: 100 }, hit, isTiny)).toBe("tooth_36");
    expect(pickWithProxies(null, [tooth("tooth_36", 110, 100)], { x: 100, y: 100 }, hit, isTiny)).toBe("tooth_36");
  });

  it("picks the nearest proxy on screen", () => {
    const ps = [tooth("tooth_36", 115, 100), tooth("tooth_37", 92, 100)];
    expect(pickWithProxies(null, ps, { x: 100, y: 100 }, hit, isTiny)).toBe("tooth_37");
  });

  it("ignores proxies out of reach, behind the real hit, behind the camera, or big enough to tap", () => {
    const real = { id: "mandible", depth: 1.0 };
    expect(pickWithProxies(real, [tooth("tooth_36", 130, 100)], { x: 100, y: 100 }, hit, isTiny)).toBe("mandible");
    expect(pickWithProxies(real, [tooth("tooth_36", 105, 100, 1.05)], { x: 100, y: 100 }, hit, isTiny)).toBe("mandible");
    expect(pickWithProxies(null, [tooth("tooth_36", 105, 100, -0.5)], { x: 100, y: 100 }, hit, isTiny)).toBeNull();
    expect(pickWithProxies(real, [tooth("tooth_36", 105, 100, 1, 40)], { x: 100, y: 100 }, hit, isTiny)).toBe("mandible");
  });

  it("a tooth partly in the bone (centre a little deeper than the hit) still counts", () => {
    expect(pickWithProxies({ id: "mandible", depth: 1.0 }, [tooth("tooth_36", 105, 100, 1.01)], { x: 100, y: 100 }, hit, isTiny)).toBe("tooth_36");
  });

  it("the mouse radius is much smaller than the touch one", () => {
    const p = [tooth("tooth_36", 110, 100)];
    expect(pickWithProxies({ id: "mandible", depth: 1 }, p, { x: 100, y: 100 }, PROXY_RADIUS_PX.mouse, isTiny)).toBe("mandible");
  });
});
