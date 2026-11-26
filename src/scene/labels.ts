// Floating labels (spec §7: "laid out so they never overlap"; plan decision 7).
// Pure: the scene projects each object's centre to the screen, and this module
// picks which labels to show and where, greedily by priority. No three.js.

import { EAGER_LAYER, LABEL_ORDER, type LayerId } from "../systems/registry";

/** A rectangle in client pixels. */
export type Rect = { left: number; top: number; right: number; bottom: number };

/** An object that could get a label: its centre on screen and its size there. */
export type LabelCandidate = {
  id: string;
  text: string;
  /** Anchor: the object's box centre on screen (client px). */
  x: number;
  y: number;
  /** Radius of the object's bounding sphere on screen (px). */
  sizePx: number;
  /** 0 = the focus, 1 = tier 1, 2 = tier 2, 3 = everything else. Lower is placed first. */
  priority: number;
  /** The layer the object is drawn in (M10): breaks ties of equal size in favour of the focus layer. */
  layer?: string;
};

/** A label that was placed: its box (client px) and its anchor. */
export type PlacedLabel = { id: string; text: string; ax: number; ay: number; x: number; y: number; w: number; h: number };

export const LABEL = {
  /** Height of a label box (13 px text, padding). */
  height: 22,
  /** Horizontal padding inside the box, each side. */
  padX: 6,
  /** Leader line: the box sits this far from the anchor, diagonally. */
  leader: 14,
  /** Space kept clear around each box. */
  gap: 2,
  /**
   * With nothing isolated, only objects at least this big on screen (bounding
   * sphere radius, px) get a label, so the whole skeleton shows the large bones
   * and gains more as the user zooms in.
   */
  minSizePx: 32,
  /** While something is isolated, its objects get labels down to this size. */
  minSizeIsolatedPx: 0,
} as const;

/** Rough text width for 13 px system-ui (the overlay measures for real when it can). */
export const estimateTextWidth = (text: string): number => Math.ceil(text.length * 7);

const overlaps = (a: Rect, b: Rect, gap: number): boolean =>
  a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

const inside = (r: Rect, area: Rect): boolean => r.left >= area.left && r.right <= area.right && r.top >= area.top && r.bottom <= area.bottom;

const pointIn = (x: number, y: number, r: Rect): boolean => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

export type LayoutOptions = {
  /** Size threshold (px) for priority-3 candidates; see `LABEL.minSizePx`. */
  minSizePx?: number;
  /** Text width in px. */
  measure?: (text: string) => number;
  /** Screen areas labels must stay off (toolbar, panels, legend). Anchors inside them are dropped. */
  obstacles?: readonly Rect[];
  /**
   * The focus layer (M10 plan decision 2): among candidates of the same
   * priority and equal size on screen (radii within `EQUAL_SIZE`), those in
   * this layer are placed first. Unset, or every candidate in one layer, gives
   * M5's order exactly.
   */
  focusLayer?: string | null;
};

/** Two on-screen radii count as equal size when the smaller is within 10 % of the larger (M10 plan decision 2). */
export const EQUAL_SIZE = 0.1;

/** What the label order reads from a candidate: enough to rank it before it is projected (M13 plan decision 12). */
export type Rankable = Pick<LabelCandidate, "id" | "priority" | "sizePx" | "layer">;

const byPrioritySize = (a: Rankable, b: Rankable): number =>
  a.priority - b.priority || b.sizePx - a.sizePx || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * M5's order (priority, then size, biggest first, then ID), then the focus
 * layer's tie-break: the sorted list is cut into runs of one priority whose
 * sizes are all within `EQUAL_SIZE` of the run's first (largest); inside a run,
 * the focus layer's candidates move to the front, each side keeping its order.
 * Runs are cut from the sorted list, so the order is deterministic.
 */
export function labelOrder<C extends Rankable>(candidates: readonly C[], focusLayer: string | null = null): C[] {
  const sorted = [...candidates].sort(byPrioritySize);
  if (focusLayer === null) return sorted;
  const out: C[] = [];
  for (let i = 0; i < sorted.length; ) {
    const head = sorted[i]!;
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.priority === head.priority && isEqualSize(sorted[j]!.sizePx, head.sizePx)) j++;
    const run = sorted.slice(i, j);
    out.push(...run.filter((c) => c.layer === focusLayer), ...run.filter((c) => c.layer !== focusLayer));
    i = j;
  }
  return out;
}

const isEqualSize = (small: number, large: number): boolean => (large === small ? true : Number.isFinite(large) ? large - small < EQUAL_SIZE * large : false);

/**
 * Greedy no-overlap layout. Candidates are sorted by priority, then by size on
 * screen (biggest first), then by ID (stable), with the focus layer first among
 * equal sizes (`labelOrder`). Each tries six spots around its
 * anchor (above right, above left, below right, below left, above, below) and
 * takes the first that stays inside `area`, off every obstacle and clear of
 * every label already placed; if none fits it is dropped. The focus (priority
 * 0) is placed first, so it is always shown when its anchor is in the area: if
 * no spot fits inside, its box is moved inside the area.
 */
