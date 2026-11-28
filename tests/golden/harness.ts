// M11 session AS: the golden snapshots (SPEC-platform §2.2; M11 plan decision 6),
// recorded at M10's behaviour before any refactor. Each builder runs the app's
// own pure functions and loaders (the same virtual modules the browser loads,
// resolved by Vitest through vite.config.ts) and returns plain JSON. The
// refactors of M11 to M15 must reproduce these exactly; any difference is a bug
// until the user approves it (spec §13).
//
// Everything here reads the app through its M10 module paths. When a later
// milestone moves a function, change the import here, never the snapshot.

import { createHash } from "node:crypto";
import { vi } from "vitest";

/** Every ID the app knows: 238 bones and teeth, then the 900 soft structures, in file order. */
export type Golden = Record<string, unknown>;

const hash = (s: string | null | undefined): string | null => (s == null ? null : createHash("sha1").update(s).digest("hex").slice(0, 12));

/** Load the bone content, the soft-tissue table and every soft layer's content, through the app's loaders. */
async function loadEverything() {
  const { loadContent } = await import("../../src/content/loader");
  const { loadSoftContent } = await import("../../src/content/softContentLoader");
  const bones = await loadContent();
  // The soft-tissue table is the always-loaded ID index since M12 BB (tests/setup.ts loads it).
  const soft = {
    cartilage: await loadSoftContent("cartilage"),
    ligaments: await loadSoftContent("ligaments"),
    muscles: await loadSoftContent("muscles"),
  };
  return { bones, soft };
}

async function allIds(): Promise<{ bones: string[]; soft: string[] }> {
  const ids = (await import("../../content/ids.json")).default as { id: string }[];
  const { softEntries } = await import("../../src/content/softRegistry");
  return { bones: ids.map((e) => e.id), soft: softEntries().map((e) => e.id) };
}

// ---------------------------------------------------------------------------
// tiers.json

/**
 * For every ID: tiers 1 and 2 from `relatedAt` with all four layers On (in the
 * order the app produces them); for muscles and parts the antagonists (the
 * roles' `ant` list, which `withTints` adds at tier 2 with `ant=1`); for bones
 * and teeth also tiers 1 and 2 with only the bones layer on.
 */
