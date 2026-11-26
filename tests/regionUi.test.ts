// M13 BN: the region UI's pure parts (plan decision 8): the generated body map
// (projection, hulls, which regions each view shows, the regions' boxes) and the
// region announcements, on the real volumes, membership and content.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import volumes from "../assets/build/region-volumes.json";
import { buildBodyMap, containers, convexHull, inConvex, project, MIN_VISIBLE } from "../src/regions/bodyMap";
import type { RegionVolumes } from "../src/regions/volume";
import { compileAllSoftFromDisk } from "../scripts/lib/content-files";
import { countsPhrase, isolationAnnouncement, LEFT_REGION_ANNOUNCEMENT, OUTSIDE_REGION, regionAnnouncement, regionCounts } from "../src/content/announce";
import { registerSoftContent, resetSoftContent } from "../src/content/softContentLoader";
import { resetAppGraph } from "../src/content/appGraph";
import { hasMesh } from "../src/content/index";
import { membersOf, regionList } from "../src/regions/index";
import { DEFAULT_MODES } from "../src/systems/registry";
import type { LayerModes } from "../src/state/url";

const V = volumes as unknown as RegionVolumes;

describe("body map geometry", () => {
  it("projects front with the patient's left on the right, back mirrored, y down", () => {
    expect(project([0.1, 1, 0.2], "front")).toEqual({ u: 0.1, v: -1, depth: 0.2 });
    expect(project([0.1, 1, 0.2], "back")).toEqual({ u: -0.1, v: -1, depth: -0.2 });
  });
  it("hulls drop inner and collinear points; inConvex takes either winding", () => {
    const hull = convexHull([
      [0, 0],
      [2, 0],
      [1, 0],
      [2, 2],
      [0, 2],
      [1, 1],
    ]);
    expect(hull).toHaveLength(4);
    expect(inConvex(hull, [1, 1])).toBe(true);
    expect(inConvex([...hull].reverse(), [1, 1])).toBe(true);
    expect(inConvex(hull, [3, 1])).toBe(false);
  });
  it("nested volumes: the orbit and the oral cavity in the face, the ear in the cranium", () => {
    expect(Object.fromEntries(containers(V.regions))).toEqual({ orbit: "face", oral_cavity: "face", ear: "cranium" });
  });
});

describe("the generated body map (real volumes)", () => {
  const map = buildBodyMap(V);
  const keys = (view: "front" | "back") => map.views.find((v) => v.view === view)!.shapes.map((s) => s.key);
  it("has a front and a back view, each shape a region with its own name", () => {
    expect(map.views.map((v) => v.view)).toEqual(["front", "back"]);
    const names = new Map(V.regions.map((r) => [r.key, r.name]));
    for (const v of map.views) for (const s of v.shapes) expect(s.name).toBe(names.get(s.key));
    expect(MIN_VISIBLE).toBeGreaterThan(0);
  });
  it("shows the front regions from the front and the back regions from the back", () => {
    expect(keys("front")).toEqual(expect.arrayContaining(["face", "orbit", "oral_cavity", "anterior_neck", "thoracic_wall", "abdominal_wall", "forearm_left", "thigh_right"]));
    expect(keys("front")).not.toContain("back_thoracic");
    expect(keys("front")).not.toContain("posterior_neck");
    expect(keys("back")).toEqual(expect.arrayContaining(["back_thoracic", "back_lumbar", "back_sacral", "posterior_neck", "ear", "forearm_left"]));
    expect(keys("back")).not.toContain("face");
  });
  it("puts every fine region except the pelvis and the perineum on at least one view", () => {
    const shown = new Set([...keys("front"), ...keys("back")]);
    expect(V.regions.map((r) => r.key).filter((k) => !shown.has(k))).toEqual(["pelvis", "perineum"]);
  });
  it("paints a nested region after its container", () => {
    const f = keys("front");
    expect(f.indexOf("orbit")).toBeGreaterThan(f.indexOf("face"));
  });
  it("has a box for every region, fine and coarse; a coarse box holds its fine ones", () => {
    for (const k of [...V.regions.map((r) => r.key), ...V.coarse.map((c) => c.key)]) expect(map.boxes[k]).toBeDefined();
    const arm = map.boxes.upper_limb_left!;
    const fa = map.boxes.forearm_left!;
    for (let i = 0; i < 3; i++) {
      expect(arm.min[i]).toBeLessThanOrEqual(fa.min[i]!);
      expect(arm.max[i]).toBeGreaterThanOrEqual(fa.max[i]!);
    }
    // The left forearm is on the patient's left (+X).
    expect(fa.min[0]).toBeGreaterThan(0);
  });
});

