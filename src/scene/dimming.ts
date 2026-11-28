// Context dimming (M14 plan decision 9, session BY; SPEC-platform §7.3): with a
// focus selected and a tier showing, the related structures on a layer other
// than the focus's are drawn desaturated, so the focus layer's colours carry
// the meaning. The amount is each layer's `colour.dim` (BW: the muscles only);
// a layer without one is never dimmed.

import { Color } from "three";
import { layerDescriptor, type LayerId } from "../systems/registry";

/** How far a layer is dimmed (0 to 1), or 0 when it never is. */
export const dimAmount = (layer: LayerId): number => layerDescriptor(layer).colour.dim ?? 0;

/**
 * A colour mixed `amount` toward its own luminance, in linear light, so the
 * brightness stays (`c` is linear, as three's `Color` holds it). In place.
 */
export function desaturate(c: Color, amount: number): Color {
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c.setRGB(c.r + (y - c.r) * amount, c.g + (y - c.g) * amount, c.b + (y - c.b) * amount);
}

/** `hex` (sRGB) dimmed by `amount`, as sRGB hex: the colour-vision table's rows. */
export const dimHex = (hex: string, amount: number): string => `#${desaturate(new Color(hex), amount).getHexString()}`;

/**
 * The structures dimmed in a view: drawn solid, on a layer other than the
 * focus layer and with a dim amount, and not the focus, a tint or a
 * highlighted joint's bone (the tint is the point; the joint is its own cue).
 * None with no focus, at tier 0 or while colour-by-region is drawn (the
 * caller passes `on` false). Ghosts are never dimmed (they aren't solid).
 */
export function dimmedIn(
  view: {
    solid: ReadonlySet<string> | null;
    focusIds: readonly string[];
    joint: readonly string[];
    tints?: ReadonlyMap<string, unknown>;
  },
  focusLayer: LayerId | null,
  layerOf: (id: string) => LayerId | null,
  on: boolean,
  amountOf: (layer: LayerId) => number = dimAmount,
): ReadonlySet<string> {
  if (!on || focusLayer === null || view.solid === null || view.focusIds.length === 0) return NONE;
  const out = new Set<string>();
  for (const id of view.solid) {
    const l = layerOf(id);
    if (l === null || l === focusLayer || amountOf(l) <= 0) continue;
    if (view.focusIds.includes(id) || view.joint.includes(id) || view.tints?.has(id)) continue;
    out.add(id);
  }
  return out.size === 0 ? NONE : out;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The instance colour that draws `target` (sRGB hex: the layer's material or a
 * shade) dimmed, over the layer's `material`: instance colours multiply the
 * material, as `tintFor` (material.ts). Cached by layer and target.
 */
const cache = new Map<string, Color>();
export function dimTint(layer: LayerId, target: string, material: string): Color {
  const key = `${layer}|${target}`;
  let c = cache.get(key);
  if (!c) {
    const t = desaturate(new Color(target), dimAmount(layer));
    const m = new Color(material);
    c = new Color(t.r / Math.max(m.r, 1e-4), t.g / Math.max(m.g, 1e-4), t.b / Math.max(m.b, 1e-4));
    cache.set(key, c);
  }
  return c;
}
