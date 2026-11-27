// Search (spec §7, plan step 1): the documents, the minisearch options, the
// side filter and the result shape. Pure, so Vitest builds the index straight
// from the content files. The app gets a prebuilt index from the virtual module
// `virtual:skeleton-search` (scripts/lib/content-plugin.ts), loaded lazily.

import MiniSearch, { type AsPlainObject, type Options, type SearchResult as RawResult } from "minisearch";
import type { CompiledContent } from "./compile";
import { displayName } from "./names";
import { layerOfId } from "./index";
import { BAND, rankHits, type Band, type HitFacts, type RankContext } from "./searchRank";
import { searchOrder } from "./searchMerge";
import { REGISTRY } from "../systems/registry";
import type { GroupSynonym, Synonyms } from "./schema";
import type { SoftTreeData, SoftTreeNode } from "../tree/types";

type Side = "left" | "right" | "midline";
type IdEntry = { id: string; name: string; kind: string; side: Side };

/** One searchable object. `synonyms` is the curated list for the object (left terms reused on the right). */
export type SearchDoc = {
  id: string;
  name: string;
  latin: string;
  common: string;
  synonyms: string[];
  /** FDI number for teeth ("36"), else "". */
  fdi: string;
  side: Side;
  /** Soft-tissue documents (M9): the display name, ready-made ("Biceps brachii (left)"; a group's name). */
  label?: string;
  /** Soft-tissue documents: something is drawn for it (its mesh, or its parts'). */
  drawn?: boolean;
  /** A group synonym's document: choosing it isolates the group `id` (M9 plan decision 12). */
  group?: true;
};

export type SearchHit = {
  id: string;
  /** Display name: "Femur (left)". */
  label: string;
  /** The matched term when it isn't the name: "Thigh bone", "Os coxae", "FDI 36"; else null. */
  match: string | null;
  /** True for a group (the ID is a group key): choosing it isolates the group. */
  group: boolean;
  /** Something is drawn for it; null for bones (the app knows from ids.json). */
  drawn: boolean | null;
  /** minisearch's score: for debugging only, nothing sorts by it (M14 plan decision 1). */
  score: number;
  /** What the ranking compares (`rankHits`, src/content/searchRank.ts). */
  facts: HitFacts;
};

/** What the virtual module exports: the serialised index and the documents. */
export type SearchData = { index: AsPlainObject; docs: SearchDoc[] };

const FIELDS = ["name", "common", "synonyms", "latin", "fdi"] as const;
type Field = (typeof FIELDS)[number];
/** Plan step 1: name 3, common name 2, synonyms 2, Latin 1 (the FDI number counts as a name). */
export const BOOST: Record<Field, number> = { name: 3, common: 2, synonyms: 2, latin: 1, fdi: 3 };
const STOP = new Set(["of", "the", "a", "an", "and"]);
const SIDE_WORDS: Record<string, "left" | "right"> = { left: "left", right: "right" };

/**
 * Generic words (M14 plan decision 3, spec §8): never a match alone; next to
 * another word they keep only their layer's results ("biceps muscle"). Each
 * layer's first kind's noun, one and many ("muscle", "muscles"), plus its
 * `searchStopWords`. Word → layer.
 */
export const GENERIC_WORDS: ReadonlyMap<string, string> = new Map(
  REGISTRY.flatMap((l) => {
    const k = l.kinds[0]!;
    return [k.noun.one, k.noun.many, ...((l as { searchStopWords?: readonly string[] }).searchStopWords ?? [])].map((w) => [w.toLowerCase(), l.id] as const);
  }),
);

const processTerm = (term: string): string | null => {
  const t = term.toLowerCase();
  return STOP.has(t) ? null : t;
};

export const SEARCH_OPTIONS: Options<SearchDoc> = {
  fields: [...FIELDS],
  // Soft documents have no FDI number: a missing field is "".
  storeFields: [],
  extractField: (doc, field) => {
    const v = (doc as Record<string, unknown>)[field];
    return Array.isArray(v) ? v.join(" · ") : ((v as string | undefined) ?? "");
  },
  processTerm,
  searchOptions: {
    boost: BOOST,
    prefix: true,
    // Short terms ("c1", "36", "t4") must match exactly; longer ones forgive a typo or two.
    fuzzy: (term) => (term.length > 3 ? 0.2 : false),
    combineWith: "AND",
  },
};

/** FDI tooth number from the stable ID: tooth_36 → "36". */
const fdiOf = (id: string): string => /^tooth_(\d\d)$/.exec(id)?.[1] ?? "";

/**
 * One document per object. Synonyms are written under the left (or midline)
 * ID; `opposite` maps a right-side object to its left twin.
 */
