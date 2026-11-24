// M9 session AG: origins, insertions and antagonists (spec §5.2–5.3; plan
// decisions 6–8), on the real content and the real patch mapping.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { compileAllSoftFromDisk, readPatches } from "../scripts/lib/content-files";
import { registerSoftIds, resetSoftIds, softEntry } from "../src/content/softRegistry";
import { registerSoftTiers, resetSoftTiers } from "../src/content/softRelations";
import { bothSynergistAndAntagonist, buildMuscleRoles, muscleModel, patchAgreement, type MuscleRoles } from "../src/content/softRoles";
import type { SoftFm } from "../src/content/softSchema";
import { trimSoftIds, type RawSoftId } from "../src/layers/softIds";
import { isolationView, sceneView, withTints } from "../src/scene/isolation";
import { type LayerModes } from "../src/state/url";
import { DEFAULT_MODES } from "../src/systems/registry";

const RAW = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];
const BONES = ids as { id: string; meshAvailable: boolean }[];
const BONE_MESH = new Set(BONES.filter((e) => e.meshAvailable).map((e) => e.id));
const hasMesh = (id: string) => BONE_MESH.has(id) || softEntry(id)?.mesh === true;
const SOFT = compileAllSoftFromDisk();
const ROLES = SOFT.muscles.roles!;
const FM: Record<string, SoftFm> = {};
for (const c of Object.values(SOFT)) for (const [id, e] of Object.entries(c.entries)) FM[id] = e.fm;
const PATCHES = readPatches();
const DERIVED = SOFT.muscles.derived!;

const modes = (m: Partial<LayerModes>): LayerModes => ({ ...DEFAULT_MODES, ...m });
const MUSCLES_ON = modes({ muscles: "on" });

/** The whole pipeline the store uses: isolation, tints, scene. */
function view(sel: string, tier: 0 | 1 | 2, m: LayerModes, opts: { ant?: boolean; hidden?: string[]; failed?: boolean } = {}) {
  const iso = isolationView(sel, tier, "ghost", hasMesh, null, undefined, undefined, m);
  const tinted = withTints(iso, sel, tier, opts.ant ?? false, hasMesh, m, undefined, opts.failed ?? false);
  return { iso: tinted, scene: sceneView(tinted, m, new Set(opts.hidden ?? [])) };
}

beforeAll(() => {
  registerSoftIds(trimSoftIds(RAW));
  for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftTiers(l, SOFT[l].tiers, SOFT[l].roles);
});
afterAll(() => {
  resetSoftIds();
  resetSoftTiers();
});

