// The content compiler (plan step 4): content/bones/*.md → one object per ID
// with everything the info panel shows, the summary rendered to HTML. Pure, so
// Vitest can run it on fixtures; the Vite plugin (scripts/lib/content-plugin.ts)
// runs it at build and dev time and serves the result as a lazily loaded chunk.

import { marked } from "marked";
import { splitFrontMatter } from "./frontmatter";
import { frontMatterSchema, type FrontMatter } from "./schema";

export type CompiledEntry = {
  latin: string;
  common: string | null;
  region: string[];
  type: FrontMatter["type"];
  toothType: FrontMatter["toothType"];
  functions: string[];
  /** Landmark names, and whether any has a position yet (decision 9: none do). */
  landmarks: string[];
  /** The landmarks' IDs, in the same order as `landmarks` (M9: the muscle panels name an attachment's landmark). */
  landmarkIds: string[];
  landmarkPositions: number;
  /** Muscles and parts attached to the bone, derived from their origins and insertions (M8 plan decision 13; links since M9). */
  attached: BoneAttachedRows;
  clinical: string | null;
  /** The 40 to 80 word summary as HTML. */
  summary: string;
  reviewed: boolean;
};
export type CompiledContent = Record<string, CompiledEntry>;

/** Attachments per bone, as the muscles layer derives them (`SoftDerived.attached`). */
export type BoneAttachments = Record<string, { origins: readonly string[]; insertions: readonly string[] }>;

/** One muscle or part attached to a bone, as the bone panel lists it. */
export type AttachedRow = { id: string; name: string; side: "left" | "right" | "midline" };
export type BoneAttachedRows = { origins: AttachedRow[]; insertions: AttachedRow[] };
export const NO_ATTACHED: BoneAttachedRows = { origins: [], insertions: [] };

/**
 * The bone panel's Origins and Insertions (spec §5.4; M9 plan decision 9):
 * each muscle or part declaring an attachment on the bone, by name (left
 * before right where both sides share a midline bone). A muscle reached only
 * through a part is listed by the part, as the part declares it. A structure
 * that is both origin and insertion is in both lists.
 */
export function boneAttachedRows(
  attached: BoneAttachments,
  info: (id: string) => { name: string; side: AttachedRow["side"] },
): Record<string, BoneAttachedRows> {
  const rows = (ids: readonly string[]) =>
    ids
      .map((id) => ({ id, ...info(id) }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.side.localeCompare(b.side) || a.id.localeCompare(b.id));
  const out: Record<string, BoneAttachedRows> = {};
  for (const [bone, { origins, insertions }] of Object.entries(attached)) out[bone] = { origins: rows(origins), insertions: rows(insertions) };
  return out;
}

/**
 * Compile every file. `attached` is `boneAttachedRows` of the muscles layer. Throws on the first file that doesn't parse (the build
 * runs validate-content first, which lists every problem).
 */
export function compileContent(files: Map<string, string>, attached: Record<string, BoneAttachedRows> = {}): CompiledContent {
  const out: CompiledContent = {};
  for (const [name, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const { data, body } = splitFrontMatter(text);
    const res = frontMatterSchema.safeParse(data);
    if (!res.success) throw new Error(`content/bones/${name}.md: ${res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const d = res.data;
    if (d.id !== name) throw new Error(`content/bones/${name}.md: id is ${d.id}`);
    out[name] = {
      latin: d.latin,
      common: d.commonName,
      region: d.region,
      type: d.type,
      toothType: d.toothType,
      functions: d.functions,
      landmarks: d.landmarks.map((l) => l.name),
      landmarkIds: d.landmarks.map((l) => l.id),
      landmarkPositions: d.landmarks.filter((l) => l.position !== null).length,
      attached: attached[name] ?? NO_ATTACHED,
      clinical: d.clinicalNote,
      summary: (marked.parse(body, { async: false, gfm: true }) as string).trim(),
      reviewed: d.reviewed,
    };
  }
  return out;
}
