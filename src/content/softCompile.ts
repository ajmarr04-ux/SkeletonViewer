// The soft-tissue content compiler (M8 plan decisions 9 and 11): one layer's
// content folder → one object per ID with the summary rendered to HTML, plus,
// for the muscles layer, the derived synergists, antagonists and each
// structure's attached muscles. Pure, so Vitest can run it on fixtures; the
// Vite plugin (scripts/lib/content-plugin.ts) serves each layer as its own lazy
// chunk.

import { marked } from "marked";
import { derive, type DeriveMuscle } from "./derive";
import { splitFrontMatter } from "./frontmatter";
import { buildMuscleRoles, type MuscleRoles, type Patch } from "./softRoles";
import { buildSoftTiers, type SoftTierData } from "./softTiers";
import { LAYER_FOLDERS, schemaForKind, type SoftFm, type SoftLayer } from "./softSchema";

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
};

export type SoftCompileDeps = {
  /** soft-ids.json kinds by ID. */
  kindOf: (id: string) => string | undefined;
  pairJoints: Iterable<string>;
  functionalJoints: Record<string, readonly string[]>;
  antagonistPairs: readonly (readonly [string, string])[];
};

/** Compile one layer. Throws on the first file that doesn't parse (validate-content lists every problem). */
export function compileSoftLayer(layer: SoftLayer, files: Map<string, string>, deps: SoftCompileDeps): SoftLayerContent {
  const entries: Record<string, SoftCompiledEntry> = {};
  for (const [name, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const where = `content/${LAYER_FOLDERS[layer]}/${name}.md`;
    const kind = deps.kindOf(name);
    const schema = kind ? schemaForKind(kind) : null;
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
  return { entries, derived: layer === "muscles" ? deriveAll(entries, deps) : null };
}

function deriveAll(entries: Record<string, SoftCompiledEntry>, deps: SoftCompileDeps): SoftDerived {
  const muscles: Record<string, DeriveMuscle> = {};
  for (const [id, { fm }] of Object.entries(entries)) {
    if (fm.kind === "muscle")
      muscles[id] = { kind: "muscle", parent: null, parts: fm.parts, origin: fm.origin, insertion: fm.insertion, actions: fm.actions, synergistOverrides: fm.synergistOverrides };
    else if (fm.kind === "muscle_part")
      muscles[id] = { kind: "muscle_part", parent: fm.parent, parts: [], origin: fm.origin, insertion: fm.insertion, actions: fm.actions };
  }
  const d = derive({ muscles, pairJoints: deps.pairJoints, functionalJoints: deps.functionalJoints, antagonistPairs: deps.antagonistPairs });
  const synergists: Record<string, string[]> = {};
  const antagonists: Record<string, string[]> = {};
  const structures = new Set<string>();
  for (const id of Object.keys(muscles)) {
    synergists[id] = d.synergistsOf(id);
    antagonists[id] = d.antagonistsOf(id);
    const m = muscles[id]!;
    for (const list of [m.origin, m.insertion]) if (list !== "inherit") for (const a of list) if ("structure" in a) structures.add(a.structure);
  }
  const attached: SoftDerived["attached"] = {};
  for (const s of [...structures].sort()) attached[s] = d.attachedMuscles(s);
  return { synergists, antagonists, attached };
}

/**
 * Add the tier sets (M9 plan decision 4) to compiled layers. They need every
 * layer at once: a muscle's tier 2 uses the derived synergists, and a
 * ligament's tier 2 names cartilage (and the other way round).
 */
export function withSoftTiers(
  layers: Record<SoftLayer, SoftLayerContent>,
  deps: Pick<SoftCompileDeps, "pairJoints" | "functionalJoints"> & { patches?: Record<string, Patch> },
): Record<SoftLayer, SoftLayerContent> {
  const fm: Record<string, SoftFm> = {};
  for (const c of Object.values(layers)) for (const [id, e] of Object.entries(c.entries)) fm[id] = e.fm;
  const tiers = buildSoftTiers({ fm, synergists: layers.muscles.derived?.synergists ?? {}, pairJoints: deps.pairJoints, functionalJoints: deps.functionalJoints });
  const d = layers.muscles.derived;
  const roles = buildMuscleRoles({ fm, patches: deps.patches ?? {}, synergists: d?.synergists ?? {}, antagonists: d?.antagonists ?? {} });
  return {
    muscles: { ...layers.muscles, tiers: tiers.muscles, roles },
    ligaments: { ...layers.ligaments, tiers: tiers.ligaments },
    cartilage: { ...layers.cartilage, tiers: tiers.cartilage },
  };
}
