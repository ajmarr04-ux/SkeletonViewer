// Draws a screenshot (plan decision 9) and hands it to the user: the frame is
// rendered on demand and copied straight away (the drawing buffer is not
// preserved), then the labels, the legend and the attribution strip are drawn
// over it with the 2D canvas API, so the picture matches the screen.

import { graphVersion } from "../content/appGraph";
import { leaderEnd } from "../scene/labels";
import { usePatchBatch } from "../scene/layerRegistry";
import { markColour, PATTERN_PERIOD_CSS, patternCells, type Pattern } from "../scene/patterns";
import { REGIONS, regionColour } from "../scene/regionColours";
import { ATTRIBUTION_STAMP, screenshotFileName, stripBox } from "../scene/screenshot";
import { useViewer } from "../state/store";
import { LABEL_FONT } from "./Labels";
import { keyItems, type KeyItem } from "./Legend";

type FrameGrabber = () => HTMLCanvasElement | null;
let grabber: FrameGrabber | null = null;

/** The Canvas registers how to render one frame and copy it (see `ScreenshotService`). */
export function registerFrameGrabber(g: FrameGrabber | null): void {
  grabber = g;
}

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** The composited PNG and its file name, or null when the 3D view isn't ready. */
export async function renderScreenshot(): Promise<{ blob: Blob; name: string } | null> {
  const frame = grabber?.();
  if (!frame) return null;
  const st = useViewer.getState();
  const out = document.createElement("canvas");
  out.width = frame.width;
  out.height = frame.height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(frame, 0, 0);
  const rect = frame.getBoundingClientRect();
  const scale = rect.width > 0 ? frame.width / rect.width : 1;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-rect.left, -rect.top);
  if (st.labelsOn) drawLabels(ctx, st.labelLayout, st.sel);
  ctx.restore();
  const key = keyItems(st, graphVersion(), usePatchBatch.getState().failed);
  // As on screen: the regions in colour-by-region (paused while tints are drawn), then the key chips with their patterns (M14 BX).
  const regions = st.colourMode === "region" && !key.some((k) => k.pattern !== "none");
  const rows: LegendRow[] = [...(regions ? REGIONS.map((r) => ({ name: r.name, colour: regionColour(r.region), pattern: "none" as const })) : []), ...key];
  if (rows.length > 0) drawLegend(ctx, scale, out.height, rows);
  drawStrip(ctx, out.width, out.height, scale);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  return blob ? { blob, name: screenshotFileName(st.sel, st.grp) } : null;
}

function drawLabels(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof useViewer.getState>["labelLayout"], focus: string | null): void {
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "middle";
  for (const l of layout) {
    const end = leaderEnd(l);
    ctx.strokeStyle = "rgba(232,234,237,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.ax, l.ay);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(l.ax, l.ay, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e8eaed";
    ctx.fill();
    ctx.fillStyle = l.id === focus ? "rgba(22,38,64,0.92)" : "rgba(20,22,26,0.86)";
    ctx.strokeStyle = l.id === focus ? "#8ab4f8" : "#5f6368";
    roundRect(ctx, Math.round(l.x) + 0.5, Math.round(l.y) + 0.5, l.w - 1, l.h - 1, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8eaed";
    ctx.fillText(l.text, Math.round(l.x) + 6, Math.round(l.y) + l.h / 2);
  }
}

type LegendRow = Pick<KeyItem, "name" | "colour" | "pattern">;

/** A canvas pattern of a tint's marks at the shader's period in image pixels (`scale` = the canvas's pixel ratio). */
function marksPattern(ctx: CanvasRenderingContext2D, p: Pattern, colour: string, scale: number): CanvasPattern | null {
  const n = Math.max(2, Math.round(PATTERN_PERIOD_CSS * scale));
  const tile = document.createElement("canvas");
  tile.width = tile.height = n;
  const t = tile.getContext("2d");
  if (!t) return null;
  t.fillStyle = markColour(colour);
  patternCells(p, n).forEach((row, y) => row.forEach((on, x) => on && t.fillRect(x, y, 1, 1)));
  const pattern = ctx.createPattern(tile, "repeat");
  // The context is scaled by `scale` when the swatch is drawn; undo it so a tile cell is one image pixel.
  pattern?.setTransform(new DOMMatrix().scale(1 / scale));
  return pattern;
}

function drawLegend(ctx: CanvasRenderingContext2D, scale: number, imageH: number, rows: readonly LegendRow[]): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";
  const row = 22;
  const pad = 8;
  const w = pad * 2 + 22 + Math.max(...rows.map((r) => ctx.measureText(r.name).width));
  const h = pad * 2 + row * rows.length;
  const x = 12;
  const y = imageH / scale - 40 - h;
  ctx.fillStyle = "rgba(32,35,40,0.9)";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  rows.forEach((r, i) => {
    const ry = y + pad + i * row + row / 2;
    ctx.fillStyle = r.colour;
    ctx.fillRect(x + pad, ry - 7, 14, 14);
    const marks = r.pattern === "none" ? null : marksPattern(ctx, r.pattern, r.colour, scale);
    if (marks) {
      ctx.fillStyle = marks;
      ctx.fillRect(x + pad, ry - 7, 14, 14);
    }
    ctx.fillStyle = "#e8eaed";
    ctx.fillText(r.name, x + pad + 22, ry);
  });
  ctx.restore();
}

function drawStrip(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number): void {
  ctx.font = `${12 * scale}px ${FONT_FAMILY}`;
  const box = stripBox(w, h, ctx.measureText(ATTRIBUTION_STAMP).width, scale);
  ctx.font = `${box.fontPx}px ${FONT_FAMILY}`;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(ATTRIBUTION_STAMP, box.textX, box.textY, box.w - (box.textX - box.x) * 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** A phone or tablet: share sheets there, downloads elsewhere. */
export const coarsePointer = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

/**
 * The toolbar's Screenshot action: render, then share the file (phones, where
 * the Web Share API takes files) or download it. Announced either way.
 */
export async function takeScreenshot(): Promise<void> {
  const st = useViewer.getState();
  const shot = await renderScreenshot();
  if (!shot) {
    st.showToast("The screenshot could not be taken.");
    return;
  }
  const file = new File([shot.blob], shot.name, { type: "image/png" });
  if (coarsePointer() && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Skeleton Viewer" });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // the user closed the share sheet
      // Otherwise fall through to a download.
    }
  }
  const url = URL.createObjectURL(shot.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = shot.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  st.showToast(`Screenshot saved: ${shot.name}`);
}
