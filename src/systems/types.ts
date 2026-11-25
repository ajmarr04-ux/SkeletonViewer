// Descriptor types (SPEC-platform §3.2, M11 plan decision 2). Plain data plus
// small pure functions. This half is the runtime one and goes in the main
// chunk, so nothing here may import zod, three.js or React. The authoring half
// (`schema`, `bodyWords`, content folder) is `content.ts` in each layer folder
// (AV); fields later milestones fill (`tiers`, `panel`, `searchFields`, the
// tree builder) are optional until then.

import type { Graph } from "../graph/graph";
import type { EdgeTypeDescriptor, KindTiers } from "../graph/types";

export type LayerMode = "on" | "ghost" | "off";
export type Lod = "low" | "high";

/** Colours of a layer (spec §7; M14 extends this). */
export type ColourSpec = {
  /** Material colour (sRGB). */
  material: string;
  /** The colour key's entry name, when it isn't the layer's label. */
  keyLabel?: string;
  /** Flat colour in M6's debug layer view (`?debug&layers=…`). */
  debug?: string;
};

/** A model file's budget for one LOD (spec §5; M6 plan decision 8), checked by `npm run check-models`: size cap and triangle target (±15 %). */
export type ModelBudget = { maxMiB: number; targetTris: number };

/** A layer's model files (spec §6.3). */
export type ModelSpec = {
  /** File stem: `public/models/<file>-<lod>.glb`. */
  file: string;
  /** Loaded with the main chunk, before anything else (the bones); lazy layers load the first time they aren't Off. */
  eager: boolean;
  /** One file per LOD for the whole layer (M13 adds "region"). */
  chunking: "single";
  /** The build manifest, a chunk of its own fetched only by `?debug` (bounds check). */
  debugManifest?: () => Promise<unknown>;
  budgets: Readonly<Record<Lod, ModelBudget>>;
};

/** An optional peel control (muscles today): stops 0 (all) to `stops.length - 1`. */
export type DepthSpec = {
  /** The stop labels, in order. */
  stops: readonly string[];
  /** URL depth values from earlier builds, mapped to today's stops (`3` → 2). */
  legacy?: Readonly<Record<number, number>>;
};

/** Extra geometry drawn for a layer's structures (the attachment patches). */
export type OverlaySpec = {
  id: string;
  /** M6's debug-view code letter. */
  debugCode: string;
  /** File stem, like `ModelSpec.file`. */
  file: string;
  colour: { debug: string };
  /** Wanted while a structure of this layer is selected at tier 1 or 2. */
  when: "selected-tier";
  debugManifest?: () => Promise<unknown>;
  budgets: Readonly<Record<Lod, ModelBudget>>;
};

/** The two ends of a structure the tints colour (spec §5.3). */
export type TintEnd = "origin" | "insertion";
/** One attachment patch of an overlay (M6, `soft-to-id.json` `attachments`): the structures it serves, its end, the structure it lies on. */
export type Patch = { structures: readonly string[]; end: TintEnd; on: string | null };
/** One end of a structure's tints: patches drawn (`[patch ID, structure it lies on]`) and structures tinted whole. */
export type RoleSet = { p: [string, string][]; f: string[] };
export type Roles = { o: RoleSet; i: RoleSet };
/**
 * A kind's origin/insertion tints over the graph and its layer's patches
 * (M12 plan decision 8). The patch index is built once per patch list.
 */
export type RolesSpec = {
  index(patches: Readonly<Record<string, Patch>>): unknown;
  /** `index`: what `index` returned. */
  roles(graph: Graph, id: string, index: unknown): Roles;
};

/** How the sidebar root is built (M12 defines and fills it). */
export type TreeSpec = Record<string, never>;

/** A kind's subtype (a muscle part's `partType`). */
export type PartTypeSpec = {
  id: string;
  /** Drawn in the layer's lighter tendon tint (spec §6.3). */
  tendinous?: boolean;
};

export type KindDescriptor = {
  id: string;
  /** For announcements ("3 parts"). Kinds with the same noun are counted together (a tooth counts as a bone). */
  noun: { one: string; many: string };
  /**
   * Lower comes first. The layer whose kinds rank first is the labels' focus
   * layer when nothing is selected (M10 plan decision 2: the topmost layer that
   * is On); announcements count the eager layer's kinds first, then the others
   * in this order.
   */
  labelPriority: number;
  /**
   * Muscle → part: a click selects the parent first, then the part (spec §5.1); `maxParts` = the most parts any parent has (one outline each).
   * `via`: the parts are the structures with a `type` edge to the parent, except edges whose meta has `except` (M12: tier rules' parts expansion).
   */
  parentOf?: { childKind: string; selection: "nested"; maxParts: number; via: { type: string; except?: string } };
  /** Tier rules (SPEC-platform §4.3; M12 plan decision 6): `t1`, `t2`, and other sets a feature asks for (`ant`). */
  tiers?: KindTiers;
  /** The values of the entries' `partType`, in order. */
  partTypes?: readonly PartTypeSpec[];
  /** Origin and insertion tints (spec §5.3), from the graph and the layer's attachment patches. */
  roles?: RolesSpec;
};

export type LayerDescriptor = {
  id: string;
  system: string;
  /** One URL letter, stable forever (`layers=b:on,…`). */
  code: string;
  label: string;
  /** Draw order among ghost batches (0 first). */
  ghostOrder: number;
  colour: ColourSpec;
  models: ModelSpec;
  /** The layer's content chunk (virtual module name); none for a layer whose content is in the main chunk. */
  contentChunk?: string;
  defaultSetting: LayerMode;
  depth?: DepthSpec;
  overlays?: readonly OverlaySpec[];
  tree?: TreeSpec;
  kinds: readonly KindDescriptor[];
};

export type PresetDescriptor = {
  /** Stable: the button's test ID is `layers-preset-<id>`. */
  id: string;
  label: string;
  /** Announced as "<label>: <summary>." ("Skeleton: bones only."). */
  summary: string;
  /** Mode per layer; layers not named are Off. */
  modes: Readonly<Record<string, LayerMode>>;
  /** The depth layer's stop the preset sets; the depth is kept when absent. */
  depth?: number;
};

export type SystemDescriptor = {
  id: string;
  /** The Layers panel's group header ("Musculoskeletal"). */
  label: string;
  /** The system's relationship types (SPEC-platform §4.2; M12 plan decision 1). */
  edgeTypes?: readonly EdgeTypeDescriptor[];
  /** Layer presets, shown above the groups. */
  presets?: readonly PresetDescriptor[];
};

/** Keeps the literal types (`id: "muscles"`), so `LayerId` is a union the compiler checks. */
export const defineLayer = <const D extends LayerDescriptor>(d: D): D => d;
export const defineSystem = <const D extends SystemDescriptor>(d: D): D => d;
