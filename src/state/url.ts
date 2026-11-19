// Pure helpers for the URL query string (spec §7, "URL state").
// No React or three.js here, so Vitest covers them directly.

export type Vec3 = [number, number, number];
export type CameraState = { position: Vec3; target: Vec3 };

/** Anything further than this from the origin (metres) is treated as garbage. */
const MAX_COORD_M = 100;
/** Metres are written with 4 decimals: 0.1 mm. */
const DECIMALS = 4;

/** Parse `px,py,pz,tx,ty,tz`. Returns null for anything malformed or out of range. */
export function parseCam(value: string | null | undefined): CameraState | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 6) return null;
  const n = parts.map((p) => (p.trim() === "" ? NaN : Number(p)));
  if (n.some((x) => !Number.isFinite(x) || Math.abs(x) > MAX_COORD_M)) return null;
  const [px, py, pz, tx, ty, tz] = n as [number, number, number, number, number, number];
  // The camera must not sit on its own target.
  if (Math.hypot(px - tx, py - ty, pz - tz) < 1e-6) return null;
  return { position: [px, py, pz], target: [tx, ty, tz] };
}

function fmt(x: number): string {
  const s = x.toFixed(DECIMALS).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

export function formatCam(cam: CameraState): string {
  return [...cam.position, ...cam.target].map(fmt).join(",");
}

/** Split a query string into raw `key[=value]` pieces, keeping them verbatim. */
function pieces(search: string): string[] {
  return search.replace(/^\?/, "").split("&").filter((p) => p !== "");
}

function keyOf(piece: string): string {
  const i = piece.indexOf("=");
  return decodeURIComponent(i < 0 ? piece : piece.slice(0, i));
}

export type UrlState = { cam: CameraState | null };

export function parseUrlState(search: string): UrlState {
  return { cam: parseCam(new URLSearchParams(search).get("cam")) };
}

/**
 * Write `state` into `search`, keeping every other parameter as it was
 * (including bare flags such as `?debug`). Returns "" or a string starting with "?".
 */
export function serialiseUrlState(state: UrlState, search: string): string {
  const kept = pieces(search).filter((p) => keyOf(p) !== "cam");
  if (state.cam) kept.push(`cam=${formatCam(state.cam)}`);
  return kept.length ? `?${kept.join("&")}` : "";
}

/** True when a bare or valued flag such as `?debug` or `?debug=1` is set (and not `=0`). */
export function hasFlag(search: string, name: string): boolean {
  const v = new URLSearchParams(search).get(name);
  return v !== null && v !== "0" && v !== "false";
}
