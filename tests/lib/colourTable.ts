// The colour-vision pair table (M10 plan decision 3, rebuilt from the registry
// in M14 BW, plan decision 7): every colour that can be on screen, and every
// pair of them that can meet, under one rule. Used by tests/colourVision.test.ts
// (the shipped layers) and tests/futureColours.test.ts (the proposed future
// systems, plan decision 10), so both run the same pairs and thresholds.
//
// Names: a layer's solid is its ID (`muscles`), a shade `<layer>:<shade>`
// (`muscles:tendon`), a ghost `ghost:<layer>@<opacity>`, a dimmed solid
// `dim:<layer>` / `dim:<layer>:<shade>`, a tint its role, a region colour
// `region:<region>`, and the marks `accent`, `outline`, `hover`, `background`.

import { drawnColourMode } from "../../src/scene/isolation";
import { ACCENT_COLOUR, SCENE_BACKGROUND, SELECTION_OUTLINE_COLOUR } from "../../src/scene/material";
import { OUTLINE } from "../../src/scene/outline";
import { deltaE2000, linearToSrgb, parseHex, REGIONS, regionColour, simulateCvd, srgbToLinear, toLab, type Rgb } from "../../src/scene/regionColours";
import { TINT_COLOURS } from "../../src/scene/tints";
import { GHOST_OPACITY } from "../../src/state/store";
import { EAGER_LAYER, LAYER_IDS, layerDescriptor } from "../../src/systems/registry";

export { drawnColourMode };

/** One layer's colours: from its descriptor, or a proposed future layer's from tests/fixtures/future-colours.json. */
export type LayerColours = { id: string; material: string; shades?: Readonly<Record<string, string>>; dim?: number; neverWith?: readonly string[] };

/** Every registered layer's colours, in registry order. */
export const registryLayers = (): LayerColours[] =>
  LAYER_IDS.map((id) => {
    const c = layerDescriptor(id).colour;
    return { id, material: c.material, shades: c.shades, dim: c.dim, neverWith: c.neverWith };
  });

export const hex = (c: Rgb): string => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0")).join("")}`;
/** `fg` at `alpha` over `bg` (sRGB, as the browser composites). */
export const over = (fg: string, alpha: number, bg: string): string => {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return hex(f.map((x, i) => x * alpha + b[i]! * (1 - alpha)) as Rgb);
};

/**
 * Context dimming (M14 plan decision 9, drawn from BY): mixed `amount` toward
 * its own luminance in linear space, so the brightness stays. The amount is
 * each layer's `colour.dim`. BY moves this into `src/`.
 */
export function dim(c: string, amount: number): string {
  const lin = parseHex(c).map(srgbToLinear) as Rgb;
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return hex(lin.map((x) => linearToSrgb(x + (y - x) * amount)) as Rgb);
}

export type Role = "solid" | "shade" | "ghost" | "dim" | "tint" | "region" | "mark";
export type Entry = { name: string; colour: string; role: Role; layer?: string };

export type TableOptions = {
  /** Add the dimmed solid and shades of each layer with a `dim` amount (plan decision 9). */
  dimmed?: boolean;
};

/** The table: every layer's solid, shades and three ghosts, the tints, the region colours (bones only, spec §7.4) and the marks. */
export function colourTable(layers: readonly LayerColours[], opts: TableOptions = {}): Entry[] {
  const out: Entry[] = [];
  for (const l of layers) {
    out.push({ name: l.id, colour: l.material, role: "solid", layer: l.id });
    for (const [s, c] of Object.entries(l.shades ?? {})) out.push({ name: `${l.id}:${s}`, colour: c, role: "shade", layer: l.id });
  }
  // Ghosts are the layer's material only: the ghost batches carry no instance colours, so a ghosted tendon is drawn in the muscle colour.
  for (const l of layers)
    for (const o of [GHOST_OPACITY.min, GHOST_OPACITY.default, GHOST_OPACITY.max])
      out.push({ name: `ghost:${l.id}@${o}`, colour: over(l.material, o, SCENE_BACKGROUND), role: "ghost", layer: l.id });
  if (opts.dimmed)
    for (const l of layers) {
      if (!l.dim) continue;
      out.push({ name: `dim:${l.id}`, colour: dim(l.material, l.dim), role: "dim", layer: l.id });
      for (const [s, c] of Object.entries(l.shades ?? {})) out.push({ name: `dim:${l.id}:${s}`, colour: dim(c, l.dim), role: "dim", layer: l.id });
    }
  for (const [r, c] of Object.entries(TINT_COLOURS)) out.push({ name: r, colour: c, role: "tint" });
  for (const r of REGIONS) if (r.region !== "teeth") out.push({ name: `region:${r.region}`, colour: regionColour(r.region), role: "region", layer: EAGER_LAYER });
  out.push(
    { name: "accent", colour: ACCENT_COLOUR, role: "mark" },
    { name: "outline", colour: SELECTION_OUTLINE_COLOUR, role: "mark" },
    { name: "hover", colour: OUTLINE.hover.colour, role: "mark" },
    { name: "background", colour: SCENE_BACKGROUND, role: "mark" },
  );
  return out;
}

