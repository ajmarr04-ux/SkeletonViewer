// M13 BM: body-region focus state (plan decision 7, spec §6.4): the reducer's
// `reg`, `focusRegion` / `leaveRegion`, `levelOf` and Back; URL `reg=`; the
// history as the app drives it (`skvDepth`); the view sets inside a region.
// Real region data (the ID index's `regions`, loaded by the setup file).

import { afterEach, describe, expect, it, vi } from "vitest";
import { FULL_SKELETON, isolationStep, levelOf, type Isolation, type IsolationAction, type ParentOf } from "../src/state/isolation";
import { parseUrlState, serialiseUrlState } from "../src/state/url";
import { isolationView, sceneView, shownIn, isPickableIn, viewOf, EAGER_ONLY } from "../src/scene/isolation";
import { isRegionKey, memberSet, membersOf } from "../src/regions/index";
import { hasMesh } from "../src/content/index";
import { softEntry } from "../src/content/softRegistry";
import { DEFAULT_MODES } from "../src/systems/registry";
import type { LayerModes } from "../src/state/url";

const PARENTS: Record<string, string> = { fcu_humeral: "fcu", fcu_ulnar: "fcu" };
const parentOf: ParentOf = (id) => PARENTS[id] ?? null;
const iso = (sel: string | null, tier: 0 | 1 | 2 = 0, reg: string | null = null, grp: string | null = null): Isolation => ({ sel, tier, grp, reg });
const step = (s: Isolation, a: IsolationAction) => isolationStep(s, a, parentOf);