describe("roles on the real content (plan decision 6)", () => {
  it("every muscle and part has roles, and nothing else", () => {
    const muscles = RAW.filter((e) => e.kind === "muscle" || e.kind === "muscle_part").map((e) => e.id);
    expect(Object.keys(ROLES).sort()).toEqual(muscles.sort());
  });

  it("the long head of triceps: its own origin patch on the scapula, the muscle's insertion patch on the ulna", () => {
    expect(ROLES.triceps_brachii_long_head_left).toMatchObject({
      o: { p: [["triceps_brachii_long_head_left__origin", "scapula_left"]], f: [] },
      i: { p: [["triceps_brachii_left__insertion", "ulna_left"]], f: [] },
    });
  });

  it("a muscle collects its parts' patches", () => {
    const r = ROLES.triceps_brachii_left!;
    expect(r.o.p.map(([p]) => p).sort()).toEqual([
      "triceps_brachii_lateral_head_left__origin",
      "triceps_brachii_long_head_left__origin",
      "triceps_brachii_medial_head_left__origin",
    ]);
    expect(r.o.f).toEqual([]);
  });

  it("a structure the content names with no agreeing patch falls back to a whole-structure tint", () => {
    // Biceps: the long head arises from the supraglenoid tubercle and the glenoid labrum; only the scapula has a patch.
    expect(ROLES.biceps_brachii_left!.o.f).toEqual(["glenoid_labrum_left"]);
    expect(ROLES.biceps_brachii_left!.o.p.map(([, on]) => on)).toContain("scapula_left");
  });

  it("every structure named in a role is drawn, by a patch or by the fallback", () => {
    const m = muscleModel(FM);
    for (const [id, r] of Object.entries(ROLES)) {
      for (const [role, set] of [["origin", r.o], ["insertion", r.i]] as const) {
        const drawn = new Set([...set.p.map(([, on]) => on), ...set.f]);
        for (const s of m.effective(id, role)) {
          const parts = m.partsOf(s);
          expect(drawn.has(s) || (parts.length > 0 && parts.every((x) => drawn.has(x))), `${id} ${role} ${s}`).toBe(true);
        }
      }
    }
  });

  it("a patch is drawn only for a role the content gives its bone, and only for a structure it serves", () => {
    const m = muscleModel(FM);
    for (const [id, r] of Object.entries(ROLES)) {
      for (const [role, set] of [["origin", r.o], ["insertion", r.i]] as const) {
        for (const [pid, on] of set.p) {
          const p = PATCHES[pid]!;
          expect(p.end).toBe(role);
          expect(p.on).toBe(on);
          expect(m.effective(id, role)).toContain(on);
          expect(p.structures.some((s) => m.servers(id).has(s)), `${id} ${pid}`).toBe(true);
        }
      }
    }
  });

  it("every patch is either drawn for some muscle or part, or reported as never drawn", () => {
    const drawn = new Set(Object.values(ROLES).flatMap((r) => [...r.o.p, ...r.i.p].map(([p]) => p)));
    const never = new Set(patchAgreement(FM, PATCHES).flatMap((d) => (d.kind === "patch-without-content" ? [d.patch] : [])));
    for (const p of never) expect(drawn.has(p), p).toBe(false);
    expect(drawn.size + never.size).toBe(Object.keys(PATCHES).length);
  });

  it("left and right draw the mirror image (the content mirrors, even where the source's patches don't)", () => {
    const flip = (x: string) => x.replace(/_left$/, "_right");
    const drawn = (r: MuscleRoles, role: "o" | "i") => [...new Set([...r[role].p.map(([, on]) => on), ...r[role].f])].sort();
    for (const [id, r] of Object.entries(ROLES)) {
      if (!id.endsWith("_left")) continue;
      const other = ROLES[flip(id)]!;
      for (const role of ["o", "i"] as const) expect(drawn(other, role), `${id} ${role}`).toEqual(drawn(r, role).map(flip).sort());
      // (Antagonists aren't compared: trunk rotation has a direction, so they don't simply mirror; see derive.ts and QUESTIONS 78.)
    }
  });

  it("antagonists are expanded to parts and never include a synergist (plan decision 7)", () => {
    const r = ROLES.triceps_brachii_left!;
    expect(r.ant).toEqual(expect.arrayContaining(["biceps_brachii_long_head_left", "biceps_brachii_short_head_left", "brachialis_left"]));
    expect(r.ant).not.toContain("biceps_brachii_left");
    for (const [id, rr] of Object.entries(ROLES)) {
      const syn = new Set(DERIVED.synergists[id] ?? []);
      for (const a of rr.ant) expect(syn.has(a) || syn.has(FM[a]?.kind === "muscle_part" ? (FM[a] as { parent: string }).parent : ""), `${id} ${a}`).toBe(false);
    }
    // The overlaps are reported (QUESTIONS 134).
    expect(bothSynergistAndAntagonist(DERIVED)).toContainEqual(["biceps_brachii_left", "pronator_teres_left"]);
  });

  it("buildMuscleRoles with no patches tints every named structure whole", () => {
    const roles = buildMuscleRoles({ fm: FM, patches: {}, synergists: DERIVED.synergists, antagonists: DERIVED.antagonists });
    expect(roles.triceps_brachii_long_head_left).toMatchObject({ o: { p: [], f: ["scapula_left"] }, i: { p: [], f: ["ulna_left"] } });
  });
});

