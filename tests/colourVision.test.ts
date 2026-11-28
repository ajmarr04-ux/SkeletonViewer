import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EAGER_LAYER, LAYER_IDS } from "../src/systems/registry";
import { ACCENT_COLOUR, BONE_COLOUR, SCENE_BACKGROUND } from "../src/scene/material";
import { OUTLINE } from "../src/scene/outline";
import { contrastRatio, parseHex, type Rgb } from "../src/scene/regionColours";
import { colourTable, drawnColourMode, hex, lowPairs, over, pairsOf, registryLayers, VISIONS } from "./lib/colourTable";

// M10 plan decision 3 (session AL), rebuilt from the registry in M14 BW (plan
// decision 7): every colour that can be on screen at once, and every pair of
// them that can actually meet, checked with the colour-vision rule: ΔE2000 ≥ 8
// under normal vision, deuteranopia and protanopia (spec §6.3, M5's
// colour-by-region rule), ≥ 20 for the tints' neighbours (M9 plan decision 8).
// The colours and which layers can meet come from the descriptors
// (`colour.material`, `colour.shades`, `colour.neverWith`); the pair rule and
// the drawing-rule exemptions are in tests/lib/colourTable.ts. If a pair
// fails, the colour changes, not the threshold.

const LAYERS = registryLayers();
const TABLE = colourTable(LAYERS, { dimmed: true });
const { all, checked, exemptWhy } = pairsOf(LAYERS, TABLE);
const byName = Object.fromEntries(TABLE.map((e) => [e.name, e]));
const ofRole = (role: string) => Object.fromEntries(TABLE.filter((e) => e.role === role).map((e) => [e.name, e.colour]));

/** Solid structures: every layer's material and shades (the bone ivory is also the teeth's). */
const SOLID = { ...ofRole("solid"), ...ofRole("shade") };
const TINTS = ofRole("tint");
const REGION = ofRole("region");

describe("colour vision: every colour that can be on screen at once (M10 decision 3, from the registry since M14 BW)", () => {
  it("the table is the registry's layers, shades and ghosts, the tints, the region colours and the marks", () => {
    const shades = LAYERS.reduce((n, l) => n + Object.keys(l.shades ?? {}).length, 0);
    expect(Object.keys(SOLID)).toHaveLength(LAYER_IDS.length + shades);
    expect(Object.keys(ofRole("ghost"))).toHaveLength(3 * LAYER_IDS.length);
    // Dimmed rows for each layer with a `dim` amount (only the muscles today: their colour and the tendon shade).
    expect(Object.keys(ofRole("dim"))).toHaveLength(LAYERS.filter((l) => l.dim).reduce((n, l) => n + 1 + Object.keys(l.shades ?? {}).length, 0));
    expect(Object.keys(TINTS)).toHaveLength(3);
    expect(Object.keys(REGION)).toHaveLength(7);
    expect(TABLE.filter((e) => e.role === "mark").map((e) => e.name)).toEqual(["accent", "outline", "hover", "background"]);
    expect(byName[EAGER_LAYER]!.colour).toBe(BONE_COLOUR);
  });

  it("every layer meets every other (no descriptor declares neverWith today) and is checked against it", () => {
    for (const l of LAYERS) expect(l.neverWith ?? [], l.id).toEqual([]);
    // Every pair a solid structure (not the ivory, which the accent and region rules cover) takes part in with another solid, a tint or a region colour is checked.
    const solidish = (n: string) => n in SOLID;
    for (const [a, b] of all) {
      const [x, y] = [a.name, b.name];
      if (x === EAGER_LAYER || y === EAGER_LAYER) continue;
      if ((solidish(x) && (solidish(y) || y in TINTS || y in REGION)) || (solidish(y) && (x in TINTS || x in REGION))) expect(exemptWhy(a, b), `${x}/${y}`).toBeUndefined();
    }
    // Every pair with the selection outline is checked, except with the accent it surrounds and the hover outline.
    for (const e of TABLE) if (!["outline", "accent", "hover"].includes(e.name)) expect(exemptWhy(byName.outline!, e), e.name).toBeUndefined();
    expect(checked.length).toBeGreaterThan(150);
  });

  for (const kind of VISIONS) {
    it(`ΔE2000 ≥ 8 (≥ 20 for the tints' neighbours) for every pair that can meet${kind ? ` under ${kind}` : ""}`, () => {
      expect(lowPairs(checked, kind)).toEqual([]);
    });
  }

  it("colour-by-region pauses while a tint or a patch is drawn", () => {
    const none = { tints: new Map(), patches: new Map() };
    expect(drawnColourMode("region", none)).toBe("region");
    expect(drawnColourMode("bone", none)).toBe("bone");
    expect(drawnColourMode("region", { tints: new Map([["humerus_left", "origin" as const]]), patches: new Map() })).toBe("bone");
    expect(drawnColourMode("region", { tints: new Map(), patches: new Map([["biceps_brachii_left", "insertion" as const]]) })).toBe("bone");
    expect(drawnColourMode("bone", { tints: new Map([["humerus_left", "origin" as const]]), patches: new Map() })).toBe("bone");
  });
});

