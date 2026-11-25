// File access for the content scripts: the ID list, content/bones/*.md and the
// model node names; the soft-tissue folders (M8). The rules themselves are in
// src/content/validate.ts and softValidate.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontMatter } from "../../src/content/frontmatter";
import { oppositeOf } from "../../src/content/placeholder";
import { encodeEdges, type EdgeWire } from "../../src/graph/codec";
import { shipEdges } from "../../src/graph/ship";
import type { Edge } from "../../src/graph/types";
import { compileSoftLayer, withShipped, type SoftCompileDeps, type SoftLayerContent } from "../../src/content/softCompile";
import type { SoftIdEntry } from "../../src/content/softValidate";
import type { IdEntry } from "../../src/content/validate";
import { EAGER_LAYER, EDGE_TYPES, LAZY_LAYERS, layerOfKind, panelEdgeTypes, type LazyLayerId } from "../../src/systems/registry";
import { compileContentGraph, contentFolder, layerContent } from "../../src/systems/registry.content";
import type { Patch } from "../../src/systems/types";

export const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
/** The eager layer's content folder (content/bones). */
export const bonesDir = join(root, "content", contentFolder(EAGER_LAYER));

export const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(root, rel), "utf8"));
export const readIds = (): IdEntry[] => readJson("content/ids.json") as IdEntry[];

/** content/bones/<name>.md, by name. */
export function readContentFiles(): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(bonesDir)) return out;
  for (const f of readdirSync(bonesDir).sort()) if (f.endsWith(".md")) out.set(f.slice(0, -3), readFileSync(join(bonesDir, f), "utf8"));
  return out;
}

/** Names of the scene's top-level nodes in a .glb, read from its JSON chunk (no decoding needed). */
export function glbNodeNames(file: string): string[] {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a .glb`);
  const len = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${file}: first chunk isn't JSON`);
  const gltf = JSON.parse(buf.subarray(20, 20 + len).toString("utf8")) as {
    scene?: number;
    scenes: { nodes?: number[] }[];
    nodes: { name?: string }[];
  };
  const scene = gltf.scenes[gltf.scene ?? 0]!;
  return (scene.nodes ?? []).map((i) => gltf.nodes[i]!.name ?? "").filter((n) => n !== "");
}

// --- Soft-tissue content (M8 plan decision 1) ---

export const softDir = (layer: LazyLayerId): string => join(root, "content", contentFolder(layer));
export const readSoftIds = (): SoftIdEntry[] => readJson("content/soft-ids.json") as SoftIdEntry[];

/** content/<layer folder>/<name>.md, by layer and name. */
export function readSoftFiles(): Record<LazyLayerId, Map<string, string>> {
  const out = {} as Record<LazyLayerId, Map<string, string>>;
  for (const layer of LAZY_LAYERS) {
    const m = new Map<string, string>();
    const dir = softDir(layer);
    if (existsSync(dir)) for (const f of readdirSync(dir).sort()) if (f.endsWith(".md")) m.set(f.slice(0, -3), readFileSync(join(dir, f), "utf8"));
    out[layer] = m;
  }
  return out;
}

/** Bone ID → landmark IDs from the bone content files (files that don't parse are skipped; validate-content reports them). */
export function readBoneLandmarks(files: Map<string, string> = readContentFiles()): Map<string, ReadonlySet<string>> {
  const out = new Map<string, ReadonlySet<string>>();
  for (const [name, text] of files) {
    try {
      const data = splitFrontMatter(text).data as { landmarks?: { id: string }[] };
      out.set(name, new Set((data.landmarks ?? []).map((l) => l.id)));
    } catch {
      /* reported by validate-content */
    }
  }
  return out;
}

/**
 * The opposite side's ID for a bone (ids.json), a soft-tissue structure
 * (soft-ids.json) or a joint (articulations.json, joints.json), else null.
 */
export function makeOpposite(soft: SoftIdEntry[] = readSoftIds()): (id: string) => string | null {
  const bySide = new Map<string, string>(soft.map((e) => [e.id, e.side]));
  const joints = [
    ...(readJson("content/articulations.json") as { joint: string }[]).map((a) => a.joint),
    ...(readJson("content/joints.json") as { id: string }[]).map((j) => j.id),
  ];
  for (const j of joints) {
    const m = /_(left|right)$/.exec(j);
    if (m) bySide.set(j, m[1]!);
  }
  return (id) => {
    const bone = oppositeOf(id);
    if (bone !== null) return bone;
    const side = bySide.get(id);
    if (side !== "left" && side !== "right") return null;
    const other = side === "left" ? id.replace(/_left$/, "_right") : id.replace(/_right$/, "_left");
    return other !== id && bySide.get(other) === (side === "left" ? "right" : "left") ? other : null;
  };
}

/** Every structure's ID and kind (ids.json, soft-ids.json). */
const readStructures = () => [...readIds(), ...readSoftIds()].map((e) => ({ id: e.id, kind: e.kind }));

