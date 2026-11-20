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

/**
 * Layers (musculoskeletal spec §6.1, M7 plan decision 1). The order is the
 * Layers panel's (spec §6.1 table) and the URL's.
 */
export const LAYERS = ["bones", "cartilage", "ligaments", "muscles"] as const;
export type Layer = (typeof LAYERS)[number];
/** The soft-tissue layers, each with its own pair of files (M6). */
export const TISSUE_LAYERS = ["cartilage", "ligaments", "muscles"] as const satisfies readonly Layer[];
export type TissueLayer = (typeof TISSUE_LAYERS)[number];
export type LayerMode = "on" | "ghost" | "off";
export type LayerModes = Record<Layer, LayerMode>;
/**
 * Muscle depth control (spec §6.2, three stops as the user chose in session V):
 * 0 = all, 1 = hide superficial, 2 = hide superficial + intermediate (deep only).
 */
export type MuscleDepth = 0 | 1 | 2;
export type LayerSetting = { layers: LayerModes; depth: MuscleDepth };

export const DEFAULT_LAYERS: LayerModes = { bones: "on", cartilage: "off", ligaments: "off", muscles: "off" };
export const DEFAULT_LAYER_SETTING: LayerSetting = { layers: DEFAULT_LAYERS, depth: 0 };

const LAYER_CODE: Record<Layer, string> = { bones: "b", cartilage: "c", ligaments: "l", muscles: "m" };
const CODE_LAYER: Record<string, Layer> = { b: "bones", c: "cartilage", l: "ligaments", m: "muscles" };
const MODES: readonly string[] = ["on", "ghost", "off"];

/**
 * The user format `b:on,c:off,l:off,m:ghost:2` has a colon in it; M6's debug
 * view uses `layers=all` or `m,l,c,a` (no colon) and keeps that meaning.
 */
export function isUserLayersValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.includes(":");
}

/**
 * Parse the user format. Missing layers keep their default, unknown codes and
 * modes are ignored, and the muscles entry may carry the depth (`m:on:2`).
 * Null when the value isn't the user format or has no valid entry.
 */
export function parseLayers(value: string | null | undefined): LayerSetting | null {
  if (!isUserLayersValue(value)) return null;
  const layers: LayerModes = { ...DEFAULT_LAYERS };
  let depth: MuscleDepth = 0;
  let any = false;
  for (const piece of value!.split(",")) {
    const [code = "", mode = "", extra] = piece.trim().toLowerCase().split(":");
    const layer = CODE_LAYER[code] ?? ((LAYERS as readonly string[]).includes(code) ? (code as Layer) : undefined);
    if (!layer || !MODES.includes(mode)) continue;
    layers[layer] = mode as LayerMode;
    any = true;
    if (layer === "muscles" && extra !== undefined) {
      const d = Number(extra);
      // `3` was "Deep only" while the control had four stops (session V's first build): the same as 2.
      if (d === 1 || d === 2) depth = d;
      else if (d === 3) depth = 2;
    }
  }
  return any ? { layers, depth } : null;
}

export function isDefaultLayers(s: LayerSetting): boolean {
  return s.depth === 0 && LAYERS.every((l) => s.layers[l] === DEFAULT_LAYERS[l]);
}

/** Every layer in panel order, the depth on the muscles entry when it isn't 0. */
export function formatLayers(s: LayerSetting): string {
  return LAYERS.map((l) => `${LAYER_CODE[l]}:${s.layers[l]}${l === "muscles" && s.depth !== 0 ? `:${s.depth}` : ""}`).join(",");
}

/** At most this many hidden structures are kept in the URL (spec §5.5); the rest are dropped with a toast. */
export const HIDDEN_URL_CAP = 100;
const ID_PATTERN = /^[a-z0-9_]+$/;

/** `hid=a,b,c`: well-formed IDs, no repeats, capped. `dropped` counts what the cap cut off. */
export function parseHidden(value: string | null | undefined, isId: (id: string) => boolean = () => true): { ids: string[]; dropped: number } {
  if (!value) return { ids: [], dropped: 0 };
  const seen = new Set<string>();
  for (const raw of value.split(",")) {
    const id = raw.trim();
    if (ID_PATTERN.test(id) && isId(id)) seen.add(id);
  }
  const all = [...seen];
  return { ids: all.slice(0, HIDDEN_URL_CAP), dropped: Math.max(0, all.length - HIDDEN_URL_CAP) };
}

