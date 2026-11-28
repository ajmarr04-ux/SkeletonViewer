// M14 session BT: one search index per layer (plan decision 4). The documents
// are built per layer from each kind's `searchFields`, and the merged results
// must not depend on how the documents are split into indexes: with the default
// context, the top 30 of every golden query is the same from one index of every
// document as from one index per layer (the ranking compares facts that don't
// depend on an index's corpus, decision 1).
import { describe, expect, it } from "vitest";
import { buildIndex, makeSearcher, mergeSearchers, type SearchHit } from "../src/content/search";
import { layerOfId } from "../src/content/index";
import { readAllSearchDocuments } from "../scripts/lib/search-data";
import { LAYER_IDS, REGISTRY, layerDescriptor } from "../src/systems/registry";
import { layerContent } from "../src/systems/registry.content";
import { SEARCH_QUERIES } from "./golden/harness";

const docs = readAllSearchDocuments();
const all = LAYER_IDS.flatMap((l) => docs[l]);
const one = mergeSearchers(makeSearcher(buildIndex(all), all));
const perLayer = mergeSearchers(...LAYER_IDS.map((l) => makeSearcher(buildIndex(docs[l]), docs[l])));
// Everything but minisearch's score, which does depend on the corpus (and sorts nothing).
const shown = (hits: SearchHit[]) => hits.map(({ score: _, ...h }) => h);

describe("one index per layer (decision 4)", () => {
  it("every kind names its search fields, and every layer its own index chunk", () => {
    for (const l of REGISTRY) {
      for (const k of l.kinds) expect(k.searchFields.length, k.id).toBeGreaterThan(0);
      expect(layerContent(l.id).searchChunk).toBe(`virtual:skeleton-search-${l.id}`);
    }
  });

  it("each layer's index holds its own structures, and the groups of its tree", () => {
    for (const l of LAYER_IDS)
      for (const d of docs[l]) {
        if (d.group) expect(d.id.split(".")[0], d.id).toBe(l);
        else expect(layerOfId(d.id), d.id).toBe(l);
      }
    expect(docs[LAYER_IDS[0]!].some((d) => d.group)).toBe(false);
  });

  it("a field outside the kind's searchFields stays empty", () => {
    const fdi = all.filter((d) => d.fdi !== "").map((d) => d.id);
    expect(fdi.length).toBe(32);
    expect(fdi.every((id) => id.startsWith("tooth_"))).toBe(true);
    const bones = layerDescriptor(LAYER_IDS[0]!);
    expect(bones.kinds.filter((k) => k.searchFields.includes("fdi")).map((k) => k.id)).toEqual(["tooth"]);
  });

  it("the merged top 30 of every golden query is the same with one index or one per layer", () => {
    for (const q of SEARCH_QUERIES) expect(shown(perLayer(q, 30)), q).toEqual(shown(one(q, 30)));
  });

  it("and with the indexes in any order", () => {
    const reversed = mergeSearchers(...[...LAYER_IDS].reverse().map((l) => makeSearcher(buildIndex(docs[l]), docs[l])));
    for (const q of SEARCH_QUERIES) expect(shown(reversed(q, 30)), q).toEqual(shown(perLayer(q, 30)));
  });
});
