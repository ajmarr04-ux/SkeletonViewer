// M9 session AH: the info panel's kind-specific sections (spec §7; plan
// decision 9) and "Show attached muscles" (spec §5.4; plan decision 10), on the
// real content.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { compileAllSoftFromDisk } from "../scripts/lib/content-files";
import { attachedBoneOf, attachedTo, attachedKey, groupAncestors, groupOf, isGroupKey, ancestorsOf } from "../src/content/groups";
import { groupIsolationAnnouncement } from "../src/content/announce";
import { softEntry } from "../src/content/softRegistry";
import { resetAppGraph } from "../src/content/appGraph";
import { registerSoftContent, resetSoftContent } from "../src/content/softContentLoader";
import { isEagerId } from "../src/content/index";
import type { SoftLayerContent } from "../src/content/softCompile";
import { panelModel as generic, structureLabel, type ActionRow, type LayerContent, type SectionModel } from "../src/panel/model";
import type { AttachmentList } from "../src/systems/musculoskeletal/muscles/panel";
import { softOpposite } from "../src/content/softRegistry";
import { groupView, isolationView, withJoint } from "../src/scene/isolation";
import { isolationStep, FULL_SKELETON } from "../src/state/isolation";
import { parseUrlState, serialiseUrlState } from "../src/state/url";

// M12 BE: the M9 section shapes (softPanel.ts's `softSections`, deleted) read off the generic model, so the
// expectations below stay as written: a written structure's sections by test ID; null while unwritten or unloaded.
type Link = { id: string; label: string };
type MuscleSections = {
  kind: "muscle";
  parts: Link[];
  partOf: Link | null;
  origin: AttachmentList;
  insertion: AttachmentList;
  actions: ActionRow[];
  inheritedActions: ActionRow[];
  functions: string[];
  synergists: Link[];
  antagonists: Link[];
  innervation: { text: string; inheritedFrom: Link | null } | null;
  clinical: string | null;
};
type JoinSections = { kind: "ligament" | "cartilage"; joint: string | null; links: Link[]; functions: string[]; clinical: string | null };
type LandmarkName = (structure: string, landmark: string) => string | undefined;
function softSections(id: string, content: SoftLayerContent | null, landmarkName: LandmarkName = () => undefined): MuscleSections | JoinSections | null {
  const layer = softEntry(id)?.layer;
  if (isEagerId(id) || !layer) return null;
  const m = generic(id, { content: (l) => (l === layer ? (content as unknown as LayerContent) : null), opposite: softOpposite, landmarkName });
  if (!m || !m.written) return null;
  const by = new Map(m.sections.map((x) => [x.testId, x]));
  const plain = (l: Link): Link => ({ id: l.id, label: l.label });
  const links = (k: string) => ((by.get(k) as Extract<SectionModel, { render: "links" }> | undefined)?.links ?? []).map(plain);
  const text = (k: string) => (by.get(k) as Extract<SectionModel, { render: "text" }> | undefined)?.value ?? null;
  const functions = (by.get("functions") as Extract<SectionModel, { render: "list" }> | undefined)?.items ?? [];
  if (!by.has("origin")) {
    const joins = by.has("connects") ? "connects" : "attached-to";
    return { kind: joins === "connects" ? "ligament" : "cartilage", joint: links("joint")[0]?.label ?? null, links: links(joins), functions, clinical: text("clinical") };
  }
  const actions = by.get("actions") as Extract<SectionModel, { render: "actions-table" }>;
  const innervation = by.get("innervation") as Extract<SectionModel, { render: "text" }>;
  const custom = (k: string) => (by.get(k) as Extract<SectionModel, { render: "custom" }>).data as AttachmentList;
  return {
    kind: "muscle",
    parts: links("parts"),
    partOf: m.partOf ? { id: m.partOf.id, label: structureLabel(m.partOf.id, m.side) } : null,
    origin: custom("origin"),
    insertion: custom("insertion"),
    actions: actions.rows,
    inheritedActions: actions.inherited,
    functions: actions.fallback,
    synergists: links("synergists"),
    antagonists: links("antagonists"),
    innervation: innervation.value === null ? null : { text: innervation.value, inheritedFrom: innervation.inherited ? plain(innervation.inherited) : null },
    clinical: text("clinical"),
  };
}

const BONES = ids as { id: string; meshAvailable: boolean }[];
const BONE_MESH = new Set(BONES.filter((e) => e.meshAvailable).map((e) => e.id));
const hasMesh = (id: string) => BONE_MESH.has(id) || softEntry(id)?.mesh === true;
const SOFT = compileAllSoftFromDisk();
const muscle = (id: string) => softSections(id, SOFT.muscles) as MuscleSections;
const ids_ = (l: { id: string }[]) => l.map((x) => x.id);
/** M12 BD: the sections read the graph, so the section tests register the chunks as the loader does (and forget them after). */
function withChunks() {
  beforeAll(() => {
    for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftContent(l, SOFT[l]);
  });
  afterAll(() => {
    resetSoftContent();
    resetAppGraph();
  });
}

