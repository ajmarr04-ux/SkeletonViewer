// The registry isolation test (SPEC-platform §10, first bullet; M11 plan
// decision 7). No file outside the descriptors may name a system, layer, kind
// or overlay by its ID as a quoted literal: it has to ask the registry. Files
// that still do (the per-kind code later milestones move onto the shared
// mechanisms) are listed in `tests/registry-allowlist.json` with the milestone
// that removes them, and the list may only shrink: an entry whose file no
// longer names an ID fails, so it has to be deleted.
//
// TypeScript is parsed (rolldown's oxc parser), so only real string literals,
// string literal types and template literals without substitutions count;
// comments don't. Python and shell files are matched by a regular expression
// with `#` comment lines skipped.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAst } from "rolldown/parseAst";
import { describe, expect, it } from "vitest";
import { OVERLAYS, REGISTRY, SYSTEMS } from "../src/systems/registry";

type Allowlist = {
  files: Record<string, { milestone: string; reason: string }>;
  otherVocabulary: { literal: string; meaning: string; files: string[] }[];
};

const root = join(__dirname, "..");
const allowlist = JSON.parse(readFileSync(join(root, "tests/registry-allowlist.json"), "utf8")) as Allowlist;

/** Every ID the registry defines. */
const IDS = new Set<string>([
  ...SYSTEMS.map((s) => s.id),
  ...REGISTRY.map((l) => l.id),
  ...REGISTRY.flatMap((l) => l.kinds.map((k) => k.id)),
  ...OVERLAYS.map((o) => o.id),
]);

/** Property names count only for layers, and member accesses only on a map keyed by layer (`s.layers.muscles`, `modes.bones`). */
const LAYER_NAMES = new Set<string>(REGISTRY.map((l) => l.id));
const MAPS = /^(layers|modes|layerModes)$/;

const SCANNED = ["src", "scripts"];
/** Allowed without listing (decision 7). `tests/` isn't scanned. */
const FREE = ["src/systems/"];
const EXTENSIONS = /\.(ts|tsx|py|sh)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTENSIONS.test(name)) out.push(relative(root, p).split("\\").join("/"));
  }
  return out;
}

/** `prop`: a property name (`s.layers.muscles`, `{ muscles: … }`) rather than a quoted string. */
type Hit = { literal: string; line: number; prop?: boolean };

function lineOf(text: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/**
 * Quoted strings in a TypeScript file (literals, literal types, plain template
 * literals), and property names: non-computed member accesses, object keys and
 * type members (`s.layers.muscles`, `{ muscles: … }`), which name a layer as
 * surely as a string does (AX found one in Viewer.tsx this way).
 */
function tsStrings(file: string, text: string): Hit[] {
  const ast = parseAst(text, { lang: file.endsWith(".tsx") ? "tsx" : "ts" }, file);
  const out: Hit[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; value?: unknown; start?: number; quasis?: { value: { cooked: string } }[]; expressions?: unknown[] };
    if (n.type === "Literal" && typeof n.value === "string") out.push({ literal: n.value, line: lineOf(text, n.start ?? 0) });
    if (n.type === "TemplateLiteral" && n.expressions?.length === 0 && n.quasis)
      out.push({ literal: n.quasis[0]!.value.cooked, line: lineOf(text, n.start ?? 0) });
    const name = (k: unknown) => (k && typeof k === "object" && (k as { type?: string }).type === "Identifier" ? (k as { name: string }).name : null);
    const m = n as { computed?: boolean; property?: unknown; key?: unknown; object?: { type?: string; property?: unknown } };
    const holder = m.object?.type === "MemberExpression" ? name(m.object.property) : name(m.object);
    const prop =
      (n.type === "MemberExpression" && !m.computed && holder !== null && MAPS.test(holder) && name(m.property)) ||
      ((n.type === "Property" || n.type === "TSPropertySignature" || n.type === "PropertyDefinition") && !m.computed && name(m.key));
    if (prop && LAYER_NAMES.has(prop)) out.push({ literal: prop, line: lineOf(text, n.start ?? 0), prop: true });
    for (const v of Object.values(n)) if (v && typeof v === "object") visit(v);
  };
  visit(ast);
  return out;
}

