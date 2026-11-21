// File access for the content scripts: the ID list, content/bones/*.md and the
// model node names; the soft-tissue folders (M8). The rules themselves are in
// src/content/validate.ts and softValidate.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boneMuscleLists } from "../../src/content/compile";
import { splitFrontMatter } from "../../src/content/frontmatter";
import { oppositeOf } from "../../src/content/placeholder";
import type { Patch } from "../../src/content/softRoles";
import { compileSoftLayer, withSoftTiers, type SoftCompileDeps, type SoftLayerContent } from "../../src/content/softCompile";
import { LAYER_FOLDERS, type SoftLayer } from "../../src/content/softSchema";
import type { SoftIdEntry } from "../../src/content/softValidate";
import type { IdEntry } from "../../src/content/validate";

export const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const bonesDir = join(root, "content/bones");

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

export const softDir = (layer: SoftLayer): string => join(root, "content", LAYER_FOLDERS[layer]);
export const SOFT_LAYERS = Object.keys(LAYER_FOLDERS) as SoftLayer[];
export const readSoftIds = (): SoftIdEntry[] => readJson("content/soft-ids.json") as SoftIdEntry[];

/** content/<layer folder>/<name>.md, by layer and name. */
export function readSoftFiles(): Record<SoftLayer, Map<string, string>> {
  const out = {} as Record<SoftLayer, Map<string, string>>;
  for (const layer of SOFT_LAYERS) {
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

function softDeps(): SoftCompileDeps {
  const kinds = new Map(readSoftIds().map((e) => [e.id, e.kind]));
  const movements = readJson("content/movements.json") as { antagonistPairs: [string, string][] };
  return {
    kindOf: (id) => kinds.get(id),
    pairJoints: (readJson("content/articulations.json") as { joint: string }[]).map((a) => a.joint),
    functionalJoints: Object.fromEntries((readJson("content/joints.json") as { id: string; articulations: string[] }[]).map((j) => [j.id, j.articulations])),
    antagonistPairs: movements.antagonistPairs,
  };
}

/** One layer's compiled soft-tissue content, read from disk (`npm run content`, the scripts and tests). No tier sets. */
export function compileSoftFromDisk(layer: SoftLayer, files = readSoftFiles()[layer]): SoftLayerContent {
  return compileSoftLayer(layer, files, softDeps());
}

/** The attachment patches (M6) as `soft-to-id.json` maps them (M9 plan decision 6). */
export function readPatches(): Record<string, Patch> {
  const raw = readJson("assets/mapping/soft-to-id.json") as { attachments: Record<string, { structures: string[]; end: Patch["end"]; on?: string | null }> };
  return Object.fromEntries(Object.entries(raw.attachments).map(([id, p]) => [id, { structures: p.structures, end: p.end, on: p.on ?? null }]));
}

/** Every layer compiled, with the tier sets and the muscles' roles (M9 plan decisions 4, 6, 7): what the lazy chunks ship. */
export function compileAllSoftFromDisk(files = readSoftFiles()): Record<SoftLayer, SoftLayerContent> {
  const deps = softDeps();
  const layers = Object.fromEntries(SOFT_LAYERS.map((l) => [l, compileSoftLayer(l, files[l], deps)])) as Record<SoftLayer, SoftLayerContent>;
  return withSoftTiers(layers, { ...deps, patches: readPatches() });
}

/** Each bone's derived muscle list for the panel (M8 plan decision 13), from the muscles layer's content. */
export function readBoneMuscles(): Record<string, string[]> {
  const muscles = compileSoftFromDisk("muscles");
  const soft = new Map(readSoftIds().map((e) => [e.id, e.name]));
  return boneMuscleLists(muscles.derived?.attached ?? {}, (id) => muscles.entries[id]?.fm.name ?? soft.get(id) ?? id);
}
