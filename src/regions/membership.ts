// Body-region membership (SPEC-platform §6.2; M13 plan decisions 4 to 6).
// Pure: the vertex shares, the threshold rule, overrides, inheritance for
// structures without a mesh, the checks and the triangle totals. The I/O is
// scripts/regions/membership.ts (`npm run regions`); the output is
// assets/build/located-in.json. Names no layer, kind or region.

import { inShape, type Shape, type Vec3 } from "./volume";

/** A fine region as membership reads it (from assets/build/region-volumes.json). */
export type MemberRegion = { key: string; coarse: string; shapes: Shape[] };

export type Override = { id: string; region: string; reason: string };
/** content/regions/overrides.json. */
export type Overrides = { $comment?: string; add: Override[]; remove: Override[] };

/** How a structure without a mesh got its regions. */
export type Inherited = "parts" | "neighbours";

export type StructureMembership = {
  /** Fine regions, in region order. */
  regions: string[];
  /** Share of the structure's vertices in each fine region it touches (3 decimals; only those above 0). */
  shares?: Record<string, number>;
  /** The coarse region holding most of its vertices (decision 9: its chunk); null without a mesh. */
  home: string | null;
  inherited?: Inherited;
  /** The structures it inherited from. */
  from?: string[];
  /** The regions before the overrides, when an override changed them. */
  computed?: string[];
};

export type TriangleTotals = {
  /** Per LOD: each region's (fine and coarse) member triangles, each structure once. */
  high: Record<string, number>;
  low: Record<string, number>;
  /** The whole layer, per LOD. */
  total: { high: number; low: number };
};

export type LocatedInFile = {
  $comment: string;
  threshold: number;
  /** Hash of region-volumes.json and overrides.json. */
  sourceHash: string;
  /** Fine region keys, in order. */
  regions: string[];
  /** Coarse regions with their fine regions, in order. */
  coarse: { key: string; regions: string[] }[];
  structures: Record<string, StructureMembership>;
  /** Per layer. */
  triangles: Record<string, TriangleTotals>;
};

// ------------------------------------------------------------ vertex shares

type Bounds = { min: Vec3; max: Vec3 };
function shapeBounds(s: Shape): Bounds {
  if (s.type === "capsule") {
    const r = s.radius;
    return {
      min: [0, 1, 2].map((k) => Math.min(s.a[k]!, s.b[k]!) - r) as Vec3,
      max: [0, 1, 2].map((k) => Math.max(s.a[k]!, s.b[k]!) + r) as Vec3,
    };
  }
  const ext = [0, 1, 2].map((k) => s.axes.reduce((sum, ax, i) => sum + Math.abs(ax[k]!) * s.half[i]!, 0));
  return { min: [0, 1, 2].map((k) => s.center[k]! - ext[k]! - 1e-9) as Vec3, max: [0, 1, 2].map((k) => s.center[k]! + ext[k]! + 1e-9) as Vec3 };
}
const within = (b: Bounds, p: Vec3) => p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2];

/** Point tests per region, with a bounding-box reject per shape. */
export function regionTester(regions: readonly MemberRegion[]): (p: Vec3) => boolean[] {
  const prepared = regions.map((r) => r.shapes.map((s) => ({ s, b: shapeBounds(s) })));
  return (p) => prepared.map((shapes) => shapes.some(({ s, b }) => within(b, p) && inShape(s, p)));
}

/**
 * For one structure's world vertices (flat xyz): the share inside each fine
 * region and the coarse region holding most of them (a vertex counts once per
 * coarse region; ties go to the earlier coarse region; null if none holds any).
 */
export function vertexShares(
  points: ArrayLike<number>,
  regions: readonly MemberRegion[],
  coarseKeys: readonly string[],
  test = regionTester(regions),
): { shares: number[]; home: string | null } {
  const n = points.length / 3;
  const fine = new Array<number>(regions.length).fill(0);
  const coarse = new Array<number>(coarseKeys.length).fill(0);
  const coarseOf = regions.map((r) => coarseKeys.indexOf(r.coarse));
  const hit = new Set<number>();
  for (let i = 0; i < n; i++) {
    const inside = test([points[3 * i]!, points[3 * i + 1]!, points[3 * i + 2]!]);
    hit.clear();
    inside.forEach((yes, k) => {
      if (!yes) return;
      fine[k]!++;
      hit.add(coarseOf[k]!);
    });
    for (const c of hit) coarse[c]!++;
  }
  let best = -1;
  coarse.forEach((c, k) => {
    if (c > 0 && (best < 0 || c > coarse[best]!)) best = k;
  });
  return { shares: fine.map((c) => (n === 0 ? 0 : c / n)), home: best < 0 ? null : coarseKeys[best]! };
}

