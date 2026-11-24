import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { depthOf, peeled, sideFree, type DepthEntry } from "../src/content/muscleDepth";
import { validateMuscleDepth } from "../src/content/muscleDepthRules";
import { peeledAt, peeledMuscleCount, registerSoftIds, resetSoftIds } from "../src/content/softRegistry";
import { trimSoftIds, type RawSoftId } from "../src/layers/softIds";
import { FULL_VIEW, shownIn, viewOf } from "../src/scene/isolation";
import { depthAnnouncement } from "../src/content/announce";
import { DEFAULT_LAYERS } from "../src/state/url";

// M7 session V, step 7 (plan decisions 9 and 10): muscle depth.

const raw = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];
const depths = JSON.parse(readFileSync("content/muscle-depth.json", "utf8")) as Record<string, 1 | 2 | 3>;

describe("content/muscle-depth.json", () => {
  it("passes the rules: every muscle has a depth, keys are real and side-free", () => {
    expect(validateMuscleDepth(depths, raw)).toEqual([]);
  });
  it("gives every muscle and every part a depth once resolved (parts inherit)", () => {
    const table = trimSoftIds(raw, depths);
    const muscular = table.filter((e) => e.kind === "muscle" || e.kind === "muscle_part");
    expect(muscular.filter((e) => e.depth === undefined)).toEqual([]);
    expect(table.filter((e) => e.kind === "ligament").every((e) => e.depth === undefined)).toBe(true);
    const by = new Map(table.map((e) => [e.id, e]));
    expect(by.get("deltoid_acromial_part_left")!.depth).toBe(1); // inherits deltoid
    expect(by.get("triceps_brachii_medial_head_right")!.depth).toBe(2); // overrides triceps (1)
    expect(by.get("transversus_abdominis_left")!.depth).toBe(3);
  });
});

describe("the rules on fixtures", () => {
  const entries: DepthEntry[] = [
    { id: "deltoid_left", kind: "muscle" },
    { id: "deltoid_right", kind: "muscle" },
    { id: "deltoid_acromial_part_left", kind: "muscle_part", parent: "deltoid_left" },
    { id: "linea_alba", kind: "muscle_part", parent: null },
    { id: "inguinal_ligament_left", kind: "ligament" },
  ];
  it("reports a muscle (or a part without a muscle) with no depth", () => {
    expect(validateMuscleDepth({ deltoid: 1 }, entries)).toEqual(["muscle-depth.json: part linea_alba has no depth"]);
    expect(validateMuscleDepth({ linea_alba: 1 }, entries)).toContain("muscle-depth.json: muscle deltoid has no depth");
  });
  it("rejects sided keys, unknown keys, non-muscles, redundant part entries and bad values", () => {
    const errs = validateMuscleDepth({ deltoid: 1, linea_alba: 1, deltoid_left: 2, biceps: 1, inguinal_ligament: 2, deltoid_acromial_part: 1 }, entries);
    expect(errs).toContain("muscle-depth.json deltoid_left: write the key without the side");
    expect(errs).toContain("muscle-depth.json biceps: no such muscle or part in content/soft-ids.json");
    expect(errs).toContain("muscle-depth.json inguinal_ligament: no such muscle or part in content/soft-ids.json");
    expect(errs).toContain("muscle-depth.json deltoid_acromial_part: same depth as its muscle; leave it out");
    expect(validateMuscleDepth({ deltoid: 4, linea_alba: 1 }, entries)[0]).toMatch(/^muscle-depth\.json deltoid:/);
  });
  it("resolves and peels", () => {
    expect(sideFree("deltoid_left")).toBe("deltoid");
    expect(depthOf(entries[2]!, { deltoid: 1 })).toBe(1);
    expect(depthOf(entries[2]!, { deltoid: 1, deltoid_acromial_part: 2 })).toBe(2);
    expect(depthOf(entries[4]!, { inguinal_ligament: 1 })).toBeUndefined();
    expect([0, 1, 2].map((s) => peeled(1, s as 0))).toEqual([false, true, true]);
    expect([0, 1, 2].map((s) => peeled(2, s as 0))).toEqual([false, false, true]);
    expect([0, 1, 2].map((s) => peeled(3, s as 0))).toEqual([false, false, false]);
    expect(peeled(undefined, 2)).toBe(false);
  });
});

describe("peeling in the view", () => {
  beforeAll(() => registerSoftIds(trimSoftIds(raw, depths)));
  afterAll(() => resetSoftIds());
  const st = (muscleDepth: 0 | 1 | 2, sel: string | null = null) => ({
    sel,
    tier: 0 as const,
    ghostMode: "ghost" as const,
    grp: null,
    joint: null,
    layers: { ...DEFAULT_LAYERS, muscles: "on" as const },
    hidden: new Set<string>(),
    muscleDepth,
  });
  const hasMesh = () => true;
  it("hides (not ghosts) the peeled muscles; deeper ones stay solid", () => {
    expect(shownIn(viewOf(st(0), hasMesh), "muscles", "deltoid_acromial_part_left")).toBe("solid");
    expect(shownIn(viewOf(st(1), hasMesh), "muscles", "deltoid_acromial_part_left")).toBe("hidden");
    expect(shownIn(viewOf(st(1), hasMesh), "muscles", "supraspinatus_left")).toBe("solid");
    expect(shownIn(viewOf(st(2), hasMesh), "muscles", "supraspinatus_left")).toBe("hidden");
    expect(shownIn(viewOf(st(2), hasMesh), "muscles", "subscapularis_left")).toBe("solid");
  });
  it("never peels the selected structure, ligaments or bones", () => {
    expect(shownIn(viewOf(st(2, "deltoid_acromial_part_left"), hasMesh), "muscles", "deltoid_acromial_part_left")).toBe("solid");
    expect(shownIn(viewOf(st(2), hasMesh), "ligaments", "inguinal_ligament_left")).toBe("hidden"); // the ligaments layer is Off
    expect(shownIn(viewOf(st(2), hasMesh), "bones", "femur_left")).toBe("solid");
    expect(viewOf({ ...st(0), muscleDepth: undefined }, hasMesh).hidden.size).toBe(0);
    expect(FULL_VIEW.isolated).toBe(false);
  });
  it("counts and announces", () => {
    const n1 = peeledMuscleCount(1);
    const n2 = peeledMuscleCount(2);
    expect(n1).toBeGreaterThan(50);
    expect(n2).toBeGreaterThan(n1);
    expect(peeledAt(1).has("deltoid_acromial_part_left")).toBe(true);
    expect(depthAnnouncement(1, 41)).toBe("Superficial muscles hidden: 41 muscles.");
    expect(depthAnnouncement(2, 150)).toBe("Superficial and intermediate muscles hidden, deep muscles only: 150 muscles.");
    expect(depthAnnouncement(0, 0)).toBe("All muscles shown.");
    expect(depthAnnouncement(1, null)).toBe("Superficial muscles hidden.");
  });
});
