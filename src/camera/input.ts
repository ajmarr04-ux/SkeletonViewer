// Pure input helpers (spec §6 input table): the wheel classifier, the key map
// and double-tap detection. No DOM or three.js here, so Vitest covers them.

// --- wheel: mouse wheel, trackpad pinch or trackpad two-finger drag ------------

export type WheelSample = {
  deltaX: number;
  deltaY: number;
  /** 0 pixels, 1 lines, 2 pages. */
  deltaMode: number;
  ctrlKey: boolean;
  /** Event time in ms. */
  timeStamp: number;
  /** Legacy `wheelDeltaY` (Chrome, Edge, Safari); undefined where the browser lacks it. */
  wheelDeltaY?: number;
};

/** pinch → zoom; wheel → zoom toward the cursor; pan → two-finger drag. */
export type WheelKind = "pinch" | "wheel" | "pan";

/** What the previous event was classified as, so one gesture keeps one meaning. */
export type WheelMemory = { kind: WheelKind | null; at: number };
export const NO_WHEEL_MEMORY: WheelMemory = { kind: null, at: -Infinity };

/** Events closer together than this belong to the same gesture. */
export const GESTURE_GAP_MS = 120;

/**
 * Tell a mouse wheel from a trackpad. Heuristic, in order:
 * 1. `ctrlKey` is set: a trackpad pinch (Chrome, Edge and Firefox send pinches
 *    as wheel events with ctrlKey).
 * 2. `deltaMode` is lines or pages: a mouse wheel (Firefox).
 * 3. Within one gesture (events < 120 ms apart) the first event's meaning sticks,
 *    so a trackpad drag can't flicker into zooms halfway through.
 * 4. Where `wheelDeltaY` exists: trackpads report `wheelDeltaY === -3 * deltaY`;
 *    mouse wheels don't (they report ±120 per notch whatever deltaY is).
 * 5. Otherwise: any horizontal delta means a two-finger drag; a large step
 *    (≥ 50 px) is a wheel notch; whole-pixel steps are a wheel; anything else
 *    (small fractional deltas) is a trackpad.
 */
export function classifyWheel(e: WheelSample, memory: WheelMemory): { kind: WheelKind; memory: WheelMemory } {
  const kind = rawKind(e, memory);
  return { kind, memory: { kind, at: e.timeStamp } };
}

function rawKind(e: WheelSample, memory: WheelMemory): WheelKind {
  if (e.ctrlKey) return "pinch";
  if (e.deltaMode !== 0) return "wheel";
  if ((memory.kind === "pan" || memory.kind === "wheel") && e.timeStamp - memory.at < GESTURE_GAP_MS) return memory.kind;
  if (e.wheelDeltaY !== undefined && e.wheelDeltaY !== 0) {
    return Math.abs(e.wheelDeltaY + 3 * e.deltaY) < 1 ? "pan" : "wheel";
  }
  if (e.deltaX !== 0) return "pan";
  if (Math.abs(e.deltaY) >= 50) return "wheel";
  return Number.isInteger(e.deltaY) ? "wheel" : "pan";
}

/** One mouse-wheel notch (100 px, 3 lines or 1 page) dollies by 10%. */
const WHEEL_STEP = 0.9;

/**
 * Distance multiplier for a zoom event (> 1 moves away). Scrolling down or
 * pinching in moves away; scrolling up or pinching out moves closer.
 */
export function zoomFactor(kind: Exclude<WheelKind, "pan">, e: Pick<WheelSample, "deltaY" | "deltaMode">): number {
  if (kind === "pinch") return Math.exp(clampAbs(e.deltaY, 50) * 0.01);
  const notches = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaMode === 2 ? e.deltaY : e.deltaY / 100;
  return Math.pow(WHEEL_STEP, -clampAbs(notches, 5));
}

function clampAbs(x: number, max: number): number {
  return Math.max(-max, Math.min(max, x));
}

// --- keyboard ---------------------------------------------------------------

export type KeyAction =
  /** Angles in radians, added to the current ones (same sense as a drag in the arrow's direction). */
  | { kind: "orbit"; azimuth: number; polar: number }
  /** Truck by a fraction of the current distance (same sense as a Shift-drag). */
  | { kind: "pan"; x: number; y: number }
  /** Multiply the distance by `factor`. */
  | { kind: "dolly"; factor: number }
  | { kind: "reset" }
  | { kind: "frame" };