/** Layers that never meet (a descriptor's `neverWith`, either way round). */
const apart = (layers: readonly LayerColours[], a: Entry, b: Entry): boolean => {
  if (!a.layer || !b.layer || a.layer === b.layer) return false;
  const never = (x: string, y: string) => layers.find((l) => l.id === x)?.neverWith?.includes(y) ?? false;
  return never(a.layer, b.layer) || never(b.layer, a.layer);
};

const EAGER = EAGER_LAYER as string;
const is = (role: Role) => (e: Entry) => e.role === role;
const isName = (n: string) => (e: Entry) => e.name === n;
/** The eager layer's own colour, solid or dimmed (the ivory: bones and teeth). */
const ivory = (e: Entry) => e.layer === EAGER && (e.role === "solid" || e.role === "dim");
const either = (p: (e: Entry) => boolean, q: (e: Entry) => boolean) => (a: Entry, b: Entry) => (p(a) && q(b)) || (q(a) && p(b));

/**
 * Pairs that never meet on screen, or are tested elsewhere: the first rule that
 * matches gives the reason. These are drawing rules, not layers (plan decision
 * 7): which layers can meet is the descriptors' `neverWith`.
 */
export const EXEMPT: { test: (a: Entry, b: Entry) => boolean; why: string }[] = [
  { test: (a, b) => is("region")(a) && is("region")(b), why: "two region colours: tests/regionColours.test.ts (M5)" },
  { test: (a, b) => either(is("region"), (e) => e.layer === EAGER && e.role === "solid")(a, b), why: "the teeth keep the ivory in colour-by-region: tests/regionColours.test.ts (M5)" },
  { test: either(is("region"), is("tint")), why: "colour-by-region pauses while any tint or patch is drawn (drawnColourMode, tested below)" },
  { test: either(is("region"), is("dim")), why: "context dimming is off with colour-by-region (plan decision 9)" },
  {
    test: either(isName("accent"), (e) => ivory(e) || is("region")(e)),
    why: "the pale accent on ivory and the region colours: the selection outline carries the selection (M3; outline/bone and outline/regions are checked)",
  },
  { test: either(isName("accent"), isName("outline")), why: "the outline is drawn around the accent on purpose: two cues for one selection (M3)" },
  { test: either(isName("hover"), isName("accent")), why: "the hover outline is never drawn on the focus (Isolation.tsx: hover skips focusIds)" },
  { test: either(isName("hover"), isName("outline")), why: "the hover outline and the selection outline are never on the same structure; the joint partner's outline uses the selection blue on purpose" },
  {
    test: (a, b) => (is("ghost")(a) || isName("background")(a)) && (is("ghost")(b) || isName("background")(b)),
    why: "ghosts are faint context, not told apart by colour: the Layers panel names which layer is ghosted",
  },
  { test: either(isName("accent"), (e) => is("ghost")(e) || isName("background")(e)), why: "the focus against ghosts and the background is outlined (outline/ghost and outline/background are checked)" },
  {
    test: (a, b) => a.layer !== undefined && a.layer === b.layer && (is("dim")(a) !== is("dim")(b)) && !is("ghost")(a) && !is("ghost")(b),
    why: "dimming takes a whole layer: a layer's dimmed colours never sit beside its own full ones (plan decision 9)",
  },
];

/** Pairs that sit side by side and need the stronger ≥ 20 (M9 plan decision 8): the tints against each other and their neighbours, by name. */
export const STRONG = new Set(
  [
    ["origin", "insertion"],
    [EAGER, "origin"],
    [EAGER, "insertion"],
    ["cartilage", "origin"],
    ["cartilage", "insertion"],
    ["muscles", "antagonist"],
    ["origin", "antagonist"],
    ["accent", "origin"],
    ["accent", "insertion"],
  ].map(([a, b]) => `${a}/${b}`),
);
export const need = (a: string, b: string): number => (STRONG.has(`${a}/${b}`) || STRONG.has(`${b}/${a}`) ? 20 : 8);
export const MIN_DE = 8;

export type Pairs = { all: (readonly [Entry, Entry])[]; checked: (readonly [Entry, Entry])[]; exemptWhy: (a: Entry, b: Entry) => string | undefined };

export function pairsOf(layers: readonly LayerColours[], table: readonly Entry[]): Pairs {
  const all = table.flatMap((a, i) => table.slice(i + 1).map((b) => [a, b] as const));
  const exemptWhy = (a: Entry, b: Entry) => (apart(layers, a, b) ? "the layers never meet (neverWith)" : EXEMPT.find((e) => e.test(a, b))?.why);
  return { all, checked: all.filter(([a, b]) => exemptWhy(a, b) === undefined), exemptWhy };
}

export type Vision = null | "deuteranopia" | "protanopia";
export const VISIONS: readonly Vision[] = [null, "deuteranopia", "protanopia"];
export const deltaUnder = (kind: Vision, a: string, b: string): number => {
  const lab = (c: string) => toLab(kind ? simulateCvd(parseHex(c), kind) : parseHex(c));
  return deltaE2000(lab(a), lab(b));
};
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Every checked pair under `kind` that falls below its threshold. */
export function lowPairs(pairs: readonly (readonly [Entry, Entry])[], kind: Vision): { pair: string; d: number; need: number }[] {
  return pairs
    .map(([a, b]) => ({ pair: `${a.name}/${b.name}`, d: round1(deltaUnder(kind, a.colour, b.colour)), need: need(a.name, b.name) }))
    .filter((p) => p.d < p.need);
}
