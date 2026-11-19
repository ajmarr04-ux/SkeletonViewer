// Pure helpers for the URL query string (spec §7, "URL state").
// No React or three.js here, so Vitest covers them directly.

export type Vec3 = [number, number, number];
/**
 * A camera pose. `target` is the orbit pivot; `position` is where the camera
 * orbits (target + distance × direction). `offset` is the focal offset in
 * metres along the view's right and up axes: the eye sits that far from
 * `position`, so panning and zooming don't move the pivot. Absent means zero.
 */
export type CameraState = { position: Vec3; target: Vec3; offset?: [number, number] };

/** Anything further than this from the origin (metres) is treated as garbage. */
const MAX_COORD_M = 100;
/** Metres are written with 4 decimals: 0.1 mm. */
const DECIMALS = 4;

/**
 * Parse `px,py,pz,tx,ty,tz[,ox,oy]` (the offset is optional, so Milestone 2
 * links still work). Returns null for anything malformed or out of range.
 */
export function parseCam(value: string | null | undefined): CameraState | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 6 && parts.length !== 8) return null;
  const n = parts.map((p) => (p.trim() === "" ? NaN : Number(p)));
  if (n.some((x) => !Number.isFinite(x) || Math.abs(x) > MAX_COORD_M)) return null;
  const [px, py, pz, tx, ty, tz] = n as [number, number, number, number, number, number];
  // The camera must not sit on its own target.
  if (Math.hypot(px - tx, py - ty, pz - tz) < 1e-6) return null;
  const cam: CameraState = { position: [px, py, pz], target: [tx, ty, tz] };
  if (n.length === 8 && (n[6] !== 0 || n[7] !== 0)) cam.offset = [n[6]!, n[7]!];
  return cam;
}

function fmt(x: number): string {
  const s = x.toFixed(DECIMALS).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

export function formatCam(cam: CameraState): string {
  const values = [...cam.position, ...cam.target];
  const o = cam.offset;
  if (o && (fmt(o[0]) !== "0" || fmt(o[1]) !== "0")) values.push(...o);
  return values.map(fmt).join(",");
}

/** Split a query string into raw `key[=value]` pieces, keeping them verbatim. */
function pieces(search: string): string[] {
  return search.replace(/^\?/, "").split("&").filter((p) => p !== "");
}

function keyOf(piece: string): string {
  const i = piece.indexOf("=");
  return decodeURIComponent(i < 0 ? piece : piece.slice(0, i));
}

/** Ghost mode for objects outside the isolation (spec §6): `ghost=0` in the URL means hide. */
export type GhostMode = "ghost" | "hide";

export type UrlState = {
  cam: CameraState | null;
  /** Selected object (a stable ID), or null for the full skeleton. */
  sel: string | null;
  /** Isolation tier, 0 to 2. Always 0 when nothing is selected. */
  tier: 0 | 1 | 2;
  ghost: GhostMode;
};

const MANAGED = ["sel", "tier", "ghost", "cam"] as const;

/**
 * Read the app's parameters. `isId` says which IDs exist: an unknown `sel` is
 * dropped (and with it the tier).
 */
export function parseUrlState(search: string, isId: (id: string) => boolean = () => true): UrlState {
  const q = new URLSearchParams(search);
  const rawSel = q.get("sel");
  const sel = rawSel && isId(rawSel) ? rawSel : null;
  const t = Number(q.get("tier"));
  const tier = sel !== null && (t === 1 || t === 2) ? t : 0;
  const ghost: GhostMode = q.get("ghost") === "0" ? "hide" : "ghost";
  return { cam: parseCam(q.get("cam")), sel, tier, ghost };
}

/**
 * Write the given parts of the state into `search`. Parts not given keep their
 * value from `search`; every other parameter is kept verbatim (including bare
 * flags such as `?debug`). The app's own parameters go last, in the order
 * sel, tier, ghost, cam, and only when they differ from the defaults.
 * Returns "" or a string starting with "?".
 */
export function serialiseUrlState(state: Partial<UrlState>, search: string): string {
  const merged = { ...parseUrlState(search), ...state };
  const kept = pieces(search).filter((p) => !(MANAGED as readonly string[]).includes(keyOf(p)));
  if (merged.sel !== null) {
    kept.push(`sel=${encodeURIComponent(merged.sel)}`);
    if (merged.tier !== 0) kept.push(`tier=${merged.tier}`);
  }
  if (merged.ghost === "hide") kept.push("ghost=0");
  if (merged.cam) kept.push(`cam=${formatCam(merged.cam)}`);
  return kept.length ? `?${kept.join("&")}` : "";
}

/** True when a bare or valued flag such as `?debug` or `?debug=1` is set (and not `=0`). */
export function hasFlag(search: string, name: string): boolean {
  const v = new URLSearchParams(search).get(name);
  return v !== null && v !== "0" && v !== "false";
}
