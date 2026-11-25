import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { readEagerContentEdges } from "../scripts/lib/content-files";
import { compileContent } from "../src/content/compile";
import { appGraph, registerContentEdges } from "../src/content/appGraph";
import type { CompiledContent, CompiledEntry } from "../src/content/compile";
import { oppositeOf } from "../src/content/placeholder";
import { panelModel as generic, structureLabel, type SectionModel } from "../src/panel/model";
import { typeLabel } from "../src/systems/musculoskeletal/bones/panel";
import { EAGER_LAYER } from "../src/systems/registry";

const dir = join(__dirname, "../content/bones");
const files = new Map(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => [f.slice(0, -3), readFileSync(join(dir, f), "utf8")]));
const content = compileContent(files);
// The bones' content chunk ships the attachment edges into them (M12 BD), as the loader registers them.
registerContentEdges("bones-content", readEagerContentEdges());

// M12 BE: the M4 panel shape (src/content/panel.ts, deleted) read off the generic model, so these expectations stay as written.
type Link = { id: string; label: string };
function panelModel(id: string, c: CompiledContent | Record<string, never> | null) {
  const m = generic(id, { content: (layer) => (layer === EAGER_LAYER ? c : null), opposite: oppositeOf });
  if (!m) return null;
  const by = new Map(m.sections.map((x) => [x.testId, x]));
  const text = (k: string) => (by.get(k) as Extract<SectionModel, { render: "text" }>).value;
  const list = (k: string) => by.get(k) as Extract<SectionModel, { render: "list" }>;
  const links = by.get("articulations") as Extract<SectionModel, { render: "links" }>;
  const groups = (by.get("muscles") as Extract<SectionModel, { render: "grouped-links" }>).groups;
  const plain = (l: Link): Link => ({ id: l.id, label: l.label });
  return {
    written: m.written,
    latin: m.subtitle.latin ? m.subtitle.text : null,
    common: m.common,
    badges: { region: m.badges[0], type: m.badges[1], draft: m.draft },
    note: m.note ?? null,
    summary: text("summary"),
    functions: list("functions").items,
    landmarks: list("landmarks").items,
    articulations: links.links!.map((l) => ({ id: l.id, label: l.label, joint: l.node, name: l.detail })),
    neighbours: (links.also?.links ?? []).map(plain),
    origins: groups ? groups[0]!.links.map(plain) : null,
    insertions: groups ? groups[1]!.links.map(plain) : null,
    clinical: text("clinical"),
  };
}
/** A bone's landmark name by ID, as the model's default `landmarkName` reads it. */
function landmarkName(c: CompiledEntry, landmark: string): string | undefined {
  const i = c.landmarkIds.indexOf(landmark);
  return i < 0 ? undefined : c.landmarks[i];
}
const linkLabel = (id: string, focus: string) => structureLabel(id, (ids as { id: string; side: "left" | "right" | "midline" }[]).find((e) => e.id === focus)!.side);

const fixture = (over: Record<string, string> = {}) => `---
id: ${over.id ?? "sternum"}
name: Sternum
latin: Sternum
commonName: ${over.commonName ?? "Breastbone"}
side: midline
kind: bone
region: [axial, thorax]
type: flat
toothType: null
ta2: null
functions: [Protects the heart]
landmarks:
  - { id: manubrium, name: Manubrium, position: null }
clinicalNote: null
reviewed: false
---
The **sternum** is a flat bone.
`;

describe("content compiler", () => {
  it("compiles a file: fields, landmark names, the summary as HTML", () => {
    const c = compileContent(new Map([["sternum", fixture()]])).sternum!;
    expect(c).toMatchObject({ latin: "Sternum", common: "Breastbone", type: "flat", functions: ["Protects the heart"], landmarks: ["Manubrium"], landmarkPositions: 0, clinical: null, reviewed: false });
    expect(c.landmarkIds).toEqual(["manubrium"]);
    expect(landmarkName(c, "manubrium")).toBe("Manubrium");
    expect(landmarkName(c, "nothing")).toBeUndefined();
    expect(c.summary).toBe("<p>The <strong>sternum</strong> is a flat bone.</p>");
  });

  it("throws on a file that fails the schema or is misnamed", () => {
    expect(() => compileContent(new Map([["sternum", fixture({ commonName: "[1, 2]" })]]))).toThrow(/sternum\.md/);
    expect(() => compileContent(new Map([["coccyx", fixture()]]))).toThrow(/id is sternum/);
    expect(() => compileContent(new Map([["sternum", "no front matter"]]))).toThrow();
  });

  it("compiles every committed file, all unreviewed, none with a landmark position (plan decision 9)", () => {
    expect(Object.keys(content).length).toBe(files.size);
    for (const [id, c] of Object.entries(content)) {
      expect(c.reviewed, id).toBe(false);
      expect(c.landmarkPositions, id).toBe(0);
      expect(c.summary.startsWith("<p>"), id).toBe(true);
    }
  });

  it("covers every object in ids.json, all 238 (sessions K and L)", () => {
    const all = ids as { id: string }[];
    expect(all.length).toBe(238);
    for (const e of all) expect(content[e.id], e.id).toBeDefined();
  });
});

