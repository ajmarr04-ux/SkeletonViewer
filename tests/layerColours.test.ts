import { describe, expect, it } from "vitest";
import { LAYER_COLOURS, TENDON_COLOUR } from "../src/layers/colours";
import { ACCENT_COLOUR, BONE_COLOUR, SELECTION_OUTLINE_COLOUR } from "../src/scene/material";
import { deltaE2000, parseHex, simulateCvd, toLab } from "../src/scene/regionColours";

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
