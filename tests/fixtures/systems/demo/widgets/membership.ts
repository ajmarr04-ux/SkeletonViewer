// Where the fixture's widgets sit and which body regions hold them (M13 plan
// decision 11). Each kind's row of four is placed at the front of one fine
// region's resolved volume (assets/build/region-volumes.json), in a 2 × 2 grid,
// so the three rows fall in three coarse regions: the gears in the head, the
// springs in the thorax, the levers in the left lower limb. Their membership is
// computed with the app's own pure functions (src/regions/membership.ts) and
// written by generate.ts to located-in.json, which the fixture's registry
// option merges into the real file (scripts/lib/index-plugin.ts, `extraMembership`).
import { memberIndices, triangleTotals, vertexShares, type LocatedInFile, type MemberRegion, type StructureMembership } from "../../../../../src/regions/membership";
import type { OBox, RegionVolumes, Vec3 } from "../../../../../src/regions/volume";
import { WIDGET_IDS, widgets } from "./layer";

/** The membership file the fixture merges (repo path). */
export const WIDGETS_MEMBERSHIP = "tests/fixtures/systems/demo/widgets/located-in.json";

/** Half the box's edge, metres. */
export const HALF = 0.03;
/** Each kind's row (in `widgets.kinds` order): the fine region it sits in, and that region's coarse parent (its chunk). */
export const PLACES = [
  { region: "face", coarse: "head" },
  { region: "thoracic_wall", coarse: "thorax" },
  { region: "thigh_left", coarse: "lower_limb_left" },
] as const;
/** Grid offset from the region's centre, along its two non-depth axes, metres. */
const STEP = 0.035;

const round = (x: number) => Math.round(x * 1e4) / 1e4;

/** Box centres (glTF: Y up, facing +Z), in `WIDGET_IDS` order. */
export function widgetCentres(volumes: RegionVolumes): Vec3[] {
  return WIDGET_IDS.map((_, i) => {
    const place = PLACES[Math.floor(i / 4)]!;
    const box = volumes.regions.find((r) => r.key === place.region)!.shapes[0] as OBox;
    // The axis nearest the world's +Z (anterior) and its sign: the boxes sit just inside the volume's front face.
    const depth = [0, 1, 2].reduce((best, k) => (Math.abs(box.axes[k]![2]) > Math.abs(box.axes[best]![2]) ? k : best), 0);
    const front = Math.sign(box.axes[depth]![2]) * (box.half[depth]! - HALF - 0.01);
    const [a, b] = [0, 1, 2].filter((k) => k !== depth) as [number, number];
    const col = i % 4;
    const off: Record<number, number> = { [depth]: front, [a]: (col % 2 ? 1 : -1) * STEP, [b]: (col < 2 ? 1 : -1) * STEP };
    return [0, 1, 2].map((k) => round(box.center[k]! + [0, 1, 2].reduce((s, j) => s + box.axes[j]![k]! * off[j]!, 0))) as Vec3;
  });
}

/** The widgets' membership, as a file `mergeMembership` adds to the real one (its region lists, threshold and hash). */
export function widgetsMembership(
  volumes: RegionVolumes,
  base: Pick<LocatedInFile, "regions" | "coarse">,
  points: readonly ArrayLike<number>[],
  trianglesEach: number,
): Omit<LocatedInFile, "$comment"> {
  const regions: MemberRegion[] = volumes.regions.map((r) => ({ key: r.key, coarse: r.coarse, shapes: r.shapes }));
  const coarseKeys = base.coarse.map((c) => c.key);
  const structures: Record<string, StructureMembership> = {};
  WIDGET_IDS.forEach((id, i) => {
    const { shares, home } = vertexShares(points[i]!, regions, coarseKeys);
    const touched = Object.fromEntries(shares.flatMap((s, k) => (s > 0 ? [[regions[k]!.key, Math.round(s * 1000) / 1000]] : [])));
    structures[id] = { regions: memberIndices(shares, volumes.threshold).map((k) => regions[k]!.key), shares: touched, home };
  });
  const tris = () => trianglesEach;
  return {
    threshold: volumes.threshold,
    sourceHash: volumes.sourceHash,
    regions: base.regions,
    coarse: base.coarse,
    structures,
    triangles: { [widgets.id]: triangleTotals(WIDGET_IDS, (id) => structures[id]!.regions, { high: tris, low: tris }, base.coarse) },
  };
}
