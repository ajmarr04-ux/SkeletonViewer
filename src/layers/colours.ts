// Layer colours (musculoskeletal spec §6.3, M7 plan decision 5). Pure, so the
// colour-vision test (tests/colourVision.test.ts) covers them.

import type { TissueLayer } from "../state/url";

/**
 * Material colour of each soft-tissue layer (sRGB). M10 session AL changed all
 * four (M7: muscles #a8483f, tendon #c98a7c, ligaments #d9dde3, cartilage
 * #a9bccb) by the smallest step that passes every pair: the muscle swatch was
 * under 3:1 on the legend, the ligaments too close to the hover outline, the
 * cartilage to the pectoral girdle's region colour (deuteranopia) and the
 * tendon to the thorax's (protanopia).
 */
export const LAYER_COLOURS: Record<TissueLayer, string> = {
  muscles: "#b44d43",
  ligaments: "#cccccc",
  cartilage: "#c5dfee",
};

/** Tendons and aponeuroses: a lighter muscle colour (spec §6.3). */
export const TENDON_COLOUR = "#c18274";
