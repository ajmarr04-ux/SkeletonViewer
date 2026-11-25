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

// --- Info panel (SPEC-platform §5.1; M12 plan decision 11) ---

/** What every section has: its heading, the test ID the e2e specs select it by, and what it says when empty. */
type SectionBase = {
  title: string;
  /** `data-testid` of the section (the e2e specs select by it). */
  testId: string;
  /** Shown when the section has nothing (its file is written). "Not written yet" covers an unwritten file. */
  empty?: string;
};

/** How a links section orders its targets. */
export type LinksOrder =
  /** As the edges were written (an edge type's own order). */
  | "written"
  /** Sorted by ID. */
  | "id"
  /** Sorted by the label's name, then side, then ID (the bone's attached muscles). */
  | "name";

export type PanelSection = SectionBase &
  (
    | {
        render: "text";
        /** A field of the structure's content record. */
        field: string;
        /** `html`: compiled Markdown; `prose`: a paragraph; `line`: a short fact (an innervation). */
        format: "html" | "prose" | "line";
        /** While the field is empty, the parent's (a part's innervation), marked as inherited. */
        inherit?: "parent";
      }
    | {
        render: "list";
        field: string;
        /** Shown inline (the landmarks). */
        inline?: boolean;
        /** A count field shown with the list (the landmarks with a 3D position). */
        count?: string;
      }
    | {
        render: "links";
        /** Edge type IDs (forward), inverse labels (backward) or symmetric types. */
        edges: string | readonly string[];
        order?: LinksOrder;
        /** Leave out the targets of these step names (an antagonist that is also a synergist, M9 plan decision 7). */
        exclude?: string;
        /** Leave out edges whose meta has this key (a part's `also`). */
        exceptMeta?: string;
        /** Each link's detail: the name of the graph node in this meta key (an articulation's joint). */
        detail?: { meta: string };
        /** Hovering a link highlights the pair (the joint highlight). */
        highlight?: "pair";
        /** A second list under its own heading in the same section, whose targets leave the first (the neighbouring teeth). */
        also?: { title: string; edges: string };
        /** The target's name only, no link (a structure's joint, which isn't a structure). */
        nameOnly?: true;
        /** Left out of the panel while empty (a muscle without parts). */
        omitEmpty?: true;
        /** Empty ("Not written yet") while the structure's own file isn't written. */
        needsContent?: true;
      }
    | {
        render: "grouped-links";
        /** One group per edge name, in this order. */
        groups: readonly { edges: string; title: string; testId: string; role: string }[];
        /** Leave out edges whose meta has this key (a part's inherited attachments). */
        exceptMeta?: string;
        order?: LinksOrder;
        needsContent?: true;
      }
    | {
        render: "actions-table";
        /** The content field holding `{ joint, movement, role }` rows. */
        field: string;
        /** Role labels ("prime" → "prime mover"). */
        roles: Readonly<Record<string, string>>;
        /** A part's rows its own don't replace, from its parent (same joint and movement replace). */
        inherit?: "parent";
        /** A list field shown when there are no rows (spec §4.3). */
        fallback?: string;
      }
    | {
        /** The escape hatch (at most two uses; M12 plan decision 11): `component` names the view, `model` builds its data. */
        render: "custom";
        component: string;
        model(ctx: PanelContext): unknown;
      }
  );

/** What a kind's panel functions read: the structure, its content record, the layer's records and the graph. */
export type PanelContext = {
  id: string;
  name: string;
  kind: string;
  layer: string;
  side: "left" | "right" | "midline";
  /** The structure's parent (a part's muscle), if any. */
  parent: string | null;
  partType: string | null;
  /** The structure's content record (front matter plus compiled fields), or undefined while unwritten or unloaded. */
  record: Readonly<Record<string, unknown>> | undefined;
  /** Another structure's record from the same layer's content. */
  recordOf(id: string): Readonly<Record<string, unknown>> | undefined;
  /** A structure's (or graph node's) name. */
  nameOf(id: string): string;
  /** A link to a structure, labelled under this one (side only when it differs). */
  link(id: string): { id: string; label: string };
  /** A landmark's written name on a structure (from that structure's layer content), if loaded. */
  landmarkName(structure: string, landmark: string): string | undefined;
  /** A graph node's name (a joint), else the ID in words. */
  nodeName(id: string): string;
};

/** Everything around the sections (spec §7): read from the kind instead of `if (kind === …)`. */
export type PanelChrome = {
  /** The line under the title when there is no Latin name. */
  typeLine(ctx: PanelContext): string;
  /** The classification badges, without the draft badge. */
  badges(ctx: PanelContext): readonly string[];
  /** The draft badge: always, or while the file says `reviewed: false` (or is unwritten). */
  draft: "always" | "unreviewed";
  /** The breadcrumb, and (kinds that can have a parent) which crumb names it, one level up, or null. */
  trail(ctx: PanelContext): { trail: string[]; parentCrumb?: number | null };
  /** Shown instead of the 3D view's Hide for a structure without a mesh (the wisdom teeth). */
  noModelNote?: string;
  /** The "Part of" line under the title. */
  partOf?: true;
  /** The common name: always (a placeholder while unwritten) or only when the file names one. */
  common: "always" | "when-written";
  /** While the file is unwritten: every section with its placeholder, or the first only. */
  unwritten: "all-sections" | "first-section";
};

/** How the sidebar root is built (M12 defines and fills it). */
export type TreeSpec = Record<string, never>;

/** A kind's subtype (a muscle part's `partType`). */
export type PartTypeSpec = {
  id: string;
  /** In the type badge ("Muscle part: head"). */
  label: string;
  /** Drawn in the layer's lighter tendon tint (spec §6.3). */
  tendinous?: boolean;
};

export type KindDescriptor = {
  id: string;
  /** Its type badge ("Ligament", "Intervertebral disc"). */
  label: string;
  /** False where the name says the side already (teeth: "Upper right first molar"). */
  sideInName?: false;
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
  /** The info panel's sections in render order (M12 plan decision 11). */
  panel?: readonly PanelSection[];
  /** Everything else in the panel. */
  chrome?: PanelChrome;
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