describe("region focus reducer (M13 plan decision 7)", () => {
  it("region → select → tier 1 → tier 2 → Back × 4", () => {
    const r0 = step(FULL_SKELETON, { type: "focusRegion", key: "forearm" });
    expect(r0).toEqual({ state: iso(null, 0, "forearm"), history: "push" });
    const r1 = step(r0.state, { type: "select", id: "radius" });
    expect(r1).toEqual({ state: iso("radius", 0, "forearm"), history: "push" });
    const r2 = step(r1.state, { type: "related" });
    expect(r2).toEqual({ state: iso("radius", 1, "forearm"), history: "push" });
    const r3 = step(r2.state, { type: "region" });
    expect(r3).toEqual({ state: iso("radius", 2, "forearm"), history: "push" });
    expect([r0, r1, r2, r3].map((r) => levelOf(r.state, parentOf))).toEqual([1, 2, 3, 4]);
    const b1 = step(r3.state, { type: "back" });
    expect(b1).toEqual({ state: iso("radius", 1, "forearm"), history: "pop" });
    const b2 = step(b1.state, { type: "back" });
    expect(b2).toEqual({ state: iso("radius", 0, "forearm"), history: "pop" });
    const b3 = step(b2.state, { type: "back" });
    expect(b3).toEqual({ state: iso(null, 0, "forearm"), history: "pop" });
    const b4 = step(b3.state, { type: "back" });
    expect(b4).toEqual({ state: FULL_SKELETON, history: "pop" });
    expect(step(b4.state, { type: "back" }).history).toBe("none");
  });

  it("levelOf counts the region as one level under everything else; with no region it is unchanged", () => {
    expect(levelOf(FULL_SKELETON)).toBe(0);
    expect(levelOf(iso(null, 0, "forearm"))).toBe(1);
    expect(levelOf(iso(null, 0, "forearm", "g"))).toBe(2);
    expect(levelOf(iso(null, 0, null, "g"))).toBe(1);
    expect(levelOf(iso("fcu_humeral", 0, "forearm"), parentOf)).toBe(3);
    expect(levelOf(iso("fcu_humeral", 2, null), parentOf)).toBe(4);
    expect(levelOf(iso("radius", 2, "forearm"))).toBe(4);
  });

  it("a group inside a region: a level of its own, Back to the region, a member from it a new entry", () => {
    const r = step(iso(null, 0, "forearm"), { type: "group", key: "g" });
    expect(r).toEqual({ state: iso(null, 0, "forearm", "g"), history: "push" });
    expect(step(r.state, { type: "group", key: "h" })).toEqual({ state: iso(null, 0, "forearm", "h"), history: "replace" });
    expect(step(r.state, { type: "select", id: "radius" })).toEqual({ state: iso("radius", 0, "forearm"), history: "push" });
    expect(step(r.state, { type: "back" })).toEqual({ state: iso(null, 0, "forearm"), history: "pop" });
  });

  it("region → region: the same level with nothing isolated; a new entry, cleared, from an isolation", () => {
    expect(step(iso(null, 0, "forearm"), { type: "focusRegion", key: "arm" })).toEqual({ state: iso(null, 0, "arm"), history: "replace" });
    expect(step(iso(null, 0, "forearm"), { type: "focusRegion", key: "forearm" }).history).toBe("none");
    // From an isolation (inside a region, or over the whole body): pick a region, then choose.
    expect(step(iso("radius", 1, "forearm"), { type: "focusRegion", key: "arm" })).toEqual({ state: iso(null, 0, "arm"), history: "push" });
    expect(step(iso("radius", 1, "forearm"), { type: "focusRegion", key: "forearm" })).toEqual({ state: iso(null, 0, "forearm"), history: "push" });
    expect(step(iso("radius", 0), { type: "focusRegion", key: "forearm" })).toEqual({ state: iso(null, 0, "forearm"), history: "push" });
    expect(step(iso(null, 0, null, "g"), { type: "focusRegion", key: "forearm" })).toEqual({ state: iso(null, 0, "forearm"), history: "push" });
  });

  it("selecting a part via its muscle inside a region keeps the region on both entries", () => {
    const r = step(iso(null, 0, "forearm"), { type: "select", id: "fcu_humeral" });
    expect(r).toEqual({ state: iso("fcu_humeral", 0, "forearm"), history: "push", via: iso("fcu", 0, "forearm") });
    // Down from the muscle, across to a sibling, and Back from a part to its muscle.
    expect(step(iso("fcu", 0, "forearm"), { type: "select", id: "fcu_humeral" })).toEqual({ state: iso("fcu_humeral", 0, "forearm"), history: "push" });
    expect(step(iso("fcu_humeral", 0, "forearm"), { type: "select", id: "fcu_ulnar" })).toEqual({ state: iso("fcu_ulnar", 0, "forearm"), history: "replace" });
    expect(step(iso("fcu_humeral", 0, "forearm"), { type: "back" })).toEqual({ state: iso("fcu", 0, "forearm"), history: "pop" });
    expect(step(iso("fcu_humeral", 0, "forearm"), { type: "select", id: "fcu" })).toEqual({ state: iso("fcu", 0, "forearm"), history: "pop" });
  });

  it("switching side and switching focus keep the region", () => {
    expect(step(iso("radius", 2, "forearm"), { type: "switchSide", id: "radius_r" })).toEqual({ state: iso("radius_r", 2, "forearm"), history: "replace" });
    expect(step(iso("radius", 0, "forearm"), { type: "select", id: "femur" })).toEqual({ state: iso("femur", 0, "forearm"), history: "replace" });
    expect(step(iso("radius", 1, "forearm"), { type: "select", id: "femur" })).toEqual({ state: iso("femur", 0, "forearm"), history: "push" });
  });

  it("leaveRegion: one step back with nothing isolated; an isolation stays, over the whole body", () => {
    expect(step(iso(null, 0, "forearm"), { type: "leaveRegion" })).toEqual({ state: FULL_SKELETON, history: "pop" });
    expect(step(iso("radius", 1, "forearm"), { type: "leaveRegion" })).toEqual({ state: iso("radius", 1), history: "replace" });
    expect(step(iso(null, 0, "forearm", "g"), { type: "leaveRegion" })).toEqual({ state: iso(null, 0, null, "g"), history: "replace" });
    expect(step(FULL_SKELETON, { type: "leaveRegion" }).history).toBe("none");
    expect(step(iso("radius", 1), { type: "leaveRegion" }).history).toBe("none");
  });

  it("with no region every step gives what it gave before M13 (reg stays null)", () => {
    const actions: IsolationAction[] = [{ type: "select", id: "radius" }, { type: "related" }, { type: "region" }, { type: "back" }, { type: "group", key: "g" }, { type: "back" }];
    let s = FULL_SKELETON;
    for (const a of actions) {
      s = step(s, a).state;
      expect(s.reg).toBeNull();
    }
  });
});

