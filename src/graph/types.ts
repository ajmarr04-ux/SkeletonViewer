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