export async function buildTiers(): Promise<Golden> {
  await loadEverything();
  const { relatedAt } = await import("../../src/scene/isolation");
  const { rolesOf: softRoles } = await import("../../src/content/appGraph");
  const { DEFAULT_MODES: DEFAULT_LAYERS } = await import("../../src/systems/registry");
  const allOn = { bones: "on", cartilage: "on", ligaments: "on", muscles: "on" } as const;
  const { bones, soft } = await allIds();
  const out: Golden = {};
  for (const id of bones)
    out[id] = {
      t1: relatedAt(id, 1, allOn),
      t2: relatedAt(id, 2, allOn),
      bonesOnly: { t1: relatedAt(id, 1, DEFAULT_LAYERS), t2: relatedAt(id, 2, DEFAULT_LAYERS) },
    };
  for (const id of soft) {
    const r = softRoles(id);
    out[id] = { t1: relatedAt(id, 1, allOn), t2: relatedAt(id, 2, allOn), ...(r ? { ant: r.ant } : {}) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// panels.json

type Link = { id: string; label: string; detail?: string };
/** A link as the panel shows it: "id | label" (with " | detail" where a row has one). */
const link = (l: Link, detail?: string | null): string => (detail ? `${l.id} | ${l.label} | ${detail}` : `${l.id} | ${l.label}`);
type Section = { title: string; links?: string[]; text?: (string | null)[]; html?: string | null };
type SectionModel = import("../../src/panel/model").SectionModel;
type AttachmentList = import("../../src/systems/musculoskeletal/muscles/panel").AttachmentList;

/** One section as the golden records it, by render type (M12 BD: the generic panel model). */
function recordSection(s: SectionModel): Section {
  const { title } = s;
  switch (s.render) {
    case "text":
      return s.format === "line" ? { title, text: s.value === null ? [] : [s.value + (s.inherited ? " (as the whole muscle)" : "")] } : { title, html: hash(s.value) };
    case "list":
      return { title, text: s.items ?? [], ...(s.count ? { links: [`positions: ${s.count}`] } : {}) };
    case "links":
      if (s.nameOnly) return { title, text: [s.links?.[0]?.label ?? null] };
      return {
        title,
        links: (s.links ?? []).map((l) => link(l, l.detail)),
        ...(s.also ? { text: [s.also.title, ...s.also.links.map((n) => link(n))] } : {}),
      };
    case "grouped-links":
      return { title, ...(s.groups ? { text: s.groups.flatMap((g) => [g.title, ...g.links.map((l) => link(l))]) } : {}) };
    case "actions-table": {
      const act = (a: { joint: string; movement: string; role: string }) => `${a.joint} · ${a.movement} · ${a.role}`;
      return {
        title,
        text: [
          ...s.rows.map(act),
          ...(s.inherited.length ? ["With the whole muscle", ...s.inherited.map(act)] : []),
          ...(s.rows.length + s.inherited.length === 0 ? s.fallback : []),
        ],
      };
    }
    case "custom": {
      // The one custom component (plan decision 11): an origin or insertion list.
      const list = s.data as AttachmentList;
      return {
        title,
        ...(list.inheritedFrom ? { text: [`As the whole muscle: ${link(list.inheritedFrom)}`] } : {}),
        links: list.rows.map((r) => (r.link ? link(r.link, [r.landmark, r.part].filter(Boolean).join(" · ") || null) : `text | ${r.text}${r.part ? ` · ${r.part}` : ""}`)),
      };
    }
  }
}

/**
 * For every ID, what the info panel shows (InfoPanel.tsx at M10): the title and
 * the line under it, Part of, the side pair, the badges, the common name, the
 * sections in order with their links (in order) and short texts, and the
 * breadcrumb trail. Prose (summary and clinical note HTML) is recorded as a
 * hash, so the file stays small but any change shows. Since M12 BD it reads
 * the generic panel model (`src/panel/model.ts`); a field the kind's chrome
 * doesn't have is undefined and so left out, as the M10 golden did per kind.
 */
export async function buildPanels(): Promise<Golden> {
  const { bones: boneContent, soft } = await loadEverything();
  const { panelModel, oppositeAcross } = await import("../../src/panel/model");
  const { oppositeOf } = await import("../../src/content/placeholder");
  const { softOpposite } = await import("../../src/content/softRegistry");
  const { EAGER_LAYER } = await import("../../src/systems/registry");
  const { bones, soft: softIds } = await allIds();
  const contents: Record<string, unknown> = { [EAGER_LAYER]: boneContent, ...soft };
  const inputs = { content: (layer: string) => (contents[layer] ?? null) as Record<string, unknown> | null, opposite: oppositeAcross(oppositeOf, softOpposite) };
  const out: Golden = {};
  for (const id of [...bones, ...softIds]) {
    const m = panelModel(id, inputs)!;
    out[id] = {
      title: m.title,
      subtitle: m.subtitle.text,
      partOf: m.partOf === undefined ? undefined : m.partOf ? `${m.partOf.id} | ${m.partOf.name}` : null,
      common: m.common,
      written: m.written,
      pair: m.pair,
      badges: [...m.badges, ...(m.draft ? ["Draft — not yet reviewed"] : [])],
      note: m.note,
      // The M10 golden recorded it where there is no no-model note (the soft panels' Hide reads it; the bones' note says it).
      meshAvailable: m.note === undefined ? m.meshAvailable : undefined,
      sections: m.sections.map(recordSection),
      trail: m.trail,
      parentCrumb: m.parentCrumb,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// search.json

/** 60 queries (plan decision 6): every kind's names, common names and synonyms, Latin, side words, a typo, generic words. */
export const SEARCH_QUERIES = [
  // bones and teeth
  "femur", "left femur", "femur right", "humerus", "scapula", "skull", "vertebra", "c1", "atlas", "axis", "rib", "first rib", "sternum",
  "patella", "kneecap", "collarbone", "shin bone", "hip bone", "pelvis", "sacrum", "hyoid", "stapes", "ossicles", "carpals", "phalanx",
  "molar", "canine", "wisdom tooth", "incisor", "11", "tooth 36",
  // muscles and parts
  "biceps", "biceps brachii", "triceps long head", "deltoid", "rotator cuff", "quadriceps", "hamstrings", "gluteus maximus", "diaphragm",
  "pec major", "lats", "trapezius", "sternocleidomastoid",
  // ligaments, cartilage, discs, menisci
  "acl", "anterior cruciate ligament", "inguinal ligament", "meniscus", "lateral meniscus", "intervertebral disc", "disc l4", "labrum", "costal cartilage",
  // Latin, a typo, generic words
  "os coxae", "musculus", "clavicula", "humorus",
  "left", "muscle", "ligament",
] as const;

/** For each query, the top 10 through the sidebar's merge (every layer's index, asked for 30 as the sidebar does). */
export async function buildSearch(): Promise<Golden> {
  await loadEverything();
  const { loadAllSearch } = await import("../../src/content/searchLoader");
  const { mergeSearchers } = await import("../../src/content/searchMerge");
  const search = mergeSearchers(...(await loadAllSearch()));
  const out: Golden = {};
  for (const q of SEARCH_QUERIES)
    out[q] = search(q, 30)
      .slice(0, 10)
      .map((h) => `${h.id} | ${h.label}${h.match ? ` | ${h.match}` : ""}${h.group ? " | group" : ""}${h.drawn != null ? ` | drawn ${h.drawn}` : ""}`);
  return out;
}

// ---------------------------------------------------------------------------
// urls.json

/**
 * 40 URLs (plan decision 6). Each is opened as a fresh page: a new module graph
 * (`vi.resetModules`), an empty localStorage and a stubbed `window`, then the
 * app's own load path (`initSelectionFromUrl`, Viewer.tsx), with the lazy
 * chunks resolved and every layer that is turned on reported as on screen (as
 * `LayerScenes` does once its model loads). Recorded: the store state, the
 * address bar afterwards, and `serialiseUrlState` of that state on an empty URL.
 */
export const URLS = [
  "",
  // one per layer, and full layer names
  "?layers=b:on,c:on,l:off,m:off",
  "?layers=b:on,c:off,l:on,m:off",
  "?layers=b:ghost,c:off,l:off,m:on",
  "?layers=bones:on,muscles:ghost,ligaments:on",
  // every depth stop, the legacy 3, and a depth on a layer that has none
  "?layers=b:on,c:off,l:off,m:on:1",
  "?layers=b:on,c:off,l:off,m:on:2",
  "?layers=b:on,c:off,l:off,m:on:3",
  "?layers=b:on,c:off,l:on:2,m:off",
  // unknown code and mode; M6's debug forms
  "?layers=b:on,x:on,m:sideways",
  "?debug&layers=all",
  "?debug&layers=m,l,c,a",
  // bones and teeth at each tier
  "?sel=femur_left",
  "?sel=femur_left&tier=1",
  "?sel=femur_left&tier=2&layers=b:on,c:on,l:on,m:on",
  "?sel=tooth_36",
  "?sel=tooth_18&tier=1",
  // soft kinds at each tier, the part level, antagonists
  "?sel=biceps_brachii_left",
  "?sel=biceps_brachii_left&tier=1",
  "?sel=biceps_brachii_left&tier=2&ant=1",
  "?sel=triceps_brachii_long_head_left&tier=1",
  "?sel=anterior_cruciate_ligament_left&tier=2",
  "?sel=lateral_meniscus_left&tier=1",
  "?sel=intervertebral_disc_l4_l5",
  "?sel=glenoid_labrum_left&tier=2&layers=b:on,c:on,l:off,m:off",
  "?sel=femur_left&tier=1&ant=1",
  // groups: bone, dentition, soft, attached; and unknown ones
  "?grp=axial.skull.ossicles",
  "?grp=dentition.type.molars&ghost=0",
  "?grp=muscles.upper_limb.shoulder.rotator_cuff",
  "?grp=muscles.sets.quadriceps_femoris",
  "?grp=attached:femur_left",
  "?grp=muscles.nowhere",
  "?sel=femur_left&grp=axial.skull.ossicles",
  // hidden, colour, ghost, camera
  "?hid=femur_left,biceps_brachii_left,not_a_bone",
  "?color=region&sel=scapula_left&tier=1",
  "?ghost=0&sel=humerus_right",
  "?cam=0.1,1.2,2.5,0,1,0,0.05,-0.02",
  "?sel=radius_left&cam=0.3,1.1,1.8,0.2,1,0",
  // unknown IDs
  "?sel=not_a_bone&tier=2",
  "?sel=no_such_muscle_left&tier=1&layers=b:on,c:off,l:off,m:on",
] as const;

type Win = {
  location: { pathname: string; search: string; hash: string; href: string };
  history: { state: unknown; length: number; replaceState: (s: unknown, t: string, u: string) => void; pushState: (s: unknown, t: string, u: string) => void; back: () => void };
  localStorage: Storage;
  addEventListener: () => void;
  removeEventListener: () => void;
  matchMedia: (q: string) => { matches: boolean; addEventListener: () => void; removeEventListener: () => void };
};

/** Writes to a page's address after it was recorded (a leak between pages); the build fails if any. */
const lateWrites: string[] = [];

function fakeWindow(search: string): Win & { close: () => void } {
  const store = new Map<string, string>();
  let closed = false;
  const loc = { pathname: "/", search, hash: "", href: `http://localhost/${search}` };
  const go = (u: string) => {
    if (closed) lateWrites.push(`${search} → ${u}`);
    const url = new URL(u, "http://localhost/");
    loc.pathname = url.pathname;
    loc.search = url.search;
    loc.hash = url.hash;
    loc.href = url.href;
  };
  const w: Win & { close: () => void } = {
    close: () => void (closed = true),
    location: loc,
    history: {
      state: null,
      length: 1,
      replaceState: (s, _t, u) => {
        w.history.state = s;
        go(u);
      },
      pushState: (s, _t, u) => {
        w.history.state = s;
        w.history.length++;
        go(u);
      },
      back: () => undefined,
    },
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, String(v)),
      removeItem: (k) => void store.delete(k),
      clear: () => store.clear(),
      key: (i) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  };
  return w;
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Wait until the page is idle: the lazy chunks the app may have asked for are in, and nothing has changed for 300 ms. */
async function settle(snapshot: () => string): Promise<void> {
  const { loadSoftTree } = await import("../../src/content/softTreeLoader");
  const { loadSoftContent } = await import("../../src/content/softContentLoader");
  // Loading a chunk only registers data; it never changes the store or the address by itself.
  await Promise.allSettled([loadSoftTree(), loadSoftContent("cartilage"), loadSoftContent("ligaments"), loadSoftContent("muscles")]);
  let last = snapshot();
  for (let still = 0; still < 30; ) {
    await tick(10);
    const now = snapshot();
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

/** Open one URL as a fresh page and record what the app ends up with. */
/** A new module graph, with the always-loaded ID index handed over first, as the app's entry (src/main.tsx) does (M12 BB). */
async function freshModules(): Promise<void> {
  vi.resetModules();
  await import("../../src/content/indexData");
}

async function openUrl(search: string): Promise<Golden> {
  await freshModules();
  const win = fakeWindow(search);
  vi.stubGlobal("window", win);
  vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => setTimeout(() => f(0), 0));
  try {
    const { initSelectionFromUrl } = await import("../../src/state/selection");
    const { useViewer } = await import("../../src/state/store");
    const { useLayerBatches } = await import("../../src/scene/layerRegistry");
    // A layer's batch "arrives" once it is turned on (LayerScenes, after the model loads).
    const showOn = () => {
      const st = useViewer.getState();
      const have = useLayerBatches.getState() as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const [l, mode] of Object.entries(st.layers)) if (l !== "bones" && mode !== "off" && !have[l]) patch[l] = { fake: true };
      if (Object.keys(patch).length) useLayerBatches.setState(patch as never);
    };
    const off = useViewer.subscribe(showOn);
    const url = initSelectionFromUrl();
    showOn();
    await settle(() => JSON.stringify([useViewer.getState(), [...useViewer.getState().hidden], win.location.search]));
    off();
    win.close();
    const st = useViewer.getState();
    const { serialiseUrlState } = await import("../../src/state/url");
    const serialised = serialiseUrlState(
      { sel: st.sel, tier: st.tier, grp: st.grp, ant: st.antagonists, ghost: st.ghostMode, color: st.colourMode === "region" ? "region" : null, layers: { layers: st.layers, depth: st.muscleDepth }, hid: [...st.hidden], cam: url.cam },
      "",
    );
    return {
      state: {
        sel: st.sel,
        tier: st.tier,
        grp: st.grp,
        antagonists: st.antagonists,
        ghostMode: st.ghostMode,
        colourMode: st.colourMode,
        layers: st.layers,
        muscleDepth: st.muscleDepth,
        debugLayersView: st.debugLayersView,
        hidden: [...st.hidden],
        cam: url.cam,
        toast: st.toast?.text ?? null,
      },
      address: win.location.search,
      serialised,
    };
  } finally {
    vi.unstubAllGlobals();
  }
}

export async function buildUrls(): Promise<Golden> {
  const out: Golden = {};
  for (const u of URLS) out[u === "" ? "(none)" : u] = await openUrl(u);
  await tick(200);
  await freshModules();
  if (lateWrites.length > 0) throw new Error(`a page wrote its address after it was recorded:\n${lateWrites.join("\n")}`);
  return out;
}

// ---------------------------------------------------------------------------
// tree.json (M12 plan decision 9, recorded at M11 before the tree builders move)

/**
 * The sidebar's tree and its groups. `rows:initial` is the rows with the top
 * bone groups open before the soft tree loads (the soft roots alone, count
 * null). After everything has loaded: `row:<key>` for every row with every
 * openable row open (kind, label, level, parent, pos/size, count, and the
 * soft rows' `expandable`/`drawn`), `rows:order` the keys in order; `group:<key>`
 * for every group (bone groups, tooth types, soft tree nodes, synonym sets and
 * every bone's `attached:` group): label, name, trail, parent, layer, members,
 * counts, both announcements, ancestors; `ancestors:<id>` for every structure.
 */
export async function buildTree(): Promise<Golden> {
  const groups = await import("../../src/content/groups");
  const tree = await import("../../src/content/tree");
  const out: Golden = {};
  groups.resetSoftTree();
  out["rows:initial"] = tree.visibleRows(new Set(tree.TOP_KEYS)).map((r) => `${r.key} | ${r.level} | ${r.count}${r.soft ? " | soft" : ""}`);

  await loadEverything();
  const { loadSoftTree } = await import("../../src/content/softTreeLoader");
  await loadSoftTree();
  const data = groups.softTree()!;
  const { isSoftNode } = await import("../../src/tree/types");

  // Every openable row open: grow the open set until the rows stop changing.
  let open = new Set<string>();
  for (let rows = tree.visibleRows(open); ; ) {
    const next = new Set(rows.filter(tree.openable).map((r) => r.key));
    if (next.size === open.size) break;
    open = next;
    rows = tree.visibleRows(open);
  }
  const rows = tree.visibleRows(open);
  const seen = new Map<string, number>();
  for (const r of rows) {
    const n = (seen.get(r.key) ?? 0) + 1;
    seen.set(r.key, n);
    const { key, ...rest } = r;
    out[`row:${key}${n > 1 ? `#${n}` : ""}`] = rest;
  }
  out["rows:order"] = rows.map((r) => r.key);

  const keys: string[] = [...groups.GROUPS.keys()];
  const walk = (items: readonly import("../../src/tree/types").SoftTreeItem[]) => {
    for (const i of items)
      if (isSoftNode(i)) {
        keys.push(i.key);
        walk(i.children);
      }
  };
  walk(data.roots);
  keys.push(...data.sets.map((s) => s.key));
  const { bones, soft } = await allIds();
  keys.push(...bones.map(groups.attachedKey));
  for (const key of keys) {
    const g = groups.groupOf(key)!;
    out[`group:${key}`] = {
      label: g.label,
      name: g.name,
      trail: g.trail,
      parent: g.parent,
      layer: groups.groupLayer(key),
      members: g.members,
      ...(g.attached ? { attached: g.attached } : {}),
      counts: groups.groupCounts(key),
      announce: groups.groupAnnouncement(key),
      back: groups.groupAnnouncement(key, true),
      ancestors: groups.groupAncestors(key),
    };
  }
  for (const id of [...bones, ...soft]) out[`ancestors:${id}`] = groups.ancestorsOf(id);
  return out;
}

// ---------------------------------------------------------------------------
// regions.json (M13 BL, plan decision 4)

/**
 * For every ID: its fine regions (`located_in`, as the main chunk ships them);
 * for every region (fine, then coarse): name, coarse parent and members per
 * layer, in index order; and the graph's view of one ID per kind of entry.
 */
export async function buildRegions(): Promise<Golden> {
  const { regionList, regionsOf, membersOf } = await import("../../src/regions/index");
  const { layerOfId } = await import("../../src/content/index");
  const { bones, soft } = await allIds();
  const out: Golden = {};
  for (const id of [...bones, ...soft]) out[id] = regionsOf(id);
  for (const r of regionList()) {
    const byLayer: Record<string, string[]> = {};
    for (const id of membersOf(r.key)) (byLayer[layerOfId(id) ?? "?"] ??= []).push(id);
    out[`region:${r.key}`] = { name: r.name, coarse: r.coarse, members: byLayer };
  }
  return out;
}
