// The registry (SPEC-platform §3.2, M11): every system and layer, in order.
// This is the only place outside the descriptor folders where layer names are
// listed; everything else asks the registry. Main chunk: data only.

import { bones } from "./musculoskeletal/bones/layer";
import { cartilage } from "./musculoskeletal/cartilage/layer";
import { ligaments } from "./musculoskeletal/ligaments/layer";
import { muscles } from "./musculoskeletal/muscles/layer";
import { musculoskeletal } from "./musculoskeletal/system";
import type { LayerDescriptor, LayerMode, OverlaySpec, SystemDescriptor } from "./types";

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
export const OVERLAYS: readonly (OverlaySpec & { layer: LayerId })[] = REGISTRY.flatMap((l) =>
  ((l as LayerDescriptor).overlays ?? []).map((o) => ({ ...o, layer: l.id })),
);

/** The layer each kind belongs to. */
const KIND_LAYER = new Map<string, LayerId>(REGISTRY.flatMap((l) => l.kinds.map((k) => [k.id, l.id] as const)));
export const layerOfKind = (kind: string): LayerId | undefined => KIND_LAYER.get(kind);

/** The layer whose kinds have parts selected through their parent (muscles → parts), or false. */
export const hasNestedParts = (id: LayerId): boolean => layerDescriptor(id).kinds.some((k) => k.parentOf !== undefined);

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
