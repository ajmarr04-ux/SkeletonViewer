// The registry (SPEC-platform §3.2, M11): every system and layer, in order.
// The list itself is `registered.ts`; this module holds the lookups everything
// else asks instead of naming a layer or kind. Main chunk: data only.

import { REGISTRY, SYSTEMS } from "./registered";
import type { Graph } from "../graph/graph";
import type { TierContext } from "../graph/query";
import { edgeTypeIndex } from "../graph/edgeTypes";
import type { EdgeTypeDescriptor, TierWording } from "../graph/types";
import type { HierarchyTreeSpec, KindDescriptor, LayerDescriptor, LayerMode, OverlaySpec, PresetDescriptor, RolesSpec, SystemDescriptor, TreeSpec } from "./types";

export { REGISTRY, SYSTEMS };

type Registered = (typeof REGISTRY)[number];
export type LayerId = Registered["id"];
/** The layers loaded the first time they aren't Off (all but the bones today). */
export type LazyLayerId = Extract<Registered, { models: { eager: false } }>["id"];
/** The layer loaded with the main chunk (the bones). */
export type EagerLayerId = Extract<Registered, { models: { eager: true } }>["id"];
/** The layer with a depth control (the muscles). */
export type DepthLayerId = Extract<Registered, { depth: object }>["id"];
export type SystemId = (typeof SYSTEMS)[number]["id"];
/** Extra geometry files drawn for a layer's structures (the attachment patches). */
export type OverlayId = Extract<Registered, { overlays: readonly unknown[] }>["overlays"][number]["id"];

type RegisteredKind = Registered["kinds"][number];
/** Every kind. */
export type KindId = RegisteredKind["id"];
/** The eager layer's kinds (`content/ids.json`: bone, tooth). */
export type EagerKind = Extract<Registered, { models: { eager: true } }>["kinds"][number]["id"];
/** The lazy layers' kinds (`content/soft-ids.json`). */
export type SoftKind = Extract<Registered, { models: { eager: false } }>["kinds"][number]["id"];
/** A muscle part's `partType`. */
export type PartType = Extract<RegisteredKind, { partTypes: unknown }>["partTypes"][number]["id"];

const BY_ID = new Map<string, LayerDescriptor>(REGISTRY.map((l) => [l.id, l]));
const BY_CODE = new Map<string, LayerDescriptor>(REGISTRY.map((l) => [l.code, l]));

/** Every layer ID, in order. */
export const LAYER_IDS: readonly LayerId[] = REGISTRY.map((l) => l.id);

export const isLayerId = (x: string): x is LayerId => BY_ID.has(x);
export const layerDescriptor = (id: LayerId): LayerDescriptor => BY_ID.get(id)!;
export const layerByCode = (code: string): LayerId | undefined => BY_CODE.get(code)?.id as LayerId | undefined;

/** The lazy layers, in order. */
export const LAZY_LAYERS: readonly LazyLayerId[] = REGISTRY.filter((l) => !l.models.eager).map((l) => l.id as LazyLayerId);
export const isLazyLayer = (id: LayerId): id is LazyLayerId => !layerDescriptor(id).models.eager;

/** The one eager layer (its structures are the main chunk's `content/ids.json`). */
export const EAGER_LAYER: EagerLayerId = REGISTRY.find((l) => l.models.eager)!.id as EagerLayerId;

/** The layer with a depth control. */
export const DEPTH_LAYER: DepthLayerId = REGISTRY.find((l) => "depth" in l)!.id as DepthLayerId;
export const depthStops = (): readonly string[] => layerDescriptor(DEPTH_LAYER).depth!.stops;

/** Each layer's default mode (the Skeleton preset). */
export const DEFAULT_MODES: Readonly<Record<LayerId, LayerMode>> = Object.fromEntries(REGISTRY.map((l) => [l.id, l.defaultSetting])) as Record<LayerId, LayerMode>;

/** Every overlay, with the layer it belongs to. */
export const OVERLAYS: readonly (OverlaySpec & { id: OverlayId; layer: LayerId })[] = REGISTRY.flatMap((l) =>
  ((l as LayerDescriptor).overlays ?? []).map((o) => ({ ...o, id: o.id as OverlayId, layer: l.id })),
);
export const isOverlayId = (x: string): x is OverlayId => OVERLAYS.some((o) => o.id === x);