// M12 BD: the rows are the graph's inverse `originates_on` / `inserts_on` edges (not a part's inherited ones),
// sorted by name then side, which the compiled content carried as `attached` before (`boneAttachedRows`).
describe("the bones' derived Origins and Insertions (M8 session AD, M9 session AH)", () => {
  it("lists each muscle or part by name in its role, left before right", () => {
    const m = panelModel("sternum", content)!;
    const names = m.origins!.map((l) => l.label);
    expect(names).toEqual([...names].sort((a, b) => a.replace(/ \((left|right)\)$/, "").localeCompare(b.replace(/ \((left|right)\)$/, "")) || 0));
    const left = m.origins!.findIndex((l) => l.id === "pectoralis_major_sternocostal_head_left");
    expect(m.origins![left + 1]!.id).toBe("pectoralis_major_sternocostal_head_right");
  });

  it("derives the real lists from the muscle files; a part that declares its own attachment is listed by the part", () => {
    const femur = panelModel("femur_left", content)!;
    expect(femur.insertions!.map((r) => r.id)).toContain("gluteus_maximus_left");
    expect(femur.origins!.map((r) => r.id)).toEqual(expect.arrayContaining(["vastus_lateralis_left", "biceps_femoris_short_head_left"]));
    expect(femur.origins!.every((r) => r.id.endsWith("_left"))).toBe(true);
    expect(panelModel("femur_right", content)!.origins!.map((r) => r.id)).toEqual(femur.origins!.map((r) => r.id.replace(/_left$/, "_right")));
    expect(panelModel("tooth_11", content)!.origins).toEqual([]);
    const withMuscles = (ids as { id: string }[]).filter((e) => {
      const m = panelModel(e.id, content)!;
      return m.origins!.length + m.insertions!.length > 0;
    });
    expect(withMuscles.length).toBeGreaterThan(150);
  });

  // M12 BE: `attachedLabel` (a pure function over made-up rows) is gone; the one label rule is `structureLabel`.
  it("labels: the side only when it differs from the bone's", () => {
    expect(structureLabel("gluteus_maximus_left", "left")).toBe("Gluteus maximus");
    expect(structureLabel("gluteus_maximus_left", "midline")).toBe("Gluteus maximus (left)");
    expect(structureLabel("diaphragm", "left")).toBe("Diaphragm");
  });
});

describe("panel model", () => {
  it("uses the compiled content: Latin, common name, badges, sections", () => {
    const m = panelModel("sternum", content)!;
    expect(m.written).toBe(true);
    expect(m.latin).toBe("Sternum");
    expect(m.common).toBe("Breastbone");
    expect(m.badges).toEqual({ region: "Thorax", type: "Flat bone", draft: true });
    expect(m.summary).toMatch(/^<p>The sternum/);
    expect(m.functions!.length).toBeGreaterThan(0);
    expect(m.landmarks).toContain("Sternal angle");
    const origins = m.origins!.map((l) => l.label);
    expect(origins).toContain("Sternocostal head of pectoralis major (left)");
    expect(origins).toContain("Sternocostal head of pectoralis major (right)");
    expect(m.origins!.find((l) => l.label === "Sternocostal head of pectoralis major (left)")!.id).toBe("pectoralis_major_sternocostal_head_left");
    expect(m.clinical).toMatch(/sternotomy/);
  });

  it("falls back to the placeholder for an object not written yet, but still lists its articulations", () => {
    const m = panelModel("femur_left", {})!;
    expect(m.written).toBe(false);
    expect(m.latin).toBeNull();
    expect(m.summary).toBeNull();
    expect(m.badges.type).toBe("Bone");
    expect(m.articulations.map((a) => a.id).sort()).toEqual(["hip_bone_left", "patella_left", "tibia_left"]);
    expect(m.articulations.find((a) => a.id === "hip_bone_left")!.name).toBe("Hip joint");
    expect(panelModel("femur_left", null)!.written).toBe(false);
  });

  it("lists every articulation from either side of the pair, labelled with the partner's side only when it differs", () => {
    const m = panelModel("sternum", content)!;
    expect(m.articulations.length).toBe(appGraph().out("sternum", "articulates_with").length);
    expect(m.articulations.map((a) => a.label)).toContain("Rib 1 (left)");
    expect(m.articulations.map((a) => a.label)).toContain("Clavicle (right)");
    expect(panelModel("rib_1_left", content)!.articulations.map((a) => a.label)).toEqual(expect.arrayContaining(["T1 vertebra", "Sternum"]));
    expect(linkLabel("rib_2_left", "rib_1_left")).toBe("Rib 2");
    expect(linkLabel("rib_1_right", "rib_1_left")).toBe("Rib 1 (right)");
  });

  it("teeth: the tooth-type badge, the alveolar bone as the articulation, neighbours listed apart", () => {
    const m = panelModel("tooth_11", content)!;
    expect(m.badges.type).toBe("Tooth type: incisor");
    expect(m.articulations.map((a) => a.id)).toEqual(["maxilla_right"]);
    expect(m.neighbours.map((n) => n.id)).toEqual(["tooth_21", "tooth_12"]);
    expect(m.origins).toEqual([]);
    expect(m.insertions).toEqual([]);
    const wisdom = panelModel("tooth_38", content)!;
    expect(wisdom.note).not.toBeNull();
    expect(wisdom.articulations.map((a) => a.id)).toEqual(["mandible"]);
    expect(wisdom.neighbours.map((n) => n.id)).toEqual(["tooth_37"]);
  });

  it("the hyoid has no articulations", () => {
    expect(panelModel("hyoid_bone", content)!.articulations).toEqual([]);
  });

  it("type labels", () => {
    expect(typeLabel(content.vertebra_c1!)).toBe("Irregular bone");
    expect(typeLabel(content.tooth_26!)).toBe("Tooth type: molar");
  });

  it("returns null for an unknown ID", () => {
    expect(panelModel("nope", content)).toBeNull();
  });
});
