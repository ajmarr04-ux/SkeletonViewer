import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYER_IDS } from "../src/systems/registry";
import { colourTable, deltaUnder, lowPairs, pairsOf, registryLayers, VISIONS, type Entry, type LayerColours } from "./lib/colourTable";

// M14 plan decision 10 (spec §7.5): proposed base colours for the future
// systems, recorded for the next spec and not shipped (nothing in `src/` reads
// tests/fixtures/future-colours.json). Each runs through the shipped table's
// own pair rule (tests/lib/colourTable.ts) as if it were a registered layer,
// in full, ghosted and dimmed form, against the current layers (full and
// dimmed), the tints, the marks and each other. One rule is added (accepted by
// the user in BW): colour-by-region pauses while another system's layer is on,
// so the region colours never meet a future layer. With them in, no set near
// the textbook hues passes (BW notes).

type Future = {
  id: string;
  label: string;
  /** The textbook hue it started from. */
  seed: string;
  material: string;
  /** Its context-dimming amount (plan decision 9), as a descriptor's `colour.dim`. */
  dim: number;
  /** The nearest checked neighbour under each vision type, as recorded in the plan's BW notes. */
  nearest: Record<"normal" | "deuteranopia" | "protanopia", { pair: string; dE: number }>;
};
const FILE = JSON.parse(readFileSync(new URL("./fixtures/future-colours.json", import.meta.url), "utf8")) as { layers: Future[] };
const FUTURE: LayerColours[] = FILE.layers.map((f) => ({ id: f.id, material: f.material, dim: f.dim }));
const LAYERS = [...registryLayers(), ...FUTURE];
const TABLE = colourTable(LAYERS, { dimmed: true });
const future = new Set(FUTURE.map((f) => f.id));
/** Proposed for the next spec: the region colours (bones only) pause while another system's layer is on. */
const regionPaused = ([a, b]: readonly [Entry, Entry]) =>
  (a.role === "region" && future.has(b.layer ?? "")) || (b.role === "region" && future.has(a.layer ?? ""));
const checked = pairsOf(LAYERS, TABLE).checked.filter((p) => !regionPaused(p));
/** The pairs a future colour takes part in (the current layers' own dimmed pairs are BY's, plan decision 9). */
const touches = (id?: string) => (p: readonly [Entry, Entry]) => (id ? p[0].layer === id || p[1].layer === id : future.has(p[0].layer ?? "") || future.has(p[1].layer ?? ""));
const mine = checked.filter(touches());

describe("future-system colours (M14 decision 10): recorded, not shipped", () => {
  it("proposes arteries, veins, nerves, lymph nodes and organs, none of them a registered layer", () => {
    expect(FILE.layers.map((f) => f.id)).toEqual(["arteries", "veins", "nerves", "lymph_nodes", "organs"]);
    for (const f of FILE.layers) expect(LAYER_IDS as readonly string[]).not.toContain(f.id);
    // Each in full, three ghosts and dimmed, against every other colour and each other.
    expect(TABLE.filter((e) => future.has(e.layer ?? ""))).toHaveLength(5 * FUTURE.length);
    for (const f of FUTURE) for (const g of FUTURE) if (f !== g) expect(mine.some(([a, b]) => (a.name === f.id && b.name === g.id) || (a.name === g.id && b.name === f.id)), `${f.id}/${g.id}`).toBe(true);
  });

  for (const kind of VISIONS) {
    it(`every pair a future colour takes part in passes the shipped rule${kind ? ` under ${kind}` : ""}`, () => {
      expect(lowPairs(mine, kind)).toEqual([]);
    });
  }

  it("the nearest neighbours recorded in the plan are the ones the rule finds", () => {
    for (const f of FILE.layers) {
      const pairs = checked.filter(touches(f.id));
      for (const kind of VISIONS) {
        const near = pairs
          .map(([a, b]) => ({ pair: `${a.name}/${b.name}`, dE: Math.round(deltaUnder(kind, a.colour, b.colour) * 10) / 10 }))
          .reduce((m, p) => (p.dE < m.dE ? p : m));
        expect(near, `${f.id} ${kind ?? "normal"}`).toEqual(f.nearest[kind ?? "normal"]);
      }
    }
  });
});
