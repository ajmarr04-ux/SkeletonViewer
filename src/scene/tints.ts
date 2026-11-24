// Origin, insertion and antagonist tints (musculoskeletal spec §5.2–5.3, §6.3;
// M9 plan decision 8). Pure, so the colour-vision test
// (tests/colourVision.test.ts) covers them. Okabe–Ito colours, like the regions.

export type TintRole = "origin" | "insertion" | "antagonist";
export const TINT_ROLES: readonly TintRole[] = ["origin", "insertion", "antagonist"];

/** sRGB. Origin yellow, insertion blue, antagonist reddish purple. */
export const TINT_COLOURS: Record<TintRole, string> = {
  origin: "#F0E442",
  insertion: "#0072B2",
  antagonist: "#CC79A7",
};

export const TINT_NAMES: Record<TintRole, string> = { origin: "Origin", insertion: "Insertion", antagonist: "Antagonist" };

/**
 * A structure that is both origin and insertion of the selection with no patch
 * (the fallback) takes the origin tint plus an outline in the insertion colour
 * (spec §5.3). At most this many such outlines are drawn at once (each is a
 * draw call); the serial trunk muscles that have more (the intercostals …)
 * show the rest in the origin tint alone (QUESTIONS 133).
 */
export const MAX_BOTH_OUTLINES = 4;
export const BOTH_OUTLINE = { widthPx: 2, colour: TINT_COLOURS.insertion } as const;
