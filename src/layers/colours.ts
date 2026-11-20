// Layer colours (musculoskeletal spec §6.3, M7 plan decision 5). Pure, so the
// colour-vision test (tests/layerColours.test.ts) covers them.

import type { TissueLayer } from "../state/url";

/** Material colour of each soft-tissue layer (sRGB). */
export const LAYER_COLOURS: Record<TissueLayer, string> = {
  muscles: "#a8483f",
  ligaments: "#d9dde3",
  cartilage: "#a9bccb",
};

/** Tendons and aponeuroses: a lighter muscle colour (spec §6.3). */
export const TENDON_COLOUR = "#c98a7c";
