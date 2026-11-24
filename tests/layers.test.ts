import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTendinous, meshIdsOf, trimSoftIds, type RawSoftId } from "../src/layers/softIds";
import { presetOf } from "../src/state/selection";
import { DEFAULT_MODES, LAZY_LAYERS } from "../src/systems/registry";
import { modelSizes } from "../scripts/lib/model-versions-plugin";

const raw = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];
const table = trimSoftIds(raw);

describe("trimmed soft-tissue IDs (M7 plan decision 15)", () => {
  it("keeps every ID and only the fields the viewer uses", () => {
    expect(table).toHaveLength(raw.length);
    for (const e of table) {
      expect(Object.keys(e).every((k) => ["id", "name", "kind", "layer", "side", "mesh", "parent", "parts", "partType", "depth"].includes(k))).toBe(true);
    }
    expect(JSON.stringify(table).length).toBeLessThan(JSON.stringify(raw).length * 0.75);
  });
  it("has one mesh ID per node in each layer's manifest", () => {
    for (const layer of LAZY_LAYERS) {
      const manifest = JSON.parse(readFileSync(`assets/build/manifest-${layer}.json`, "utf8")) as { objects: Record<string, unknown> };
      expect(new Set(meshIdsOf(table, layer))).toEqual(new Set(Object.keys(manifest.objects)));
    }
    expect(meshIdsOf(table, "muscles")).toHaveLength(477);
  });
  it("marks tendons and aponeuroses (15 parts) for the lighter colour", () => {
    expect(table.filter(isTendinous)).toHaveLength(15);
    expect(isTendinous(table.find((e) => e.id === "linea_alba"))).toBe(true);
    expect(isTendinous(table.find((e) => e.id === "triceps_brachii_long_head_left"))).toBe(false);
  });
});

describe("model sizes for the progress bar", () => {
  it("lists every committed model file with its size", () => {
    const sizes = modelSizes();
    for (const l of LAZY_LAYERS) for (const lod of ["low", "high"]) expect(sizes[`${l}-${lod}`]).toBeGreaterThan(100_000);
  });
});

describe("layer presets (spec §6.1)", () => {
  it("recognises Skeleton and Full musculoskeletal", () => {
    expect(presetOf(DEFAULT_MODES)).toBe("skeleton");
    expect(presetOf({ bones: "on", cartilage: "on", ligaments: "on", muscles: "on" })).toBe("full");
    expect(presetOf({ ...DEFAULT_MODES, muscles: "ghost" })).toBeNull();
  });
});
