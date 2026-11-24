// M10 session AM: announcement wording (plan decision 4), one test per row of
// the final table, on the real soft-tissue table and content; then the
// composer that folds one action's changes into one message (risk 3).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { compileAllSoftFromDisk } from "../scripts/lib/content-files";
import {
  ALL_SHOWN_ANNOUNCEMENT,
  antagonistAnnouncement,
  antagonistCount,
  attachedAnnouncement,
  composeAnnouncement,
  countByKind,
  countsPhrase,
  depthAnnouncement,
  groupIsolationAnnouncement,
  hiddenAnnouncement,
  isolationAnnouncement,
  layerLoadAnnouncement,
  layerModeAnnouncement,
  layersAnnouncement,
  type AnnounceDeps,
  type AnnounceState,
} from "../src/content/announce";
import { groupOf } from "../src/content/groups";
import { registerSoftIds, resetSoftIds, softEntry } from "../src/content/softRegistry";
import { registerSoftTiers, resetSoftTiers } from "../src/content/softRelations";
import { trimSoftIds, type RawSoftId } from "../src/layers/softIds";
import { isolationView } from "../src/scene/isolation";
import { DEFAULT_LAYERS, type LayerModes, type TissueLayer } from "../src/state/url";

const RAW = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as RawSoftId[];
const BONE_MESH = new Set((ids as { id: string; meshAvailable: boolean }[]).filter((e) => e.meshAvailable).map((e) => e.id));
const hasMesh = (id: string) => BONE_MESH.has(id) || softEntry(id)?.mesh === true;
const SOFT = compileAllSoftFromDisk();
const modes = (m: Partial<LayerModes>): LayerModes => ({ ...DEFAULT_LAYERS, ...m });
const ALL_ON = modes({ muscles: "on", ligaments: "on", cartilage: "on" });
const MUSCLES_ON = modes({ muscles: "on" });
const iso = (sel: string | null, tier: 0 | 1 | 2 = 0, grp: string | null = null) => ({ sel, tier, grp });
const say = (now: ReturnType<typeof iso>, prev: ReturnType<typeof iso> | null, m: LayerModes = ALL_ON) => isolationAnnouncement(now, prev, m, hasMesh);

beforeAll(() => {
  registerSoftIds(trimSoftIds(RAW));
  for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftTiers(l, SOFT[l].tiers, SOFT[l].roles, SOFT[l].derived?.attached);
});
afterAll(() => {
  resetSoftTiers();
  resetSoftIds();
});

describe("counts by kind", () => {
  it("phrases: one, two, several kinds, singular and irregular plurals", () => {
    expect(countsPhrase({})).toBe("");
    expect(countsPhrase({ bone: 1 })).toBe("1 bone");
    expect(countsPhrase({ muscle_part: 3, bone: 2 })).toBe("2 bones and 3 parts");
    expect(countsPhrase({ ligament: 5, meniscus: 2, bone: 2 })).toBe("2 bones, 5 ligaments and 2 menisci");
    expect(countsPhrase({ meniscus: 1, disc: 1, cartilage: 2 })).toBe("2 cartilages, 1 disc and 1 meniscus");
  });
  it("a part counts as a part only for its own muscle; any other part counts once, as its muscle", () => {
    const parts = softEntry("triceps_brachii_left")!.parts!;
    expect(countByKind(parts, "triceps_brachii_left")).toEqual({ muscle_part: 3 });
    expect(countByKind(parts)).toEqual({ muscle: 1 });
    expect(countByKind([...parts, "femur_left", "anterior_cruciate_ligament_left"])).toEqual({ muscle: 1, bone: 1, ligament: 1 });
  });
});

