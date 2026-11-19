import { describe, expect, it } from "vitest";
import { buildIndex, loadSearcher, buildSearchData, makeSearcher, parseQuery } from "../src/content/search";
import { validateSynonyms } from "../src/content/validate";
import { readIds, readJson } from "../scripts/lib/content-files";
import { readSearchDocuments } from "../scripts/lib/search-data";

const docs = readSearchDocuments();
const search = makeSearcher(buildIndex(docs), docs);
const ids = (q: string) => search(q).map((h) => h.id);

describe("search (plan step 1)", () => {
  it("finds common names, on both sides", () => {
    expect(ids("kneecap").slice(0, 2).sort()).toEqual(["patella_left", "patella_right"]);
    expect(ids("collarbone").slice(0, 2).sort()).toEqual(["clavicle_left", "clavicle_right"]);
  });
  it("shows the matched term when it isn't the name", () => {
    const hit = search("kneecap")[0]!;
    expect(hit.match).toBe("Kneecap");
    expect(hit.label).toMatch(/^Patella \((left|right)\)$/);
    expect(search("femur")[0]!.match).toBeNull();
    expect(search("os coxae")[0]!.match).toBe("Os coxae");
  });
  it("finds the four wisdom teeth", () => {
    expect(ids("wisdom tooth").sort()).toEqual(["tooth_18", "tooth_28", "tooth_38", "tooth_48"]);
  });
  it("narrows to a side with 'left' or 'right'", () => {
    expect(ids("left femur")).toEqual(["femur_left"]);
    expect(ids("femur right")).toEqual(["femur_right"]);
    expect(ids("upper left first molar")[0]).toBe("tooth_26");
  });
  it("finds Latin names", () => {
    expect(ids("os coxae").sort()).toEqual(["hip_bone_left", "hip_bone_right"]);
  });
  it("finds FDI numbers and vertebra codes", () => {
    expect(ids("36")[0]).toBe("tooth_36");
    expect(search("36")[0]!.match).toBe("FDI 36");
    expect(ids("C1")[0]).toBe("vertebra_c1");
    expect(ids("T4")[0]).toBe("vertebra_t4");
  });
  it("finds synonyms", () => {
    expect(ids("innominate").sort()).toEqual(["hip_bone_left", "hip_bone_right"]);
    expect(ids("tailbone")).toEqual(["coccyx"]);
    expect(ids("big toe").length).toBe(6);
  });
  it("forgives a typo", () => {
    expect(ids("scapla").slice(0, 2).sort()).toEqual(["scapula_left", "scapula_right"]);
  });
  it("finds by prefix", () => {
    expect(ids("clav").slice(0, 2).sort()).toEqual(["clavicle_left", "clavicle_right"]);
  });
  it("returns nothing for nonsense or an empty query", () => {
    expect(ids("xqzvw")).toEqual([]);
    expect(ids("")).toEqual([]);
    expect(ids("left")).toEqual([]);
  });
  it("the serialised index gives the same results", () => {
    const loaded = loadSearcher(JSON.parse(JSON.stringify(buildSearchData(docs))));
    for (const q of ["kneecap", "left femur", "36", "scapla", "os coxae"]) expect(loaded(q)).toEqual(search(q));
  });
  it("parseQuery splits off the side", () => {
    expect(parseQuery("  Left  femur ")).toEqual({ text: "femur", side: "left" });
    expect(parseQuery("tibia")).toEqual({ text: "tibia", side: null });
  });
});

describe("synonyms.json validation", () => {
  const idList = readIds();
  it("the real file is valid", () => {
    expect(validateSynonyms(readJson("content/synonyms.json"), idList)).toEqual([]);
  });
  it("rejects unknown IDs, right-side keys, empty, repeated and side terms", () => {
    const errors = validateSynonyms(
      { nope: ["x"], femur_right: ["thigh"], femur_left: ["", "thigh", "Thigh", "left leg"] },
      idList,
    );
    expect(errors.join("\n")).toMatch(/nope: no such ID/);
    expect(errors.join("\n")).toMatch(/femur_right: write paired terms under the left ID/);
    expect(errors.join("\n")).toMatch(/femur_left: empty term/);
    expect(errors.join("\n")).toMatch(/"Thigh" is listed twice/);
    expect(errors.join("\n")).toMatch(/"left leg" names a side/);
  });
  it("rejects a malformed file", () => {
    expect(validateSynonyms({ femur_left: "thigh" }, idList).length).toBeGreaterThan(0);
  });
});
