import { describe, expect, it } from "vitest";
import ids from "../content/ids.json";
import mapping from "../assets/mapping/source-to-id.json";

type Entry = { id: string; name: string; kind: "bone" | "tooth"; side: "left" | "right" | "midline"; group: string[]; meshAvailable: boolean };
const entries = ids as Entry[];
const map = mapping.map as Record<string, string[]>;
const missing = mapping.missing as Record<string, string>;

describe("canonical ID list", () => {
  it("has 238 unique IDs: 206 bones and 32 teeth", () => {
    expect(entries).toHaveLength(238);
    expect(new Set(entries.map((e) => e.id)).size).toBe(238);
    expect(entries.filter((e) => e.kind === "bone")).toHaveLength(206);
    expect(entries.filter((e) => e.kind === "tooth")).toHaveLength(32);
  });

  it("uses snake_case IDs", () => {
    for (const e of entries) expect(e.id).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
  });

  it("gives every paired bone its partner on the other side", () => {
    const set = new Set(entries.map((e) => e.id));
    for (const e of entries.filter((x) => x.kind === "bone" && x.side !== "midline")) {
      expect(e.id).toMatch(/_(left|right)$/);
      const partner = e.id.replace(/_(left|right)$/, (_, s: string) => (s === "left" ? "_right" : "_left"));
      expect(set.has(partner), `${e.id} has no partner`).toBe(true);
    }
  });

  it("numbers the teeth by FDI: quadrants 1-4, positions 1-8", () => {
    const teeth = entries.filter((e) => e.kind === "tooth").map((e) => e.id).sort();
    const expected = [1, 2, 3, 4].flatMap((q) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => `tooth_${q}${p}`)).sort();
    expect(teeth).toEqual(expected);
    for (const e of entries.filter((x) => x.kind === "tooth")) {
      const q = Number(e.id[6]);
      expect(e.side).toBe(q === 1 || q === 4 ? "right" : "left");
    }
  });
});

describe("source mapping", () => {
  it("maps every ID with a mesh, and lists every ID without one as missing", () => {
    for (const e of entries) {
      if (e.meshAvailable) expect(map[e.id]?.length, e.id).toBeGreaterThan(0);
      else expect(missing[e.id], e.id).toBeTruthy();
    }
    expect(Object.keys(map).length + Object.keys(missing).length).toBe(238);
  });

  it("never maps one source object to two IDs", () => {
    const all = Object.values(map).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
