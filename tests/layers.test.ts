import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shadeOf, meshIdsOf, trimSoftIds, type RawSoftId } from "../src/layers/softIds";
import { DEFAULT_MODES, LAYER_IDS, LAZY_LAYERS, layersOfSystem, presetDescriptor, presetModes, presetOf, PRESETS, REGISTRY, SYSTEMS, systemMode } from "../src/systems/registry";
import { formatCollapsed, parseCollapsed, toggleCollapsed } from "../src/ui/systemGroups";
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
    expect(table.filter((e) => shadeOf(e) !== undefined)).toHaveLength(15);
    expect(shadeOf(table.find((e) => e.id === "linea_alba"))).toBe("#c18274");
    expect(shadeOf(table.find((e) => e.id === "triceps_brachii_long_head_left"))).toBeUndefined();
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

describe("M11: presets and system groups from the registry (plan decision 5)", () => {
  it("presets keep their M10 IDs, labels, wording and modes", () => {
    expect(PRESETS.map((p) => [p.id, p.label, p.summary])).toEqual([
      ["skeleton", "Skeleton", "bones only"],
      ["full", "Full musculoskeletal", "all layers on"],
    ]);
    // Skeleton = the default; Full = every layer On and the depth back to all.
    expect(presetModes("skeleton")).toEqual(DEFAULT_MODES);
    expect(Object.values(presetModes("full")).every((m) => m === "on")).toBe(true);
    expect(presetDescriptor("full").depth).toBe(0);
    expect(presetDescriptor("skeleton").depth).toBeUndefined();
  });
  it("every preset names only layers of its own system", () => {
    for (const s of SYSTEMS) for (const p of s.presets) for (const l of Object.keys(p.modes)) expect(layersOfSystem(s.id)).toContain(l);
  });
  it("every layer belongs to exactly one registered system; groups in registry order", () => {
    expect(SYSTEMS.flatMap((s) => layersOfSystem(s.id))).toEqual([...LAYER_IDS]);
    for (const l of REGISTRY) expect(SYSTEMS.map((s) => s.id)).toContain(l.system);
  });
  it("the group control's state: one mode, or mixed", () => {
    expect(systemMode("musculoskeletal", DEFAULT_MODES)).toBe("mixed");
    expect(systemMode("musculoskeletal", presetModes("full"))).toBe("on");
    expect(systemMode("musculoskeletal", { bones: "ghost", cartilage: "ghost", ligaments: "ghost", muscles: "ghost" })).toBe("ghost");
    expect(systemMode("musculoskeletal", { bones: "off", cartilage: "off", ligaments: "off", muscles: "off" })).toBe("off");
  });
  it("the expanded state in localStorage: collapsed systems only, anything unreadable is all expanded", () => {
    expect(parseCollapsed(null).size).toBe(0);
    expect(parseCollapsed("not json").size).toBe(0);
    expect(parseCollapsed("[1]").size).toBe(0);
    expect([...parseCollapsed('{"musculoskeletal":false,"organs":true}')]).toEqual(["musculoskeletal"]);
    const c = toggleCollapsed(new Set(), "musculoskeletal");
    expect(formatCollapsed(c)).toBe('{"musculoskeletal":false}');
    expect(formatCollapsed(toggleCollapsed(c, "musculoskeletal"))).toBeNull();
    expect(parseCollapsed(formatCollapsed(c))).toEqual(c);
  });
});