describe("URL reg= (M13 plan decision 7)", () => {
  it("parses a region key, drops an unknown or malformed one, and an existing URL parses as before", () => {
    expect(parseUrlState("?reg=forearm_left", undefined, undefined, isRegionKey).reg).toBe("forearm_left");
    expect(parseUrlState("?reg=upper_limb_left&sel=radius_left&tier=1", undefined, undefined, isRegionKey)).toMatchObject({ reg: "upper_limb_left", sel: "radius_left", tier: 1 });
    expect(parseUrlState("?reg=nowhere", undefined, undefined, isRegionKey).reg).toBeNull();
    expect(parseUrlState("?reg=Forearm-Left").reg).toBeNull();
    expect(parseUrlState("?reg=").reg).toBeNull();
    expect(parseUrlState("?sel=femur_left&tier=2").reg).toBeNull();
  });

  it("serialises reg after sel/tier/ant or grp, before ghost; round trips", () => {
    const cases: [Parameters<typeof serialiseUrlState>[0], string][] = [
      [{ reg: "forearm_left" }, "?reg=forearm_left"],
      [{ sel: "radius_left", tier: 2, ant: true, reg: "forearm_left", ghost: "hide" }, "?sel=radius_left&tier=2&ant=1&reg=forearm_left&ghost=0"],
      [{ grp: "attached:femur_left", reg: "thigh_left", color: "region" }, "?grp=attached:femur_left&reg=thigh_left&color=region"],
      [{ reg: "head", hid: ["radius_left"] }, "?reg=head&hid=radius_left"],
    ];
    for (const [state, want] of cases) {
      const out = serialiseUrlState(state, "");
      expect(out).toBe(want);
      expect(serialiseUrlState({}, out)).toBe(want);
      const back = parseUrlState(out, undefined, undefined, isRegionKey);
      expect(back.reg).toBe(state.reg);
    }
    // Clearing the region keeps everything else, and unmanaged flags stay first.
    expect(serialiseUrlState({ reg: null }, "?debug&reg=forearm_left&sel=radius_left")).toBe("?debug&sel=radius_left");
    expect(serialiseUrlState({ sel: "ulna_left" }, "?reg=forearm_left&sel=radius_left")).toBe("?sel=ulna_left&reg=forearm_left");
  });
});