afterAll(() => {
  resetSoftContent();
    resetAppGraph();
});

describe("muscle and part sections", () => {
  withChunks();
  it("a muscle with parts: Parts, each part's origin named by the part, its insertion with the landmark, actions, innervation, clinical note", () => {
    const s = muscle("triceps_brachii_left");
    expect(s.kind).toBe("muscle");
    expect(ids_(s.parts)).toEqual(["triceps_brachii_long_head_left", "triceps_brachii_lateral_head_left", "triceps_brachii_medial_head_left"]);
    expect(s.partOf).toBeNull();
    const long = s.origin.rows.find((r) => r.part === "Long head")!;
    expect(long.link).toEqual({ id: "scapula_left", label: "Scapula" });
    expect(long.landmark).toBe("Infraglenoid tubercle");
    expect(s.origin.rows.filter((r) => r.link?.id === "humerus_left").length).toBeGreaterThan(0);
    expect(s.insertion).toEqual({ rows: [{ link: { id: "ulna_left", label: "Ulna" }, landmark: "Olecranon", text: null, part: null }], inheritedFrom: null });
    expect(s.actions).toEqual([{ joint: "Elbow joint", movement: "extension", role: "prime mover" }]);
    expect(s.inheritedActions).toEqual([]);
    expect(s.innervation).toEqual({ text: "Radial nerve (C6–C8)", inheritedFrom: null });
    expect(s.clinical).toMatch(/triceps reflex/);
  });

  it("a part: its own origin, the inherited insertion and innervation say so, its own and the muscle's actions apart", () => {
    const s = muscle("triceps_brachii_long_head_left");
    expect(s.parts).toEqual([]);
    expect(s.partOf).toEqual({ id: "triceps_brachii_left", label: "Triceps brachii" });
    expect(s.origin.inheritedFrom).toBeNull();
    expect(s.origin.rows.map((r) => [r.link?.id, r.landmark])).toEqual([["scapula_left", "Infraglenoid tubercle"]]);
    expect(s.insertion.inheritedFrom).toEqual({ id: "triceps_brachii_left", label: "Triceps brachii" });
    expect(s.insertion.rows.map((r) => r.link?.id)).toEqual(["ulna_left"]);
    expect(s.actions.map((a) => `${a.joint} · ${a.movement} · ${a.role}`)).toEqual([
      "Glenohumeral (shoulder) joint · extension · assists",
      "Glenohumeral (shoulder) joint · adduction · assists",
    ]);
    expect(s.inheritedActions).toEqual([{ joint: "Elbow joint", movement: "extension", role: "prime mover" }]);
    expect(s.innervation).toEqual({ text: "Radial nerve (C6–C8)", inheritedFrom: { id: "triceps_brachii_left", label: "Triceps brachii" } });
  });

  it("a part with its own innervation keeps it", () => {
    expect(muscle("biceps_femoris_long_head_left").innervation).toEqual({ text: "Tibial part of the sciatic nerve (L5–S2)", inheritedFrom: null });
  });

  it("synergists and antagonists are the derived lists, links; an overlap shows only as a synergist", () => {
    const id = "triceps_brachii_left";
    const s = muscle(id);
    expect(ids_(s.synergists)).toEqual(SOFT.muscles.derived!.synergists[id]);
    const syn = new Set(SOFT.muscles.derived!.synergists[id]);
    expect(ids_(s.antagonists)).toEqual(SOFT.muscles.derived!.antagonists[id]!.filter((x) => !syn.has(x)));
    expect(ids_(s.antagonists)).toContain("biceps_brachii_left");
    expect(s.antagonists.find((l) => l.id === "biceps_brachii_left")!.label).toBe("Biceps brachii");
    for (const [m, ants] of Object.entries(SOFT.muscles.derived!.antagonists)) {
      const sec = softSections(m, SOFT.muscles);
      if (sec?.kind !== "muscle") continue;
      for (const a of sec.antagonists) expect(sec.synergists.some((x) => x.id === a.id), `${m} ${a.id}`).toBe(false);
      expect(sec.antagonists.length).toBeLessThanOrEqual(ants.length);
    }
  });

  it("a non-object attachment is its free text; a muscle with no actions shows its written functions", () => {
    const s = muscle("abductor_hallucis_left");
    expect(s.origin.rows.some((r) => r.link === null && r.text === "flexor retinaculum and the plantar aponeurosis")).toBe(true);
    const f = muscle("articularis_genus_left");
    expect(f.actions).toEqual([]);
    expect(f.functions.length).toBeGreaterThan(0);
  });

  it("every muscle and part has sections; every link names a known structure, labelled without its own side", () => {
    for (const id of Object.keys(SOFT.muscles.entries)) {
      const s = muscle(id);
      expect(s, id).not.toBeNull();
      const links = [...s.parts, ...s.synergists, ...s.antagonists, ...s.origin.rows.flatMap((r) => (r.link ? [r.link] : [])), ...s.insertion.rows.flatMap((r) => (r.link ? [r.link] : []))];
      for (const l of links) {
        expect(BONES.some((b) => b.id === l.id) || softEntry(l.id) !== undefined, `${id} → ${l.id}`).toBe(true);
        expect(l.label, `${id} → ${l.id}`).not.toBe(l.id);
      }
      // A muscle with parts lists something for its origin (its own or its parts').
      if (softEntry(id)?.parts?.length) expect(s.origin.rows.length + s.insertion.rows.length, id).toBeGreaterThan(0);
    }
  });

  it("an unwritten or unloaded structure has no sections", () => {
    expect(softSections("triceps_brachii_left", null)).toBeNull();
    expect(softSections("no_such_structure", SOFT.muscles)).toBeNull();
  });

  it("landmark names come from the bone's content when given", () => {
    const s = softSections("triceps_brachii_long_head_left", SOFT.muscles, (b, l) => (b === "scapula_left" && l === "infraglenoid_tubercle" ? "Infraglenoid tubercle of the scapula" : undefined)) as MuscleSections;
    expect(s.origin.rows[0]!.landmark).toBe("Infraglenoid tubercle of the scapula");
  });
});