/** The fine regions a structure is `located_in`: every share ≥ threshold, else its single best (if any share is above 0). Indices, ascending. */
export function memberIndices(shares: readonly number[], threshold: number): number[] {
  const over = shares.flatMap((s, k) => (s >= threshold ? [k] : []));
  if (over.length > 0) return over;
  let best = -1;
  shares.forEach((s, k) => {
    if (s > 0 && (best < 0 || s > shares[best]!)) best = k;
  });
  return best < 0 ? [] : [best];
}

export const round3 = (x: number): number => Math.round(x * 1000) / 1000;

// ------------------------------------------------------------ overrides and inheritance

/** The overrides' own problems (reason, known ID and region); `changes` are checked when they are applied. */
export function checkOverrides(o: Overrides, known: (id: string) => boolean, regionKeys: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [what, list] of [["add", o.add], ["remove", o.remove]] as const) {
    if (!Array.isArray(list)) {
      errors.push(`overrides: "${what}" is not a list`);
      continue;
    }
    for (const x of list) {
      const at = `overrides ${what} ${x.id} → ${x.region}`;
      if (!x.reason?.trim()) errors.push(`${at}: no reason`);
      if (!known(x.id)) errors.push(`${at}: unknown structure`);
      if (!regionKeys.has(x.region)) errors.push(`${at}: unknown fine region`);
      const key = `${x.id}\u0000${x.region}`;
      if (seen.has(key)) errors.push(`${at}: listed twice`);
      seen.add(key);
    }
  }
  return errors;
}

/**
 * Apply the overrides of the IDs `which` accepts, in place. An override that
 * changes nothing (adds a region the structure is already in, removes one it
 * isn't) is an error. Region order is kept.
 */
export function applyOverrides(
  out: Map<string, StructureMembership>,
  o: Overrides,
  regionOrder: readonly string[],
  which: (id: string) => boolean,
): string[] {
  const errors: string[] = [];
  const rank = (k: string) => regionOrder.indexOf(k);
  for (const [what, list] of [["add", o.add], ["remove", o.remove]] as const)
    for (const x of list) {
      if (!which(x.id)) continue;
      const m = out.get(x.id);
      if (!m) continue; // unknown IDs are checkOverrides' error
      const has = m.regions.includes(x.region);
      if (what === "add" ? has : !has) {
        errors.push(`overrides ${what} ${x.id} → ${x.region}: changes nothing (${what === "add" ? "already in it" : "not in it"})`);
        continue;
      }
      m.computed ??= [...m.regions];
      m.regions = what === "add" ? [...m.regions, x.region].sort((a, b) => rank(a) - rank(b)) : m.regions.filter((r) => r !== x.region);
    }
  return errors;
}

/**
 * Regions for a structure without a mesh (decision 4): a structure with parts
 * takes the union of its parts' regions; any other takes the regions most of
 * its tier-1 neighbours (those with regions) share: a wisdom tooth is where its
 * neighbouring tooth and its jaw both are (the oral cavity), not everywhere the
 * jaw reaches. Region order; `from` in the order given.
 */
export function inheritRegions(
  parts: readonly string[],
  neighbours: () => readonly string[],
  regionsOf: (id: string) => readonly string[] | undefined,
  regionOrder: readonly string[],
): StructureMembership {
  const via: Inherited = parts.length > 0 ? "parts" : "neighbours";
  const from = (parts.length > 0 ? parts : neighbours()).filter((id) => (regionsOf(id)?.length ?? 0) > 0);
  const count = new Map<string, number>();
  for (const id of from) for (const r of regionsOf(id)!) count.set(r, (count.get(r) ?? 0) + 1);
  const most = Math.max(0, ...count.values());
  const keep = (r: string) => (via === "parts" ? count.has(r) : count.get(r) === most);
  return { regions: regionOrder.filter(keep), home: null, inherited: via, from };
}

