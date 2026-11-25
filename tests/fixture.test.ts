// The fixture layer, pure side (M11 session AX, plan decision 8). The registry's
// list module is swapped for the test registry (the real layers plus system
// `demo`, layer `widgets`, code `w`), exactly as `vite build --mode fixture`
// swaps it, and every surface M11 built has to pick the layer up with no other
// change: Layers panel groups, URL, defaults, presets, announcements, colours,
// ghost order, the layer files table, the ID table and the content registry.
// tests/e2e/fixture.spec.ts covers the browser side.
import { readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/systems/registered", () => import("./fixtures/systems/registry"));

import { layersAnnouncement, layerModeAnnouncement, systemModeAnnouncement, countsPhrase } from "../src/content/announce";
import { DEBUG_LAYER_COLOURS, LAYER_FILES, parseDebugLayers } from "../src/scene/debugLayers";
import { DEFAULT_LAYER_SETTING, formatLayers, parseLayers, type LayerModes } from "../src/state/url";
import {
  COUNT_ORDER,
  DEBUG_CODES,
  DEFAULT_MODES,
  LABEL_ORDER,
  LAYER_IDS,
  LAZY_LAYERS,
  PRESETS,
  REGISTRY,
  SYSTEMS,
  isLazyLayer,
  kindNoun,
  layerByCode,
  layerColour,
  layerLabel,
  layerOfKind,
  layersOfSystem,
  presetModes,
  presetOf,
  systemMode,
  type KindId,
  type LayerId,
  type SystemId,
} from "../src/systems/registry";
import { idFiles, readLayerIds } from "../scripts/lib/soft-ids-plugin";
import { fixtureRegistry } from "./fixtures/systems/vite";
import { FIXTURE_CONTENT } from "./fixtures/systems/registry.content";
import { WIDGET_IDS, widgets } from "./fixtures/systems/demo/widgets/layer";
import { centreOf } from "./fixtures/systems/demo/widgets/generate";

// The fixture's IDs aren't in the real registry's literal types.
const W = "widgets" as LayerId;
const DEMO = "demo" as SystemId;
const kind = (k: string) => k as KindId;
const real = await vi.importActual<typeof import("../src/systems/registered")>("../src/systems/registered");

describe("fixture registry", () => {
  it("is the real registry plus the demo system and its one layer, nothing else", () => {
    expect(REGISTRY.slice(0, -1)).toEqual([...real.REGISTRY]);
    expect(REGISTRY.at(-1)).toBe(widgets);
    expect(SYSTEMS.map((s) => s.id)).toEqual([...real.SYSTEMS.map((s) => s.id), "demo"]);
    expect(LAYER_IDS.at(-1)).toBe(W);
    expect(isLazyLayer(W)).toBe(true);
    expect(LAZY_LAYERS.at(-1)).toBe(W);
    expect(widgets.kinds.map((k) => k.id)).toHaveLength(3);
    for (const k of widgets.kinds) expect(layerOfKind(k.id)).toBe(W);
  });

  it("the Layers panel: its own group after the musculoskeletal one, with a group mode", () => {
    expect(SYSTEMS.map((s) => s.id)).toEqual(["musculoskeletal", "demo"]);
    expect(layersOfSystem(DEMO)).toEqual([W]);
    expect(layersOfSystem("musculoskeletal" as SystemId)).not.toContain(W);
    expect(layerLabel(W)).toBe("Widgets");
    expect(systemMode(DEMO, DEFAULT_MODES)).toBe("off");
    expect(systemMode(DEMO, { ...DEFAULT_MODES, [W]: "ghost" })).toBe("ghost");
  });

  it("layers= parses and formats with w, the code is unique, and M10's URLs keep their meaning", () => {
    expect(layerByCode("w")).toBe(W);
    expect(new Set(REGISTRY.map((l) => l.code)).size).toBe(REGISTRY.length);
    const s = parseLayers("b:on,w:on")!;
    expect(s.layers[W]).toBe("on");
    expect(formatLayers(s)).toBe("b:on,c:off,l:off,m:off,w:on");
    expect(parseLayers("widgets:ghost")!.layers[W]).toBe("ghost");
    // An M10 URL leaves the new layer at its default.
    const old = parseLayers("b:on,c:off,l:on,m:ghost:2")!;
    expect(old.layers[W]).toBe("off");
    expect(old.depth).toBe(2);
    expect(formatLayers(old)).toBe("b:on,c:off,l:on,m:ghost:2,w:off");
    expect(formatLayers(DEFAULT_LAYER_SETTING)).toBe("b:on,c:off,l:off,m:off,w:off");
  });

  it("defaults and presets: off by default; the musculoskeletal presets leave it off", () => {
    expect(DEFAULT_MODES[W]).toBe("off");
    for (const p of PRESETS) expect(presetModes(p.id)[W]).toBe("off");
    expect(presetOf({ ...presetModes(PRESETS[0]!.id), [W]: "on" })).toBeNull();
    expect(PRESETS.map((p) => p.id)).toEqual(["skeleton", "full"]);
  });

  it("announcements: the layer's label, the system's group message, the kinds' nouns and count order", () => {
    const before: LayerModes = { ...DEFAULT_MODES };
    expect(layerModeAnnouncement(W, "on", true)).toBe("Widgets on, loading.");
    expect(layersAnnouncement(before, { ...before, [W]: "on" })).toBe("Widgets on.");
    expect(layersAnnouncement(before, { ...before, [W]: "ghost" }, [], DEMO)).toBe("Demo: all ghosted.");
    expect(systemModeAnnouncement(DEMO, "off")).toBe("Demo: all off.");
    expect(kindNoun(kind("spring"), 2)).toBe("springs");
    expect(COUNT_ORDER.slice(-3)).toEqual(["gear", "spring", "lever"]);
    expect(countsPhrase({ [kind("gear")]: 2, [kind("lever")]: 1 })).toBe("2 gears and 1 lever");
    // Its kinds rank below every musculoskeletal kind, so the labels' focus order puts it last.
    expect(LABEL_ORDER.at(-1)).toBe(W);
  });

  it("colours and ghost order: its own material and debug colour, a ghost order no other layer has", () => {
    expect(layerColour(W)).toBe(widgets.colour.material);
    expect(new Set(REGISTRY.map((l) => l.ghostOrder)).size).toBe(REGISTRY.length);
    expect(new Set(LAZY_LAYERS.map(layerColour)).size).toBe(LAZY_LAYERS.length);
  });

  it("the layer files table and M6's debug codes", () => {
    expect(LAYER_FILES).toContain(W);
    expect(DEBUG_CODES.get("w")).toBe(W);
    expect(parseDebugLayers("?debug&layers=w,l")).toEqual(["ligaments", W]);
    expect(DEBUG_LAYER_COLOURS[W as never]).toBe(widgets.colour.debug);
  });
});

describe("fixture files and the content side", () => {
  it("the content registry covers exactly the test registry's layers and kinds", () => {
    expect(Object.keys(FIXTURE_CONTENT).sort()).toEqual([...LAYER_IDS].sort());
    for (const l of REGISTRY) expect(Object.keys(FIXTURE_CONTENT[l.id]!.kinds).sort()).toEqual(l.kinds.map((k) => k.id).sort());
  });

  it("the ID table: the real entries unchanged, then the 12 widgets from the fixture's idsFile", () => {
    const realIds = JSON.parse(readFileSync("content/soft-ids.json", "utf8")) as { id: string }[];
    expect([...idFiles(fixtureRegistry).keys()]).toEqual(["content/soft-ids.json", "tests/fixtures/systems/demo/widgets/ids.json"]);
    const all = readLayerIds(fixtureRegistry);
    expect(all.slice(0, realIds.length)).toEqual(realIds);
    expect(all.slice(realIds.length).map((e) => e.id)).toEqual([...WIDGET_IDS]);
    expect(all.slice(realIds.length).every((e) => e.layer === W && e.meshAvailable && widgets.kinds.some((k) => k.id === (e.kind as string)))).toBe(true);
  });

  it("the generated .glb files hold one named node per widget, where the manifest says", async () => {
    const manifest = JSON.parse(readFileSync("tests/fixtures/systems/demo/widgets/models/manifest.json", "utf8")) as {
      objects: Record<string, { lods: Record<string, { bboxMin: number[]; bboxMax: number[] }> }>;
    };
    expect(Object.keys(manifest.objects)).toEqual([...WIDGET_IDS]);
    for (const lod of ["low", "high"]) {
      const doc = await new NodeIO().read(`tests/fixtures/systems/demo/widgets/models/widgets-${lod}.glb`);
      const nodes = doc.getRoot().listNodes();
      expect(nodes.map((n) => n.getName())).toEqual([...WIDGET_IDS]);
      nodes.forEach((n, i) => {
        expect(n.getTranslation()).toEqual(centreOf(i));
        const b = manifest.objects[n.getName()]!.lods[lod]!;
        expect(b.bboxMin.map((x, k) => (x + b.bboxMax[k]!) / 2)).toEqual(centreOf(i).map((x) => expect.closeTo(x, 9)));
      });
    }
  });
});

// The whole colour-vision table (M10 AL), re-run with the fixture layer in it:
// its colour, its ghosts and its tints against every colour it can meet.
describe("colour vision with the fixture layer", async () => {
  await import("./colourVision.test");
});