export function layoutLabels(candidates: readonly LabelCandidate[], area: Rect, opts: LayoutOptions = {}): PlacedLabel[] {
  const minSize = opts.minSizePx ?? LABEL.minSizePx;
  const measure = opts.measure ?? estimateTextWidth;
  const obstacles = opts.obstacles ?? [];
  const order = labelOrder(
    candidates
      .filter((c) => Number.isFinite(c.x) && Number.isFinite(c.y) && pointIn(c.x, c.y, area))
      .filter((c) => c.priority < 3 || c.sizePx >= minSize)
      .filter((c) => c.priority === 0 || !obstacles.some((o) => pointIn(c.x, c.y, o))),
    opts.focusLayer ?? null,
  );
  const placed: PlacedLabel[] = [];
  const boxes: Rect[] = [...obstacles];
  const h = LABEL.height;
  const L = LABEL.leader;
  for (const c of order) {
    const w = Math.ceil(measure(c.text)) + 2 * LABEL.padX;
    const spots: [number, number][] = [
      [c.x + L, c.y - L - h],
      [c.x - L - w, c.y - L - h],
      [c.x + L, c.y + L],
      [c.x - L - w, c.y + L],
      [c.x - w / 2, c.y - L - h],
      [c.x - w / 2, c.y + L],
    ];
    let spot: [number, number] | null = null;
    for (const [x, y] of spots) {
      const r = { left: x, top: y, right: x + w, bottom: y + h };
      if (inside(r, area) && !boxes.some((b) => overlaps(r, b, LABEL.gap))) {
        spot = [x, y];
        break;
      }
    }
    if (!spot && c.priority === 0) {
      // The focus is always shown: its first spot, pulled inside the area.
      const [x, y] = spots[0]!;
      spot = [Math.min(Math.max(area.left, x), area.right - w), Math.min(Math.max(area.top, y), area.bottom - h)];
    }
    if (!spot) continue;
    const [x, y] = spot;
    placed.push({ id: c.id, text: c.text, ax: c.x, ay: c.y, x, y, w, h });
    boxes.push({ left: x, top: y, right: x + w, bottom: y + h });
  }
  return placed;
}

/** The point on a label's box nearest its anchor: where the leader line ends. */
export function leaderEnd(p: PlacedLabel): { x: number; y: number } {
  return { x: Math.min(Math.max(p.ax, p.x), p.x + p.w), y: Math.min(Math.max(p.ay, p.y), p.y + p.h) };
}

/** The priority of an object for the label layout: focus, tier-1 set, tier-2 set, the rest. */
export function labelPriority(id: string, focus: string | null, tier1: ReadonlySet<string>, tier2: ReadonlySet<string>): number {
  if (id === focus) return 0;
  if (tier1.has(id)) return 1;
  if (tier2.has(id)) return 2;
  return 3;
}

/**
 * The ID an object is labelled under (M10 plan decision 1): a part of a muscle
 * is labelled as its muscle (one label per muscle, at the union of its parts),
 * except at the part level, where the parts of the selected part's muscle are
 * labelled one by one. Everything else is labelled as itself.
 */
export function labelKey(id: string, parentOf: (id: string) => string | null, partLevelMuscle: string | null): string {
  const parent = parentOf(id);
  return parent === null || parent === partLevelMuscle ? id : parent;
}

/**
 * The focus layer (M10 plan decision 2): the selected structure's layer; with
 * nothing selected (or its layer unknown), the topmost layer that is On, in the
 * registry's label order (the kinds' `labelPriority`: muscles, ligaments,
 * cartilage, bones), else the eager layer.
 */
export function focusLayerOf(selLayer: string | null, modes: Readonly<Record<LayerId, string>>): string {
  if (selLayer !== null) return selLayer;
  for (const l of LABEL_ORDER) if (modes[l] === "on") return l;
  return EAGER_LAYER;
}

/**
 * Label thinning (M13 plan decision 12): the most candidates the layout is
 * given when a region is in focus or a layer besides the bones is drawn
 * (a bones-only view of the whole body is never thinned). Measured in BQ
 * (plan notes): with every layer On the uncut set is about 190 candidates
 * and 1.3 ms a layout; 60 brings it to about 0.9 ms against the bones-only
 * 0.55 ms, and a lower cap saves nothing more (the rest is the pass over
 * every drawn instance).
 */
export const MAX_LABEL_CANDIDATES = 60;

/**
 * Cuts the candidates, before they are projected, to the ones the layout
 * would try first: priority-3 candidates under `minSizePx` are dropped (the
 * layout drops them too), then the best `max` in `labelOrder`'s order are
 * kept. The input order is kept among the survivors. Fewer than `max` left
 * after the size cut: returned unchanged in content, so the layout is
 * exactly what it was without thinning.
 */
export function thinCandidates<C extends Rankable>(candidates: readonly C[], max: number, minSizePx: number, focusLayer: string | null = null): C[] {
  const sized = candidates.filter((c) => c.priority < 3 || c.sizePx >= minSizePx);
  if (sized.length <= max) return sized;
  const keep = new Set(labelOrder(sized, focusLayer).slice(0, max));
  return sized.filter((c) => keep.has(c));
}