/** The layer each kind belongs to. */
const KIND_LAYER = new Map<string, LayerId>(REGISTRY.flatMap((l) => l.kinds.map((k) => [k.id, l.id] as const)));
export const layerOfKind = (kind: string): LayerId | undefined => KIND_LAYER.get(kind);

const KIND = new Map<string, KindDescriptor>(REGISTRY.flatMap((l) => (l.kinds as readonly KindDescriptor[]).map((k) => [k.id, k] as const)));
export const kindDescriptor = (kind: KindId): KindDescriptor => KIND.get(kind)!;
/** A kind's origin/insertion tints (M12 plan decision 8), or undefined. */
export const rolesSpecOf = (kind: string): RolesSpec | undefined => KIND.get(kind)?.roles;

// ---------------------------------------------------------------------------
// Tier rules over the graph (M12 plan decisions 5 and 6)

/**
 * The ID index's order (`anatomical` in tier rules): the eager layer's
 * structures as its ID file lists them, then each other layer in registry
 * order, its IDs sorted. `entries` = every structure with its kind, in any order
 * apart from the eager layer's.
 */
export function indexRank(entries: readonly { id: string; kind: string }[]): (id: string) => number {
  const layerIndex = (kind: string) => LAYER_IDS.indexOf(layerOfKind(kind) ?? ("" as LayerId));
  const ordered = entries
    .map((e, i) => ({ ...e, i, l: layerIndex(e.kind) }))
    .sort((a, b) => a.l - b.l || (a.l === LAYER_IDS.indexOf(EAGER_LAYER) ? a.i - b.i : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rank = new Map(ordered.map((e, i) => [e.id, i]));
  return (id) => rank.get(id) ?? Infinity;
}

/** The tier engine's context: each structure's kind (its rules, its parts) and layer from the registry. */
export function tierContext(graph: Graph, lookup: { kindOf(id: string): string | undefined; rank(id: string): number }): TierContext {
  const partsOf = (id: string): readonly string[] => {
    const k = lookup.kindOf(id);
    const via = k === undefined ? undefined : KIND.get(k)?.parentOf?.via;
    if (!via) return [];
    return graph
      .in(id, via.type)
      .filter((e) => via.except === undefined || e.meta?.[via.except] === undefined)
      .map((e) => e.from);
  };
  return {
    graph,
    rulesOf: (id) => {
      const k = lookup.kindOf(id);
      return k === undefined ? undefined : KIND.get(k)?.tiers;
    },
    partsOf,
    kindOf: lookup.kindOf,
    layerOf: (id) => {
      const k = lookup.kindOf(id);
      return k === undefined ? undefined : layerOfKind(k);
    },
    rank: lookup.rank,
  };
}

/** Does the layer have kinds whose parts are selected through their parent (muscles → parts)? */
export const hasNestedParts = (id: LayerId): boolean => layerDescriptor(id).kinds.some((k) => "parentOf" in k);
/** The most parts any structure of the layer has (one selection outline each); 0 for a layer without parts. */
export const maxPartsOf = (id: LayerId): number =>
  Math.max(0, ...(layerDescriptor(id).kinds as readonly KindDescriptor[]).map((k) => k.parentOf?.maxParts ?? 0));
/** The layer whose structures have parts (the muscles): their attachments, functional groups and antagonists. */
export const NESTED_LAYER: LazyLayerId = REGISTRY.find((l) => hasNestedParts(l.id))!.id as LazyLayerId;

/** The lazy layers with a sidebar root of their own (M12 plan decision 10), in sidebar order: key = the layer's ID. */
export const TREE_ROOTS: readonly { key: LazyLayerId; label: string; name: string }[] = REGISTRY.flatMap((l) => {
  const t = (l as LayerDescriptor).tree as TreeSpec | undefined;
  return t && t.builder !== "hierarchy" ? [{ key: l.id as LazyLayerId, label: t.root.label, name: t.root.name, order: t.root.order }] : [];
})
  .sort((a, b) => a.order - b.order)
  .map(({ key, label, name }) => ({ key, label, name }));
/** The eager layer's tree spec (its hierarchy file and type groups). */
export const EAGER_TREE: HierarchyTreeSpec | undefined = (() => {
  const t = (layerDescriptor(EAGER_LAYER) as LayerDescriptor).tree;
  return t?.builder === "hierarchy" ? t : undefined;
})();
/** Is this a lazy layer's group key by its form (`<layer>` or `<layer>.<path>`)? Whether it exists is known once the tree has loaded. */
export const looksLikeTreeGroup = (key: string): boolean => {
  const head = key.split(".", 1)[0]!;
  return TREE_ROOTS.some((r) => r.key === head) && /^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(key);
};

/**
 * The group synonyms' own sets (content/synonyms.json `groups` with `members`): they sit under the root whose
 * tree spec says `sets`, keyed `<root>.sets.<name>`, and their members are that layer's structures with parts.
 */
export const SYNONYM_SETS: { prefix: string; memberKind: string | undefined; noun: string } = (() => {
  const l = REGISTRY.find((x) => ((x as LayerDescriptor).tree as { sets?: true } | undefined)?.sets);
  if (!l) return { prefix: "", memberKind: undefined, noun: "structure" }; // no layer holds sets: every set is an error
  const k = (l.kinds as readonly KindDescriptor[]).find((x) => x.parentOf) ?? l.kinds[0]!;
  return { prefix: `${l.id}.sets.`, memberKind: k.id, noun: k.noun.one };
})();

/** Every part type, in order (the content schema's enum). */
export const PART_TYPES: readonly PartType[] = [...KIND.values()].flatMap((k) => (k.partTypes ?? []).map((t) => t.id as PartType));
const TENDINOUS = new Set([...KIND.values()].flatMap((k) => (k.partTypes ?? []).filter((t) => t.tendinous).map((t) => t.id)));
/** Drawn in the tendon tint (tendons and aponeuroses). */
export const isTendinousType = (t: string | undefined): boolean => t !== undefined && TENDINOUS.has(t);

/** "bone" / "bones". */
export const kindNoun = (kind: KindId, n = 1): string => (n === 1 ? kindDescriptor(kind).noun.one : kindDescriptor(kind).noun.many);
const byPriority = (a: KindDescriptor, b: KindDescriptor) => a.labelPriority - b.labelPriority;
/** The kind a structure is counted as: the first kind with its noun (a tooth counts as a bone). */
const COUNT_AS = new Map([...KIND.values()].map((k) => [k.id, [...KIND.values()].find((o) => o.noun.one === k.noun.one)!.id as KindId]));
export const countKind = (kind: KindId): KindId => COUNT_AS.get(kind)!;
/** The counted kinds in announcement order: the eager layer's first, then the others by `labelPriority`. */
export const COUNT_ORDER: readonly KindId[] = [
  ...(layerDescriptor(EAGER_LAYER).kinds as readonly KindDescriptor[]),
  ...[...KIND.values()].filter((k) => layerOfKind(k.id) !== EAGER_LAYER).sort(byPriority),
]
  .map((k) => k.id as KindId)
  .filter((k) => countKind(k) === k);

/** What `t1` and `t2` are called for a kind whose rules don't say (the fixture's widgets). */
const DEFAULT_WORDING: Readonly<Record<string, TierWording>> = {
  t1: { label: "related structures", button: { text: "Show related", title: "Show the related structures", shown: "Shown" } },
  t2: { label: "region", button: { text: "Expand region", title: "Show the surrounding region", shown: "Shown" } },
};
/** A kind's tier wording (M12 plan decision 12: announcements and the panel's tier buttons); `t1`/`t2` fall back to a generic wording, any other tier is undefined without its own. */
export const tierWording = (kind: string, tier: string): TierWording | undefined => KIND.get(kind)?.tiers?.[tier]?.wording ?? DEFAULT_WORDING[tier];
/** Whether a kind has a tier rule by this name (`ant`: the antagonist toggle). */
export const hasTier = (kind: string, tier: string): boolean => KIND.get(kind)?.tiers?.[tier] !== undefined;
const CHILD_KINDS = new Set([...KIND.values()].flatMap((k) => (k.parentOf ? [k.parentOf.childKind] : [])));
/** What a tier's set is counted as: the first kind (by `labelPriority`) with the rule that isn't a part kind (parts count as their parent: the antagonists are "4 muscles"). */
export function tierCountKind(tier: string): KindId | undefined {
  const k = [...KIND.values()].filter((x) => x.tiers?.[tier] !== undefined && !CHILD_KINDS.has(x.id)).sort(byPriority)[0];
  return k ? countKind(k.id as KindId) : undefined;
}
/** What the depth stops peel, counted: the depth layer's first kind by `labelPriority` ("41 muscles"). */
export const depthKind = (): KindId => countKind(([...layerDescriptor(DEPTH_LAYER).kinds] as KindDescriptor[]).sort(byPriority)[0]!.id as KindId);

/** Layers in label order: the topmost first (the labels' focus layer when nothing is selected). */
const layerRank = (l: LayerDescriptor) => Math.min(...l.kinds.map((k) => k.labelPriority));
export const LABEL_ORDER: readonly LayerId[] = [...REGISTRY].sort((a, b) => layerRank(a) - layerRank(b)).map((l) => l.id);

/** The layer's name in the Layers panel, announcements and badges ("Muscles"). */
export const layerLabel = (id: LayerId): string => layerDescriptor(id).label;
/** The layer's material colour (sRGB). */
export const layerColour = (id: LayerId): string => layerDescriptor(id).colour.material;

/** A layer's or overlay's debug facts by file name (`?debug` bounds and M6's debug view): its build manifest and flat colour. */
export function debugFacts(name: string): { manifest?: () => Promise<unknown>; colour?: string } | undefined {
  const l = BY_ID.get(name);
  if (l) return { manifest: l.models.debugManifest, colour: l.colour.debug };
  const o = OVERLAYS.find((x) => x.id === name);
  return o && { manifest: o.debugManifest, colour: o.colour.debug };
}

/** M6's debug-view codes (`layers=m,l,c,a`): each layer's URL code and each overlay's debug code → its name. */
export const DEBUG_CODES: ReadonlyMap<string, string> = new Map([...REGISTRY.map((l) => [l.code, l.id] as const), ...OVERLAYS.map((o) => [o.debugCode, o.id] as const)]);

// ---------------------------------------------------------------------------
// Systems and presets (the Layers panel's groups; M11 plan decision 5)

/** The layers of a system, in registry order. */
export const layersOfSystem = (system: SystemId): readonly LayerId[] => REGISTRY.filter((l) => l.system === system).map((l) => l.id);
/** Every system's edge types, in system order (M12 plan decision 1). */
export const EDGE_TYPES: readonly EdgeTypeDescriptor[] = SYSTEMS.flatMap((s): readonly EdgeTypeDescriptor[] => ("edgeTypes" in s ? s.edgeTypes : []));

/** The edge type IDs a layer's panels read (its kinds' sections: links, groups, exclusions). */
export function panelEdgeTypes(id: LayerId): ReadonlySet<string> {
  const index = edgeTypeIndex(EDGE_TYPES);
  const names = layerDescriptor(id).kinds.flatMap((k) =>
    (k.panel ?? []).flatMap((s) => {
      if (s.render === "links") return [...(typeof s.edges === "string" ? [s.edges] : s.edges), ...(s.also ? [s.also.edges] : []), ...(s.exclude ? [s.exclude] : [])];
      if (s.render === "grouped-links") return s.groups.map((g) => g.edges);
      return [];
    }),
  );
  return new Set(names.map((n) => index.byLabel(n)!.type.id));
}

export const systemDescriptor = (system: SystemId): SystemDescriptor => SYSTEMS.find((s) => s.id === system)!;

/** The system's layers all in one mode, or "mixed" when they differ. */
export function systemMode(system: SystemId, modes: Readonly<Record<LayerId, LayerMode>>): LayerMode | "mixed" {
  const [first, ...rest] = layersOfSystem(system).map((l) => modes[l]);
  return first !== undefined && rest.every((m) => m === first) ? first : "mixed";
}

type RegisteredPreset = (typeof SYSTEMS)[number]["presets"][number];
export type PresetId = RegisteredPreset["id"];
/** Every system's presets, in order (the buttons above the groups). */
export const PRESETS: readonly (PresetDescriptor & { id: PresetId })[] = SYSTEMS.flatMap((s) => s.presets);

/** The modes a preset sets: the layers it names, every other layer Off. */
export function presetModes(id: PresetId): Record<LayerId, LayerMode> {
  const p = PRESETS.find((x) => x.id === id)!;
  return Object.fromEntries(LAYER_IDS.map((l) => [l, p.modes[l] ?? "off"])) as Record<LayerId, LayerMode>;
}
export const presetDescriptor = (id: PresetId): PresetDescriptor => PRESETS.find((x) => x.id === id)!;

/** The first preset the layers match, if any. */
export function presetOf(modes: Readonly<Record<LayerId, LayerMode>>): PresetId | null {
  for (const p of PRESETS) {
    const want = presetModes(p.id);
    if (LAYER_IDS.every((l) => modes[l] === want[l])) return p.id;
  }
  return null;
}
