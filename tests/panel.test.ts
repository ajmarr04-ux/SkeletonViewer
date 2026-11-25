import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import { readBoneAttached } from "../scripts/lib/content-files";
import { boneAttachedRows, compileContent } from "../src/content/compile";
import { attachedLabel, landmarkName, linkLabel, panelModel, typeLabel } from "../src/content/panel";
import { appGraph } from "../src/content/appGraph";

const dir = join(__dirname, "../content/bones");
const files = new Map(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => [f.slice(0, -3), readFileSync(join(dir, f), "utf8")]));
const content = compileContent(files, readBoneAttached());

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
    const rows = { origins: [{ id: "pectoralis_major_left", name: "Pectoralis major", side: "left" as const }], insertions: [] };
    const c = compileContent(new Map([["sternum", fixture()]]), { sternum: rows }).sternum!;
    expect(c).toMatchObject({ latin: "Sternum", common: "Breastbone", type: "flat", functions: ["Protects the heart"], landmarks: ["Manubrium"], landmarkPositions: 0, attached: rows, clinical: null, reviewed: false });
    expect(c.landmarkIds).toEqual(["manubrium"]);
    expect(landmarkName(c, "manubrium")).toBe("Manubrium");
    expect(landmarkName(c, "nothing")).toBeUndefined();
    expect(compileContent(new Map([["sternum", fixture()]])).sternum!.attached).toEqual({ origins: [], insertions: [] });
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

describe("the bones' derived Origins and Insertions (M8 session AD, M9 session AH)", () => {
  it("lists each muscle or part by name in its role, left before right, both roles in both lists", () => {
    const info: Record<string, { name: string; side: "left" | "right" | "midline" }> = {
      a_left: { name: "Alpha", side: "left" },
      a_right: { name: "Alpha", side: "right" },
      b: { name: "Beta", side: "midline" },
      c_part: { name: "Head of gamma", side: "left" },
    };
    const rows = boneAttachedRows(
      { bone: { origins: ["b", "a_right", "a_left"], insertions: ["c_part", "b"] }, other: { origins: [], insertions: [] } },
      (id) => info[id]!,
    );
    expect(rows.bone!.origins.map((r) => r.id)).toEqual(["a_left", "a_right", "b"]);
    expect(rows.bone!.insertions.map((r) => r.id)).toEqual(["b", "c_part"]);
    expect(rows.other).toEqual({ origins: [], insertions: [] });
  });

  it("derives the real lists from the muscle files; a part that declares its own attachment is listed by the part", () => {
    const femur = content.femur_left!.attached;
    expect(femur.insertions.map((r) => r.id)).toContain("gluteus_maximus_left");
    expect(femur.origins.map((r) => r.id)).toEqual(expect.arrayContaining(["vastus_lateralis_left", "biceps_femoris_short_head_left"]));
    expect(femur.origins.every((r) => r.side === "left")).toBe(true);
    expect(content.femur_right!.attached.origins.map((r) => r.id)).toEqual(femur.origins.map((r) => r.id.replace(/_left$/, "_right")));
    expect(content.tooth_11!.attached).toEqual({ origins: [], insertions: [] });
    expect(Object.values(content).filter((c) => c.attached.origins.length + c.attached.insertions.length > 0).length).toBeGreaterThan(150);
  });

  it("labels: the side only when it differs from the bone's", () => {
    expect(attachedLabel({ id: "x_left", name: "Alpha", side: "left" }, "left")).toBe("Alpha");
    expect(attachedLabel({ id: "x_left", name: "Alpha", side: "left" }, "midline")).toBe("Alpha (left)");
    expect(attachedLabel({ id: "y", name: "Beta", side: "midline" }, "left")).toBe("Beta");
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
