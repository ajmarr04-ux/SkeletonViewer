// Front matter: split and join a content file's YAML header and markdown body,
// and write a right-side file from its left-side twin (plan decision 2).

import { parse, stringify } from "yaml";

export type ParsedFile = { data: unknown; body: string };

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function splitFrontMatter(text: string): ParsedFile {
  const m = FENCE.exec(text);
  if (!m) throw new Error("no front matter (the file must start with a --- line)");
  return { data: parse(m[1]!) as unknown, body: m[2]!.trim() };
}

/** Swap whole words left ↔ right, keeping the first letter's case. */
export function swapSideWords(s: string): string {
  return s.replace(/\b(left|right|Left|Right|LEFT|RIGHT)\b/g, (w) => {
    const lower = w.toLowerCase() === "left" ? "right" : "left";
    if (w === w.toUpperCase()) return lower.toUpperCase();
    return w[0] === w[0]!.toUpperCase() ? lower[0]!.toUpperCase() + lower.slice(1) : lower;
  });
}

/**
 * The mirrored value: object IDs go to the other side (`opposite`), the `side`
 * flips, and side words in any other text are swapped. Keys are kept as they are
 * except `surfaces`-style maps keyed by object ID.
 */
function mirrorValue(v: unknown, opposite: (id: string) => string | null): unknown {
  if (typeof v === "string") return opposite(v) ?? swapSideWords(v);
  if (Array.isArray(v)) return v.map((x) => mirrorValue(x, opposite));
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[opposite(k) ?? k] = mirrorValue(x, opposite);
    return out;
  }
  return v;
}

export function mirroredHeader(leftId: string): string {
  return `# Generated from ${leftId}.md by \`npm run content:mirror\`. Edit that file, not this one.`;
}

/** The right-side file written from a left-side file's text. */
export function mirrorFile(leftText: string, leftId: string, opposite: (id: string) => string | null): string {
  const { data, body } = splitFrontMatter(leftText);
  const mirrored = mirrorValue(data, opposite);
  const yaml = stringify(mirrored, { lineWidth: 0 }).trimEnd();
  return `---\n${mirroredHeader(leftId)}\n${yaml}\n---\n${swapSideWords(body)}\n`;
}
