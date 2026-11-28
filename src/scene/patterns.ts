// The pattern cue on the role tints (SPEC-platform §7.2; M14 plan decision 8):
// diagonal stripes for origin, dots for insertion, cross-hatch for antagonist,
// so a role reads by its pattern as well as its hue. Pure, so the unit tests,
// the legend's SVG swatches and the screenshot all use the shader's rule.
//
// Where the index lives: in the alpha of each batch's instance colour (the
// colours texture `BatchedMesh` already has, RGBA float, alpha otherwise
// unused by the opaque materials): alpha = 1 + pattern index, so the texture's
// default 1 is "none". No extra texture or uniform per batch; one shared
// uniform carries the period in device pixels.

import type { Color, Vector4 } from "three";
import type { TintRole } from "./tints";

export type Pattern = "none" | "stripes" | "dots" | "hatch";

/** The pattern drawn with each role's tint (spec §12 default). */
export const PATTERN_OF: Readonly<Record<TintRole, Pattern>> = { origin: "stripes", insertion: "dots", antagonist: "hatch" };

/** The shader's index for each pattern (0 = none). */
export const PATTERN_INDEX: Readonly<Record<Pattern, number>> = { none: 0, stripes: 1, dots: 2, hatch: 3 };

/** The period in CSS pixels; the shader works in device pixels (× devicePixelRatio). */
export const PATTERN_PERIOD_CSS = 6;

/** How much darker the pattern's marks are than the tint (not black, so the AO still reads). */
export const PATTERN_DARKEN = 0.25;

/** Stripe width and hatch line width as a share of the period; dot radius as a share of the period. */
const STRIPE = 0.5;
const HATCH = 0.3;
const DOT = 0.3;

/** The instance-colour alpha that carries a pattern. */
export const patternAlpha = (p: Pattern): number => 1 + PATTERN_INDEX[p];

/** The pattern an instance-colour alpha carries (rounded, as the shader does). */
export function patternOfAlpha(alpha: number): Pattern {
  const i = Math.round(alpha) - 1;
  return (Object.keys(PATTERN_INDEX) as Pattern[]).find((p) => PATTERN_INDEX[p] === i) ?? "none";
}

/** An instance colour with its pattern, ready for `BatchedMesh.setColorAt` (which writes all four channels for a Vector4). */
export function withPattern(out: Vector4, colour: Color, p: Pattern): Vector4 {
  return out.set(colour.r, colour.g, colour.b, patternAlpha(p));
}

const fract = (x: number) => x - Math.floor(x);

/**
 * Is the pixel at (x, y) (device pixels, the fragment's `gl_FragCoord`) one of
 * the pattern's darker marks? The JS twin of `PATTERN_FRAGMENT`.
 */
export function patternMark(p: Pattern, x: number, y: number, period: number): boolean {
  const u = x / period;
  const v = y / period;
  switch (p) {
    case "stripes":
      return fract(u + v) < STRIPE;
    case "dots":
      return Math.hypot(fract(u) - 0.5, fract(v) - 0.5) < DOT;
    case "hatch":
      return fract(u + v) < HATCH || fract(u - v) < HATCH;
    default:
      return false;
  }
}

/** The shared period uniform (device pixels); every patterned material holds this one object. */
export const PATTERN_PERIOD_UNIFORM = { value: PATTERN_PERIOD_CSS };

/** Follow the canvas's pixel ratio, so the pattern is about 6 CSS px on every screen. */
export function setPatternPixelRatio(dpr: number): void {
  PATTERN_PERIOD_UNIFORM.value = PATTERN_PERIOD_CSS * Math.max(dpr, 0.5);
}

export const PATTERN_UNIFORM_DECL = "\nuniform float uPatternPeriod;\n";

/**
 * GLSL, after the tint (`vTint`, see `material.ts`): darken the marks of the
 * instance's pattern. Screen space and static, so it neither moves with the
 * camera nor animates (reduced motion needs nothing more).
 */
export const PATTERN_FRAGMENT = /* glsl */ `
  {
    float pat = floor( vTint.a + 0.5 ) - 1.0;
    if ( pat > 0.5 ) {
      vec2 q = gl_FragCoord.xy / uPatternPeriod;
      float mark;
      if ( pat < 1.5 ) mark = step( fract( q.x + q.y ), ${STRIPE.toFixed(3)} );
      else if ( pat < 2.5 ) mark = step( length( fract( q ) - 0.5 ), ${DOT.toFixed(3)} );
      else mark = max( step( fract( q.x + q.y ), ${HATCH.toFixed(3)} ), step( fract( q.x - q.y ), ${HATCH.toFixed(3)} ) );
      diffuseColor.rgb *= 1.0 - ${PATTERN_DARKEN.toFixed(3)} * mark;
    }
  }
`;

/** The darker shade of a tint (sRGB hex), as the legend and the screenshot draw it. */
export function markColour(hex: string): string {
  // The shader darkens in linear space; the swatch darkens the sRGB value by the matching factor.
  const k = Math.pow(1 - PATTERN_DARKEN, 1 / 2.2);
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/**
 * The pattern's marks over one period, `n` × `n` cells, rows top to bottom as
 * on screen (the shader's `gl_FragCoord` counts up from the bottom, so rows are
 * flipped to match): the legend's SVG swatch and the screenshot's canvas
 * pattern are rasterised from the shader's own rule.
 */
export function patternCells(p: Pattern, n: number): boolean[][] {
  return Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => patternMark(p, col + 0.5, n - row - 0.5, n)));
}

/** The marks over one period as an SVG path in a `size` × `size` box (row runs merged). */
export function patternPath(p: Pattern, size = PATTERN_PERIOD_CSS, n = 12): string {
  const c = size / n;
  const f = (x: number) => +(x * c).toFixed(3);
  let d = "";
  patternCells(p, n).forEach((row, y) => {
    for (let x = 0; x < n; ) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < n && row[x]) x++;
      d += `M${f(start)} ${f(y)}h${f(x - start)}v${f(1)}h${-f(x - start)}z`;
    }
  });
  return d;
}