describe("ligament and cartilage sections", () => {
  withChunks();
  it("a ligament: joint name, Connects links, functions, clinical note", () => {
    const s = softSections("anterior_cruciate_ligament_left", SOFT.ligaments) as JoinSections;
    expect(s).toMatchObject({ kind: "ligament", joint: "Knee joint (tibiofemoral)" });
    expect(s.links).toEqual([
      { id: "femur_left", label: "Femur" },
      { id: "tibia_left", label: "Tibia" },
    ]);
    expect(s.functions.length).toBe(2);
    expect(s.clinical).toMatch(/Lachman/);
  });

  it("a ligament that is not part of a joint", () => {
    expect((softSections("coraco_acromial_ligament_left", SOFT.ligaments) as JoinSections).joint).toBeNull();
  });

  it("a meniscus: joint and Attached to", () => {
    const s = softSections("lateral_meniscus_left", SOFT.cartilage) as JoinSections;
    expect(s).toMatchObject({ kind: "cartilage", joint: "Knee joint (tibiofemoral)", links: [{ id: "tibia_left", label: "Tibia" }] });
  });

  it("every ligament and cartilage file has sections, every joint named", () => {
    for (const layer of ["ligaments", "cartilage"] as const)
      for (const [id, e] of Object.entries(SOFT[layer].entries)) {
        const s = softSections(id, SOFT[layer]) as JoinSections;
        const fm = e.fm as { joint: string | null };
        expect(s.joint === null, id).toBe(fm.joint === null);
        if (fm.joint !== null) expect(SOFT[layer].joints![fm.joint], `${id} joint ${fm.joint}`).toBeDefined();
      }
  });

  it("labels: the side only when it differs (both sides from a midline structure)", () => {
    expect(structureLabel("femur_left", "left")).toBe("Femur");
    expect(structureLabel("femur_left", "midline")).toBe("Femur (left)");
    expect(structureLabel("sternum", "left")).toBe("Sternum");
    expect(structureLabel("triceps_brachii_left", "right")).toBe("Triceps brachii (left)");
  });
});

