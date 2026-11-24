// The registry (SPEC-platform §3.2, M11): every system and layer, in order.
// This is the only place outside the descriptor folders where layer names are
// listed; everything else asks the registry. Main chunk: data only.

import { bones } from "./musculoskeletal/bones/layer";
import { cartilage } from "./musculoskeletal/cartilage/layer";
import { ligaments } from "./musculoskeletal/ligaments/layer";
import { muscles } from "./musculoskeletal/muscles/layer";
import { musculoskeletal } from "./musculoskeletal/system";
import type { KindDescriptor, LayerDescriptor, LayerMode, OverlaySpec, SystemDescriptor } from "./types";

/** Systems, in Layers-panel order. */
export const SYSTEMS = [musculoskeletal] as const satisfies readonly SystemDescriptor[];

/** Layers, in Layers-panel and URL order. */
export const REGISTRY = [bones, cartilage, ligaments, muscles] as const satisfies readonly LayerDescriptor[];

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

/** Does the layer have kinds whose parts are selected through their parent (muscles → parts)? */
export const hasNestedParts = (id: LayerId): boolean => layerDescriptor(id).kinds.some((k) => "parentOf" in k);
/** The most parts any structure of the layer has (one selection outline each); 0 for a layer without parts. */
export const maxPartsOf = (id: LayerId): number =>
  Math.max(0, ...(layerDescriptor(id).kinds as readonly KindDescriptor[]).map((k) => k.parentOf?.maxParts ?? 0));
/** The layer whose structures have parts (the muscles): their attachments, functional groups and antagonists. */
export const NESTED_LAYER: LazyLayerId = REGISTRY.find((l) => hasNestedParts(l.id))!.id as LazyLayerId;

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
