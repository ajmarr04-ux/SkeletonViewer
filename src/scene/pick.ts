// Picking rules (spec §6 "Selection"), pure so Vitest covers them.
//
// Small objects get enlarged, invisible hit areas so they can be tapped on a
// phone. The hit areas are screen-space discs, not meshes: no geometry, no
// draw calls, nothing to keep in step with the model.

/**
 * Objects whose bounding sphere is smaller than this (metres) are "tiny" and
 * get a hit proxy. 2 cm covers every object the spec names (ossicles, distal
 * phalanges, sesamoids, teeth: 2.8 mm to 17.9 mm, the pisiforms 9 mm) and
 * some neighbours of the same size (carpals, middle phalanges, nasal and
 * lacrimal bones): 100 objects in all. The patellae (sesamoids too) are big
 * enough to tap.
 */
export const TINY_RADIUS_M = 0.02;

/**
 * A proxy's hit radius: 22 CSS px for touch (a 44 px target, WCAG 2.5.8 and
 * Apple's guideline), 6 px for a mouse, which is precise and shouldn't lose
 * the bone under the pointer to a tooth next to it.
 */
export const PROXY_RADIUS_PX = { touch: 22, mouse: 6 } as const;

export function tinyObjects(radii: ReadonlyMap<string, number>, threshold = TINY_RADIUS_M): Set<string> {
  const out = new Set<string>();
  for (const [id, r] of radii) if (r < threshold) out.add(id);
  return out;
}

/** The nearest surface under the pointer: which object, and how far along the view axis. */
export type RealHit = { id: string; depth: number };

/** A tiny object as seen on screen now. */
export type Proxy = {
  id: string;
  /** Projected centre, CSS px. */
  x: number;
  y: number;
  /** Depth of the centre along the view axis, metres (> 0 means in front of the camera). */
  depth: number;
  /** Bounding-sphere radius, metres. */
  radius: number;
  /** That radius on screen, CSS px. */
  radiusPx: number;
};

/**
 * Which object a click or tap at `pointer` picks.
 * 1. A real hit on a tiny object wins.
 * 2. Otherwise, the tiny object whose projected centre is nearest the pointer,
 *    if it is within `hitPx` and too small on screen to tap on its own
 *    (`radiusPx < hitPx`), and not hidden behind the real hit (its front,
 *    `depth - radius`, is nearer than the real hit), so a tooth behind the
 *    mandible can't take the tap.
 * 3. Otherwise the real hit (or nothing).
 */
export function pickWithProxies(
  real: RealHit | null,
  proxies: readonly Proxy[],
  pointer: { x: number; y: number },
  hitPx: number,
  isTiny: (id: string) => boolean,
): string | null {
  if (real && isTiny(real.id)) return real.id;
  let best: Proxy | null = null;
  let bestDist = Infinity;
  for (const p of proxies) {
    if (!(p.depth > 0) || p.radiusPx >= hitPx) continue;
    const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    if (d > hitPx || d >= bestDist) continue;
    if (real && p.depth - p.radius >= real.depth) continue;
    best = p;
    bestDist = d;
  }
  return best ? best.id : (real?.id ?? null);
}
