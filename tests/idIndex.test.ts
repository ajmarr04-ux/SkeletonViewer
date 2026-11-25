// M12 BB (plan decision 7): the always-loaded ID index. Vitest's setup file
// loads it as the app's entry does, so nothing here loads a chunk first.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readIndexData } from "../scripts/lib/index-plugin";
import { hasMesh, indexNode, isKnownId, layerOfId, lazyEntries } from "../src/content/index";
import { displayName } from "../src/content/names";
import { decodeIndex, encodeIndex } from "../src/content/indexCodec";
import { fixtureRegistry } from "./fixtures/systems/vite";
import { WIDGET_IDS } from "./fixtures/systems/demo/widgets/layer";

const SOFT = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as { id: string; meshAvailable: boolean }[];

describe("the ID index", () => {
  it("answers for every layer's structures at once", () => {
    expect(isKnownId("femur_left")).toBe(true);
    expect(layerOfId("femur_left")).toBe("bones");
    expect(isKnownId("biceps_brachii_left")).toBe(true);
    expect(layerOfId("biceps_brachii_left")).toBe("muscles");
    expect(layerOfId("anterior_cruciate_ligament_left")).toBe("ligaments");
    expect(layerOfId("lateral_meniscus_left")).toBe("cartilage");
    expect(displayName("biceps_brachii_left")).toBe("Biceps brachii (left)");
    expect(hasMesh("biceps_brachii_long_head_left")).toBe(true);
    expect(hasMesh("tooth_18")).toBe(false);
    expect(isKnownId("not_a_structure")).toBe(false);
    expect(layerOfId("not_a_structure")).toBeNull();
  });

  it("holds the lazy layers in their file's order, mesh flags as generated", () => {
    expect(lazyEntries().map((e) => e.id)).toEqual(SOFT.map((e) => e.id));
    for (const e of SOFT) expect(hasMesh(e.id)).toBe(e.meshAvailable);
  });

  it("names the joint nodes, which aren't structures", () => {
    const n = indexNode("coronal_suture_left");
    expect(n).toEqual({ id: "coronal_suture_left", node: "joint", name: "Coronal suture" });
    expect(indexNode("shoulder_girdle_left")?.name).toBe("Joints of the shoulder girdle");
    expect(isKnownId("coronal_suture_left")).toBe(false);
    expect(readIndexData().nodes).toHaveLength(404);
  });

  it("the fixture build's ID file joins through the same plugin", () => {
    const data = readIndexData(fixtureRegistry);
    expect(data.eager).toBe("bones");
    expect(data.entries.slice(SOFT.length).map((e) => e.id)).toEqual([...WIDGET_IDS]);
  });
});

describe("the index's wire format", () => {
  const sorted = (x: unknown) => JSON.parse(JSON.stringify(x, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)));
  it("round-trips the real and the fixture data exactly", () => {
    for (const d of [readIndexData(), readIndexData(fixtureRegistry)]) expect(sorted(decodeIndex(encodeIndex(d)))).toEqual(sorted(d));
  });
  it("sends no row for a mirrored right side listed after its left (a reference, or the left row's flag when it follows)", () => {
    const p = encodeIndex(readIndexData());
    const ids = SOFT.map((e) => e.id);
    const leftFirst = ids.filter((id, i) => id.endsWith("_right") && ids.indexOf(id.replace(/_right$/, "_left")) < i).length;
    expect(leftFirst).toBe(430); // the two wrist collateral ligaments list their right side first
    expect(p.entries.filter((r) => typeof r !== "number")).toHaveLength(SOFT.length - leftFirst);
    expect(p.nodes.filter((r) => typeof r === "number")).toHaveLength(165);
  });
  it("keeps a right side that isn't a mirror, and refuses a parent its muscle doesn't list", () => {
    const base = { kind: "muscle", layer: "muscles", mesh: true } as const;
    const d = {
      eager: "bones" as const,
      entries: [
        { ...base, id: "m_left", name: "M", side: "left" as const, parts: ["p_left"] },
        { ...base, id: "p_left", name: "P", side: "left" as const, parent: "m_left" },
        { ...base, id: "m_right", name: "M (odd)", side: "right" as const, parts: ["p_right"] },
        { ...base, id: "p_right", name: "P", side: "right" as const, parent: "m_right" },
      ],
      nodes: [],
    };
    const p = encodeIndex(d);
    expect(p.entries.map((r) => typeof r)).toEqual(["object", "object", "object", "number"]);
    expect(sorted(decodeIndex(p))).toEqual(sorted(d));
    expect(() => encodeIndex({ ...d, entries: [d.entries[0]!, { ...d.entries[1]!, parent: undefined }] })).toThrow(/p_left/);
  });
});
