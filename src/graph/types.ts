// The relationship graph's types (SPEC-platform §4.1–4.2; M12 plan decision 1).
// Generic: nothing here names a system, layer, kind or edge type. The edge
// types themselves are descriptors, declared by each system
// (`SystemDescriptor.edgeTypes`) and listed by the registry.

/** One relationship, compiled at build time from the authoring files (spec §4.1). */
export type Edge = {
  from: string;
  /** An edge type's `id`. */
  type: string;
  to: string;
  /** Small string facts about the relationship (an articulation's joint, an action's movement and role). */
  meta?: Readonly<Record<string, string>>;
};

export type EdgeTypeDescriptor = {
  /** Stable: tier rules and panel sections name it. */
  id: string;
  /** The forward label ("part of"). */
  label: string;
  /** The label read backwards ("has part"), which a tier step may follow; null for a symmetric type or one never followed backwards. */
  inverse: string | null;
  /** Stored once per pair, as `from < to`, and read from either end. */
  symmetric: boolean;
  /** Computed by a rule from other edges (spec §4.4); never written by an authoring file. */
  derived?: boolean;
};

/** A graph node that isn't a structure (a joint): named so the endpoint check passes and a panel can show it. */
export type GraphNode = { id: string; node: string; name: string };

// --- Tier rules (SPEC-platform §4.3; M12 plan decisions 5 and 6) ---

/**
 * How a step lists each source's targets: `id` sorted by ID; `anatomical` in
 * the ID index's order (the eager layer as its ID file is written, then each
 * other layer in registry order, IDs sorted); `written` as the edges were
 * written.
 */
export type TierOrder = "id" | "anatomical" | "written";

/** Where a `follow` step starts. */
export type TierFrom =
  /** The structure itself (default). */
  | "self"
  /** The structure and its parts. */
  | "self+parts"
  /** What the step before it gave. */
  | "previous"
  /** The structure and everything the steps before it gave. */
  | "result";

export type TierStep =
  /** The structure itself (removed from the final result; a source for the next step). */
  | { self: true }
  | {
      /** Edge type IDs (forward), inverse labels (backward) or symmetric types. */
      follow: string | readonly string[];
      from?: TierFrom;
      /** Each source's targets in this order, source by source (default `written`). */
      order?: TierOrder;
      /** Leave out what these step names reach from the structure (with their parts). */
      exclude?: string | readonly string[];
    }
  /** Another tier of the same kind, evaluated in full. */
  | { tier: string }
  /** Keep only what matches, of everything so far. */
  | { filter: { kind?: readonly string[]; layer?: readonly string[] } };

/** What a tier is called (M12 plan decision 12): in announcements, and on its button in the info panel. */
export type TierWording = {
  /** "<name>: <label> shown, …" ("attachments", "functional group", "related bones"); a feature's set its own heading ("Antagonists"). */
  label: string;
  /** The button that shows the set: its text, its title while it can be pressed, and its title once the set is shown. */
  button: { text: string; title: string; shown: string };
};

export type TierRule = {
  steps: readonly TierStep[];
  /** Its wording (announcements and the panel's tier buttons). */
  wording?: TierWording;
  /** Sort what the rule adds itself (everything after its `tier` steps' results) in this order. */
  order?: TierOrder;
  /** A structure with parts in the result: followed by its parts (`with`, default) or replaced by them (`instead`). */
  parts?: "with" | "instead";
  /** The tier exists only for a structure with an edge along this step name (a ligament's tier 2 needs a joint). */
  requires?: string;
};

/** A kind's tiers by name (`t1`, `t2`, and any other set a feature asks for, such as `ant`). */
export type KindTiers = Readonly<Record<string, TierRule>>;
