// Colour-by-region (spec §7, §10; plan decision 8). Eight regions from the
// hierarchy's second level, each with an Okabe–Ito colour (a palette designed
// to stay distinct with deuteranopia and protanopia), lightened a little so
// the baked AO still reads on it. Teeth keep the natural ivory. Pure: no
// three.js here, so Vitest checks the palette (`tests/regionColours.test.ts`).
// Only instance colours change in the scene; no geometry moves (spec §12).

import ids from "../../content/ids.json";

export type Region =
  | "skull"
  | "vertebral_column"
  | "thorax"
  | "pectoral_girdle"
  | "upper_limb"
  | "pelvic_girdle"
  | "lower_limb"
  | "teeth";

/** Region → its group key in the tree (for the legend's "isolate"), name and Okabe–Ito colour. */
export const REGIONS: readonly { region: Region; group: string; name: string; base: string }[] = [
  { region: "skull", group: "axial.skull", name: "Skull", base: "#56B4E9" }, // sky blue
  { region: "vertebral_column", group: "axial.vertebral_column", name: "Vertebral column", base: "#E69F00" }, // orange
  { region: "thorax", group: "axial.thorax", name: "Thorax", base: "#009E73" }, // bluish green
  { region: "pectoral_girdle", group: "appendicular.pectoral_girdle", name: "Pectoral girdle", base: "#CC79A7" }, // reddish purple
  { region: "upper_limb", group: "appendicular.upper_limb", name: "Upper limbs", base: "#F0E442" }, // yellow
  { region: "pelvic_girdle", group: "appendicular.pelvic_girdle", name: "Pelvic girdle", base: "#D55E00" }, // vermillion
  { region: "lower_limb", group: "appendicular.lower_limb", name: "Lower limbs", base: "#0072B2" }, // blue
  { region: "teeth", group: "dentition", name: "Teeth", base: "#D8CDB8" }, // ivory: the bone colour, unchanged
];

/** How far each colour is lightened toward white (sRGB), so the AO still reads. Teeth stay as they are. */
export const LIGHTEN = 0.2;

export type Rgb = [number, number, number];

const hexToRgb = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
const toHex = (c: Rgb): string => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0")).join("")}`;

/** The colour a region's bones are drawn in (sRGB hex), also the legend swatch. */
export function regionColour(region: Region): string {
  const r = REGIONS.find((x) => x.region === region)!;
  if (region === "teeth") return r.base.toLowerCase();
  return toHex(hexToRgb(r.base).map((c) => c + (1 - c) * LIGHTEN) as Rgb);
}

type IdEntry = { id: string; group: string[] };
const REGION_OF = new Map<string, Region>();
for (const e of ids as IdEntry[]) {
  const key = e.group[0] === "dentition" ? "dentition" : `${e.group[0]}.${e.group[1]}`;
  const r = REGIONS.find((x) => x.group === key);
  if (r) REGION_OF.set(e.id, r.region);
}

/** The region of an object, from its `group` in ids.json; undefined for an unknown ID. */
export const regionOf = (id: string): Region | undefined => REGION_OF.get(id);

/** Colour mode (`color=region` in the URL, plan decision 8). */
export type ColourMode = "bone" | "region";
export const COLOUR_MODE_KEY = "skeleton-viewer:colour";

// --- colour science, for the tests and the legend ----------------------------

export const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export const parseHex = hexToRgb;

/** Machado, Oliveira and Fernandes (2009), severity 1.0, applied to linear RGB. */
export const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const;

/** An sRGB colour as a person with this colour-vision deficiency sees it. */
export function simulateCvd(rgb: Rgb, kind: keyof typeof CVD_MATRICES): Rgb {
  const l = rgb.map(srgbToLinear);
  return CVD_MATRICES[kind].map((row) => linearToSrgb(Math.min(1, Math.max(0, row[0] * l[0]! + row[1] * l[1]! + row[2] * l[2]!)))) as Rgb;
}

/** CIE L*a*b* (D65) of an sRGB colour. */
export function toLab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(srgbToLinear) as Rgb;
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 colour difference between two L*a*b* colours. */
export function deltaE2000(p: Rgb, q: Rgb): number {
  const [L1, a1, b1] = p;
  const [L2, a2, b2] = q;
  const rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hue = (x: number, y: number) => {
    const t = Math.atan2(y, x) / rad;
    return t < 0 ? t + 360 : t;
  };
  const hp1 = Cp1 === 0 ? 0 : hue(ap1, b1);
  const hp2 = Cp2 === 0 ? 0 : hue(ap2, b2);
  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2);
  const Lb = (L1 + L2) / 2;
  const Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hb += hb < 360 ? 360 : -360;
    hb /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dT = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cpb;
  const SH = 1 + 0.015 * Cpb * T;
  const RT = -Math.sin(2 * dT * rad) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

/** WCAG contrast ratio between two sRGB colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lum = (c: Rgb) => 0.2126 * srgbToLinear(c[0]) + 0.7152 * srgbToLinear(c[1]) + 0.0722 * srgbToLinear(c[2]);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
