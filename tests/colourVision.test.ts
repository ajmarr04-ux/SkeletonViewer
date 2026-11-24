import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYER_COLOURS, TENDON_COLOUR } from "../src/layers/colours";
import { drawnColourMode } from "../src/scene/isolation";
import { ACCENT_COLOUR, BONE_COLOUR, SCENE_BACKGROUND, SELECTION_OUTLINE_COLOUR } from "../src/scene/material";
import { OUTLINE } from "../src/scene/outline";
import { contrastRatio, deltaE2000, parseHex, REGIONS, regionColour, simulateCvd, toLab, type Rgb } from "../src/scene/regionColours";
import { TINT_COLOURS } from "../src/scene/tints";
import { GHOST_OPACITY } from "../src/state/store";

// M10 plan decision 3 (session AL): one table of every colour that can be on
// screen at once, and every pair of them that can actually meet, checked with
// the existing colour-vision rule: ΔE2000 ≥ 8 under normal vision,
// deuteranopia and protanopia (spec §6.3, M5's colour-by-region rule), ≥ 20
// for the tints' neighbours (M9 plan decision 8). Pairs that never meet, or
// that earlier milestones already test, are listed in EXEMPT with the reason.
// If a pair fails, the colour changes, not the threshold.

const hex = (c: Rgb): string => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0")).join("")}`;
/** `fg` at `alpha` over `bg` (sRGB, as the browser composites). */
const over = (fg: string, alpha: number, bg: string): string => {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return hex(f.map((x, i) => x * alpha + b[i]! * (1 - alpha)) as Rgb);
};

/** Solid structures: the bone ivory (also the teeth) and the layers' colours. */
const SOLID: Record<string, string> = {
  bone: BONE_COLOUR,
  muscles: LAYER_COLOURS.muscles,
  tendon: TENDON_COLOUR,
  ligaments: LAYER_COLOURS.ligaments,
  cartilage: LAYER_COLOURS.cartilage,
};
const TINTS: Record<string, string> = { ...TINT_COLOURS };
const REGION: Record<string, string> = Object.fromEntries(REGIONS.filter((r) => r.region !== "teeth").map((r) => [`region:${r.region}`, regionColour(r.region)]));
/** Ghosts: each layer's colour at the lowest, default and highest ghost opacity over the background (no AO, spec §6). */
const GHOST: Record<string, string> = Object.fromEntries(
  Object.entries({ bone: BONE_COLOUR, ...LAYER_COLOURS }).flatMap(([name, c]) =>
    [GHOST_OPACITY.min, GHOST_OPACITY.default, GHOST_OPACITY.max].map((o) => [`ghost:${name}@${o}`, over(c, o, SCENE_BACKGROUND)]),
  ),
);
const MARKS: Record<string, string> = {
  accent: ACCENT_COLOUR,
  outline: SELECTION_OUTLINE_COLOUR,
  hover: OUTLINE.hover.colour,
  background: SCENE_BACKGROUND,
};
const ALL: Record<string, string> = { ...SOLID, ...TINTS, ...REGION, ...GHOST, ...MARKS };

const isA = (group: Record<string, string>) => (n: string) => n in group;
const solid = isA(SOLID);
const tint = isA(TINTS);
const region = isA(REGION);
const ghost = isA(GHOST);