// ------------------------------------------------------------ checks (validate-content)

export type MembershipCheckInput = {
  file: LocatedInFile;
  overrides: Overrides;
  /** Every structure ID (all layers), and those with a mesh. */
  ids: readonly string[];
  meshIds: ReadonlySet<string>;
  /** Fine region keys from region-volumes.json. */
  regionKeys: readonly string[];
};

/** Spec §10's region checks over the generated file and the overrides. */
export function checkMembership({ file, overrides, ids, meshIds, regionKeys }: MembershipCheckInput): string[] {
  const errors: string[] = [];
  const known = new Set(ids);
  const keys = new Set(regionKeys);
  if (file.regions.join(",") !== regionKeys.join(",")) errors.push("located-in.json: its region list differs from region-volumes.json (run npm run regions)");
  for (const id of ids) if (!file.structures[id]) errors.push(`${id}: missing from located-in.json (run npm run regions)`);
  for (const [id, m] of Object.entries(file.structures)) {
    if (!known.has(id)) errors.push(`${id}: in located-in.json but not a structure`);
    if (meshIds.has(id) && m.regions.length === 0) errors.push(`${id}: has a mesh but no located_in region`);
    for (const r of m.regions) if (!keys.has(r)) errors.push(`${id}: located in unknown region ${r}`);
  }
  for (const k of regionKeys) if (!Object.values(file.structures).some((m) => m.regions.includes(k))) errors.push(`region ${k}: contains no structure`);
  errors.push(...checkOverrides(overrides, (id) => known.has(id), keys));
  for (const [what, list] of [["add", overrides.add], ["remove", overrides.remove]] as const)
    for (const x of list ?? []) {
      const m = file.structures[x.id];
      if (!m) continue;
      const now = m.regions.includes(x.region);
      const before = (m.computed ?? m.regions).includes(x.region);
      if (what === "add" ? !now || before : now || !before) errors.push(`overrides ${what} ${x.id} → ${x.region}: not applied, or changes nothing (run npm run regions)`);
    }
  return errors;
}

// ------------------------------------------------------------ triangle totals

/**
 * A layer's triangle totals per region (decision 5): for each fine region the
 * sum over its members, for each coarse region over the union of its fine
 * regions' members (each structure once), and the whole layer.
 */
export function triangleTotals(
  layerIds: readonly string[],
  regionsOf: (id: string) => readonly string[],
  tris: { high(id: string): number; low(id: string): number },
  coarse: readonly { key: string; regions: readonly string[] }[],
): TriangleTotals {
  const out: TriangleTotals = { high: {}, low: {}, total: { high: 0, low: 0 } };
  const fineOrder = coarse.flatMap((c) => c.regions);
  for (const lod of ["high", "low"] as const) {
    const per = out[lod];
    for (const k of fineOrder) per[k] = 0;
    for (const c of coarse) per[c.key] = 0;
    for (const id of layerIds) {
      const t = tris[lod](id);
      out.total[lod] += t;
      const rs = regionsOf(id);
      for (const r of rs) per[r] = (per[r] ?? 0) + t;
      for (const c of coarse) if (c.regions.some((r) => rs.includes(r))) per[c.key]! += t;
    }
  }
  return out;
}

// ------------------------------------------------------------ merging

/**
 * Another layer set's membership (the fixture's, M13 plan decision 11) added to
 * a file: the same regions, structures and layers that neither already has.
 */
export function mergeMembership(base: LocatedInFile, extra: Pick<LocatedInFile, "regions" | "coarse" | "structures" | "triangles">): LocatedInFile {
  if (JSON.stringify([base.regions, base.coarse]) !== JSON.stringify([extra.regions, extra.coarse])) throw new Error("mergeMembership: the region lists differ (regenerate the extra file)");
  for (const id of Object.keys(extra.structures)) if (base.structures[id]) throw new Error(`mergeMembership: ${id} is in both files`);
  for (const l of Object.keys(extra.triangles)) if (base.triangles[l]) throw new Error(`mergeMembership: layer ${l} is in both files`);
  return { ...base, structures: { ...base.structures, ...extra.structures }, triangles: { ...base.triangles, ...extra.triangles } };
}
