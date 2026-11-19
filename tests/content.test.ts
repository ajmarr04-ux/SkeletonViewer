import { describe, expect, it } from "vitest";
import articulations from "../content/articulations.json";
import hierarchy from "../content/hierarchy.json";
import idsJson from "../content/ids.json";
import regions from "../content/regions.json";
import { mirrorFile, splitFrontMatter, swapSideWords } from "../src/content/frontmatter";
import { oppositeOf } from "../src/content/placeholder";
import { frontMatterSchema, wordCount } from "../src/content/schema";
import { validateContent, type ContentInput, type IdEntry } from "../src/content/validate";

const ids = idsJson as IdEntry[];
const meshIds = ids.filter((e) => e.meshAvailable).map((e) => e.id);
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function file(id: string, over: Record<string, unknown> = {}, body = words(50)): string {
  const e = ids.find((x) => x.id === id)!;
  const tooth = e.kind === "tooth";
  const fm: Record<string, unknown> = {
    id,
    name: e.name,
    latin: "Os testis",
    commonName: null,
    side: e.side,
    kind: e.kind,
    region: e.group,
    type: tooth ? "tooth" : "long",
    toothType: tooth ? "molar" : null,
    ta2: null,
    functions: ["Bears weight on the left side"],
    landmarks: [{ id: "head", name: "Head", position: null }],
    muscleAttachments: [],
    clinicalNote: null,
    reviewed: false,
    ...over,
  };
  return `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")}\n---\n${body}\n`;
}

function input(files: Record<string, string> = {}, over: Partial<ContentInput> = {}): ContentInput {
  return {
    ids,
    files: new Map(Object.entries(files)),
    meshes: { high: meshIds, low: meshIds },
    articulations,
    regions,
    hierarchy,
    opposite: oppositeOf,
    ...over,
  };
}

