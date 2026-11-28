// M14 session BS: the search ranking (plan decisions 1–3): the comparator over
// match facts, the bands, the generic words and the noun filter.
import { describe, expect, it } from "vitest";
import { BAND, compareHits, rankHits, type HitFacts } from "../src/content/searchRank";
import { buildIndex, GENERIC_WORDS, hitFacts, makeSearcher, mergeSearchers, queryWords, type SearchDoc } from "../src/content/search";
import { searchOrder } from "../src/content/searchMerge";
import { readSearchDocuments, readSoftSearchDocuments } from "../scripts/lib/search-data";
import { layerOfId } from "../src/content/index";
import { LAYER_IDS } from "../src/systems/registry";

const f = (over: Partial<HitFacts> = {}): HitFacts => ({ band: BAND.partial, exact: 1, prefix: 0, nameLength: 2, group: false, ...over });
const order = (hits: { id: string; facts: HitFacts }[], ctx = {}) => rankHits(hits, ctx).map((h) => h.id);

describe("rankHits: the comparator (decision 1)", () => {
  it("orders by band first, whatever else", () => {
    expect(order([{ id: "c", facts: f({ band: 2, exact: 3 }) }, { id: "b", facts: f({ band: 1, exact: 0 }) }, { id: "a", facts: f({ band: 0, nameLength: 9 }) }])).toEqual(["a", "b", "c"]);
  });
  it("inside a band: region, then visibility, then exact words, prefix words, name length, index order, ID", () => {
    const inRegion = (id: string) => id === "r";
    const visible = (id: string) => id === "v" || id === "r";
    expect(order([{ id: "v", facts: f() }, { id: "r", facts: f() }, { id: "x", facts: f({ exact: 5 }) }], { inRegion, visible })).toEqual(["r", "v", "x"]);
    expect(order([{ id: "a", facts: f({ exact: 1 }) }, { id: "b", facts: f({ exact: 2 }) }])).toEqual(["b", "a"]);
    expect(order([{ id: "a", facts: f({ prefix: 0 }) }, { id: "b", facts: f({ prefix: 1 }) }])).toEqual(["b", "a"]);
    expect(order([{ id: "a", facts: f({ nameLength: 4 }) }, { id: "b", facts: f({ nameLength: 1 }) }])).toEqual(["b", "a"]);
    const rank = (id: string) => ({ b: 0, a: 1 })[id] ?? Infinity;
    expect(order([{ id: "a", facts: f() }, { id: "z", facts: f() }, { id: "b", facts: f() }], { rank })).toEqual(["b", "a", "z"]);
    expect(order([{ id: "b", facts: f() }, { id: "a", facts: f() }])).toEqual(["a", "b"]);
  });
  it("puts a band-1 group before the structures carrying its term, and only in band 1 (decision 2)", () => {
    expect(order([{ id: "m", facts: f({ band: 1, exact: 2 }) }, { id: "g", facts: f({ band: 1, group: true, nameLength: 5 }) }])).toEqual(["g", "m"]);
    expect(order([{ id: "g", facts: f({ group: true, nameLength: 5 }) }, { id: "m", facts: f() }])).toEqual(["m", "g"]);
  });
  it("is total and doesn't depend on the input order", () => {
    const hits = ["e", "d", "c", "b", "a"].map((id, i) => ({ id, facts: f({ exact: i % 2, nameLength: i % 3 }) }));
    const want = order(hits);
    for (let k = 0; k < 5; k++) expect(order([...hits.slice(k), ...hits.slice(0, k)])).toEqual(want);
    const cmp = compareHits();
    for (const a of hits) for (const b of hits) expect(Math.sign(cmp(a, b)) + 0).toBe(-Math.sign(cmp(b, a)) + 0);
  });
});

const doc = (over: Partial<SearchDoc>): SearchDoc => ({ id: "x", name: "", latin: "", common: "", synonyms: [], fdi: "", side: "midline", ...over });

describe("hitFacts: the bands (decisions 1 and 2)", () => {
  it("band 0: the name's words (generic words aside) or the FDI number", () => {
    expect(hitFacts(doc({ name: "Biceps brachii" }), ["brachii", "biceps"]).band).toBe(BAND.name);
    expect(hitFacts(doc({ name: "Hip bone" }), ["hip"]).band).toBe(BAND.name);
    expect(hitFacts(doc({ name: "Lower left first molar", fdi: "36" }), ["36"]).band).toBe(BAND.name);
    expect(hitFacts(doc({ name: "Long head of biceps brachii" }), ["biceps", "brachii"]).band).toBe(BAND.partial);
  });
  it("band 1: a common name or one synonym holds every word", () => {
    expect(hitFacts(doc({ name: "Patella", common: "Kneecap" }), ["kneecap"]).band).toBe(BAND.common);
    expect(hitFacts(doc({ name: "Pectoralis major", synonyms: ["pecs", "pec major"] }), ["major", "pec"]).band).toBe(BAND.common);
    expect(hitFacts(doc({ name: "Pectoralis major", synonyms: ["pecs", "major"] }), ["pecs", "major"]).band).toBe(BAND.partial); // two synonyms, not one
    expect(hitFacts(doc({ name: "Hip bone", latin: "Os coxae" }), ["os", "coxae"]).band).toBe(BAND.partial); // Latin is partial
  });
  it("a group is band 1 only when the query is one of its terms or its name", () => {
    const g = doc({ id: "muscles.x", name: "Rotator cuff", synonyms: ["rotator cuff muscles"], group: true });
    expect(hitFacts(g, ["rotator", "cuff"]).band).toBe(BAND.common);
    expect(hitFacts(g, ["cuff"]).band).toBe(BAND.partial);
    expect(hitFacts(g, ["rotator", "cuff"]).group).toBe(true);
  });
  it("counts exact and prefix words, and the name in words", () => {
    expect(hitFacts(doc({ name: "Clavicular head of pectoralis major" }), ["clav", "major"])).toMatchObject({ exact: 1, prefix: 1, nameLength: 4 });
  });
});

