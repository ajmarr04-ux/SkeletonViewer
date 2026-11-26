// Region chunking (M13 session BO, plan decisions 9 and 11): the pure chunk
// table, plan and checks; the fixture's membership (each box in its region,
// the committed file up to date) and its chunk plan per region; the real
// registry has no chunked layer, so its files stay as they are.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readChunkTable, readMembership } from "../scripts/lib/index-plugin";
import { checkChunks, chunkStem, chunksFor, homeChunks, layerChunks, type LayerChunks } from "../src/regions/chunks";
import { mergeMembership, type LocatedInFile } from "../src/regions/membership";
import type { RegionVolumes } from "../src/regions/volume";
import { REGISTRY } from "../src/systems/registry";
import { boxPoints, centres } from "./fixtures/systems/demo/widgets/generate";
import { WIDGET_IDS, widgets } from "./fixtures/systems/demo/widgets/layer";
import { PLACES, WIDGETS_MEMBERSHIP, widgetsMembership } from "./fixtures/systems/demo/widgets/membership";
import { fixtureRegistry } from "./fixtures/systems/option";

const readJson = <T>(rel: string) => JSON.parse(readFileSync(rel, "utf8")) as T;
const COARSE = ["a", "b", "c", "d"];
const homes: Record<string, string | null> = { x1: "a", x2: "c", x3: "a", x4: "c" };
const table: LayerChunks = layerChunks("things", ["x1", "x2", "x3", "x4"], (id) => homes[id], COARSE).chunks;

describe("the chunk table, plan and checks", () => {
  it("groups a layer's structures by home region, in coarse order, leaving out empty regions", () => {
    expect(table).toEqual({ file: "things", chunks: ["a", "c"], ids: [["x1", "x3"], ["x2", "x4"]] });
    expect([...homeChunks(table)]).toEqual([["x1", "a"], ["x3", "a"], ["x2", "c"], ["x4", "c"]]);
    expect(chunkStem("things", "c", "low")).toBe("things-c-low");
  });

  it("refuses a structure with no home (it would be in no file)", () => {
    const r = layerChunks("things", ["x1", "y"], (id) => (id === "y" ? null : "a"), COARSE);
    expect(r.chunks.ids).toEqual([["x1"]]);
    expect(r.errors).toEqual([expect.stringMatching(/^y: no home/)]);
  });

  it("plans every chunk without a region, the members' chunks with one, null for a single-file layer", () => {
    expect(chunksFor(table, null, [])).toEqual(["a", "c"]);
    // A member homed elsewhere (a long structure reaching into the region) brings its home chunk.
    expect(chunksFor(table, "r", ["x2", "other-layer-id"])).toEqual(["c"]);
    expect(chunksFor(table, "r", ["x3", "x4"])).toEqual(["a", "c"]);
    expect(chunksFor(table, "r", [])).toEqual([]);
    // A selection drawn from outside the region brings its own chunk.
    expect(chunksFor(table, "r", ["x2"], ["x1", null])).toEqual(["a", "c"]);
    expect(chunksFor(undefined, "r", ["x1"])).toBeNull();
  });

  it("checks every structure once, in its home chunk", () => {
    const ok = new Map([["a", ["x1", "x3"]], ["c", ["x2", "x4"]]]);
    expect(checkChunks("t", table, ok)).toEqual([]);
    const bad = new Map([["a", ["x1", "x2"]], ["c", ["x2"]], ["d", ["z"]]]);
    expect(checkChunks("t", table, bad)).toEqual([
      "t: x2 is in chunk a, but its home is c",
      "t: x2 is in chunks a and c",
      "t: unexpected chunk d",
      "t: unexpected node z in chunk d",
      "t: x3 is in no chunk",
      "t: x4 is in no chunk",
    ]);
    expect(checkChunks("t", table, new Map([["a", ["x1", "x3"]]]))).toEqual(["t: chunk c is missing", "t: x2 is in no chunk", "t: x4 is in no chunk"]);
  });
});

describe("the real registry", () => {
  it("chunks no layer (spec §12 default): every musculoskeletal file stays one file per LOD", () => {
    expect(REGISTRY.map((l) => l.models.chunking)).toEqual(REGISTRY.map(() => "single"));
    expect(readChunkTable()).toEqual({ table: {}, errors: [] });
  });
});

describe("the fixture's widgets (plan decision 11)", () => {
  const volumes = readJson<RegionVolumes>("assets/build/region-volumes.json");
  const real = readJson<LocatedInFile>("assets/build/located-in.json");
  const committed = readJson<LocatedInFile>(WIDGETS_MEMBERSHIP);

  it("the committed membership file is what generate.ts computes now (re-run it after a region change)", () => {
    const now = widgetsMembership(volumes, real, centres().map(boxPoints), 12);
    expect({ ...committed, $comment: undefined }).toEqual({ ...now, $comment: undefined });
  });

  it("each row of four is homed in its coarse region, and located in its fine region", () => {
    WIDGET_IDS.forEach((id, i) => {
      const place = PLACES[Math.floor(i / 4)]!;
      expect(committed.structures[id]!.home, id).toBe(place.coarse);
      expect(committed.structures[id]!.regions, id).toContain(place.region);
    });
  });

  it("merges into the real file for the fixture build, and refuses a file made from another region list", () => {
    const merged = readMembership(fixtureRegistry);
    expect(Object.keys(merged.structures)).toEqual([...Object.keys(real.structures), ...WIDGET_IDS]);
    expect(merged.triangles[widgets.id]!.total).toEqual({ high: 144, low: 144 });
    expect(() => mergeMembership(real, { ...committed, regions: committed.regions.slice(1) })).toThrow(/region lists differ/);
    expect(() => mergeMembership(merged, committed)).toThrow(/in both files/);
  });

  it("plans only the chunks a region needs", () => {
    const { table: t, errors } = readChunkTable(fixtureRegistry);
    expect(errors).toEqual([]);
    expect(Object.keys(t)).toEqual([widgets.id]);
    const w = t[widgets.id]!;
    expect(w.chunks).toEqual(PLACES.map((p) => p.coarse));
    const members = (key: string) => Object.entries(readMembership(fixtureRegistry).structures).flatMap(([id, m]) => (m.regions.includes(key) ? [id] : []));
    expect(chunksFor(w, "face", members("face"))).toEqual(["head"]);
    expect(chunksFor(w, "thigh_left", members("thigh_left"))).toEqual(["lower_limb_left"]);
    // Two gears reach the anterior neck: focusing the neck needs the head's file.
    expect(chunksFor(w, "anterior_neck", members("anterior_neck"))).toEqual(["head"]);
    expect(chunksFor(w, "forearm_left", members("forearm_left"))).toEqual([]);
    expect(chunksFor(w, null, [])).toEqual(["head", "thorax", "lower_limb_left"]);
  });
});
