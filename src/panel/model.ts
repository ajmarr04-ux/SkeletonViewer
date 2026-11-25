// The info panel's model for every kind (SPEC-platform §5.1; M12 plan
// decision 11): one function turns an ID, its layer's loaded content and the
// graph into the sections its kind's descriptor lists (`panel`, in render
// order) and the chrome around them (`chrome`). Generic: it names no layer,
// kind, field or edge type; everything kind-specific is in the descriptors.
// InfoPanel.tsx renders it by `render` type (session BE).

import ids from "../../content/ids.json";
import type { Graph } from "../graph/graph";
import { appGraph } from "../content/appGraph";
import { indexNode, isEagerId, lazyEntry, layerOfId } from "../content/index";
import { kindDescriptor, type KindId } from "../systems/registry";
import type { LinksOrder, PanelChrome, PanelContext, PanelSection } from "../systems/types";

type Side = "left" | "right" | "midline";
/** One structure as the ID index knows it, whichever layer. */
type IndexEntry = { id: string; name: string; kind: string; layer: string; side: Side; parent: string | null; partType: string | null; parts: readonly string[]; mesh: boolean };

type EagerEntry = { id: string; name: string; kind: string; side: Side; meshAvailable: boolean };
const EAGER = new Map((ids as EagerEntry[]).map((e) => [e.id, e]));

function indexEntry(id: string): IndexEntry | undefined {
  const b = EAGER.get(id);
  if (b) return { id, name: b.name, kind: b.kind, layer: layerOfId(id)!, side: b.side, parent: null, partType: null, parts: [], mesh: b.meshAvailable };
  const e = lazyEntry(id);
  if (!e) return undefined;
  return { id, name: e.name, kind: e.kind, layer: e.layer, side: e.side, parent: e.parent ?? null, partType: e.partType ?? null, parts: e.parts ?? [], mesh: e.mesh };
}

/** A structure's content record: its compiled fields (Latin name, summary HTML…) and, for a front-matter layer, the front matter. */
export type ContentRecord = Readonly<Record<string, unknown>>;
/** A layer's loaded content as the loaders give it: flat compiled entries (the eager layer) or `{ entries: { id: { fm, … } } }`. */
export type LayerContent = Readonly<Record<string, unknown>>;

/** One structure's record from a layer's content, whichever of the two shapes it has. */
export function recordIn(content: LayerContent | null | undefined, id: string): ContentRecord | undefined {
  if (!content) return undefined;
  const entries = content.entries as Record<string, { fm?: Record<string, unknown> } & Record<string, unknown>> | undefined;
  if (entries && typeof entries === "object") {
    const e = entries[id];
    if (!e) return undefined;
    const { fm, ...rest } = e;
    return { ...fm, ...rest };
  }
  return content[id] as ContentRecord | undefined;
}

/** A link in a section: what it selects, its label, and an optional detail and joint highlight. */
export type PanelLink = { id: string; label: string; detail?: string; node?: string; joint?: { a: string; b: string; name: string } };
/** One row of an actions table: "Elbow joint · extension · prime mover". */
export type ActionRow = { joint: string; movement: string; role: string };

type Common = { title: string; testId: string; empty: string | undefined };
export type SectionModel = Common &
  (
    | { render: "text"; format: "html" | "prose" | "line"; value: string | null; inherited: PanelLink | null }
    | { render: "list"; items: string[] | null; inline: boolean; count: number | null; toggle: string | null }
    | { render: "links"; links: PanelLink[] | null; nameOnly: boolean; also: { title: string; links: PanelLink[] } | null; highlight: boolean }
    | {
        render: "grouped-links";
        groups: { title: string; testId: string; role: string; links: PanelLink[] }[] | null;
        /** The section's isolate button (the bones' "Show attached muscles"), else null. */
        isolate: { text: string; title: string; noneTitle: string; noneReason: string } | null;
      }
    | { render: "actions-table"; rows: ActionRow[]; inherited: ActionRow[]; fallback: string[] }
    | { render: "custom"; component: string; data: unknown }
  );

export type PanelModel = {
  id: string;
  kind: string;
  layer: string;
  side: Side;
  title: string;
  /** The Latin name, or the kind's type line (`latin` false). */
  subtitle: { text: string; latin: boolean };
  /** The parent (a part's muscle), for kinds whose chrome shows "Part of"; undefined for the others. */
  partOf: { id: string; name: string } | null | undefined;
  common: string | null;
  /** Shown as "Common name: Not written yet" while unwritten, or only when written. */
  commonShown: PanelChrome["common"];
  written: boolean;
  /** Both sides of a pair, left first (the side toggle); else null. */
  pair: { left: string; right: string } | null;
  badges: string[];
  draft: boolean;
  /** For kinds with a no-model note: the note when there's no mesh, else null; undefined for the others. */
  note: string | null | undefined;
  /** Something is drawn for it: its own mesh, or its parts'. */
  meshAvailable: boolean;
  sections: SectionModel[];
  trail: string[];
  /** The crumb naming the parent, for kinds whose trail has one; undefined for the others. */
  parentCrumb: number | null | undefined;
};

