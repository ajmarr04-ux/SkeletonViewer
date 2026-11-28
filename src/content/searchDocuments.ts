// One layer's search documents (M14 plan decision 4), built at build time by
// the Vite plugin and the scripts (scripts/lib/search-data.ts), never in the
// browser: the app loads each layer's prebuilt index (search.ts).
import type { SearchDoc, Side } from "./search";
import type { GroupSynonym, Synonyms } from "./schema";
import type { SoftTreeData, SoftTreeNode } from "../tree/types";
import type { SearchField } from "../systems/types";

/** FDI tooth number from the stable ID: tooth_36 → "36". */
const fdiOf = (id: string): string => /^tooth_(\d\d)$/.exec(id)?.[1] ?? "";

/** A row of a layer's ID table, as search reads it (content/ids.json, or the layer's `idsFile`). */
export type SearchRow = { id: string; name: string; kind: string; side: Side; latin?: string | null; meshAvailable?: boolean; parts?: readonly string[] };

/** What a layer's search documents are built from (M14 plan decision 4). */
export type LayerSearchInput = {
  rows: readonly SearchRow[];
  /** A structure's compiled content: its Latin name and common name, or null when unwritten. */
  field: (id: string, name: "latin" | "commonName") => string | null | undefined;
  /** content/synonyms.json's terms, written under the left (or midline) ID. */
  synonyms: Synonyms;
  /** A right-side structure's left twin (whose synonyms it takes). */
  opposite: (id: string) => string | null;
  /** The group synonyms, and the sidebar tree that names their groups. */
  groups?: Readonly<Record<string, GroupSynonym>>;
  tree?: SoftTreeData;
};

/** The parts of a layer's descriptor the builder reads. */
export type SearchLayer = {
  id: string;
  models: { eager: boolean };
  kinds: readonly { id: string; searchFields: readonly SearchField[] }[];
};

/**
 * One layer's search documents (M14 plan decision 4): one per structure, with
 * the fields its kind's `searchFields` names, then one per group synonym whose
 * group is in the layer's tree root (or is a set under it);
 * choosing a group's document isolates the group (M9 plan decision 12).
 * Structures of a lazy layer carry their display name and whether something is
 * drawn for them (their mesh or their parts'); the eager layer's come from the
 * ID index in the app.
 */
export function layerSearchDocuments(layer: SearchLayer, input: LayerSearchInput): SearchDoc[] {
  const fields = new Map(layer.kinds.map((k) => [k.id, new Set(k.searchFields)]));
  const byId = new Map(input.rows.map((e) => [e.id, e]));
  const lazy = !layer.models.eager;
  const docs: SearchDoc[] = input.rows.map((e) => {
    const f = fields.get(e.kind);
    if (!f) throw new Error(`search: ${e.id} is of kind ${e.kind}, which layer ${layer.id} doesn't have`);
    const twin = e.side === "right" ? (input.opposite(e.id) ?? e.id) : e.id;
    const doc: SearchDoc = {
      id: e.id,
      name: f.has("name") ? e.name : "",
      latin: f.has("latin") ? (input.field(e.id, "latin") ?? e.latin ?? "") : "",
      common: f.has("common") ? (input.field(e.id, "commonName") ?? "") : "",
      synonyms: f.has("synonyms") ? (input.synonyms[twin] ?? []) : [],
      fdi: f.has("fdi") ? fdiOf(e.id) : "",
      side: e.side,
    };
    if (lazy) {
      doc.label = e.side === "midline" ? e.name : `${e.name} (${e.side})`;
      doc.drawn = e.meshAvailable === true || (e.parts ?? []).some((p) => byId.get(p)?.meshAvailable === true);
    }
    return doc;
  });
  if (!input.groups || !input.tree) return docs;
  const nodes = new Map<string, SoftTreeNode>();
  const walk = (n: SoftTreeNode) => {
    nodes.set(n.key, n);
    n.children.forEach((c) => "key" in c && walk(c)); // isSoftNode, inlined: this module's chunk shares nothing with the tree
  };
  const root = input.tree.roots.find((r) => r.key === layer.id);
  if (root) walk(root);
  const sets = new Map(input.tree.sets.filter((x) => (x.root ?? x.key.slice(0, x.key.indexOf("."))) === layer.id).map((x) => [x.key, x]));
  for (const [key, g] of Object.entries(input.groups)) {
    const node = nodes.get(key);
    const name = node?.name ?? sets.get(key)?.label;
    if (name === undefined) continue;
    docs.push({ id: key, name: node?.label ?? name, latin: "", common: "", synonyms: g.terms, fdi: "", side: "midline", label: name, drawn: true, group: true });
  }
  return docs;
}
