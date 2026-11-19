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
  landmarkPositions: number;
  muscles: string[];
  clinical: string | null;
  /** The 40 to 80 word summary as HTML. */
  summary: string;
  reviewed: boolean;
};
export type CompiledContent = Record<string, CompiledEntry>;

/**
 * Compile every file. Throws on the first file that doesn't parse (the build
 * runs validate-content first, which lists every problem).
 */
export function compileContent(files: Map<string, string>): CompiledContent {
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
      landmarkPositions: d.landmarks.filter((l) => l.position !== null).length,
      muscles: d.muscleAttachments,
      clinical: d.clinicalNote,
      summary: (marked.parse(body, { async: false, gfm: true }) as string).trim(),
      reviewed: d.reviewed,
    };
  }
  return out;
}
