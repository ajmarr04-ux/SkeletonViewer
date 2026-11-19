// File access for the content scripts: the ID list, content/bones/*.md and the
// model node names. The rules themselves are in src/content/validate.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
