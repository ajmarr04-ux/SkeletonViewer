// File access for the content scripts: the ID list, content/bones/*.md and the
// model node names; the soft-tissue folders (M8). The rules themselves are in
// src/content/validate.ts and softValidate.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boneAttachedRows, type BoneAttachedRows } from "../../src/content/compile";
import { splitFrontMatter } from "../../src/content/frontmatter";
import { oppositeOf } from "../../src/content/placeholder";
import type { Patch } from "../../src/content/softRoles";
import { compileSoftLayer, withSoftTiers, type SoftCompileDeps, type SoftLayerContent } from "../../src/content/softCompile";
import type { SoftIdEntry } from "../../src/content/softValidate";
import type { IdEntry } from "../../src/content/validate";
import { EAGER_LAYER, LAZY_LAYERS, NESTED_LAYER, type LazyLayerId } from "../../src/systems/registry";
import { compileContentGraph } from "../../src/systems/registry.content";
import { contentFolder } from "../../src/systems/registry.content";

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

/** The attachment patches (M6) as `soft-to-id.json` maps them (M9 plan decision 6). */
export function readPatches(): Record<string, Patch> {
  const raw = readJson("assets/mapping/soft-to-id.json") as { attachments: Record<string, { structures: string[]; end: Patch["end"]; on?: string | null }> };
  return Object.fromEntries(Object.entries(raw.attachments).map(([id, p]) => [id, { structures: p.structures, end: p.end, on: p.on ?? null }]));
}

/** Every layer compiled, with the tier sets and the muscles' roles (M9 plan decisions 4, 6, 7): what the lazy chunks ship. */
export function compileAllSoftFromDisk(files = readSoftFiles()): Record<LazyLayerId, SoftLayerContent> {
  const deps = softDeps();
  const layers = Object.fromEntries(LAZY_LAYERS.map((l) => [l, compileSoftLayer(l, files[l], deps)])) as Record<LazyLayerId, SoftLayerContent>;
  return withSoftTiers(layers, { ...deps, patches: readPatches(), jointNames: readJointNames() });
}

/** Each bone's derived Origins and Insertions for the panel (M8 plan decision 13, M9 decision 9), from the muscles layer's content (the nested layer). */
export function readBoneAttached(): Record<string, BoneAttachedRows> {
  const muscles = compileSoftFromDisk(NESTED_LAYER);
  const soft = new Map(readSoftIds().map((e) => [e.id, e]));
  return boneAttachedRows(muscles.derived?.attached ?? {}, (id) => {
    const e = soft.get(id);
    return { name: muscles.entries[id]?.fm.name ?? e?.name ?? id, side: e?.side ?? "midline" };
  });
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
