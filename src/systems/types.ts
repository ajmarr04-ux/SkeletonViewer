// Descriptor types (SPEC-platform §3.2, M11 plan decision 2). Plain data plus
// small pure functions. This half is the runtime one and goes in the main
// chunk, so nothing here may import zod, three.js or React. The authoring half
// (`schema`, `bodyWords`, content folder) is `content.ts` in each layer folder
// (AV); fields later milestones fill (`tiers`, `panel`, `searchFields`, the
// tree builder) are optional until then.

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
};

/** How the sidebar root is built (M12 defines and fills it). */
export type TreeSpec = Record<string, never>;

export type KindDescriptor = {
  id: string;
  /** Muscle → part: a click selects the parent first, then the part (spec §5.1). */
  parentOf?: { childKind: string; selection: "nested" };
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
  id: string;
  label: string;
  /** Mode per layer of the system; layers not named are Off. */
  modes: Readonly<Record<string, LayerMode>>;
};

export type SystemDescriptor = {
  id: string;
  label: string;
  /** Layer presets (session AW moves them here). */
  presets?: readonly PresetDescriptor[];
};

/** Keeps the literal types (`id: "muscles"`), so `LayerId` is a union the compiler checks. */
export const defineLayer = <const D extends LayerDescriptor>(d: D): D => d;
export const defineSystem = <const D extends SystemDescriptor>(d: D): D => d;