export function searchDocuments(
  ids: readonly IdEntry[],
  content: CompiledContent,
  synonyms: Synonyms,
  opposite: (id: string) => string | null,
): SearchDoc[] {
  return ids.map((e) => {
    const c = content[e.id];
    const key = e.side === "right" ? (opposite(e.id) ?? e.id) : e.id;
    return {
      id: e.id,
      name: e.name,
      latin: c?.latin ?? "",
      common: c?.common ?? "",
      synonyms: synonyms[key] ?? [],
      fdi: fdiOf(e.id),
      side: e.side,
    };
  });
}

type SoftSearchId = { id: string; name: string; side: Side; meshAvailable: boolean; parts?: string[]; latin?: string | null };

/**
 * The soft-tissue documents (M9 plan decision 12): every structure (name, Latin
 * and common name from its content file, the synonyms of its left or midline
 * twin), and one document per group synonym, whose choosing isolates the group.
 */
export function softSearchDocuments(
  softIds: readonly SoftSearchId[],
  frontMatter: (id: string) => { latin?: string | null; commonName?: string | null } | undefined,
  synonyms: Synonyms,
  groups: Readonly<Record<string, GroupSynonym>>,
  tree: SoftTreeData,
): SearchDoc[] {
  const byId = new Map(softIds.map((e) => [e.id, e]));
  const docs: SearchDoc[] = softIds.map((e) => {
    const fm = frontMatter(e.id);
    const left = e.side === "right" ? e.id.replace(/_right$/, "_left") : e.id;
    return {
      id: e.id,
      name: e.name,
      latin: fm?.latin ?? e.latin ?? "",
      common: fm?.commonName ?? "",
      synonyms: synonyms[left] ?? [],
      fdi: "",
      side: e.side,
      label: e.side === "midline" ? e.name : `${e.name} (${e.side})`,
      drawn: e.meshAvailable || (e.parts ?? []).some((p) => byId.get(p)?.meshAvailable === true),
    };
  });
  const nodes = new Map<string, SoftTreeNode>();
  const walk = (n: SoftTreeNode) => {
    nodes.set(n.key, n);
    n.children.forEach((c) => "key" in c && walk(c)); // isSoftNode, inlined: this module's chunk shares nothing with the tree
  };
  tree.roots.forEach(walk);
  const sets = new Map(tree.sets.map((x) => [x.key, x]));
  for (const [key, g] of Object.entries(groups)) {
    const node = nodes.get(key);
    const name = node?.name ?? sets.get(key)?.label;
    if (name === undefined) continue;
    docs.push({ id: key, name: node?.label ?? name, latin: "", common: "", synonyms: g.terms, fdi: "", side: "midline", label: name, drawn: true, group: true });
  }
  return docs;
}

export function buildIndex(docs: readonly SearchDoc[]): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
  ms.addAll(docs as SearchDoc[]);
  return ms;
}

export function buildSearchData(docs: SearchDoc[]): SearchData {
  return { index: buildIndex(docs).toJSON(), docs };
}

/** Split off a side word: "left femur" → { text: "femur", side: "left" }. */
export function parseQuery(q: string): { text: string; side: "left" | "right" | null } {
  let side: "left" | "right" | null = null;
  const words = q
    .trim()
    .split(/\s+/)
    .filter((w) => {
      const s = SIDE_WORDS[w.toLowerCase()];
      if (s) side = s;
      return !s && w !== "";
    });
  return { text: words.join(" "), side };
}

const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== "" && !STOP.has(t));

/**
 * Which field to show beside the name, and its text, for a result that didn't
 * match on the name: the field that matched the most query terms (exact before
 * fuzzy), then common name, synonym, Latin.
 */
function matchLabel(doc: SearchDoc, r: RawResult, typed: readonly string[]): string | null {
  const count = new Map<Field, number>();
  for (const fields of Object.values(r.match) as Field[][]) for (const f of fields) count.set(f, (count.get(f) ?? 0) + 1);
  if (count.has("name")) return null;
  if (count.has("fdi")) return `FDI ${doc.fdi}`;
  const terms = new Set(r.terms);
  const hit = (s: string) => tokens(s).some((t) => terms.has(t));
  const candidates: [Field, string | undefined][] = [
    ["common", doc.common || undefined],
    // A synonym holding every typed word first, generic words included ("shin bone" → "Shin bone", not "Shinbone").
    ["synonyms", doc.synonyms.find((s) => typed.every((w) => tokens(s).includes(w))) ?? doc.synonyms.find(hit) ?? doc.synonyms[0]],
    ["latin", doc.latin || undefined],
  ];
  let best: string | null = null;
  let bestN = 0;
  const holdsAll = (text: string) => typed.every((w) => tokens(text).includes(w));
  for (const [field, text] of candidates) {
    // A field that matched, and holds every typed word, beats one that matched more of the searched words.
    const n = (count.get(field) ?? 0) && (count.get(field) ?? 0) + (text && holdsAll(text) ? 1000 : 0);
    if (text && n > bestN) {
      best = text.charAt(0).toUpperCase() + text.slice(1);
      bestN = n;
    }
  }
  return best;
}