describe("region announcements (real membership and content)", () => {
  const SOFT = compileAllSoftFromDisk();
  beforeAll(() => {
    for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftContent(l, SOFT[l]);
  });
  afterAll(() => {
    resetSoftContent();
    resetAppGraph();
  });
  const ALL_ON: LayerModes = { ...DEFAULT_MODES, muscles: "on", ligaments: "on", cartilage: "on" };
  const iso = (sel: string | null, reg: string | null, tier: 0 | 1 | 2 = 0, grp: string | null = null) => ({ sel, tier, grp, reg });
  const say = (now: ReturnType<typeof iso>, prev: ReturnType<typeof iso> | null, m: LayerModes = ALL_ON) => isolationAnnouncement(now, prev, m, hasMesh);

  it("counts a region's drawn members by kind on the layers showing", () => {
    const bones = regionCounts("forearm_left", DEFAULT_MODES, hasMesh);
    expect(Object.keys(bones)).toEqual(["bone"]);
    expect(membersOf("forearm_left")).toEqual(expect.arrayContaining(["radius_left", "ulna_left"]));
    expect(bones.bone).toBeGreaterThanOrEqual(2);
    const all = regionCounts("forearm_left", ALL_ON, hasMesh);
    expect(all.bone).toBe(bones.bone);
    expect(all.muscle).toBeGreaterThan(10);
  });
  it("entering, changing and returning to a region say the region and its counts", () => {
    const counts = countsPhrase(regionCounts("forearm_left", ALL_ON, hasMesh));
    const msg = `Body region: forearm (left). ${counts} shown.`;
    expect(regionAnnouncement("forearm_left", regionCounts("forearm_left", ALL_ON, hasMesh))).toBe(msg);
    expect(say(iso(null, "forearm_left"), iso(null, null))).toBe(msg);
    expect(say(iso(null, "forearm_left"), iso(null, "arm_left"))).toBe(msg);
    expect(say(iso(null, "forearm_left"), iso("radius_left", "forearm_left"))).toBe(msg);
    expect(say(iso(null, "forearm_left"), iso("femur_left", null))).toBe(msg);
    expect(regionAnnouncement("pelvis", {})).toBe("Body region: pelvis. Nothing in the layers showing.");
  });
  it("leaving says so; with an isolation kept, only that", () => {
    expect(say(iso(null, null), iso(null, "forearm_left"))).toBe(LEFT_REGION_ANNOUNCEMENT);
    expect(say(iso("radius_left", null), iso("radius_left", "forearm_left"))).toBe(LEFT_REGION_ANNOUNCEMENT);
    expect(say(iso("femur_left", null), iso(null, "forearm_left"))).toBe(`${LEFT_REGION_ANNOUNCEMENT} Femur, left, selected. Isolated.`);
  });
  it("a selection inside is said as at M12; one outside adds that it is outside", () => {
    expect(say(iso("radius_left", "forearm_left"), iso(null, "forearm_left"))).toBe("Radius, left, selected. Isolated.");
    expect(say(iso("femur_left", "forearm_left"), iso(null, "forearm_left"))).toBe(`Femur, left, selected. Isolated. ${OUTSIDE_REGION}`);
  });
  it("tier counts are of what the region shows", () => {
    const whole = say(iso("radius_left", null, 1), iso("radius_left", null));
    const inside = say(iso("radius_left", "forearm_left", 1), iso("radius_left", "forearm_left"));
    expect(whole).toMatch(/^Radius, left: related bones shown\./);
    expect(inside).toMatch(/^Radius, left: related bones shown\./);
    expect(inside).not.toBe(whole);
  });
  it("every region has a name the message can lower-case", () => {
    for (const r of regionList()) expect(regionAnnouncement(r.key, { bone: 1 })).toMatch(/^Body region: [a-z]/);
  });
});