describe("layers (decision 4, row 1–2)", () => {
  it("one layer: on, ghosted, off; loading while its files come", () => {
    expect(layerModeAnnouncement("muscles", "on")).toBe("Muscles on.");
    expect(layerModeAnnouncement("muscles", "ghost")).toBe("Muscles ghosted.");
    expect(layerModeAnnouncement("muscles", "off", true)).toBe("Muscles off.");
    expect(layerModeAnnouncement("ligaments", "on", true)).toBe("Ligaments on, loading.");
    expect(layersAnnouncement(DEFAULT_LAYERS, MUSCLES_ON, ["muscles"])).toBe("Muscles on, loading.");
    expect(layersAnnouncement(DEFAULT_LAYERS, DEFAULT_LAYERS)).toBeNull();
  });
  it("loaded, failed and Retry", () => {
    expect(layerLoadAnnouncement("muscles", "loaded")).toBe("Muscles loaded.");
    expect(layerLoadAnnouncement("cartilage", "failed")).toBe("Cartilage failed to load. Retry available.");
    expect(layerLoadAnnouncement("cartilage", "retry")).toBe("Cartilage loading again.");
  });
  it("presets, and several changes that are no preset", () => {
    expect(layersAnnouncement(DEFAULT_LAYERS, ALL_ON)).toBe("Full musculoskeletal: all layers on.");
    expect(layersAnnouncement(DEFAULT_LAYERS, ALL_ON, ["muscles", "ligaments", "cartilage"])).toBe(
      "Full musculoskeletal: all layers on. Loading cartilage, ligaments and muscles.",
    );
    expect(layersAnnouncement(ALL_ON, DEFAULT_LAYERS)).toBe("Skeleton: bones only.");
    expect(layersAnnouncement(DEFAULT_LAYERS, modes({ bones: "ghost", muscles: "on" }))).toBe("Bones ghosted. Muscles on.");
    // One layer changed into a preset's state is that layer's message, not the preset's.
    expect(layersAnnouncement(MUSCLES_ON, DEFAULT_LAYERS)).toBe("Muscles off.");
  });
});

describe("depth, Hide, antagonists (rows 3, 4, 8)", () => {
  it("depth stops", () => {
    expect(depthAnnouncement(1, 41)).toBe("Superficial muscles hidden: 41 muscles.");
    expect(depthAnnouncement(0, 0)).toBe("All muscles shown.");
  });
  it("Hide and Show all", () => {
    expect(hiddenAnnouncement("biceps_brachii_left", 3)).toBe("Biceps brachii, left, hidden. 3 hidden.");
    expect(hiddenAnnouncement("femur_left", 1)).toBe("Femur, left, hidden. 1 hidden.");
    expect(hiddenAnnouncement("sternum", 2)).toBe("Sternum, hidden. 2 hidden.");
    expect(ALL_SHOWN_ANNOUNCEMENT).toBe("All hidden structures shown.");
  });
  it("antagonists: the count is the muscles the toggle adds (parts as their muscle)", () => {
    expect(antagonistAnnouncement(true, 4)).toBe("Antagonists shown: 4 muscles.");
    expect(antagonistAnnouncement(true, 1)).toBe("Antagonists shown: 1 muscle.");
    expect(antagonistAnnouncement(true, 0)).toBe("Antagonists shown: none in the layers showing.");
    expect(antagonistAnnouncement(false, 4)).toBe("Antagonists hidden.");
    const n = antagonistCount("triceps_brachii_left", 2, MUSCLES_ON, hasMesh);
    expect(n).toBeGreaterThan(0);
    const ant = SOFT.muscles.roles!.triceps_brachii_left!.ant;
    expect(n).toBeLessThanOrEqual(new Set(ant.map((x) => softEntry(x)?.parent ?? x)).size);
    expect(antagonistCount("triceps_brachii_left", 1, MUSCLES_ON, hasMesh)).toBe(0);
  });
});

