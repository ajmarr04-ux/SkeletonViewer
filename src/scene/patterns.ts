// The pattern cue on the role tints (SPEC-platform §7.2; M14 plan decision 8):
// diagonal stripes for origin, dots for insertion, cross-hatch for antagonist,
// so a role reads by its pattern as well as its hue. Pure, so the unit tests,
// the legend's SVG swatches and the screenshot all use the shader's rule.
//
// Where the index lives: in the alpha of each batch's instance colour (the
// colours texture `BatchedMesh` already has, RGBA float, alpha otherwise
// unused by the opaque materials): alpha = 1 + pattern index, so the texture's
// default 1 is "none". No extra texture or uniform per batch; one shared
// uniform carries the smallest on-screen period in device pixels.
//
// Where the marks are (M14 CA): on the surface, in world space (triplanar),
// not on the screen as in BX, which "swam" as the camera moved (BZ notes).

import type { Color, Vector4 } from "three";
import type { TintRole } from "./tints";

export type Pattern = "none" | "stripes" | "dots" | "hatch";

/** The pattern drawn with each role's tint (spec §12 default). */
export const PATTERN_OF: Readonly<Record<TintRole, Pattern>> = { origin: "stripes", insertion: "dots", antagonist: "hatch" };

/** The shader's index for each pattern (0 = none). */
export const PATTERN_INDEX: Readonly<Record<Pattern, number>> = { none: 0, stripes: 1, dots: 2, hatch: 3 };

/**
 * The period on the surface, in metres (M14 CA): the marks are laid out on the
 * structure in world space (triplanar), so they stick to it through pan, zoom
 * and orbit. About 18 CSS px at the tier-2 framing of a forearm muscle on a
 * 1280 × 800 view (the user's 3× of BX's 6 px, BZ notes).
 */
export const PATTERN_PERIOD_M = 0.022;

/**
 * The smallest period drawn on screen, in CSS px: zoomed out further, the marks
 * coarsen by octaves (2×, 4×, …, cross-faded), so they never shrink into a
 * shimmer; the shader works in device pixels (× devicePixelRatio).
 */
export const PATTERN_MIN_CSS = 14;

/** The most octaves the marks coarsen by (a whole-body view of a small structure). */
export const PATTERN_MAX_OCTAVES = 8;

/** How sharply the triplanar blend favours the projection facing the surface. */
const TRIPLANAR_SHARPNESS = 8;

/**
 * The period of the legend's and the screenshot key's swatches, in CSS px: they
 * show the pattern's look (two periods in a 14 px chip), not its size on
 * screen, which now depends on the zoom.
 */
export const PATTERN_SWATCH_CSS = 7;

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
 * Is the point at (x, y) (in the same units as `period`) one of the pattern's
 * darker marks? The JS twin of `PATTERN_FRAGMENT`'s rule on one projection
 * plane, without its anti-aliasing (the legend and the screenshot draw cells).
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

/** The shared smallest-period uniform (device pixels); every patterned material holds this one object. */
export const PATTERN_MIN_PX_UNIFORM = { value: PATTERN_MIN_CSS };

/** Follow the canvas's pixel ratio, so the smallest period is the same in CSS px on every screen. */
export function setPatternPixelRatio(dpr: number): void {
  PATTERN_MIN_PX_UNIFORM.value = PATTERN_MIN_CSS * Math.max(dpr, 0.5);
}

const f3 = (x: number) => x.toFixed(3);

/** GLSL for the fragment's common block: the uniform, the varyings and the mark functions. */
export const PATTERN_FRAGMENT_PARS = /* glsl */ `
uniform float uPatternMinPx;
varying vec3 vPatPos;
varying vec3 vPatNrm;
// A diagonal band of half-width h centred at h along s = u + v (fract(s) < 2h), anti-aliased over a.
float skvBand( float s, float h, float a ) {
  return 1.0 - smoothstep( h - a, h + a, abs( fract( s - h + 0.5 ) - 0.5 ) );
}
// The pattern's mark on one plane, q in periods, px = periods per device pixel.
float skvMark( float pat, vec2 q, float px ) {
  if ( pat < 1.5 ) return skvBand( q.x + q.y, ${f3(STRIPE / 2)}, 0.7 * px );
  if ( pat < 2.5 ) return 1.0 - smoothstep( ${f3(DOT)} - 0.5 * px, ${f3(DOT)} + 0.5 * px, length( fract( q ) - 0.5 ) );
  return max( skvBand( q.x + q.y, ${f3(HATCH / 2)}, 0.7 * px ), skvBand( q.x - q.y, ${f3(HATCH / 2)}, 0.7 * px ) );
}
// Triplanar: each plane's mark, weighted by how squarely the surface faces it.
float skvTriplanar( float pat, vec3 p, float px, vec3 w ) {
  return w.x * skvMark( pat, p.yz, px ) + w.y * skvMark( pat, p.zx, px ) + w.z * skvMark( pat, p.xy, px );
}
`;

