// The app's relationship graph (SPEC-platform §4.5; M12 plan decisions 3 and
// 8): one runtime graph for the whole app, in the main chunk. The eager
// layer's edges come with the ID index (src/content/indexData.ts hands them
// over) and are added on first use, so bone tiers are synchronous; each lazy
// layer's content chunk adds its own edges (and its reverse index) when it
// loads (`registerLayerEdges`, called by softContentLoader.ts). Until then a
// soft structure has no tiers ("Loading content…") and a bone gains nothing
// from that layer, which is right: its content is requested with the layer.
//
// Tiers come from the tier engine over the kinds' rules (src/graph/query.ts);
// the tints' origins and insertions from the kinds' `roles` (decision 8) and
// the antagonists from their `ant` rule. Replaces M9's relations.ts,
// softTiers.ts, softRelations.ts and softRoles.ts.

import { useSyncExternalStore } from "react";
import ids from "../../content/ids.json";
import { decodeEdges, type EdgeWire } from "../graph/codec";
import { createGraph, type Graph } from "../graph/graph";
import { tierEngine, type TierEngine } from "../graph/query";
import { EAGER_LAYER, EDGE_TYPES, indexRank, rolesSpecOf, tierContext, type LayerId } from "../systems/registry";
import type { Patch, Roles, RolesSpec } from "../systems/types";
import { eagerEdges, lazyEntries, lazyEntry, layerOfId } from "./index";

/** A structure's tints: origin and insertion (patches and whole-structure fallbacks) and its antagonists (spec §5.3). */
export type TintRoles = Roles & { ant: readonly string[] };

const EAGER_KIND = new Map((ids as { id: string; kind: string }[]).map((e) => [e.id, e.kind]));
const kindOf = (id: string): string | undefined => EAGER_KIND.get(id) ?? lazyEntry(id)?.kind;

let graph: Graph | null = null;
let engine: TierEngine | null = null;
const loaded = new Set<string>();
const patches = new Map<string, Readonly<Record<string, Patch>>>();
const patchIndexes = new Map<string, Map<RolesSpec, unknown>>();
let rolesMemo = new Map<string, TintRoles | undefined>();
let rolesVersion = -1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** The app's graph (created, with the eager layer's edges, on first use). */
export function appGraph(): Graph {
  if (!graph) {
    graph = createGraph(EDGE_TYPES);
    graph.subscribe(notify);
    loaded.add(EAGER_LAYER);
    graph.add(EAGER_LAYER, decodeEdges(eagerEdges()));
  }
  return graph;
}

/** The tier engine over the app's graph. */
export function tiers(): TierEngine {
  if (!engine) {
    const g = appGraph();
    const rank = indexRank([...(ids as { id: string; kind: string }[]), ...lazyEntries()]);
    engine = tierEngine(tierContext(g, { kindOf, rank }));
  }
  return engine;
}

/** Called when a layer's content chunk loads: its patches (if any), then its edges. Idempotent per layer. */
export function registerLayerEdges(layer: string, content: { edges?: EdgeWire; patches?: Readonly<Record<string, Patch>> }): void {
  const g = appGraph();
  if (loaded.has(layer)) return;
  loaded.add(layer);
  if (content.patches) patches.set(layer, content.patches);
  g.add(layer, content.edges ? decodeEdges(content.edges) : []);
}

/** For tests: forget every lazy layer's edges and patches. */
export function resetAppGraph(): void {
  graph = null;
  engine = null;
  loaded.clear();
  patches.clear();
  patchIndexes.clear();
  rolesMemo = new Map();
  rolesVersion = -1;
  notify();
}

/** Has the layer's content (its edges) loaded? Always true for the eager layer. */
export const layerEdgesLoaded = (layer: LayerId | null): boolean => layer !== null && (layer === EAGER_LAYER || loaded.has(layer));

/** Has the structure's own layer content loaded (so its tiers are complete)? */
export const structureLoaded = (id: string): boolean => layerEdgesLoaded(layerOfId(id));

/**
 * A structure's tints (origin, insertion, antagonists) once its layer has
 * loaded, for a kind with `roles`; else undefined (a bone, a ligament).
 */
export function rolesOf(id: string): TintRoles | undefined {
  const g = appGraph();
  if (rolesVersion !== g.version) {
    rolesVersion = g.version;
    rolesMemo = new Map();
  }
  if (rolesMemo.has(id)) return rolesMemo.get(id);
  const kind = kindOf(id);
  const spec = kind === undefined ? undefined : rolesSpecOf(kind);
  const layer = layerOfId(id);
  let out: TintRoles | undefined;
  if (spec && layer !== null && loaded.has(layer)) {
    let byLayer = patchIndexes.get(layer);
    if (!byLayer) patchIndexes.set(layer, (byLayer = new Map()));
    if (!byLayer.has(spec)) byLayer.set(spec, spec.index(patches.get(layer) ?? {}));
    out = { ...spec.roles(g, id, byLayer.get(spec)), ant: tiers().evaluate(id, "ant") ?? [] };
  }
  rolesMemo.set(id, out);
  return out;
}

export const graphVersion = (): number => appGraph().version;
export function subscribeGraph(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-render when a layer's edges arrive. */
export const useGraphVersion = (): number => useSyncExternalStore(subscribeGraph, graphVersion);
