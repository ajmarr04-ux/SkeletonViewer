// The soft tree's lazy chunk (M9 plan decision 11): fetched the first time a
// Muscles, Ligaments or Cartilage root is opened, a soft group is isolated or
// linked (`grp=muscles.…`), or a soft search result needs its group. Loading
// it registers the tree and its groups with `groups.ts`.
import { registerSoftTree, softTree } from "./groups";

let pending: Promise<void> | null = null;

export function loadSoftTree(): Promise<void> {
  if (softTree()) return Promise.resolve();
  pending ??= import("virtual:skeleton-soft-tree").then((m) => registerSoftTree(m.default));
  return pending;
}