describe("validateContent on the committed data", () => {
  it("passes with missing content allowed", () => {
    const r = validateContent(input(), { allowMissingContent: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("fails on missing files when they aren't allowed", () => {
    const r = validateContent(input());
    expect(r.errors.some((e) => e.startsWith("238 object(s) without a content file"))).toBe(true);
    expect(r.errors.some((e) => e.includes("mesh femur_left has no content file"))).toBe(true);
  });
});

describe("validation rules (fixtures)", () => {
  const ok = { allowMissingContent: true };

  it("accepts a good file and its mirrored twin", () => {
    const left = file("femur_left");
    const right = mirrorFile(left, "femur_left", oppositeOf);
    expect(validateContent(input({ femur_left: left, femur_right: right }), ok).errors).toEqual([]);
  });

  it("flags a drifted mirror and an orphan right-side file", () => {
    const left = file("femur_left");
    const right = mirrorFile(left, "femur_left", oppositeOf).replace("word3", "changed");
    const errs = validateContent(input({ femur_left: left, femur_right: right, tibia_right: file("tibia_right") }), ok).errors;
    expect(errs.some((e) => e.includes("femur_right.md: differs from the mirror"))).toBe(true);
    expect(errs.some((e) => e.includes("tibia_right.md: right-side file without its left-side file"))).toBe(true);
  });

  it("flags schema problems", () => {
    const errs = validateContent(
      input({
        femur_left: file("femur_left", { toothType: "molar" }),
        tooth_36: file("tooth_36", { toothType: null }),
        sacrum: file("sacrum", { ta2: "A02.1" }),
        patella_left: file("patella_left", { extra: 1 }),
        tibia_left: file("tibia_left", { side: "right" }),
        fibula_left: file("fibula_left", {}, words(30)),
        talus_left: file("talus_left", { id: "talus_right" }),
        not_a_bone: file("femur_left"),
      }),
      ok,
    ).errors;
    const has = (s: string) => expect(errs.some((e) => e.includes(s)), s).toBe(true);
    has("femur_left.md toothType: toothType is null for bones");
    has("tooth_36.md toothType: teeth need a toothType");
    has("sacrum.md ta2");
    has("patella_left.md");
    has("tibia_left.md: side is right");
    has("fibula_left.md: summary is 30 words");
    has("talus_left.md: id is talus_right");
    has("not_a_bone.md: no such ID");
  });

  it("flags articulation problems", () => {
    const bad = [
      ...articulations,
      { a: "femur_left", b: "femur_left", joint: "self", name: "Self" },
      { a: "hip_bone_left", b: "femur_left", joint: "hip_again", name: "Hip again" },
      { a: "femur_left", b: "nope", joint: "hip_joint_left", name: "Dup joint" },
      { a: "femur_left", b: "tibia_left", joint: "s", name: "S", surfaces: { femur_left: "nowhere", fibula_left: "head" } },
    ];
    const errs = validateContent(input({ femur_left: file("femur_left") }, { articulations: bad }), ok).errors;
    const has = (s: string) => expect(errs.some((e) => e.includes(s)), s).toBe(true);
    has("can't articulate with itself");
    has("is stored twice");
    has("unknown ID nope");
    has("joint ID hip_joint_left is used twice");
    has("femur_left has no landmark nowhere");
    has("surfaces names fibula_left, which isn't in this pair");
  });

  it("requires every object in an articulation except the hyoid", () => {
    const fewer = articulations.filter((a) => a.a !== "pisiform_left" && a.b !== "pisiform_left");
    const errs = validateContent(input({}, { articulations: fewer }), ok).errors;
    expect(errs).toEqual(["articulations.json: pisiform_left has no articulation"]);
  });

  it("flags region problems, and warns on a tier-1 repeat", () => {
    const r = { ...(regions as Record<string, string[]>) };
    delete r.sacrum;
    r.femur_left = ["tibia_left", "femur_left", "ghost_bone", "sacrum", "sacrum"];
    const rep = validateContent(input({}, { regions: { ...r, extra_id: [] } }), ok);
    const has = (s: string) => expect(rep.errors.some((e) => e.includes(s)), s).toBe(true);
    has("no entry for sacrum");
    has("femur_left: lists itself");
    has("femur_left: unknown ID ghost_bone");
    has("femur_left: listed twice: sacrum");
    has("unknown ID extra_id");
    expect(rep.warnings).toEqual(["regions.json femur_left: tibia_left is already in tier 1"]);
  });

  it("flags hierarchy problems", () => {
    const h = JSON.parse(JSON.stringify(hierarchy)) as { key: string; children: unknown[] }[];
    h[0]!.children.push("tooth_11", "femur_left");
    const errs = validateContent(input({}, { hierarchy: h.reverse() }), ok).errors;
    const has = (s: string) => expect(errs.some((e) => e.includes(s)), s).toBe(true);
    has("top-level groups are dentition, appendicular, axial");
    has("femur_left appears 2 times");
    has("tooth_11 is under axial");
  });

  it("checks the meshes against the ID list", () => {
    const errs = validateContent(input({}, { meshes: { high: [...meshIds.slice(1), "tooth_18", "extra"] } }), ok).errors;
    expect(errs).toEqual([
      "high model: mesh tooth_18 is marked meshAvailable: false",
      "high model: mesh extra is not in content/ids.json",
      `high model: no mesh for ${meshIds[0]}`,
    ]);
  });
});

describe("front matter and mirroring", () => {
  it("splits front matter and body", () => {
    expect(splitFrontMatter("---\na: 1\n---\nHello.\n")).toEqual({ data: { a: 1 }, body: "Hello." });
    expect(() => splitFrontMatter("no header")).toThrow();
  });

  it("swaps side words keeping case", () => {
    expect(swapSideWords("Left and right, LEFT; leftover")).toBe("Right and left, RIGHT; leftover");
  });

  it("mirrors IDs, side and text, and is stable", () => {
    const left = file("tooth_23", { landmarks: [], functions: ["Upper left canine tears food"] });
    const right = mirrorFile(left, "tooth_23", oppositeOf);
    const { data } = splitFrontMatter(right);
    const d = frontMatterSchema.parse(data);
    expect(d.id).toBe("tooth_13");
    expect(d.name).toBe("Upper right canine");
    expect(d.side).toBe("right");
    expect(d.region).toEqual(["dentition", "upper", "right", "canines"]);
    expect(d.functions).toEqual(["Upper right canine tears food"]);
    expect(right.split("\n")[1]).toContain("Generated from tooth_23.md");
    // Mirroring the mirror back gives the same data.
    const back = splitFrontMatter(mirrorFile(right, "tooth_13", oppositeOf)).data as Record<string, unknown>;
    expect(back.id).toBe("tooth_23");
  });

  it("counts words without markdown", () => {
    expect(wordCount("The **femur** (thigh bone) is _long_.")).toBe(6);
  });
});
