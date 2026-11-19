// Screenshot (spec §7, plan decision 9): the 3D view as a PNG at the canvas's
// pixel size, with the labels and the legend when they are on, and the
// attribution stamped bottom right. The pure parts (file name, layout of the
// strip and the legend) are tested in Vitest; `capture.ts` does the drawing.

import { displayName } from "../content/names";
import { groupOf } from "../content/groups";

/** Stamped on every screenshot (spec §7), as the licences ask. */
export const ATTRIBUTION_STAMP = "Z-Anatomy, CC BY-SA 4.0 · BodyParts3D © DBCLS, CC BY-SA 2.1 JP";

/** "Femur (left)" → "femur-left"; accents and punctuation dropped. */
export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The PNG's file name: `skeleton-femur-left.png`, `skeleton-molars-upper-and-lower.png`, or `skeleton.png`. */
export function screenshotFileName(sel: string | null, grp: string | null): string {
  const what = sel !== null ? displayName(sel) : grp !== null ? (groupOf(grp)?.name ?? "") : "";
  const s = slug(what);
  return s ? `skeleton-${s}.png` : "skeleton.png";
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * The attribution strip, in image pixels: bottom right, `scale` image pixels
 * per CSS pixel, 12 px text with 6 px padding, never wider than the image.
 */
export function stripBox(imageW: number, imageH: number, textW: number, scale: number): Box & { textX: number; textY: number; fontPx: number } {
  const fontPx = 12 * scale;
  const pad = 6 * scale;
  const w = Math.min(imageW, Math.ceil(textW + 2 * pad));
  const h = Math.ceil(fontPx + 2 * pad);
  return { x: imageW - w, y: imageH - h, w, h, textX: imageW - w + pad, textY: imageH - pad - fontPx * 0.2, fontPx };
}