describe("the view inside a body region (fixed IDs)", () => {
  const forearm = memberSet("forearm_left")!;
  const ALL_ON = DEFAULT_MODES;
  const BONES: LayerModes = EAGER_ONLY;

  it("the member set is the region's members, cached, and null for none or an unknown key", () => {
    expect(forearm.has("radius_left") && forearm.has("ulna_left")).toBe(true);
    expect(forearm.has("humerus_left") || forearm.has("radius_right") || forearm.has("femur_left")).toBe(false);
    expect(forearm.size).toBe(membersOf("forearm_left").length);
    expect(memberSet("forearm_left")).toBe(forearm);
    expect(memberSet(null)).toBeNull();
    expect(memberSet("nowhere")).toBeNull();
    const limb = memberSet("upper_limb_left")!;
    expect(limb.has("humerus_left") && limb.has("radius_left") && limb.has("scapula_left")).toBe(true);
  });

  it("a region alone: no isolation; members drawn as their layer says, everything else hidden on every layer", () => {
    const v = viewOf({ sel: null, tier: 0, ghostMode: "ghost", grp: null, reg: "forearm_left", joint: null, layers: ALL_ON, hidden: new Set() }, hasMesh, () => new Set());
    expect(v.isolated).toBe(false);
    expect(shownIn(v, "bones", "radius_left")).toBe("solid");
    expect(shownIn(v, "bones", "humerus_left")).toBe("hidden");
    expect(shownIn(v, "bones", "femur_left")).toBe("hidden");
    expect(isPickableIn(v, "bones", "radius_left")).toBe(true);
    expect(isPickableIn(v, "bones", "humerus_left")).toBe(false);
    // A Ghost layer's members stay ghosts; its non-members are hidden.
    const g = sceneView(isolationView(null, 0, "ghost", hasMesh, null), { ...BONES, bones: "ghost" }, new Set(), forearm);
    expect(shownIn(g, "bones", "ulna_left")).toBe("ghost");
    expect(shownIn(g, "bones", "humerus_left")).toBe("hidden");
  });

  it("an isolation inside the region: solid and ghosts cut to the members", () => {
    // radius_left at tier 1 (bones only) relates the humerus, the ulna and carpals; the humerus is outside the forearm.
    const plain = isolationView("radius_left", 1, "ghost", hasMesh, null, undefined, undefined, BONES);
    expect(plain.solid!.has("humerus_left")).toBe(true);
    const inside = isolationView("radius_left", 1, "ghost", hasMesh, null, undefined, undefined, BONES, forearm);
    expect(inside.solid!.has("humerus_left")).toBe(false);
    expect(inside.solid!.has("radius_left") && inside.solid!.has("ulna_left")).toBe(true);
    expect([...inside.solid!].every((id) => forearm.has(id))).toBe(true);
    const v = sceneView(inside, BONES, new Set(), forearm);
    expect(shownIn(v, "bones", "humerus_left")).toBe("hidden"); // not even a ghost
    expect(shownIn(v, "bones", "femur_left")).toBe("hidden");
    // Without the region the humerus is solid and the femur a ghost (unchanged).
    const w = sceneView(plain, BONES);
    expect(shownIn(w, "bones", "humerus_left")).toBe("solid");
    expect(shownIn(w, "bones", "femur_left")).toBe("ghost");
  });

  it("a selection made from outside the region is drawn as the focus, and pickable; its related set is cut", () => {
    const v = viewOf({ sel: "femur_left", tier: 1, ghostMode: "ghost", grp: null, reg: "forearm_left", joint: null, layers: BONES, hidden: new Set() }, hasMesh, () => new Set());
    expect(v.focus).toBe("femur_left");
    expect(shownIn(v, "bones", "femur_left")).toBe("solid");
    expect(isPickableIn(v, "bones", "femur_left")).toBe(true);
    expect(shownIn(v, "bones", "tibia_left")).toBe("hidden");
    expect(shownIn(v, "bones", "radius_left")).toBe("ghost");
  });

  it("a highlighted joint's bones stay drawn outside the region", () => {
    const v = viewOf(
      { sel: "radius_left", tier: 0, ghostMode: "ghost", grp: null, reg: "forearm_left", joint: { a: "radius_left", b: "humerus_left" }, layers: BONES, hidden: new Set() },
      hasMesh,
      () => new Set(),
    );
    expect(shownIn(v, "bones", "humerus_left")).toBe("solid");
  });

  it("a muscle selected in a region is drawn as its parts; a group is cut to the region", () => {
    const fcu = softEntry("flexor_carpi_ulnaris_left")!;
    expect(fcu.parts!.length).toBeGreaterThan(0);
    const m = isolationView("flexor_carpi_ulnaris_left", 0, "ghost", hasMesh, null, undefined, undefined, ALL_ON, forearm);
    expect([...m.focusIds].sort()).toEqual([...fcu.parts!].filter(hasMesh).sort());
    // Nothing of an isolation in the region: still an isolation, nothing solid.
    const tibia = isolationView("tibia_left", 0, "ghost", hasMesh, null, undefined, undefined, BONES, forearm);
    expect(tibia.focus).toBe("tibia_left");
    expect([...tibia.solid!]).toEqual(["tibia_left"]);
  });

  it("hidden structures stay separate from the region (the chip counts only hid=)", () => {
    const v = viewOf({ sel: null, tier: 0, ghostMode: "ghost", grp: null, reg: "forearm_left", joint: null, layers: BONES, hidden: new Set(["ulna_left"]) }, hasMesh, () => new Set());
    expect([...v.hidden]).toEqual(["ulna_left"]);
    expect(shownIn(v, "bones", "ulna_left")).toBe("hidden");
    expect(shownIn(v, "bones", "radius_left")).toBe("solid");
  });

  it("no region: viewOf is what it was (region null)", () => {
    const st = { sel: "radius_left", tier: 1 as const, ghostMode: "ghost" as const, grp: null, joint: null, layers: BONES, hidden: new Set<string>() };
    const a = viewOf(st, hasMesh, () => new Set());
    const b = viewOf({ ...st, reg: null }, hasMesh, () => new Set());
    expect(a.region).toBeNull();
    expect(b).toEqual(a);
  });
});

// ---- The history as the app drives it (selection.ts): a fake window with a real entry stack. ----

type Entry = { state: unknown; url: string };
function historyWindow(search: string) {
  const entries: Entry[] = [{ state: null, url: `/${search}` }];
  let at = 0;
  const loc = { pathname: "/", search, hash: "", href: `http://localhost/${search}` };
  const listeners: (() => void)[] = [];
  const go = (u: string) => {
    const url = new URL(u, "http://localhost/");
    loc.pathname = url.pathname;
    loc.search = url.search;
    loc.hash = url.hash;
    loc.href = url.href;
  };
  const w = {
    location: loc,
    history: {
      get state() {
        return entries[at]!.state;
      },
      get length() {
        return entries.length;
      },
      pushState: (s: unknown, _t: string, u: string) => {
        entries.splice(at + 1);
        entries.push({ state: s, url: u });
        at++;
        go(u);
      },
      replaceState: (s: unknown, _t: string, u: string) => {
        entries[at] = { state: s, url: u };
        go(u);
      },
      back: () => {
        if (at === 0) return;
        at--;
        go(entries[at]!.url);
        for (const f of listeners) f();
      },
    },
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    addEventListener: (name: string, f: () => void) => name === "popstate" && listeners.push(f),
    removeEventListener: () => undefined,
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    entries: () => entries.map((e) => e.url),
    depth: () => (entries[at]!.state as { skvDepth?: number } | null)?.skvDepth ?? 0,
  };
  return w;
}

