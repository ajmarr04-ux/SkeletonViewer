// The soft-tissue content compiler (M8 plan decisions 9 and 11): one layer's
// content folder → one object per ID with the summary rendered to HTML, plus,
// for a layer whose content half reads derived lists off the graph (the
// muscles: synergists, antagonists and each structure's attached muscles, M12
// plan decision 4), those lists. Pure, so Vitest can run it on fixtures; the
// Vite plugin (scripts/lib/content-plugin.ts) serves each layer as its own lazy
// chunk.

import { marked } from "marked";
import { splitFrontMatter } from "./frontmatter";
import { buildMuscleRoles, type MuscleRoles, type Patch } from "./softRoles";
import { buildSoftTiers, type SoftTierData } from "./softTiers";
import type { LazyLayerId } from "../systems/registry";
import type { CompiledGraph } from "../graph/compile";
import { contentFolder, layerContent, schemaForKind } from "../systems/registry.content";
import type { SoftFm } from "./softSchema";

export type SoftCompiledEntry = {
  latin: string;
  common: string | null;
  /** The summary as HTML. */
  summary: string;
  reviewed: boolean;
  /** The front matter as written (M9's panel sections read it). */
  fm: SoftFm;
};
export type SoftDerived = {
  synergists: Record<string, string[]>;
  antagonists: Record<string, string[]>;
  /** Structure (bone, cartilage, …) → the muscles and parts attached to it. */
  attached: Record<string, { origins: string[]; insertions: string[] }>;
};
export type SoftLayerContent = {
  entries: Record<string, SoftCompiledEntry>;
  derived: SoftDerived | null;
  /** Tier sets (M9 plan decision 4), from every layer's content; added by `withSoftTiers`. */
  tiers?: SoftTierData;
  /** Muscles layer only: origin/insertion patches and fallback structures, antagonists (M9 plan decisions 6 and 7); added by `withSoftTiers`. */
  roles?: Record<string, MuscleRoles>;
  /** Names of the joints this layer's structures name (actions, `joint`), for the panel (M9 plan decision 9); added by `withSoftTiers`. */
  joints?: Record<string, string>;
};

export type SoftCompileDeps = {
  /** soft-ids.json kinds by ID. */
  kindOf: (id: string) => string | undefined;
  pairJoints: Iterable<string>;
  functionalJoints: Record<string, readonly string[]>;
  /** The relationship graph over the front matter given (by ID) plus the system's sources (M12 plan decision 1). */
  graph: (fm: Readonly<Record<string, unknown>>) => CompiledGraph;
};

/** Compile one layer. Throws on the first file that doesn't parse (validate-content lists every problem). */
export function compileSoftLayer(layer: LazyLayerId, files: Map<string, string>, deps: SoftCompileDeps): SoftLayerContent {
  const entries: Record<string, SoftCompiledEntry> = {};
  for (const [name, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const where = `content/${contentFolder(layer)}/${name}.md`;
    const kind = deps.kindOf(name);
    const schema = kind ? schemaForKind<SoftFm>(kind) : null;
    if (!schema) throw new Error(`${where}: not in content/soft-ids.json`);
    const { data, body } = splitFrontMatter(text);
    const res = schema.safeParse(data);
    if (!res.success) throw new Error(`${where}: ${res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const fm = res.data;
    if (fm.id !== name) throw new Error(`${where}: id is ${fm.id}`);
    entries[name] = {
      latin: fm.latin,
      common: fm.commonName ?? null,
      summary: (marked.parse(body, { async: false, gfm: true }) as string).trim(),
      reviewed: fm.reviewed,
      fm,
    };
  }
  const lists = layerContent(layer).derivedLists;
  if (!lists) return { entries, derived: null };
  const g = deps.graph(Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, e.fm])));
  if (g.errors.length > 0) throw new Error(`content/${contentFolder(layer)}: ${g.errors.slice(0, 5).join("; ")}`);
  return { entries, derived: lists(g.edges, Object.keys(entries)) as SoftDerived };
}

/**
 * Add the tier sets (M9 plan decision 4) to compiled layers. They need every
 * layer at once: a muscle's tier 2 uses the derived synergists, and a
 * ligament's tier 2 names cartilage (and the other way round).
 */
export function withSoftTiers(
  layers: Record<LazyLayerId, SoftLayerContent>,
  deps: Pick<SoftCompileDeps, "pairJoints" | "functionalJoints"> & { patches?: Record<string, Patch>; jointNames?: Record<string, string> },
): Record<LazyLayerId, SoftLayerContent> {
  const fm: Record<string, SoftFm> = {};
  for (const c of Object.values(layers)) for (const [id, e] of Object.entries(c.entries)) fm[id] = e.fm;
  const tiers = buildSoftTiers({ fm, synergists: layers.muscles.derived?.synergists ?? {}, pairJoints: deps.pairJoints, functionalJoints: deps.functionalJoints });
  const d = layers.muscles.derived;
  const roles = buildMuscleRoles({ fm, patches: deps.patches ?? {}, synergists: d?.synergists ?? {}, antagonists: d?.antagonists ?? {} });
  const names = deps.jointNames ?? {};
  const joints = (c: SoftLayerContent) => {
    const out: Record<string, string> = {};
    for (const { fm: f } of Object.values(c.entries)) {
      const named = "joint" in f ? [f.joint] : f.actions.map((a) => a.joint);
      for (const j of named) if (j !== null && names[j] !== undefined) out[j] = names[j];
    }
    return out;
  };
  return {
    muscles: { ...layers.muscles, tiers: tiers.muscles, roles, joints: joints(layers.muscles) },
    ligaments: { ...layers.ligaments, tiers: tiers.ligaments, joints: joints(layers.ligaments) },
    cartilage: { ...layers.cartilage, tiers: tiers.cartilage, joints: joints(layers.cartilage) },
  };
}
