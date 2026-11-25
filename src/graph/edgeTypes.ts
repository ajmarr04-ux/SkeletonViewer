// Lookups over a set of edge type descriptors (M12 plan decision 1). The app's
// set is the registry's (`EDGE_TYPES`, every system's `edgeTypes`); tests and
// the fixture pass their own. Names no edge type.

import type { EdgeTypeDescriptor } from "./types";

export type EdgeTypes = {
  readonly all: readonly EdgeTypeDescriptor[];
  edgeType(id: string): EdgeTypeDescriptor | undefined;
  isSymmetric(id: string): boolean;
  /**
   * A step's name for a direction: an edge type ID (forward) or an inverse
   * label (backward). Undefined for a name no type has.
   */
  byLabel(name: string): { type: EdgeTypeDescriptor; inverse: boolean } | undefined;
};

export function edgeTypeIndex(types: readonly EdgeTypeDescriptor[]): EdgeTypes {
  const byId = new Map<string, EdgeTypeDescriptor>();
  const names = new Map<string, { type: EdgeTypeDescriptor; inverse: boolean }>();
  for (const t of types) {
    if (byId.has(t.id)) throw new Error(`edge type ${t.id} is registered twice`);
    if (t.symmetric && t.inverse !== null) throw new Error(`edge type ${t.id}: a symmetric type has no inverse label`);
    byId.set(t.id, t);
  }
  for (const t of types) {
    for (const [name, inverse] of [[t.id, false], ...(t.inverse === null ? [] : [[t.inverse, true]])] as [string, boolean][]) {
      if (names.has(name)) throw new Error(`edge type name "${name}" is used twice`);
      names.set(name, { type: t, inverse });
    }
  }
  return {
    all: types,
    edgeType: (id) => byId.get(id),
    isSymmetric: (id) => byId.get(id)?.symmetric === true,
    byLabel: (name) => names.get(name),
  };
}