export type UrlState = {
  cam: CameraState | null;
  /** Selected object (a stable ID), or null for the full skeleton. */
  sel: string | null;
  /** Isolation tier, 0 to 2. Always 0 when nothing is selected. */
  tier: 0 | 1 | 2;
  /** Isolated group (Milestone 5, a hierarchy node key), or null. Never set together with `sel`. */
  grp: string | null;
  ghost: GhostMode;
  /** Colour-by-region (plan decision 8): `color=region` in the URL; null when the URL doesn't say. */
  color: "region" | null;
  /** Layers in the user format (M7), or null when the URL doesn't say (or uses the M6 debug format). */
  layers: LayerSetting | null;
  /** Hidden structures (`hid=`, spec §5.5), capped at `HIDDEN_URL_CAP`. */
  hid: string[];
};

const MANAGED = ["sel", "tier", "grp", "ghost", "color", "hid", "cam"] as const;

/**
 * Read the app's parameters. `isId` says which IDs exist: an unknown `sel` is
 * dropped (and with it the tier). `isGroup` does the same for `grp`, which is
 * ignored when `sel` is set (the two are exclusive).
 */
export function parseUrlState(
  search: string,
  isId: (id: string) => boolean = () => true,
  isGroup: (key: string) => boolean = () => true,
): UrlState {
  const q = new URLSearchParams(search);
  const rawSel = q.get("sel");
  const sel = rawSel && isId(rawSel) ? rawSel : null;
  const t = Number(q.get("tier"));
  const tier = sel !== null && (t === 1 || t === 2) ? t : 0;
  const rawGrp = q.get("grp");
  const grp = sel === null && rawGrp && isGroup(rawGrp) ? rawGrp : null;
  const ghost: GhostMode = q.get("ghost") === "0" ? "hide" : "ghost";
  const color = q.get("color") === "region" ? "region" : null;
  const layers = parseLayers(q.get("layers"));
  const hid = parseHidden(q.get("hid")).ids;
  return { cam: parseCam(q.get("cam")), sel, tier, grp, ghost, color, layers, hid };
}

/**
 * Write the given parts of the state into `search`. Parts not given keep their
 * value from `search`; every other parameter is kept verbatim (including bare
 * flags such as `?debug`). The app's own parameters go last, in the order
 * sel, tier (or grp), ghost, color, layers, hid, cam, and only when they differ from the defaults.
 * `layers` in M6's debug format (`layers=all`) is kept verbatim unless `state` sets the layers.
 * Returns "" or a string starting with "?".
 */
export function serialiseUrlState(state: Partial<UrlState>, search: string): string {
  const merged = { ...parseUrlState(search), ...state };
  const rawLayers = new URLSearchParams(search).get("layers");
  const ownLayers = state.layers !== undefined || isUserLayersValue(rawLayers);
  const kept = pieces(search).filter((p) => {
    const k = keyOf(p);
    return !(MANAGED as readonly string[]).includes(k) && !(k === "layers" && ownLayers);
  });
  if (merged.sel !== null) {
    kept.push(`sel=${encodeURIComponent(merged.sel)}`);
    if (merged.tier !== 0) kept.push(`tier=${merged.tier}`);
  } else if (merged.grp !== null) kept.push(`grp=${encodeURIComponent(merged.grp)}`);
  if (merged.ghost === "hide") kept.push("ghost=0");
  if (merged.color === "region") kept.push("color=region");
  if (ownLayers && merged.layers && !isDefaultLayers(merged.layers)) kept.push(`layers=${formatLayers(merged.layers)}`);
  if (merged.hid.length > 0) kept.push(`hid=${merged.hid.slice(0, HIDDEN_URL_CAP).join(",")}`);
  if (merged.cam) kept.push(`cam=${formatCam(merged.cam)}`);
  return kept.length ? `?${kept.join("&")}` : "";
}

/** True when a bare or valued flag such as `?debug` or `?debug=1` is set (and not `=0`). */
export function hasFlag(search: string, name: string): boolean {
  const v = new URLSearchParams(search).get(name);
  return v !== null && v !== "0" && v !== "false";
}
