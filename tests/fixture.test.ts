// The fixture layer, pure side (M11 session AX, plan decision 8). The registry's
// list module is swapped for the test registry (the real layers plus system
// `demo`, layer `widgets`, code `w`), exactly as `vite build --mode fixture`
// swaps it, and every surface M11 built has to pick the layer up with no other
// change: Layers panel groups, URL, defaults, presets, announcements, colours,
// ghost order, the layer files table, the ID table and the content registry.
// tests/e2e/fixture.spec.ts covers the browser side. Since M12 (plan decision
// 14) the layer also has its system's edge types, front matter, tier rules, a
// three-section panel and a `byKind` tree: the graph compiler, the tier engine,
// the panel model and the tree builder run on it unchanged.
import { readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
import { idFiles, readLayerIds } from "../scripts/lib/index-plugin";
import { fixtureRegistry } from "./fixtures/systems/vite";
import { FIXTURE_CONTENT } from "./fixtures/systems/registry.content";
import { WIDGET_IDS, widgets } from "./fixtures/systems/demo/widgets/layer";
import { centreOf } from "./fixtures/systems/demo/widgets/generate";
import { compileWidgets, readWidgetFiles, widgetGraph, widgetsTree } from "./fixtures/systems/demo/widgets/compile";
import { DEMO_GRAPH_REGISTRY, FIXTURE_GRAPH_REGISTRY } from "./fixtures/systems/registry.content";
import { DEMO_EDGES } from "./fixtures/systems/demo/edges";
import { MUSCULOSKELETAL_EDGES } from "../src/systems/musculoskeletal/edges";
import { edgeCounts } from "../src/graph/compile";
import { compileContentGraph } from "../src/systems/registry.content";
import { setIndex } from "../src/content/index";
import { readIndexData } from "../scripts/lib/index-plugin";
import { registerSoftContent, resetSoftContent } from "../src/content/softContentLoader";
import { resetAppGraph, tiers } from "../src/content/appGraph";
import { relatedAt } from "../src/scene/isolation";
import { panelModel, type SectionModel } from "../src/panel/model";
import { nodeMembers, isSoftNode } from "../src/tree/types";
import { EDGE_TYPES, REGIONS, TREE_ROOTS, hasTier, tierWording, type LazyLayerId } from "../src/systems/registry";

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

describe("the graph, tiers, panel and tree (M12 plan decision 14)", () => {
  const chunk = compileWidgets();
  const fm = Object.fromEntries(Object.entries(chunk.entries).map(([id, e]) => [id, e.fm]));

  it("its edge types are registered through its system, and only there", () => {
    // The systems' types, then the body regions' located_in (M13), which no content compiles.
    expect(EDGE_TYPES.slice(-3, -1)).toEqual([...DEMO_EDGES]);
    expect([...FIXTURE_GRAPH_REGISTRY.types, REGIONS.edgeType]).toEqual(EDGE_TYPES);
    expect(DEMO_GRAPH_REGISTRY.types).toEqual([...DEMO_EDGES]);
  });

  it("the compiler accepts its edges: meshes_with stored once per pair, drives as written", () => {
    const g = widgetGraph(fm);
    expect(g.errors).toEqual([]);
    expect(edgeCounts(g.edges, DEMO_EDGES)).toEqual([
      ["meshes_with", 3],
      ["drives", 7],
    ]);
    // Written from the other end, a symmetric edge is the same edge.
    const twice = widgetGraph({ ...fm, widget_gear_2: { ...(fm.widget_gear_2 as object), meshesWith: ["widget_gear_1", "widget_gear_3"] } });
    expect(twice.edges.filter((e) => e.type === "meshes_with")).toEqual(g.edges.filter((e) => e.type === "meshes_with"));
  });

  it("the compiler rejects a bad endpoint and an unregistered type", () => {
    const bad = widgetGraph({ ...fm, widget_gear_4: { ...(fm.widget_gear_4 as object), drives: ["widget_gear_9"] } });
    expect(bad.errors).toEqual(["content/widgets/widget_gear_4.md: drives widget_gear_4 → widget_gear_9: widget_gear_9 not known"]);
    const structures = WIDGET_IDS.map((id) => ({ id, kind: id.split("_")[1]! }));
    const unregistered = compileContentGraph({ fm, structures, readJson: () => null }, { ...DEMO_GRAPH_REGISTRY, types: MUSCULOSKELETAL_EDGES });
    expect(unregistered.edges).toEqual([]);
    expect(unregistered.errors).toContain("content/widgets/widget_gear_1.md: edge type meshes_with is not registered");
    expect(unregistered.errors).toContain("content/widgets/widget_gear_1.md: edge type drives is not registered");
    // A file that breaks its kind's schema doesn't compile.
    const files = readWidgetFiles();
    files.set("widget_lever_4", files.get("widget_lever_4")!.replace("drives: []", "drives: [not_a_widget]"));
    expect(() => compileWidgets(files)).toThrow(/widget_lever_4\.md: drives\.0/);
  });

  describe("with the widgets in the ID index and their chunk loaded", () => {
    beforeAll(() => {
      setIndex(readIndexData(fixtureRegistry));
      resetAppGraph();
      resetSoftContent();
      registerSoftContent(W as LazyLayerId, chunk);
    });
    afterAll(() => {
      resetSoftContent();
      resetAppGraph();
    });
    const on = { ...DEFAULT_MODES, [W]: "on" } as LayerModes;

    it("tiers follow its rules: tier 1 = what it meshes with, drives or is driven by; tier 2 adds its gear train", () => {
      expect(tiers().evaluate("widget_gear_2", "t1")).toEqual(["widget_gear_1", "widget_gear_3", "widget_lever_2", "widget_spring_2"]);
      expect(tiers().evaluate("widget_gear_2", "t2")).toEqual(["widget_gear_1", "widget_gear_3", "widget_lever_2", "widget_spring_2", "widget_gear_4"]);
      expect(tiers().evaluate("widget_spring_1", "t2")).toEqual(["widget_gear_1", "widget_gear_2"]);
      expect(tiers().evaluate("widget_lever_4", "t1")).toEqual([]);
      expect(tiers().evaluate("widget_lever_4", "ant")).toBeNull();
      // Filtered by the layers showing, as every layer's are.
      expect(relatedAt("widget_gear_2", 1, on)).toEqual(["widget_gear_1", "widget_gear_3", "widget_lever_2", "widget_spring_2"]);
      expect(relatedAt("widget_gear_2", 1, DEFAULT_MODES)).toEqual([]);
      expect(hasTier("lever", "t2")).toBe(true);
      expect(tierWording("gear", "t1")?.label).toBe("linked widgets");
      expect(tierWording("spring", "t2")?.button.text).toBe("Show the train");
    });

    it("the panel model gives its three sections, from its content and the graph", () => {
      const m = panelModel("widget_gear_2", { content: (l) => (l === W ? chunk : null), opposite: () => null })!;
      expect(m).not.toBeNull();
      expect({ title: m.title, subtitle: m.subtitle, badges: m.badges, draft: m.draft, trail: m.trail, pair: m.pair, written: m.written }).toEqual({
        title: "Gear 2",
        subtitle: { text: "Gear", latin: false },
        badges: ["Widgets", "Gear"],
        draft: true,
        trail: ["Widgets", "Gear 2"],
        pair: null,
        written: true,
      });
      const [summary, meshes, drive] = m.sections as [SectionModel, SectionModel, SectionModel];
      expect(m.sections.map((s) => [s.render, s.testId])).toEqual([
        ["text", "summary"],
        ["links", "meshes"],
        ["grouped-links", "drive"],
      ]);
      expect(summary.render === "text" && summary.value).toBe("<p>The second gear of the front train. It meshes with gears 1 and 3 and drives lever 2.</p>");
      expect(meshes.render === "links" && meshes.links!.map((l) => l.label)).toEqual(["Gear 1", "Gear 3"]);
      expect(drive.render === "grouped-links" && drive.groups!.map((g) => [g.title, g.links.map((l) => l.id)])).toEqual([
        ["Drives", ["widget_lever_2"]],
        ["Driven by", ["widget_spring_2"]],
      ]);
      // No isolate button: that is the bones' "Show attached muscles", declared on their section only.
      expect(drive.render === "grouped-links" && drive.isolate).toBeNull();
      // Nothing linked: empty lists, each section's empty text kept for the view.
      const lone = panelModel("widget_lever_4", { content: (l) => (l === W ? chunk : null), opposite: () => null })!;
      expect(lone.sections.map((s) => (s.render === "links" ? s.links : s.render === "grouped-links" ? s.groups!.flatMap((g) => g.links) : "text"))).toEqual(["text", [], []]);
      expect(lone.sections.map((s) => s.empty)).toEqual([undefined, "Meshes with nothing.", "Drives nothing and is driven by nothing."]);
      // Before its chunk has loaded: every section, unwritten.
      const early = panelModel("widget_gear_2", { content: () => null, opposite: () => null })!;
      expect(early.written).toBe(false);
      expect(early.sections).toHaveLength(3);
    });
  });

  it("the tree builder gives its root: kind, then assembly", () => {
    const root = widgetsTree(chunk);
    expect([root.key, root.label, root.name]).toEqual(["widgets", "Widgets", "All widgets"]);
    expect(root.children.map((c) => (isSoftNode(c) ? c.key : c.id))).toEqual(["widgets.gear", "widgets.spring", "widgets.lever"]);
    const gears = root.children[0]!;
    expect(isSoftNode(gears) && gears.children.map((c) => (isSoftNode(c) ? [c.key, c.name, nodeMembers(c)] : c.id))).toEqual([
      ["widgets.gear.front_train", "Gears: Front train", ["widget_gear_1", "widget_gear_2"]],
      ["widgets.gear.rear_train", "Gears: Rear train", ["widget_gear_3", "widget_gear_4"]],
    ]);
    expect(nodeMembers(root)).toEqual([...WIDGET_IDS]);
    // The sidebar's roots: the real ones in their order, then this one (the fixture build appends its built root to the
    // real tree, `fixtureTree` in ./fixtures/systems/vite.ts; tests/e2e/fixture.spec.ts opens it).
    expect(TREE_ROOTS.map((r) => r.key)).toEqual(["muscles", "ligaments", "cartilage", W]);
    expect(TREE_ROOTS.at(-1)).toEqual({ key: W, label: "Widgets", name: "All widgets" });
  });
});

// The whole colour-vision table (M10 AL), re-run with the fixture layer in it:
// its colour, its ghosts and its tints against every colour it can meet.
describe("colour vision with the fixture layer", async () => {
  await import("./colourVision.test");
});