export const PATTERN_VERTEX_PARS = "\nvarying vec3 vPatPos;\nvarying vec3 vPatNrm;\n";

/**
 * GLSL before `project_vertex`: the vertex's offset from its instance's origin
 * and its normal, in world orientation and metres (the batch matrix carries the
 * quantisation scale), so the marks stick to the structure and Explode's
 * translations carry them along.
 */
export const PATTERN_VERTEX = /* glsl */ `
#ifdef USE_BATCHING
  mat3 patM = mat3( modelMatrix ) * mat3( batchingMatrix );
#else
  mat3 patM = mat3( modelMatrix );
#endif
  vPatPos = patM * transformed;
  vPatNrm = patM * objectNormal;
`;

/**
 * GLSL, after the tint (`vTint`, see `material.ts`): darken the marks of the
 * instance's pattern. Surface-locked (triplanar, world-space period), so the
 * marks move with the structure and never swim; anti-aliased, and coarsened by
 * octaves when they would be smaller than `uPatternMinPx` on screen. Nothing
 * animates on its own (reduced motion needs nothing more).
 */
export const PATTERN_FRAGMENT = /* glsl */ `
  {
    float pat = floor( vTint.a + 0.5 ) - 1.0;
    // Derivatives outside the branch: periods per device pixel.
    vec3 pp = vPatPos / ${f3(PATTERN_PERIOD_M)};
    float px = max( length( fwidth( pp ) ), 1e-6 );
    if ( pat > 0.5 ) {
      float lod = clamp( log2( uPatternMinPx * px ), 0.0, ${PATTERN_MAX_OCTAVES.toFixed(1)} );
      float lo = floor( lod );
      vec3 w = pow( abs( normalize( vPatNrm ) ), vec3( ${TRIPLANAR_SHARPNESS.toFixed(1)} ) );
      w /= w.x + w.y + w.z;
      float k0 = exp2( -lo );
      float mark = mix( skvTriplanar( pat, pp * k0, px * k0, w ), skvTriplanar( pat, pp * k0 * 0.5, px * k0 * 0.5, w ), lod - lo );
      diffuseColor.rgb *= 1.0 - ${f3(PATTERN_DARKEN)} * mark;
    }
  }
`;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const band = (s: number, h: number, a: number) => 1 - smoothstep(h - a, h + a, Math.abs(fract(s - h + 0.5) - 0.5));
function planeMark(p: Pattern, u: number, v: number, px: number): number {
  if (p === "stripes") return band(u + v, STRIPE / 2, 0.7 * px);
  if (p === "dots") return 1 - smoothstep(DOT - 0.5 * px, DOT + 0.5 * px, Math.hypot(fract(u) - 0.5, fract(v) - 0.5));
  if (p === "hatch") return Math.max(band(u + v, HATCH / 2, 0.7 * px), band(u - v, HATCH / 2, 0.7 * px));
  return 0;
}

/**
 * The JS twin of `PATTERN_FRAGMENT` (for the unit tests): the mark's strength
 * (0 to 1) at `pos` (metres from the instance's origin) on a surface facing
 * `normal`, where one device pixel spans `pxM` metres and the smallest period
 * on screen is `minPx` device pixels. Also returns the octave it drew.
 */
export function surfaceMark(
  p: Pattern,
  pos: readonly [number, number, number],
  normal: readonly [number, number, number],
  pxM: number,
  minPx = PATTERN_MIN_CSS,
): { mark: number; lod: number } {
  const pp = pos.map((c) => c / PATTERN_PERIOD_M) as [number, number, number];
  const px = Math.max(pxM / PATTERN_PERIOD_M, 1e-6);
  const lod = Math.min(Math.max(Math.log2(minPx * px), 0), PATTERN_MAX_OCTAVES);
  const lo = Math.floor(lod);
  const len = Math.hypot(...normal);
  const w = normal.map((c) => Math.abs(c / len) ** TRIPLANAR_SHARPNESS);
  const sum = w[0]! + w[1]! + w[2]!;
  const tri = (k: number) =>
    (w[0]! * planeMark(p, pp[1] * k, pp[2] * k, px * k) + w[1]! * planeMark(p, pp[2] * k, pp[0] * k, px * k) + w[2]! * planeMark(p, pp[0] * k, pp[1] * k, px * k)) / sum;
  const k0 = 2 ** -lo;
  const t = lod - lo;
  return { mark: tri(k0) * (1 - t) + tri(k0 * 0.5) * t, lod };
}

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
 * on screen (the shader's plane axes count up, as a front view's x and y do, so
 * rows are flipped to match): the legend's SVG swatch and the screenshot's canvas
 * pattern are rasterised from the shader's own rule.
 */
export function patternCells(p: Pattern, n: number): boolean[][] {
  return Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => patternMark(p, col + 0.5, n - row - 0.5, n)));
}

/** The marks over one period as an SVG path in a `size` × `size` box (row runs merged). */
export function patternPath(p: Pattern, size = PATTERN_SWATCH_CSS, n = 12): string {
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