/** What a section (or the common name) says while the structure's file isn't written or loaded. */
export const NOT_WRITTEN = "Not written yet";

/** snake_case → words ("lateral_rotation" → "lateral rotation"). */
export const words = (snake: string): string => snake.replace(/_/g, " ");

/** A structure's label under a focus: its name, the side only when it differs (a midline focus shows both sides); none for kinds whose name says it. */
export function structureLabel(id: string, focusSide: Side): string {
  const e = indexEntry(id);
  if (!e) return indexNode(id)?.name ?? id;
  if (e.side === "midline" || e.side === focusSide || kindDescriptor(e.kind as KindId).sideInName === false) return e.name;
  return `${e.name} (${e.side})`;
}

/** The same structure on the other side: the eager layer pairs by name and group, the others by the `_left`/`_right` suffix. */
export type OppositeOf = (id: string) => string | null;

export type PanelInputs = {
  /** A layer's loaded content, or null while it loads. */
  content(layer: string): LayerContent | null;
  opposite: OppositeOf;
  graph?: Graph;
  /** Overrides how a landmark is named (default: from the structure's layer content). */
  landmarkName?: (structure: string, landmark: string) => string | undefined;
};

/** The context a kind's panel functions read (`PanelContext`). */
function contextOf(e: IndexEntry, inputs: PanelInputs): PanelContext {
  const own = inputs.content(e.layer);
  return {
    id: e.id,
    name: e.name,
    kind: e.kind,
    layer: e.layer,
    side: e.side,
    parent: e.parent,
    partType: e.partType,
    record: recordIn(own, e.id),
    recordOf: (id) => recordIn(own, id),
    link: (id) => ({ id, label: structureLabel(id, e.side) }),
    nameOf: (id) => indexEntry(id)?.name ?? indexNode(id)?.name ?? id,
    landmarkName(structure, landmark) {
      if (inputs.landmarkName) return inputs.landmarkName(structure, landmark);
      const layer = layerOfId(structure);
      const r = layer === null ? undefined : recordIn(inputs.content(layer), structure);
      const i = (r?.landmarkIds as string[] | undefined)?.indexOf(landmark) ?? -1;
      return i < 0 ? undefined : (r!.landmarks as string[])[i];
    },
    nodeName: (id) => indexNode(id)?.name ?? words(id),
  };
}

type Along = { other: string; meta: Readonly<Record<string, string>> | undefined };

/** The edges along a step name from `id` (forward type, inverse label or symmetric type), each with the structure at the other end. */
function along(g: Graph, id: string, name: string): Along[] {
  const r = g.types.byLabel(name);
  if (!r) throw new Error(`panel: no edge type or inverse label "${name}"`);
  const { type, inverse } = r;
  const list = inverse ? g.in(id, type.id) : g.out(id, type.id);
  return list.map((e) => ({ other: inverse ? e.from : type.symmetric && e.to === id ? e.from : e.to, meta: e.meta }));
}

function sortLinks(links: PanelLink[], order: LinksOrder | undefined): PanelLink[] {
  if (order === "id") return [...links].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (order === "name") {
    const key = (l: PanelLink) => indexEntry(l.id) ?? { name: l.label, side: "midline" as Side };
    return [...links].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return x.name.localeCompare(y.name) || x.side.localeCompare(y.side) || a.id.localeCompare(b.id);
    });
  }
  return links;
}

