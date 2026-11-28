// Search ranking (M14 plan decisions 1 and 2): a pure comparator over match
// facts, so the order doesn't depend on how the documents are split into
// indexes (minisearch's BM25 scores do: they come from each index's term
// statistics). minisearch still finds the candidates; this only orders them.
// No minisearch here: the sidebar's merge (main chunk) uses it.

/** The match bands, best first. */
export const BAND = { name: 0, common: 1, partial: 2 } as const;
export type Band = (typeof BAND)[keyof typeof BAND];

/** What a searcher found out about one hit; none of it depends on the index's corpus. */
export type HitFacts = {
  /** 0: the query is the name (or the FDI number); 1: a common name or synonym holds every query word; 2: anything else. */
  band: Band;
  /** Query words equal to a word of the document. */
  exact: number;
  /** Query words that start a word of the document without equalling one. */
  prefix: number;
  /** The name's length in words (stop words aside): shorter first. Words, not letters, so "left" doesn't beat "right". */
  nameLength: number;
  /** A group (decision 2): in band 1, a group whose term is the query comes before the structures that carry it as a synonym. */
  group: boolean;
};

/** The view the results are ranked for (decision 1.2); every field optional, none = no tie-break. */
export type RankContext = {
  /** A member of the current body region. */
  inRegion?: (id: string) => boolean;
  /** On a layer that is On or Ghost. */
  visible?: (id: string) => boolean;
  /** The ID index's order; IDs it doesn't know (groups) come after, by ID. */
  rank?: (id: string) => number;
};

type Ranked = { id: string; facts: HitFacts };

const first = (f: ((id: string) => boolean) | undefined, a: string, b: string): number => (f ? Number(f(b)) - Number(f(a)) : 0);

/** The ranking as a comparator (decision 1): band, region, visibility, a band-1 group, exact words, prefix words, name length, index order, ID. */
export function compareHits(context: RankContext = {}): (a: Ranked, b: Ranked) => number {
  const rank = context.rank ?? (() => Infinity);
  const r = (id: string) => {
    const n = rank(id);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
  return (a, b) =>
    a.facts.band - b.facts.band ||
    first(context.inRegion, a.id, b.id) ||
    first(context.visible, a.id, b.id) ||
    (a.facts.band === BAND.common ? Number(b.facts.group) - Number(a.facts.group) : 0) ||
    b.facts.exact - a.facts.exact ||
    b.facts.prefix - a.facts.prefix ||
    a.facts.nameLength - b.facts.nameLength ||
    r(a.id) - r(b.id) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The hits in ranked order (a new array). Total and stable: equal IDs are the only ties. */
export function rankHits<T extends Ranked>(hits: readonly T[], context: RankContext = {}): T[] {
  return [...hits].sort(compareHits(context));
}
