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
  /** Muscles and parts attached to the bone, derived from their origins and insertions (M8 plan decision 13). */
  muscles: string[];
  clinical: string | null;
  /** The 40 to 80 word summary as HTML. */
  summary: string;
  reviewed: boolean;
};
export type CompiledContent = Record<string, CompiledEntry>;

/** Attachments per bone, as the muscles layer derives them (`SoftDerived.attached`). */
export type BoneAttachments = Record<string, { origins: readonly string[]; insertions: readonly string[] }>;

/**
 * The panel's "Major muscle attachments" text for each bone (M8 plan decision
 * 13; links are M9's): each muscle or part by name, with whether the bone holds
 * its origin, its insertion or both. The left and right muscles on a midline
 * bone share a name, so they show once.
 */
export function boneMuscleLists(attached: BoneAttachments, nameOf: (id: string) => string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [bone, { origins, insertions }] of Object.entries(attached)) {
    const roles = new Map<string, { o: boolean; i: boolean }>();
    const mark = (ids: readonly string[], key: "o" | "i") => {
      for (const id of ids) {
        const name = nameOf(id);
        const r = roles.get(name) ?? { o: false, i: false };
        r[key] = true;
        roles.set(name, r);
      }
    };
    mark(origins, "o");
    mark(insertions, "i");
    out[bone] = [...roles]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, r]) => `${name} (${r.o && r.i ? "origin and insertion" : r.o ? "origin" : "insertion"})`);
  }
  return out;
}

/**
 * Compile every file. `muscles` is `boneMuscleLists` of the muscles layer. Throws on the first file that doesn't parse (the build
 * runs validate-content first, which lists every problem).
 */
export function compileContent(files: Map<string, string>, muscles: Record<string, string[]> = {}): CompiledContent {
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
      muscles: muscles[name] ?? [],
      clinical: d.clinicalNote,
      summary: (marked.parse(body, { async: false, gfm: true }) as string).trim(),
      reviewed: d.reviewed,
    };
  }
  return out;
}
