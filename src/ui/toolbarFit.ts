// How the toolbar fits (plan decision 12): with labels, icons only, or icons
// with a "More" menu holding the overflow buttons. Pure, for Vitest.

export type ToolbarFit = "labels" | "icons" | "more";

/** One toolbar button: its label text and whether it moves into "More" when space is short. */
export type ToolItem = {
  label: string;
  overflow: boolean;
  /** Width when the bar shows icons only, if not a plain icon (the "N hidden" chip keeps its count). */
  iconWidth?: number;
};

/** Sizes from styles.css (`.toolbar`, `.tool`). */
export const TOOL_SIZE = {
  /** An icon-only button. */
  icon: 44,
  /** A labelled button without its text: 12 px padding each side, a 20 px icon and a 6 px gap. */
  labelledChrome: 12 + 20 + 6 + 12,
  /** Space between buttons. */
  gap: 4,
  /** The bar's padding and border, both sides. */
  frame: 2 * 4 + 2 * 1,
  /** Kept free either side of the bar. */
  margin: 12,
} as const;

/** Phones always use "More" (spec §7: icons only; plan decision 12). */
export const PHONE_MAX_WIDTH = 599;

export function toolbarWidth(items: readonly ToolItem[], fit: ToolbarFit, measure: (text: string) => number): number {
  const shown = fit === "more" ? [...items.filter((i) => !i.overflow), { label: "More", overflow: false }] : items;
  const buttons = shown.reduce((sum, i) => sum + (fit === "labels" ? TOOL_SIZE.labelledChrome + Math.ceil(measure(i.label)) : (i.iconWidth ?? TOOL_SIZE.icon)), 0);
  return buttons + TOOL_SIZE.gap * Math.max(0, shown.length - 1) + TOOL_SIZE.frame;
}

/**
 * The fullest fit that leaves `TOOL_SIZE.margin` either side within `available`
 * CSS px: labels, else icons, else "More". Phones (`viewportWidth` ≤ 599) always
 * get "More". If nothing would overflow, "More" is never needed.
 */
export function chooseToolbarFit(items: readonly ToolItem[], available: number, viewportWidth: number, measure: (text: string) => number): ToolbarFit {
  const room = available - 2 * TOOL_SIZE.margin;
  const hasOverflow = items.some((i) => i.overflow);
  if (viewportWidth <= PHONE_MAX_WIDTH) return hasOverflow ? "more" : "icons";
  if (toolbarWidth(items, "labels", measure) <= room) return "labels";
  if (toolbarWidth(items, "icons", measure) <= room || !hasOverflow) return "icons";
  return "more";
}