async function app(search = "") {
  vi.resetModules();
  await import("../src/content/indexData");
  const win = historyWindow(search);
  vi.stubGlobal("window", win);
  vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => setTimeout(() => f(0), 0));
  const sel = await import("../src/state/selection");
  const { useViewer } = await import("../src/state/store");
  sel.initSelectionFromUrl();
  sel.watchHistory();
  const now = () => {
    const s = useViewer.getState();
    return { sel: s.sel, tier: s.tier, grp: s.grp, reg: s.reg, url: win.location.search, depth: win.depth() };
  };
  return { sel, win, now, useViewer };
}

describe("region focus through selection.ts and the history", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("region → select → tier 1 → tier 2, then Back × 4 walks the entries (skvDepth counts the region)", async () => {
    const { sel, now } = await app();
    sel.focusRegion("forearm_left");
    expect(now()).toEqual({ sel: null, tier: 0, grp: null, reg: "forearm_left", url: "?reg=forearm_left", depth: 1 });
    sel.selectObject("radius_left");
    expect(now()).toMatchObject({ sel: "radius_left", reg: "forearm_left", url: "?sel=radius_left&reg=forearm_left", depth: 2 });
    sel.showRelated();
    sel.expandRegion();
    expect(now()).toMatchObject({ sel: "radius_left", tier: 2, url: "?sel=radius_left&tier=2&reg=forearm_left", depth: 4 });
    sel.goBack();
    expect(now()).toMatchObject({ tier: 1, reg: "forearm_left", depth: 3 });
    sel.goBack();
    expect(now()).toMatchObject({ sel: "radius_left", tier: 0, reg: "forearm_left", depth: 2 });
    sel.goBack();
    expect(now()).toMatchObject({ sel: null, reg: "forearm_left", url: "?reg=forearm_left", depth: 1 });
    sel.goBack();
    expect(now()).toEqual({ sel: null, tier: 0, grp: null, reg: null, url: "", depth: 0 });
  });

  it("region → region replaces; leaving pops; an unknown key does nothing", async () => {
    const { sel, now, win } = await app();
    sel.focusRegion("forearm_left");
    sel.focusRegion("arm_left");
    expect(now()).toMatchObject({ reg: "arm_left", url: "?reg=arm_left", depth: 1 });
    expect(win.entries()).toHaveLength(2);
    sel.focusRegion("nowhere");
    expect(now().reg).toBe("arm_left");
    sel.leaveRegion();
    expect(now()).toMatchObject({ reg: null, url: "", depth: 0 });
  });

  it("a region chosen from an isolation is a new entry; Back returns to the isolation over the whole body", async () => {
    const { sel, now } = await app();
    sel.selectObject("radius_left");
    sel.focusRegion("forearm_left");
    expect(now()).toMatchObject({ sel: null, reg: "forearm_left", url: "?reg=forearm_left", depth: 2 });
    sel.goBack();
    expect(now()).toMatchObject({ sel: "radius_left", reg: null, url: "?sel=radius_left", depth: 1 });
  });

  it("a deep link with reg= opens in the region; Back on that entry replaces it (the page's own entry)", async () => {
    const { sel, now, win } = await app("?sel=radius_left&tier=1&reg=forearm_left");
    expect(now()).toMatchObject({ sel: "radius_left", tier: 1, reg: "forearm_left", depth: 0 });
    sel.goBack();
    expect(now()).toMatchObject({ sel: "radius_left", tier: 0, reg: "forearm_left", url: "?sel=radius_left&reg=forearm_left" });
    sel.goBack();
    sel.goBack();
    expect(now()).toMatchObject({ sel: null, reg: null, url: "" });
    expect(win.entries()).toHaveLength(1);
  });

  it("an unknown reg= in the link is dropped from the URL", async () => {
    const { now } = await app("?reg=nowhere&sel=radius_left");
    expect(now()).toMatchObject({ sel: "radius_left", reg: null, url: "?sel=radius_left" });
  });

  it("hiding the selection inside a region keeps the region", async () => {
    const { sel, now, useViewer } = await app("?reg=forearm_left");
    sel.selectObject("ulna_left");
    sel.hideSelected();
    expect(now()).toMatchObject({ sel: null, reg: "forearm_left" });
    expect(now().url).toBe("?reg=forearm_left&hid=ulna_left");
    expect([...useViewer.getState().hidden]).toEqual(["ulna_left"]);
  });
});