describe('"Show attached muscles": grp=attached:<bone>', () => {
  it("keys: any bone; not unknown IDs or soft structures", () => {
    expect(attachedKey("femur_left")).toBe("attached:femur_left");
    expect(attachedBoneOf("attached:femur_left")).toBe("femur_left");
    expect(isGroupKey("attached:femur_left")).toBe(true);
    expect(isGroupKey("attached:tooth_11")).toBe(true);
    expect(isGroupKey("attached:no_bone")).toBe(false);
    expect(isGroupKey("attached:triceps_brachii_left")).toBe(false);
    expect(attachedBoneOf("lower_limb")).toBeNull();
  });

  it("before the muscles' content loads: the bone alone, loading", () => {
    resetSoftContent();
    resetAppGraph();
    expect(attachedTo("femur_left")).toBeNull();
    const g = groupOf("attached:femur_left")!;
    expect(g.members).toEqual(["femur_left"]);
    expect(g.attached).toMatchObject({ bone: "femur_left", loading: true });
    expect(g.name).toBe("Muscles attached to Femur (left)");
    expect(g.trail.slice(-2)).toEqual(["Femur", "Attached muscles"]);
    expect(groupIsolationAnnouncement("attached:femur_left")).toBe("Femur, left: attached muscles loading.");
    expect(groupView("attached:femur_left", "ghost", hasMesh).solid).toEqual(new Set(["femur_left"]));
  });

  it("once loaded: the bone plus every muscle and part attached (as derived), drawn as meshes", () => {
    for (const l of ["muscles", "ligaments", "cartilage"] as const) registerSoftContent(l, SOFT[l]);
    const a = SOFT.muscles.derived!.attached.femur_left!;
    const g = groupOf("attached:femur_left")!;
    expect(g.attached).toMatchObject({ bone: "femur_left", loading: false, origins: a.origins, insertions: a.insertions });
    expect(new Set(g.members)).toEqual(new Set(["femur_left", ...a.origins, ...a.insertions]));
    expect(g.members).toContain("gluteus_maximus_left");
    const solid = isolationView(null, 0, "ghost", hasMesh, "attached:femur_left").solid!;
    expect(solid.has("femur_left")).toBe(true);
    // Every drawn member: the bone, a muscle with a mesh, or a part of one listed; nothing else.
    for (const id of solid) {
      const p = softEntry(id)?.parent ?? null;
      expect(id === "femur_left" || g.members.includes(id) || (p !== null && g.members.includes(p)), id).toBe(true);
      expect(hasMesh(id), id).toBe(true);
    }
    // A listed muscle with parts is drawn as its parts.
    const withParts = g.members.find((id) => !hasMesh(id) && (softEntry(id)?.parts?.length ?? 0) > 0);
    if (withParts) for (const p of softEntry(withParts)!.parts!.filter(hasMesh)) expect(solid.has(p), p).toBe(true);
    // Counted by kind (M10 AM): a part listed on its own counts as a part.
    const parts = g.members.filter((id) => softEntry(id)?.kind === "muscle_part").length;
    const muscles = g.members.length - 1 - parts;
    expect(groupIsolationAnnouncement("attached:femur_left")).toBe(
      `Femur, left: attached muscles shown, ${muscles} muscles${parts ? ` and ${parts} part${parts === 1 ? "" : "s"}` : ""}.`,
    );
    expect(groupIsolationAnnouncement("attached:femur_left", true)).toMatch(/^Back to Femur, left: attached muscles shown/);
    expect(groupAncestors("attached:femur_left")).toEqual(ancestorsOf("femur_left"));
  });

  it("a bone with no muscles: the bone alone", () => {
    const g = groupOf("attached:tooth_11")!;
    expect(g.members).toEqual(["tooth_11"]);
    expect(groupIsolationAnnouncement("attached:tooth_11")).toMatch(/^Upper right central incisor: no muscles attach here\.$/);
  });

  it("the reducer treats it as a group: a level, Back to the full skeleton; a member from it is a new entry", () => {
    const r = isolationStep(FULL_SKELETON, { type: "group", key: "attached:femur_left" });
    expect(r).toEqual({ state: { sel: null, tier: 0, grp: "attached:femur_left", reg: null }, history: "push" });
    const from = isolationStep({ sel: "femur_left", tier: 0, grp: null, reg: null }, { type: "group", key: "attached:femur_left" });
    expect(from.history).toBe("push");
    expect(isolationStep(r.state, { type: "back" })).toEqual({ state: FULL_SKELETON, history: "pop" });
    expect(isolationStep(r.state, { type: "select", id: "gluteus_maximus_left" }).history).toBe("push");
  });

  it("URL: round trip, and an unknown bone is dropped", () => {
    const q = serialiseUrlState({ sel: null, tier: 0, grp: "attached:femur_left" }, "");
    expect(q).toBe("?grp=attached:femur_left");
    expect(parseUrlState(q, () => true, isGroupKey).grp).toBe("attached:femur_left");
    expect(parseUrlState("?grp=attached%3Afemur_left", () => true, isGroupKey).grp).toBe("attached:femur_left");
    expect(parseUrlState("?grp=attached:nothing", () => true, isGroupKey).grp).toBeNull();
  });

  it("hovering an attached muscle highlights it with the bone; a muscle with parts as its parts", () => {
    const base = isolationView("femur_left", 0, "ghost", hasMesh);
    const v = withJoint(base, { a: "femur_left", b: "biceps_femoris_left" }, hasMesh);
    expect(v.joint).toEqual(["femur_left", "biceps_femoris_long_head_left", "biceps_femoris_short_head_left"].filter(hasMesh));
    expect(v.jointPartner).toBe("biceps_femoris_long_head_left");
    expect(withJoint(base, { a: "femur_left", b: "gluteus_maximus_left" }, hasMesh).joint).toEqual(["femur_left", "gluteus_maximus_left"]);
  });
});