describe("selections and tiers (rows 5–11)", () => {
  it("a muscle, then its part, then Back to the muscle; back from a higher tier", () => {
    expect(say(iso("triceps_brachii_left"), null)).toBe("Triceps brachii, left, selected. Isolated.");
    expect(say(iso("triceps_brachii_long_head_left"), iso("triceps_brachii_left"))).toBe(
      "Long head of triceps brachii, left, selected. Part of triceps brachii.",
    );
    expect(say(iso("triceps_brachii_left"), iso("triceps_brachii_long_head_left"))).toBe("Triceps brachii, left, selected.");
    expect(say(iso("triceps_brachii_left"), iso("triceps_brachii_left", 1))).toBe("Triceps brachii, left, isolated.");
    expect(say(iso("linea_alba"), null)).toBe("Linea alba, selected. Isolated.");
  });
  it("muscle tier 1: attachments, counted by kind, its own parts as parts", () => {
    const text = say(iso("triceps_brachii_left", 1), iso("triceps_brachii_left"), MUSCLES_ON);
    expect(text).toMatch(/^Triceps brachii, left: attachments shown, \d+ bones? and 3 parts\.$/);
    const solid = isolationView("triceps_brachii_left", 1, "ghost", hasMesh, null, undefined, undefined, MUSCLES_ON).solid!;
    const bones = [...solid].filter((x) => BONE_MESH.has(x)).length;
    expect(text).toContain(`${bones} bone`);
  });
  it("a part's tier 1 counts its siblings as parts", () => {
    expect(say(iso("triceps_brachii_long_head_left", 1), null, MUSCLES_ON)).toMatch(/^Long head of triceps brachii, left: attachments shown, .*2 parts/);
  });
  it("muscle tier 2: functional group, other muscles counted once each", () => {
    const text = say(iso("triceps_brachii_left", 2), iso("triceps_brachii_left", 1), MUSCLES_ON);
    expect(text).toMatch(/^Triceps brachii, left: functional group shown, .*\d+ muscles?.*\.$/);
    expect(text).not.toMatch(/structures/);
  });
  it("ligament and cartilage tiers: related structures, joint", () => {
    expect(say(iso("anterior_cruciate_ligament_left", 1), null)).toMatch(/^Anterior cruciate ligament, left: related structures shown, \d+ bones?\.$/);
    expect(say(iso("anterior_cruciate_ligament_left", 2), null)).toMatch(/^Anterior cruciate ligament, left: joint shown, .*ligaments.*menisc/);
    // Only the layers showing count (M9 decision 3): with ligaments only, no menisci.
    expect(say(iso("anterior_cruciate_ligament_left", 2), null, modes({ ligaments: "on" }))).not.toMatch(/menisc/);
  });
  it("a bone's tier with soft layers on: M5's wording plus the soft structures", () => {
    expect(say(iso("femur_left", 1), null, DEFAULT_LAYERS)).toBe("Femur, left: related bones shown. Hip bone, patella, tibia.");
    expect(say(iso("femur_left", 2), null, DEFAULT_LAYERS)).toBe("Femur, left: region shown, 8 bones.");
    expect(say(iso("femur_left", 1), null, MUSCLES_ON)).toMatch(/^Femur, left: related bones shown\. Hip bone, patella, tibia\. Also \d+ muscles\.$/);
    expect(say(iso("femur_left", 2), null, MUSCLES_ON)).toMatch(/^Femur, left: region shown, 8 bones and \d+ muscles\.$/);
  });
  it("Show attached muscles", () => {
    expect(attachedAnnouncement("femur_left", ["femur_left"], true)).toBe("Femur, left: attached muscles loading.");
    expect(attachedAnnouncement("femur_left", ["femur_left", "gluteus_maximus_left", "biceps_femoris_long_head_left"], false)).toBe(
      "Femur, left: attached muscles shown, 1 muscle and 1 part.",
    );
    expect(attachedAnnouncement("femur_left", ["femur_left"], false, true)).toBe("Back to Femur, left: no muscles attach here.");
    const g = groupOf("attached:femur_left")!;
    expect(groupIsolationAnnouncement("attached:femur_left")).toMatch(/^Femur, left: attached muscles shown, \d+ muscles/);
    expect(say(iso(null, 0, "attached:femur_left"), iso("femur_left"))).toBe(groupIsolationAnnouncement(g.key));
    expect(say(iso(null, 0, "attached:femur_left"), iso("gluteus_maximus_left"))).toMatch(/^Back to Femur, left/);
  });
  it("groups and the full skeleton keep M5's wording", () => {
    expect(say(iso(null, 0, "dentition.type.molars"), null)).toBe("Molars, upper and lower: 8 shown, 8 of 12 have a 3D model.");
    expect(say(iso(null), iso("femur_left"))).toBe("Full skeleton");
  });
});