/** Quoted strings in a Python or shell file, `#` comment lines skipped. */
function scriptStrings(text: string): Hit[] {
  const out: Hit[] = [];
  text.split("\n").forEach((line, i) => {
    if (line.trim().startsWith("#")) return;
    for (const m of line.matchAll(/(["'`])([^"'`\n]*?)\1/g)) out.push({ literal: m[2]!, line: i + 1 });
  });
  return out;
}

/** The registry IDs a file names, less the other vocabularies listed for it. */
function idHits(file: string): Hit[] {
  const text = readFileSync(join(root, file), "utf8");
  const strings = /\.tsx?$/.test(file) ? tsStrings(file, text) : scriptStrings(text);
  const other = new Set(allowlist.otherVocabulary.filter((v) => v.files.includes(file)).map((v) => v.literal));
  return strings.filter((h) => IDS.has(h.literal) && !other.has(h.literal));
}

const files = SCANNED.flatMap((d) => walk(join(root, d))).filter((f) => !FREE.some((p) => f.startsWith(p)));
const hits = new Map(files.map((f) => [f, idHits(f)] as const));

describe("registry isolation", () => {
  it("scans the code (sanity: the IDs and files are there)", () => {
    expect(IDS.has(REGISTRY[0].id)).toBe(true);
    expect(files.length).toBeGreaterThan(100);
    // The parser sees literals and literal types, not comments.
    const probe = tsStrings("probe.ts", 'const a: "x" | `y` = "z"; // "w"\n/* "v" */ const b = { bones: o.layers.muscles, x: o.cartilage, [r]: 1 }; type T = { ligaments: 1 };');
    expect(probe.filter((h) => !h.prop).map((h) => h.literal).sort()).toEqual(["x", "y", "z"]);
    expect(probe.filter((h) => h.prop).map((h) => h.literal).sort()).toEqual(["bones", "ligaments", "muscles"]);
  });

  it("no file outside src/systems names a registry ID unless it is allowlisted", () => {
    const offenders = [...hits]
      .filter(([f, h]) => h.length > 0 && !(f in allowlist.files))
      .map(([f, h]) => `${f}: ${h.map((x) => `${x.line} ${x.prop ? `.${x.literal}` : `"${x.literal}"`}`).join(", ")}`);
    expect(offenders, "ask the registry (src/systems/registry.ts) instead").toEqual([]);
  });

  it("the allowlist only shrinks: every entry names a later milestone and a reason, and its file still names an ID", () => {
    const stale: string[] = [];
    for (const [file, entry] of Object.entries(allowlist.files)) {
      expect(entry.milestone, file).toMatch(/^M1[2-9]$/);
      expect(entry.reason.length, file).toBeGreaterThan(10);
      if (!existsSync(join(root, file))) stale.push(`${file}: gone`);
      else if ((hits.get(file) ?? idHits(file)).length === 0) stale.push(`${file}: names no ID any more`);
    }
    expect(stale, "delete these entries from tests/registry-allowlist.json").toEqual([]);
  });

  it("every other-vocabulary entry is still used where it is listed", () => {
    for (const v of allowlist.otherVocabulary) {
      expect(IDS.has(v.literal), v.literal).toBe(true);
      expect(v.meaning.length).toBeGreaterThan(10);
      for (const f of v.files) {
        const text = readFileSync(join(root, f), "utf8");
        const strings = /\.tsx?$/.test(f) ? tsStrings(f, text) : scriptStrings(text);
        expect(strings.some((h) => h.literal === v.literal), `${f} no longer uses "${v.literal}"`).toBe(true);
      }
    }
  });
});
