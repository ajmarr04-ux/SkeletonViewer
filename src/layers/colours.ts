// The tendon colour (musculoskeletal spec §6.3). The layers' own colours are
// in their descriptors (`src/systems/`, M11). Pure, so the colour-vision test
// (tests/colourVision.test.ts) covers it.
//
// M10 session AL changed every layer colour by the smallest step that passes
// every pair (tests/colourVision.test.ts); the tendon (M7: #c98a7c) was too
// close to the thorax's region colour under protanopia.

/** Tendons and aponeuroses: a lighter muscle colour (spec §6.3). */
export const TENDON_COLOUR = "#c18274";