describe("generic words (decision 3)", () => {
  it("are the side words' companions from the registry: each layer's first kind's noun, one and many", () => {
    expect(GENERIC_WORDS.size).toBe(LAYER_IDS.length * 2);
    expect([...new Set(GENERIC_WORDS.values())].sort()).toEqual([...LAYER_IDS].sort());
    expect(queryWords("biceps muscle of the arm")).toEqual({ words: ["biceps", "arm"], layers: new Set([GENERIC_WORDS.get("muscle")]) });
  });

  const bones = readSearchDocuments();
  const soft = readSoftSearchDocuments();
  const search = mergeSearchers(makeSearcher(buildIndex(bones), bones), makeSearcher(buildIndex(soft), soft));
  const ids = (q: string) => search(q, 30).map((h) => h.id);

  it("alone return nothing", () => {
    for (const w of [...GENERIC_WORDS.keys(), "left", "right", "left muscle", "the bones"]) expect(ids(w), w).toEqual([]);
  });
  it("next to another word, keep only their layer's results", () => {
    const layer = GENERIC_WORDS.get("muscle")!;
    const hits = search("biceps muscle", 30);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => layerOfId(h.id) === layer)).toBe(true);
    expect(ids("deltoid ligament").every((id) => layerOfId(id) === GENERIC_WORDS.get("ligament"))).toBe(true);
    expect(ids("hip bone").slice(0, 2)).toEqual(["hip_bone_left", "hip_bone_right"]);
    expect(search("hip bone")[0]!.facts.band).toBe(BAND.name);
  });
  it("the side word filters as before", () => {
    expect(ids("left femur")).toEqual(["femur_left", "ligament_head_femur_left"]);
    expect(ids("right biceps brachii")[0]).toBe("biceps_brachii_right");
  });
  it("picks the label that holds every typed word, generic ones included", () => {
    expect(search("shin bone")[0]!.match).toBe("Shin bone");
  });
});

describe("ranked results (decisions 1 and 2)", () => {
  const bones = readSearchDocuments();
  const soft = readSoftSearchDocuments();
  const search = mergeSearchers(makeSearcher(buildIndex(bones), bones), makeSearcher(buildIndex(soft), soft));
  const ids = (q: string) => search(q, 30).map((h) => h.id);

  it("exact name, then synonyms, then partial matches", () => {
    const d = search("deltoid", 30);
    expect(d.slice(0, 2).map((h) => h.id)).toEqual(["deltoid_left", "deltoid_right"]);
    const bands = d.map((h) => h.facts.band);
    expect(bands).toEqual([...bands].sort());
  });
  it("a group whose term is the query comes first", () => {
    expect(ids("quadriceps")[0]).toBe("muscles.sets.quadriceps_femoris");
    expect(ids("hamstrings")[0]).toBe("muscles.lower_limb.thigh.thigh_posterior");
  });
  it("ties follow the ID files' order, so numbered series read in order", () => {
    expect(ids("costal cartilage").slice(0, 4)).toEqual(["costal_cartilage_1_left", "costal_cartilage_1_right", "costal_cartilage_2_left", "costal_cartilage_2_right"]);
    expect(ids("rib").slice(0, 2)).toEqual(["rib_1_left", "rib_1_right"]);
    expect(searchOrder()("femur_left")).toBeLessThan(searchOrder()("biceps_brachii_left"));
  });
  it("the visibility and region tie-breaks reorder inside a band only", () => {
    const visible = (id: string) => layerOfId(id) === layerOfId("femur_left");
    const t = search("trapezius", 30, { visible });
    expect(t.slice(0, 2).map((h) => h.id)).toEqual(["trapezius_left", "trapezius_right"]); // band 0 stays first
    expect(t[2]!.id).toMatch(/^trapezium_/); // the visible bone leads band 2
    const inRegion = (id: string) => id.endsWith("_right");
    expect(search("femur", 30, { inRegion })[0]!.id).toBe("femur_right");
  });
  it("merging doesn't depend on how the documents are split", () => {
    const one = makeSearcher(buildIndex([...bones, ...soft]), [...bones, ...soft]);
    const merged = mergeSearchers(one);
    for (const q of ["biceps", "rib", "deltoid", "pec major", "carpals", "scapula", "musculus", "acl", "molar"]) expect(merged(q, 30).map((h) => h.id), q).toEqual(ids(q));
  });
});
