// M11 session AS: the golden snapshots (SPEC-platform §2.2, M11 plan decision 6).
// Compares what the app produces now with `tests/golden/*.json`, recorded at
// M10 before any refactor. A difference fails with a per-key list. Rewriting the
// files is `npm run golden -- --write` (refuses existing files without `--force`),
// and is only for a difference the user has approved (plan step 7's table).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPanels, buildSearch, buildTiers, buildTree, buildUrls, type Golden } from "./golden/harness";

const WRITE = process.env.GOLDEN_WRITE === "1";
const FORCE = process.env.GOLDEN_FORCE === "1";
const file = (name: string) => `tests/golden/${name}.json`;

/** One key per line, keys sorted: small diffs, stable files. */
export function formatGolden(g: Golden): string {
  const keys = Object.keys(g).sort();
  return `{\n${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(g[k])}`).join(",\n")}\n}\n`;
}

/** The keys whose values differ (or exist on one side only), each with both values. */
export function goldenDiff(want: Golden, got: Golden, max = 20): string[] {
  const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])].sort();
  const out: string[] = [];
  for (const k of keys) {
    const a = JSON.stringify(want[k]);
    const b = JSON.stringify(got[k]);
    if (a !== b) out.push(`${k}\n    golden: ${a ?? "(missing)"}\n    now:    ${b ?? "(missing)"}`);
  }
  return out.length > max ? [...out.slice(0, max), `… and ${out.length - max} more`] : out;
}

const SNAPSHOTS: [string, () => Promise<Golden>][] = [
  ["tiers", buildTiers],
  ["panels", buildPanels],
  ["search", buildSearch],
  ["urls", buildUrls],
  ["tree", buildTree],
];

describe("golden snapshots (M10 behaviour)", () => {
  for (const [name, build] of SNAPSHOTS)
    it(name, { timeout: 120_000 }, async () => {
      const got = await build();
      if (WRITE) {
        if (existsSync(file(name)) && !FORCE) throw new Error(`${file(name)} exists: pass --force to overwrite it (only for a difference the user approved)`);
        writeFileSync(file(name), formatGolden(got));
        return;
      }
      const want = JSON.parse(readFileSync(file(name), "utf8")) as Golden;
      const diff = goldenDiff(want, got);
      expect(diff, `${name}: ${diff.length} difference(s)\n${diff.join("\n")}`).toEqual([]);
    });
});

describe("golden diff helper", () => {
  it("lists changed, missing and extra keys", () => {
    expect(goldenDiff({ a: [1], b: 2 }, { a: [1], b: 3, c: 4 })).toEqual(["b\n    golden: 2\n    now:    3", "c\n    golden: (missing)\n    now:    4"]);
    expect(goldenDiff({ a: 1 }, { a: 1 })).toEqual([]);
  });
  it("formats one sorted key per line", () => {
    expect(formatGolden({ b: [1], a: { x: 1 } })).toBe('{\n"a": {"x":1},\n"b": [1]\n}\n');
  });
});
