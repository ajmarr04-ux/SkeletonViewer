// The lazy trees (M9 plan decision 11; one chunk per system since M14 plan
// decision 6, `virtual:skeleton-tree-<system>`): a system's chunk is fetched the
// first time one of its lazy roots is opened, one of its groups is isolated or
// linked (`grp=muscles.…`), or a search result or selection needs its branch.
// Loading it registers its roots and groups with `groups.ts`.
import importers from "virtual:skeleton-tree-importers";
import { TREE_SYSTEMS, treeSystemOf } from "../systems/registry";
import { registerSoftTree, treeLoaded } from "./groups";

const pending = new Map<string, Promise<void>>();

/** Load one system's lazy tree (nothing for a system without lazy roots). */
export function loadTree(system: string): Promise<void> {
  const load = importers[system];
  if (!load || treeLoaded(system)) return Promise.resolve();
  let p = pending.get(system);
  if (!p) {
    p = load().then((m) => registerSoftTree(m.default));
    // A failed fetch can be retried by the next caller.
    p.catch(() => pending.delete(system));
    pending.set(system, p);
  }
  return p;
}

/** Load the tree that holds a lazy group key (`muscles.upper_limb`); nothing for any other key. */
export function loadTreeOf(key: string): Promise<void> {
  const system = treeSystemOf(key);
  return system === undefined ? Promise.resolve() : loadTree(system);
}

/** Every system's lazy tree (the golden harness; a structure whose system isn't known by its key). */
export function loadSoftTree(): Promise<void> {
  return Promise.all(TREE_SYSTEMS.map((s) => loadTree(s.id))).then(() => undefined);
}