/** Ranked hits, best first (`rankHits`); `limit` applies after ranking, so it never depends on minisearch's order. */
export type Searcher = (query: string, limit?: number, context?: RankContext) => SearchHit[];
export { mergeSearchers } from "./searchMerge";

/** The query's words without the side word and stop words, split into generic and the rest (decision 3). */
export function queryWords(text: string): { words: string[]; layers: Set<string> } {
  const words: string[] = [];
  const layers = new Set<string>();
  for (const t of tokens(text)) {
    const l = GENERIC_WORDS.get(t);
    if (l === undefined) words.push(t);
    else layers.add(l);
  }
  return { words, layers };
}

type DocWords = { name: Set<string>; strict: string[][]; all: string[] };
const setIs = (a: readonly string[], b: ReadonlySet<string>) => b.size > 0 && a.length === b.size && a.every((w) => b.has(w));

function docWords(doc: SearchDoc): DocWords {
  const name = new Set(tokens(doc.name).filter((t) => !GENERIC_WORDS.has(t)));
  // Band 1's strings: a group's terms and its own name; a structure's common name and synonyms.
  const strict = (doc.group ? [doc.name, ...doc.synonyms] : [doc.common, ...doc.synonyms]).filter((x) => x !== "").map(tokens);
  const all = [doc.name, doc.common, doc.latin, doc.fdi, ...doc.synonyms].flatMap(tokens);
  return { name, strict, all };
}

/** The facts the ranking compares (decisions 1 and 2), from the query's words and the document's own words. */
export function hitFacts(doc: SearchDoc, words: readonly string[], dw: DocWords = docWords(doc)): HitFacts {
  let band: Band = BAND.partial;
  if (!doc.group && (setIs(words, dw.name) || (doc.fdi !== "" && words.length === 1 && words[0] === doc.fdi))) band = BAND.name;
  else if (dw.strict.some((s) => (doc.group ? setIs(words, new Set(s.filter((t) => !GENERIC_WORDS.has(t)))) : words.every((w) => s.includes(w))))) band = BAND.common;
  const all = new Set(dw.all);
  let exact = 0;
  let prefix = 0;
  for (const w of words)
    if (all.has(w)) exact++;
    else if (dw.all.some((t) => t.startsWith(w))) prefix++;
  return { band, exact, prefix, nameLength: tokens(doc.name).length, group: doc.group === true };
}

/** A hit's layer for the generic-word filter: a group's key starts with its layer's ID. */
const layerOfHit = (doc: SearchDoc): string | null => (doc.group ? doc.id.slice(0, doc.id.indexOf(".")) : layerOfId(doc.id));

/** A search function over a built (or loaded) index. */
export function makeSearcher(index: MiniSearch<SearchDoc>, docs: readonly SearchDoc[]): Searcher {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const words = new Map<string, DocWords>();
  const wordsOf = (d: SearchDoc) => words.get(d.id) ?? words.set(d.id, docWords(d)).get(d.id)!;
  return (query, limit = 20, context) => {
    const { text, side } = parseQuery(query);
    const q = queryWords(text);
    if (q.words.length === 0) return [];
    const typed = tokens(text);
    const out: SearchHit[] = [];
    for (const r of index.search(q.words.join(" "))) {
      const doc = byId.get(r.id as string);
      if (!doc || (side !== null && doc.side !== side)) continue;
      if (q.layers.size > 0 && !q.layers.has(layerOfHit(doc) ?? "")) continue;
      const facts = hitFacts(doc, q.words, wordsOf(doc));
      out.push({ id: doc.id, label: doc.label ?? displayName(doc.id), match: matchLabel(doc, r, typed), group: doc.group === true, drawn: doc.drawn ?? null, score: r.score, facts });
    }
    return rankHits(out, { rank: searchOrder(), ...context }).slice(0, limit);
  };
}

/** The searcher from the virtual module's data. */
export function loadSearcher(data: SearchData): Searcher {
  return makeSearcher(MiniSearch.loadJS<SearchDoc>(data.index, SEARCH_OPTIONS), data.docs);
}