/** Pairs that never meet on screen, or are tested elsewhere: the first rule that matches gives the reason. */
const EXEMPT: { test: (a: string, b: string) => boolean; why: string }[] = [
  { test: (a, b) => region(a) && region(b), why: "two region colours: tests/regionColours.test.ts (M5)" },
  { test: (a, b) => (region(a) && b === "bone") || (a === "bone" && region(b)), why: "the teeth keep the ivory in colour-by-region: tests/regionColours.test.ts (M5)" },
  {
    test: (a, b) => (region(a) && tint(b)) || (tint(a) && region(b)),
    why: "colour-by-region pauses while any tint or patch is drawn (drawnColourMode, tested below)",
  },
  {
    test: (a, b) => (a === "accent" && (b === "bone" || region(b))) || ((a === "bone" || region(a)) && b === "accent"),
    why: "the pale accent on ivory and the region colours: the selection outline carries the selection (M3; outline/bone and outline/regions are checked)",
  },
  { test: (a, b) => (a === "accent" && b === "outline") || (a === "outline" && b === "accent"), why: "the outline is drawn around the accent on purpose: two cues for one selection (M3)" },
  { test: (a, b) => [a, b].includes("hover") && [a, b].includes("accent"), why: "the hover outline is never drawn on the focus (Isolation.tsx: hover skips focusIds)" },
  { test: (a, b) => [a, b].includes("hover") && [a, b].includes("outline"), why: "the hover outline and the selection outline are never on the same structure; the joint partner's outline uses the selection blue on purpose" },
  {
    test: (a, b) => (ghost(a) || a === "background") && (ghost(b) || b === "background"),
    why: "ghosts are faint context, not told apart by colour: the Layers panel names which layer is ghosted",
  },
  { test: (a, b) => [a, b].includes("accent") && (ghost(a) || ghost(b) || a === "background" || b === "background"), why: "the focus against ghosts and the background is outlined (outline/ghost and outline/background are checked)" },
];

/** Pairs that sit side by side and need the stronger ≥ 20 (M9 plan decision 8). */
const STRONG = new Set(
  [
    ["origin", "insertion"],
    ["bone", "origin"],
    ["bone", "insertion"],
    ["cartilage", "origin"],
    ["cartilage", "insertion"],
    ["muscles", "antagonist"],
    ["origin", "antagonist"],
    ["accent", "origin"],
    ["accent", "insertion"],
  ].map(([a, b]) => `${a}/${b}`),
);

const names = Object.keys(ALL);
const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const));
const exemptWhy = (a: string, b: string) => EXEMPT.find((e) => e.test(a, b))?.why;
const checked = pairs.filter(([a, b]) => exemptWhy(a, b) === undefined);
const need = (a: string, b: string) => (STRONG.has(`${a}/${b}`) || STRONG.has(`${b}/${a}`) ? 20 : 8);

describe("colour vision: every colour that can be on screen at once (M10 decision 3)", () => {
  it("the table and its exemptions are what the plan lists", () => {
    // Four layer colours with the bone, the tendon shade, the focus/hover/outline marks, three tints, seven region colours, ghosts.
    expect(Object.keys(SOLID)).toHaveLength(5);
    expect(Object.keys(REGION)).toHaveLength(7);
    expect(Object.keys(GHOST)).toHaveLength(12);
    // Every pair a solid structure takes part in with another solid, a tint or a region colour is checked.
    for (const [a, b] of pairs) if (a !== "bone" && ((solid(a) && (solid(b) || tint(b) || region(b))) || (solid(b) && (tint(a) || region(a))))) expect(exemptWhy(a, b), `${a}/${b}`).toBeUndefined();
    // Every pair with the selection outline is checked, except with the accent it surrounds and the hover outline.
    for (const n of names) if (n !== "outline" && n !== "accent" && n !== "hover") expect(exemptWhy("outline", n), n).toBeUndefined();
    expect(checked.length).toBeGreaterThan(150);
  });

  for (const kind of [null, "deuteranopia", "protanopia"] as const) {
    it(`ΔE2000 ≥ 8 (≥ 20 for the tints' neighbours) for every pair that can meet${kind ? ` under ${kind}` : ""}`, () => {
      const lab = (n: string) => {
        const c = parseHex(ALL[n]!);
        return toLab(kind ? simulateCvd(c, kind) : c);
      };
      const low = checked
        .map(([a, b]) => ({ pair: `${a}/${b}`, d: Math.round(deltaE2000(lab(a), lab(b)) * 10) / 10, need: need(a, b) }))
        .filter((p) => p.d < p.need);
      expect(low).toEqual([]);
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
    const swatches: Record<string, string> = { bone: BONE_COLOUR, ...LAYER_COLOURS, ...TINTS, ...REGION };
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
