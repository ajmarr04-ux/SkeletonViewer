// The registry (M11 session AT, plan decisions 2–4): descriptors are
// consistent, and the URL codes match what M10 wrote (golden/urls.json).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatLayers, parseLayers, type LayerModes } from "../src/state/url";
import { CONTENT_REGISTRY, DEPTH_FILE, bodyWordsOf, schemaForKind } from "../src/systems/registry.content";
import {
  DEBUG_CODES,
  DEFAULT_MODES,
  DEPTH_LAYER,
  EAGER_LAYER,
  LAYER_IDS,
  LAZY_LAYERS,
  COUNT_ORDER,
  countKind,
  hasNestedParts,
  LABEL_ORDER,
  layerByCode,
  layerOfKind,
  NESTED_LAYER,
  OVERLAYS,
  REGISTRY,
  SYSTEMS,
} from "../src/systems/registry";

type Golden = Record<string, { state: { layers: LayerModes; muscleDepth: 0 | 1 | 2 }; serialised: string }>;
const golden = JSON.parse(readFileSync("tests/golden/urls.json", "utf8")) as Golden;

describe("registry", () => {
  it("layer IDs, codes and ghost orders are unique; codes are one lower-case letter", () => {
    const codes = REGISTRY.map((l) => l.code);
    expect(new Set(LAYER_IDS).size).toBe(REGISTRY.length);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[a-z]$/);
    expect(new Set(REGISTRY.map((l) => l.ghostOrder)).size).toBe(REGISTRY.length);
    for (const l of REGISTRY) expect(layerByCode(l.code)).toBe(l.id);
  });

  it("the overlays' debug codes don't clash with layer codes", () => {
    expect(DEBUG_CODES.size).toBe(REGISTRY.length + OVERLAYS.length);
  });

  it("every layer belongs to a registered system", () => {
    const systems = new Set<string>(SYSTEMS.map((s) => s.id));
    for (const l of REGISTRY) expect(systems.has(l.system)).toBe(true);
  });

  it("each kind belongs to exactly one layer", () => {
    const kinds = REGISTRY.flatMap((l) => l.kinds.map((k) => k.id));
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const l of REGISTRY) for (const k of l.kinds) expect(layerOfKind(k.id)).toBe(l.id);
  });

  it("exactly one eager layer, drawn first among the ghosts; exactly one depth layer", () => {
    expect(REGISTRY.filter((l) => l.models.eager).map((l) => l.id)).toEqual([EAGER_LAYER]);
    expect(Math.min(...REGISTRY.map((l) => l.ghostOrder))).toBe(REGISTRY.find((l) => l.id === EAGER_LAYER)!.ghostOrder);
    expect(LAZY_LAYERS).toEqual(LAYER_IDS.filter((l) => l !== EAGER_LAYER));
    expect(REGISTRY.filter((l) => "depth" in l).map((l) => l.id)).toEqual([DEPTH_LAYER]);
  });

  // Session AU: the kind tables moved onto the kind descriptors. These pin M10's orders.
  it("kinds: counted in M10's order (teeth as bones); labels' focus order; one layer with parts", () => {
    expect(COUNT_ORDER).toEqual(["bone", "muscle", "muscle_part", "ligament", "cartilage", "disc", "meniscus"]);
    expect(countKind("tooth")).toBe("bone");
    expect(LABEL_ORDER).toEqual(["muscles", "ligaments", "cartilage", "bones"]);
    expect(REGISTRY.filter((l) => hasNestedParts(l.id)).map((l) => l.id)).toEqual([NESTED_LAYER]);
    for (const l of REGISTRY)
      for (const k of l.kinds)
        if ("parentOf" in k) expect(layerOfKind(k.parentOf.childKind)).toBe(l.id);
  });

  it("the default modes have only the eager layer on (M10's default)", () => {
    expect(Object.entries(DEFAULT_MODES).filter(([, m]) => m !== "off")).toEqual([[EAGER_LAYER, "on"]]);
  });

  // Decision 4: codes are stable forever. Every golden URL's state formats to the `layers=` it serialised to,
  // and that value parses back to the same state.
  it("formatLayers and parseLayers match golden/urls.json byte for byte", () => {
    let checked = 0;
    for (const [url, g] of Object.entries(golden)) {
      const m = /(?:^|[?&])layers=([^&]*)/.exec(g.serialised);
      if (!m) continue;
      const value = decodeURIComponent(m[1]!);
      expect(formatLayers({ layers: g.state.layers, depth: g.state.muscleDepth }), url).toBe(value);
      expect(parseLayers(value), url).toEqual({ layers: g.state.layers, depth: g.state.muscleDepth });
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  // Session AV (decision 2): the authoring halves cover exactly the registry's layers and kinds.
  it("registry.content.ts has one content half per layer, with a schema and summary length per kind", () => {
    expect(Object.keys(CONTENT_REGISTRY).sort()).toEqual([...LAYER_IDS].sort());
    for (const l of REGISTRY) {
      const c = CONTENT_REGISTRY[l.id];
      expect(Object.keys(c.kinds).sort(), l.id).toEqual(l.kinds.map((k) => k.id).sort());
      for (const k of l.kinds) {
        expect(schemaForKind(k.id), k.id).not.toBeNull();
        const w = bodyWordsOf(k.id)!;
        expect(w.min, k.id).toBeLessThan(w.max);
      }
      // Only the depth layer has a depth table.
      expect("depthFile" in c, l.id).toBe(l.id === DEPTH_LAYER);
    }
    expect(new Set(Object.values(CONTENT_REGISTRY).map((c) => c.folder)).size).toBe(LAYER_IDS.length);
    expect(DEPTH_FILE).toMatch(/^content\/.+\.json$/);
    expect(schemaForKind("nothing")).toBeNull();
  });
});