// The overlays' colours come from the stylesheet, so the test reads them there.
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
function rule(selector: string): string {
  const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule ${selector} in styles.css`);
  return m[2]!;
}
/** A `background`/`color` value as [hex, alpha]: `#rrggbb` or `rgb(r g b / a)`. */
function colourOf(block: string, prop: "background" | "color"): [string, number] {
  const m = block.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`));
  if (!m) throw new Error(`no ${prop} in ${block}`);
  const v = m[1]!.trim();
  if (v.startsWith("#")) return [v, 1];
  const n = v.match(/rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)/);
  if (!n) throw new Error(`can't read ${v}`);
  return [hex([n[1], n[2], n[3]].map((x) => Number(x) / 255) as Rgb), n[4] === undefined ? 1 : Number(n[4])];
}

describe("legend chips and label boxes (M10 decision 3)", () => {
  // The legend sits over the scene's background (bottom left, clear of the skeleton framing).
  const [legendBg, legendAlpha] = colourOf(rule(".legend"), "background");
  const legend = over(legendBg, legendAlpha, SCENE_BACKGROUND);

  it("every legend swatch keeps 3:1 against the legend background (WCAG 1.4.11)", () => {
    const swatches: Record<string, string> = { ...ofRole("solid"), ...TINTS, ...REGION };
    const low = Object.entries(swatches)
      .map(([n, c]) => ({ n, r: Math.round(contrastRatio(parseHex(c), parseHex(legend)) * 100) / 100 }))
      .filter((x) => x.r < 3);
    expect(low).toEqual([]);
  });

  it("legend text keeps 4.5:1", () => {
    for (const sel of [".legend-chip", ".legend-item"]) expect(contrastRatio(parseHex(colourOf(rule(sel), "color")[0]), parseHex(legend)), sel).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseHex(colourOf(rule(".legend-note"), "color")[0]), parseHex(legend))).toBeGreaterThanOrEqual(4.5);
  });

  it("label text keeps 4.5:1 against its box over any structure, the scene and white", () => {
    const label = rule(".label");
    const [text] = colourOf(label, "color");
    const boxes = { label: colourOf(label, "background"), focus: colourOf(rule(".label-focus"), "background") };
    const under = { ...SOLID, ...TINTS, ...REGION, accent: ACCENT_COLOUR, hover: OUTLINE.hover.colour, background: SCENE_BACKGROUND, white: "#ffffff" };
    const low: string[] = [];
    for (const [box, [bg, a]] of Object.entries(boxes))
      for (const [n, c] of Object.entries(under)) {
        const r = contrastRatio(parseHex(text), parseHex(over(bg, a, c)));
        if (r < 4.5) low.push(`${box} over ${n}: ${r.toFixed(2)}`);
      }
    expect(low).toEqual([]);
  });
});