/** The links along some step names: unique per target (and detail), `exceptMeta` edges left out. */
function linksAlong(g: Graph, ctx: PanelContext, names: string | readonly string[], opts: { exceptMeta?: string; detail?: { meta: string }; highlight?: boolean }): PanelLink[] {
  const seen = new Set<string>();
  const out: PanelLink[] = [];
  for (const name of typeof names === "string" ? [names] : names)
    for (const a of along(g, ctx.id, name)) {
      if (opts.exceptMeta && a.meta?.[opts.exceptMeta] !== undefined) continue;
      const node = opts.detail ? (a.meta?.[opts.detail.meta] ?? "") : undefined;
      const key = node === undefined ? a.other : `${a.other} ${node}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const link: PanelLink = ctx.link(a.other);
      if (node !== undefined) {
        link.node = node;
        link.detail = ctx.nodeName(node);
        if (opts.highlight) link.joint = { a: ctx.id, b: a.other, name: link.detail };
      }
      out.push(link);
    }
  return out;
}

function sectionModel(s: PanelSection, ctx: PanelContext, g: Graph): SectionModel | null {
  const common: Common = { title: s.title, testId: s.testId, empty: s.empty };
  const r = ctx.record;
  switch (s.render) {
    case "text": {
      const own = r?.[s.field] as string | null | undefined;
      if (!own && s.inherit && ctx.parent) {
        const theirs = ctx.recordOf(ctx.parent)?.[s.field] as string | null | undefined;
        return { ...common, render: "text", format: s.format, value: theirs || null, inherited: theirs ? ctx.link(ctx.parent) : null };
      }
      return { ...common, render: "text", format: s.format, value: own ?? null, inherited: null };
    }
    case "list":
      return {
        ...common,
        render: "list",
        items: r ? ((r[s.field] as string[] | null | undefined) ?? null) : null,
        inline: s.inline ?? false,
        count: s.count ? ((r?.[s.count.field] as number | undefined) ?? 0) : null,
        toggle: s.count?.toggle ?? null,
      };
    case "links": {
      if (s.needsContent && !r) return { ...common, render: "links", links: null, nameOnly: s.nameOnly ?? false, also: null, highlight: false };
      const also = s.also ? linksAlong(g, ctx, s.also.edges, {}) : [];
      const drop = new Set([...also.map((l) => l.id), ...(s.exclude ? g.neighbours(ctx.id, s.exclude) : [])]);
      const links = sortLinks(
        linksAlong(g, ctx, s.edges, { exceptMeta: s.exceptMeta, detail: s.detail, highlight: s.highlight === "pair" }).filter((l) => !drop.has(l.id)),
        s.order,
      );
      if (s.omitEmpty && links.length === 0) return null;
      return {
        ...common,
        render: "links",
        links,
        nameOnly: s.nameOnly ?? false,
        also: s.also && also.length > 0 ? { title: s.also.title, links: also } : null,
        highlight: s.highlight === "pair",
      };
    }
    case "grouped-links":
      return {
        ...common,
        render: "grouped-links",
        isolate: s.isolate ?? null,
        groups:
          s.needsContent && !r
            ? null
            : s.groups.map((grp) => ({ title: grp.title, testId: grp.testId, role: grp.role, links: sortLinks(linksAlong(g, ctx, grp.edges, { exceptMeta: s.exceptMeta }), s.order) })),
      };
    case "actions-table": {
      type Raw = { joint: string; movement: string; role: string };
      const row = (a: Raw): ActionRow => ({ joint: ctx.nodeName(a.joint), movement: words(a.movement), role: s.roles[a.role] ?? a.role });
      const own = (r?.[s.field] as Raw[] | undefined) ?? [];
      const theirs = s.inherit && ctx.parent ? ((ctx.recordOf(ctx.parent)?.[s.field] as Raw[] | undefined) ?? []) : [];
      const inherited = theirs.filter((a) => !own.some((o) => o.joint === a.joint && o.movement === a.movement));
      return { ...common, render: "actions-table", rows: own.map(row), inherited: inherited.map(row), fallback: s.fallback ? ((r?.[s.fallback] as string[] | undefined) ?? []) : [] };
    }
    case "custom":
      return { ...common, render: "custom", component: s.component, data: s.model(ctx) };
  }
}

/** The panel for one structure, or null for an unknown ID or a kind without a panel. */
export function panelModel(id: string, inputs: PanelInputs): PanelModel | null {
  const e = indexEntry(id);
  if (!e) return null;
  const kind = kindDescriptor(e.kind as KindId);
  const chrome = kind.chrome;
  if (!chrome || !kind.panel) return null;
  const g = inputs.graph ?? appGraph();
  const ctx = contextOf(e, inputs);
  const r = ctx.record;
  const written = r !== undefined;
  const list = written || chrome.unwritten === "all-sections" ? kind.panel : kind.panel.slice(0, 1);
  const opposite = inputs.opposite(id);
  const parent = e.parent ? indexEntry(e.parent) : undefined;
  const latin = (r?.latin as string | null | undefined) ?? null;
  const { trail, parentCrumb } = chrome.trail(ctx);
  return {
    id,
    kind: e.kind,
    layer: e.layer,
    side: e.side,
    title: e.name,
    subtitle: latin !== null ? { text: latin, latin: true } : { text: chrome.typeLine(ctx), latin: false },
    partOf: chrome.partOf ? (parent ? { id: parent.id, name: parent.name } : null) : undefined,
    common: written ? ((r.common as string | null | undefined) ?? null) : null,
    commonShown: chrome.common,
    written,
    pair: opposite === null ? null : e.side === "left" ? { left: id, right: opposite } : { left: opposite, right: id },
    badges: [...chrome.badges(ctx)],
    draft: chrome.draft === "always" || !written || r.reviewed !== true,
    note: chrome.noModelNote === undefined ? undefined : e.mesh ? null : chrome.noModelNote,
    meshAvailable: e.mesh || e.parts.length > 0,
    sections: list.map((s) => sectionModel(s, ctx, g)).filter((s): s is SectionModel => s !== null),
    trail,
    parentCrumb,
  };
}

/** The opposite structure across layers: `eager` for the eager layer's IDs, `lazy` for the others. */
export const oppositeAcross =
  (eager: OppositeOf, lazy: OppositeOf): OppositeOf =>
  (id) =>
    isEagerId(id) ? eager(id) : lazy(id);