function softDeps(): SoftCompileDeps {
  const kinds = new Map(readSoftIds().map((e) => [e.id, e.kind]));
  const structures = readStructures();
  return {
    kindOf: (id) => kinds.get(id),
    pairJoints: (readJson("content/articulations.json") as { joint: string }[]).map((a) => a.joint),
    functionalJoints: Object.fromEntries((readJson("content/joints.json") as { id: string; articulations: string[] }[]).map((j) => [j.id, j.articulations])),
    graph: (fm) => compileContentGraph({ fm, structures, readJson }),
  };
}

/** One layer's compiled soft-tissue content, read from disk (`npm run content`, the scripts and tests). No tier sets. */
export function compileSoftFromDisk(layer: LazyLayerId, files = readSoftFiles()[layer]): SoftLayerContent {
  return compileSoftLayer(layer, files, softDeps());
}

/** Every joint's name: the articulation pairs (articulations.json) and the functional joints (joints.json). */
export function readJointNames(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of readJson("content/articulations.json") as { joint: string; name: string }[]) out[a.joint] = a.name;
  for (const j of readJson("content/joints.json") as { id: string; name: string }[]) out[j.id] = j.name;
  return out;
}

/** The attachment patches (M6) of every lazy layer whose content half names them (M9 plan decision 6), by layer. */
export function readLayerPatches(): Partial<Record<LazyLayerId, Record<string, Patch>>> {
  const out: Partial<Record<LazyLayerId, Record<string, Patch>>> = {};
  for (const l of LAZY_LAYERS) {
    const read = layerContent(l).patches;
    if (read) out[l] = read(readJson);
  }
  return out;
}

/** Every layer's attachment patches, together (patch IDs are unique across layers). */
export const readPatches = (): Record<string, Patch> => Object.assign({}, ...Object.values(readLayerPatches())) as Record<string, Patch>;

/** The edges each chunk ships (M12 plan decision 3): the eager layer's in the main chunk, each lazy layer's (and its reverse index) in its own. */
export function shippedEdges(edges: readonly Edge[]): Record<string, Edge[]> {
  const layers = new Map(readStructures().map((e) => [e.id, layerOfKind(e.kind)]));
  const symmetric = new Set(EDGE_TYPES.filter((t) => t.symmetric).map((t) => t.id));
  return shipEdges(edges, { eager: EAGER_LAYER, lazy: LAZY_LAYERS, layerOf: (id) => layers.get(id), isSymmetric: (t) => symmetric.has(t) });
}

/** Every layer compiled, with what each lazy chunk ships besides its entries: edges, patches, joint names (M12 plan decisions 3 and 8). */
export function compileAllSoftFromDisk(files = readSoftFiles()): Record<LazyLayerId, SoftLayerContent> {
  const deps = softDeps();
  const layers = Object.fromEntries(LAZY_LAYERS.map((l) => [l, compileSoftLayer(l, files[l], deps)])) as Record<LazyLayerId, SoftLayerContent>;
  const shipped = shippedEdges(compileGraphFromDisk(layers).edges);
  const edges = Object.fromEntries(LAZY_LAYERS.map((l) => [l, encodeEdges(shipped[l] ?? [])])) as Record<LazyLayerId, EdgeWire>;
  return withShipped(layers, { edges, patches: readLayerPatches(), jointNames: readJointNames() });
}

/** The edges the main chunk ships (the eager layer's, and those between non-structure nodes), encoded. */
export function readEagerEdges(): EdgeWire {
  const layers = Object.fromEntries(LAZY_LAYERS.map((l) => [l, compileSoftFromDisk(l)])) as Record<LazyLayerId, SoftLayerContent>;
  return encodeEdges(shippedEdges(compileGraphFromDisk(layers).edges)[EAGER_LAYER] ?? []);
}

/**
 * The edges the eager layer's content chunk ships (M12 BD): those between it
 * and a lazy layer, of the types its kinds' panels read (a bone's attached
 * muscles), so its panel needs no lazy chunk. Registered when the chunk loads.
 */
export function readEagerContentEdges(): EdgeWire {
  const layers = Object.fromEntries(LAZY_LAYERS.map((l) => [l, compileSoftFromDisk(l)])) as Record<LazyLayerId, SoftLayerContent>;
  const types = panelEdgeTypes(EAGER_LAYER);
  const eager = new Set(readStructures().filter((e) => layerOfKind(e.kind) === EAGER_LAYER).map((e) => e.id));
  const known = new Set(readStructures().map((e) => e.id));
  const lazy = (id: string) => known.has(id) && !eager.has(id);
  return encodeEdges(compileGraphFromDisk(layers).edges.filter((e) => types.has(e.type) && ((eager.has(e.to) && lazy(e.from)) || (eager.has(e.from) && lazy(e.to)))));
}

/**
 * The relationship graph from the files on disk (M12 plan decision 1): the
 * soft-tissue front matter as compiled (every layer, or the layers given), the
 * ID tables and the system's JSON sources. `errors` lists every edge the
 * compiler refused.
 */
export function compileGraphFromDisk(layers: Partial<Record<LazyLayerId, SoftLayerContent>> = compileAllSoftFromDisk()) {
  const fm: Record<string, unknown> = {};
  for (const c of Object.values(layers)) for (const [id, e] of Object.entries(c!.entries)) fm[id] = e.fm;
  return compileContentGraph({ fm, structures: readStructures(), readJson });
}