describe("tints in the view (plan decisions 6–8)", () => {
  it("long head of triceps at tier 1 with bones on: patches on the scapula and the ulna, no whole-bone tint", () => {
    const { iso, scene } = view("triceps_brachii_long_head_left", 1, MUSCLES_ON);
    expect([...scene.patches]).toEqual([
      ["triceps_brachii_long_head_left__origin", "origin"],
      ["triceps_brachii_left__insertion", "insertion"],
    ]);
    expect(scene.tints.size).toBe(0);
    expect(iso.solid).toEqual(expect.objectContaining({}));
    expect(iso.solid!.has("scapula_left") && iso.solid!.has("ulna_left")).toBe(true);
  });

  it("patches follow the bone they lie on: none with the bones layer off, none on a hidden bone", () => {
    expect(view("triceps_brachii_long_head_left", 1, modes({ bones: "off", muscles: "on" })).scene.patches.size).toBe(0);
    const hidden = view("triceps_brachii_long_head_left", 1, MUSCLES_ON, { hidden: ["scapula_left"] }).scene;
    expect([...hidden.patches.keys()]).toEqual(["triceps_brachii_left__insertion"]);
  });

  it("without the patch file, the patches' bones are tinted whole", () => {
    const { scene } = view("triceps_brachii_long_head_left", 1, MUSCLES_ON, { failed: true });
    expect(scene.patches.size).toBe(0);
    expect([...scene.tints]).toEqual([
      ["scapula_left", "origin"],
      ["ulna_left", "insertion"],
    ]);
  });

  it("the fallback tint applies only to what is drawn (decision 3's layer filter)", () => {
    expect(view("biceps_brachii_left", 1, modes({ muscles: "on", cartilage: "on" })).scene.tints.get("glenoid_labrum_left")).toBe("origin");
    expect(view("biceps_brachii_left", 1, MUSCLES_ON).scene.tints.has("glenoid_labrum_left")).toBe(false);
  });

  it("nothing at tier 0, nothing for a bone, and the focus is never tinted", () => {
    expect(view("triceps_brachii_long_head_left", 0, MUSCLES_ON).scene.patches.size).toBe(0);
    const bone = view("scapula_left", 1, MUSCLES_ON).scene;
    expect(bone.tints.size + bone.patches.size).toBe(0);
    for (const id of Object.keys(ROLES).filter((x) => x.endsWith("_left")).slice(0, 80)) {
      const { scene } = view(id, 1, modes({ muscles: "on", ligaments: "on", cartilage: "on" }));
      for (const f of scene.focusIds) expect(scene.tints.has(f), `${id} ${f}`).toBe(false);
    }
  });

  it("a structure both origin and insertion with no patch: origin tint, listed for the outline", () => {
    const { scene } = view("external_intercostal_left", 1, MUSCLES_ON);
    expect(scene.both.length).toBeGreaterThan(0);
    for (const x of scene.both) expect(scene.tints.get(x)).toBe("origin");
  });

  it("antagonists: only at tier 2, only when asked, only from a layer that is showing", () => {
    const id = "triceps_brachii_left";
    expect(view(id, 2, MUSCLES_ON).scene.tints.get("brachialis_left")).toBeUndefined();
    expect(view(id, 1, MUSCLES_ON, { ant: true }).scene.tints.get("brachialis_left")).toBeUndefined();
    const on = view(id, 2, MUSCLES_ON, { ant: true });
    expect(on.scene.tints.get("brachialis_left")).toBe("antagonist");
    expect(on.iso.solid!.has("brachialis_left")).toBe(true);
    // A synergist (shown in the functional group) is never in the antagonist tint.
    for (const [x, role] of on.scene.tints) if (role === "antagonist") expect(DERIVED.synergists[id]).not.toContain(x);
    // Muscles Off (the focus is still drawn): no antagonists.
    expect(view(id, 2, modes({ muscles: "off" }), { ant: true }).scene.tints.get("brachialis_left")).toBeUndefined();
  });
});