export type KeyInput = { key: string; shiftKey: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

export const ORBIT_STEP = (5 * Math.PI) / 180;
export const PAN_STEP = 0.02;
export const DOLLY_STEP = 0.9;

/**
 * The keyboard map (spec §6): arrows orbit by 5°, Shift + arrows pan by 2% of
 * the distance, + and - dolly by 10%, H resets and F frames. Anything with
 * Ctrl, Alt or Meta held is left to the browser.
 */
export function keyAction(e: KeyInput): KeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const arrow = ARROWS[e.key];
  if (arrow) {
    const [x, y] = arrow;
    return e.shiftKey
      ? { kind: "pan", x: x * PAN_STEP, y: y * PAN_STEP }
      : { kind: "orbit", azimuth: x * ORBIT_STEP, polar: y * ORBIT_STEP };
  }
  switch (e.key) {
    case "+":
    case "=":
      return { kind: "dolly", factor: DOLLY_STEP };
    case "-":
    case "_":
      return { kind: "dolly", factor: 1 / DOLLY_STEP };
    case "h":
    case "H":
      return { kind: "reset" };
    case "f":
    case "F":
      return { kind: "frame" };
    default:
      return null;
  }
}

// camera-controls measures a drag as (previous − current) pointer position, so
// dragging left or up gives positive deltas. Each arrow acts like a drag that way.
const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

// --- double-click / double-tap ----------------------------------------------------

/** A press that travels further than this is a drag, not a tap (spec §6). */
export const DRAG_THRESHOLD_PX = 5;
/** Longest press that still counts as a tap. */
export const TAP_MAX_MS = 500;
/** Two taps this close in time and space make a double tap. */
export const DOUBLE_TAP_MS = 350;
export const DOUBLE_TAP_PX = 24;

export type PointerSample = { type: "down" | "move" | "up" | "cancel"; id: number; x: number; y: number; t: number };

export type TapState = {
  /** Pointers currently pressed. */
  active: number[];
  /** The press that could become a tap (null once it moves or a second pointer lands). */
  press: { id: number; x: number; y: number; t: number } | null;
  lastTap: { x: number; y: number; t: number } | null;
};

export const INITIAL_TAP_STATE: TapState = { active: [], press: null, lastTap: null };

export type TapResult = { state: TapState; tap?: { x: number; y: number }; doubleTap?: { x: number; y: number } };

/**
 * Feed pointer events in. Every still press (moved no more than 5 px, released
 * within TAP_MAX_MS) gives `tap` (a click: select); the second of two quick
 * taps in the same place also gives `doubleTap` (re-centre). Coordinates are
 * where the press started. Works the same for mouse, pen and touch. A second
 * finger (pinch) cancels the tap, and a press that moves is a camera drag.
 */
export function tapStep(s: TapState, e: PointerSample): TapResult {
  switch (e.type) {
    case "down": {
      const active = [...s.active.filter((id) => id !== e.id), e.id];
      const press = active.length === 1 ? { id: e.id, x: e.x, y: e.y, t: e.t } : null;
      return { state: { active, press, lastTap: active.length === 1 ? s.lastTap : null } };
    }
    case "move": {
      if (!s.press || s.press.id !== e.id) return { state: s };
      if (Math.hypot(e.x - s.press.x, e.y - s.press.y) > DRAG_THRESHOLD_PX) return { state: { ...s, press: null, lastTap: null } };
      return { state: s };
    }
    case "cancel":
      return { state: { active: s.active.filter((id) => id !== e.id), press: null, lastTap: null } };
    case "up": {
      const active = s.active.filter((id) => id !== e.id);
      const p = s.press;
      if (!p || p.id !== e.id) return { state: { ...s, active } };
      const still = Math.hypot(e.x - p.x, e.y - p.y) <= DRAG_THRESHOLD_PX && e.t - p.t <= TAP_MAX_MS;
      if (!still) return { state: { active, press: null, lastTap: null } };
      const last = s.lastTap;
      if (last && e.t - last.t <= DOUBLE_TAP_MS && Math.hypot(e.x - last.x, e.y - last.y) <= DOUBLE_TAP_PX) {
        return { state: { active, press: null, lastTap: null }, tap: { x: p.x, y: p.y }, doubleTap: { x: p.x, y: p.y } };
      }
      return { state: { active, press: null, lastTap: { x: e.x, y: e.y, t: e.t } }, tap: { x: p.x, y: p.y } };
    }
  }
}

/**
 * Tab through the visible objects (spec §10, plan decision 6): the next ID
 * after `current` in `visibleIds` (Shift: the one before). With no current
 * object (or one no longer visible) Tab starts at the first and Shift + Tab at
 * the last. Null past either end: focus leaves the canvas, so it is never a
 * keyboard trap.
 */
export function tabCursor(visibleIds: readonly string[], current: string | null, shift: boolean): string | null {
  if (visibleIds.length === 0) return null;
  const i = current === null ? -1 : visibleIds.indexOf(current);
  if (i < 0) return shift ? visibleIds[visibleIds.length - 1]! : visibleIds[0]!;
  return visibleIds[i + (shift ? -1 : 1)] ?? null;
}
