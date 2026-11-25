// Search (spec §7, plan step 1): the documents, the minisearch options, the
// side filter and the result shape. Pure, so Vitest builds the index straight
// from the content files. The app gets a prebuilt index from the virtual module
// `virtual:skeleton-search` (scripts/lib/content-plugin.ts), loaded lazily.

import MiniSearch, { type AsPlainObject, type Options, type SearchResult as RawResult } from "minisearch";
import type { CompiledContent } from "./compile";
import { displayName } from "./names";
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
  /** minisearch's score, for merging the bone and soft-tissue results. */
  score: number;
};

/** What the virtual module exports: the serialised index and the documents. */
export type SearchData = { index: AsPlainObject; docs: SearchDoc[] };

const FIELDS = ["name", "common", "synonyms", "latin", "fdi"] as const;
type Field = (typeof FIELDS)[number];
/** Plan step 1: name 3, common name 2, synonyms 2, Latin 1 (the FDI number counts as a name). */
export const BOOST: Record<Field, number> = { name: 3, common: 2, synonyms: 2, latin: 1, fdi: 3 };
const STOP = new Set(["of", "the", "a", "an", "and"]);
const SIDE_WORDS: Record<string, "left" | "right"> = { left: "left", right: "right" };

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
function matchLabel(doc: SearchDoc, r: RawResult): string | null {
  const count = new Map<Field, number>();
  for (const fields of Object.values(r.match) as Field[][]) for (const f of fields) count.set(f, (count.get(f) ?? 0) + 1);
  if (count.has("name")) return null;
  if (count.has("fdi")) return `FDI ${doc.fdi}`;
  const terms = new Set(r.terms);
  const hit = (s: string) => tokens(s).some((t) => terms.has(t));
  const candidates: [Field, string | undefined][] = [
    ["common", doc.common || undefined],
    ["synonyms", doc.synonyms.find(hit) ?? doc.synonyms[0]],
    ["latin", doc.latin || undefined],
  ];
  let best: string | null = null;
  let bestN = 0;
  for (const [field, text] of candidates) {
    const n = count.get(field) ?? 0;
    if (text && n > bestN) {
      best = text.charAt(0).toUpperCase() + text.slice(1);
      bestN = n;
    }
  }
  return best;
}

export type Searcher = (query: string, limit?: number) => SearchHit[];
export { mergeSearchers } from "./searchMerge";

/** A search function over a built (or loaded) index. */
export function makeSearcher(index: MiniSearch<SearchDoc>, docs: readonly SearchDoc[]): Searcher {
  const byId = new Map(docs.map((d) => [d.id, d]));
  return (query, limit = 20) => {
    const { text, side } = parseQuery(query);
    if (text === "") return [];
    const out: SearchHit[] = [];
    for (const r of index.search(text)) {
      const doc = byId.get(r.id as string);
      if (!doc || (side !== null && doc.side !== side)) continue;
      out.push({ id: doc.id, label: doc.label ?? displayName(doc.id), match: matchLabel(doc, r), group: doc.group === true, drawn: doc.drawn ?? null, score: r.score });
      if (out.length >= limit) break;
    }
    return out;
  };
}

/** The searcher from the virtual module's data. */
export function loadSearcher(data: SearchData): Searcher {
  return makeSearcher(MiniSearch.loadJS<SearchDoc>(data.index, SEARCH_OPTIONS), data.docs);
}