describe("one message per action (risk 3)", () => {
  const base: AnnounceState = { sel: null, tier: 0, grp: null, antagonists: false, layers: DEFAULT_LAYERS, depth: 0, load: {} };
  const deps: AnnounceDeps = {
    isolation: (now, prev) => say(now, prev, MUSCLES_ON),
    antagonists: () => 4,
    peeled: () => 41,
  };
  const compose = (before: AnnounceState, now: AnnounceState, said: string | null = null, awaiting = new Set<TissueLayer>()) =>
    composeAnnouncement(before, now, said, deps, awaiting);

  it("nothing changed: nothing said", () => {
    expect(compose(base, { ...base })).toBeNull();
  });
  it("a selection that turns its layer on: the selection, then the layer folded in", () => {
    const now = { ...base, sel: "biceps_brachii_left", layers: MUSCLES_ON };
    expect(compose(base, now)).toBe("Biceps brachii, left, selected. Isolated. Muscles on, loading.");
    const loaded = { ...base, layers: MUSCLES_ON, load: { muscles: { shown: true, status: "ready" as const, attempt: 0 } } };
    expect(compose(base, { ...now, load: loaded.load })).toBe("Biceps brachii, left, selected. Isolated. Muscles on.");
  });
  it("loaded is said once the low LOD shows, only after a change the user made", () => {
    const awaiting = new Set<TissueLayer>();
    const on = { ...base, layers: MUSCLES_ON, load: { muscles: { shown: false, status: "loading" as const, attempt: 0 } } };
    expect(compose(base, on, null, awaiting)).toBe("Muscles on, loading.");
    const shown = { ...on, load: { muscles: { shown: true, status: "ready" as const, attempt: 0 } } };
    expect(compose(on, shown, null, awaiting)).toBe("Muscles loaded.");
    // Page load (the layer on from the URL, nothing awaited): silent.
    expect(compose(on, shown, null, new Set())).toBeNull();
  });
  it("a failed load, then Retry, then loaded", () => {
    const awaiting = new Set<TissueLayer>(["muscles"]);
    const on = { ...base, layers: MUSCLES_ON, load: { muscles: { shown: false, status: "loading" as const, attempt: 0 } } };
    const failed = { ...on, load: { muscles: { shown: false, status: "error" as const, attempt: 0 } } };
    expect(compose(on, failed, null, awaiting)).toBe("Muscles failed to load. Retry available.");
    const retry = { ...on, load: { muscles: { shown: false, status: "loading" as const, attempt: 1 } } };
    expect(compose(failed, retry, null, awaiting)).toBe("Muscles loading again.");
    const shown = { ...on, load: { muscles: { shown: true, status: "ready" as const, attempt: 1 } } };
    expect(compose(retry, shown, null, awaiting)).toBe("Muscles loaded.");
  });
  it("hushed (a soft link applied as the page opens): nothing said, nothing awaited", () => {
    const awaiting = new Set<TissueLayer>();
    const now = { ...base, sel: "biceps_brachii_left", layers: MUSCLES_ON };
    expect(composeAnnouncement(base, now, null, deps, awaiting, true)).toBeNull();
    expect(awaiting.size).toBe(0);
  });
  it("an explicit message (Hide) wins over the isolation change it causes", () => {
    const before = { ...base, sel: "femur_left" };
    expect(compose(before, base, "Femur, left, hidden. 1 hidden.")).toBe("Femur, left, hidden. 1 hidden.");
  });
  it("antagonists on and off; cleared by a change of tier, not announced separately", () => {
    const t2 = { ...base, sel: "triceps_brachii_left", tier: 2 as const, layers: MUSCLES_ON };
    expect(compose(t2, { ...t2, antagonists: true })).toBe("Antagonists shown: 4 muscles.");
    expect(compose({ ...t2, antagonists: true }, t2)).toBe("Antagonists hidden.");
    expect(compose({ ...t2, antagonists: true }, { ...t2, tier: 1 })).toMatch(/^Triceps brachii, left: attachments shown/);
  });
  it("a depth stop; a preset that resets the depth says the preset only", () => {
    const on = { ...base, layers: MUSCLES_ON, load: { muscles: { shown: true, status: "ready" as const, attempt: 0 } } };
    expect(compose(on, { ...on, depth: 1 })).toBe("Superficial muscles hidden: 41 muscles.");
    expect(compose({ ...on, depth: 1 }, { ...on, depth: 0 })).toBe("All muscles shown.");
    const full = { ...on, depth: 0 as const, layers: ALL_ON, load: { ...on.load, ligaments: { shown: true, status: "ready" as const, attempt: 0 }, cartilage: { shown: true, status: "ready" as const, attempt: 0 } } };
    expect(compose({ ...on, depth: 1 }, full)).toBe("Full musculoskeletal: all layers on.");
  });
  it("Show attached muscles turns the muscles on: the group, then the layer", () => {
    const now = { ...base, grp: "attached:femur_left", layers: MUSCLES_ON };
    expect(compose({ ...base, sel: "femur_left" }, now)).toMatch(/^Femur, left: attached muscles shown, .*\. Muscles on, loading\.$/);
  });
});
