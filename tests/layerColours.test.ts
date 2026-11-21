import { describe, expect, it } from "vitest";
import { LAYER_COLOURS, TENDON_COLOUR } from "../src/layers/colours";
import { ACCENT_COLOUR, BONE_COLOUR, SELECTION_OUTLINE_COLOUR } from "../src/scene/material";
import { deltaE2000, parseHex, simulateCvd, toLab } from "../src/scene/regionColours";
import { TINT_COLOURS } from "../src/scene/tints";

// M7 plan decision 5: every layer colour stays distinct from the others, the
// bone ivory and the focus accent, with and without simulated deuteranopia
// and protanopia (ΔE2000 ≥ 8, the colour-by-region rule).
const colours: Record<string, string> = {
  bone: BONE_COLOUR,
  accent: ACCENT_COLOUR,
  outline: SELECTION_OUTLINE_COLOUR,
  muscles: LAYER_COLOURS.muscles,
  tendon: TENDON_COLOUR,
  ligaments: LAYER_COLOURS.ligaments,
  cartilage: LAYER_COLOURS.cartilage,
};
// The accent and outline are already tested against bone (M3); here every pair with a layer colour.
const pairs = Object.keys(colours).flatMap((a, i) =>
  Object.keys(colours)
    .slice(i + 1)
    .filter((b) => !["bone", "accent", "outline"].includes(a) || !["bone", "accent", "outline"].includes(b))
    .map((b) => [a, b] as const),
);

describe("layer colours", () => {
  for (const kind of [null, "deuteranopia", "protanopia"] as const) {
    it(`ΔE2000 ≥ 8 for every pair${kind ? ` under ${kind}` : ""}`, () => {
      const lab = (name: string) => {
        const c = parseHex(colours[name]!);
        return toLab(kind ? simulateCvd(c, kind) : c);
      };
      const low = pairs.map(([a, b]) => ({ pair: `${a}/${b}`, d: deltaE2000(lab(a), lab(b)) })).filter((p) => p.d < 8);
      expect(low).toEqual([]);
    });
  }
});

// M9 plan decision 8: the origin, insertion and antagonist tints. Every pair
// with the layer colours, the bone, the focus accent, the selection outline
// and each other passes the spec's rule (ΔE2000 ≥ 8 under normal vision,
// deuteranopia and protanopia, §6.3); the pairs that sit side by side on
// screen pass ≥ 20 (the plan's stronger aim): origin and insertion with each
// other and with the bone and cartilage they tint, the antagonist with the
// muscle colour it replaces (with the tendon colour it reaches 19.x under
// normal vision, so that pair keeps the spec's ≥ 8).
describe("origin, insertion and antagonist tints", () => {
  const all: Record<string, string> = { ...colours, origin: TINT_COLOURS.origin, insertion: TINT_COLOURS.insertion, antagonist: TINT_COLOURS.antagonist };
  const tintNames = ["origin", "insertion", "antagonist"];
  const tintPairs = Object.keys(all).flatMap((a, i) =>
    Object.keys(all)
      .slice(i + 1)
      .filter((b) => tintNames.includes(a) || tintNames.includes(b))
      .map((b) => [a, b] as const),
  );
  const strong = [
    ["origin", "insertion"],
    ["bone", "origin"],
    ["bone", "insertion"],
    ["cartilage", "origin"],
    ["cartilage", "insertion"],
    ["muscles", "antagonist"],
    ["origin", "antagonist"],
    ["accent", "origin"],
    ["accent", "insertion"],
  ] as const;
  for (const kind of [null, "deuteranopia", "protanopia"] as const) {
    const lab = (name: string) => {
      const c = parseHex(all[name]!);
      return toLab(kind ? simulateCvd(c, kind) : c);
    };
    it(`ΔE2000 ≥ 8 for every pair with a tint${kind ? ` under ${kind}` : ""}`, () => {
      const low = tintPairs.map(([a, b]) => ({ pair: `${a}/${b}`, d: deltaE2000(lab(a), lab(b)) })).filter((p) => p.d < 8);
      expect(low).toEqual([]);
    });
    it(`ΔE2000 ≥ 20 for the tints' neighbours${kind ? ` under ${kind}` : ""}`, () => {
      const low = strong.map(([a, b]) => ({ pair: `${a}/${b}`, d: deltaE2000(lab(a), lab(b)) })).filter((p) => p.d < 20);
      expect(low).toEqual([]);
    });
  }
});
