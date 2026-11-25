// The info panel's model (spec §7) from the compiled content (plan step 4).
// Objects whose file isn't written yet fall back to the placeholder text
// ("Not written yet"); the articulations always come from the graph's
// `articulates_with` edges (articulations.json, M12), named by their joint node.

import type { AttachedRow, CompiledContent, CompiledEntry } from "./compile";
import { groupTrail } from "./labels";
import { panelModel as placeholderModel, type PanelModel as PlaceholderModel } from "./placeholder";
import { appGraph } from "./appGraph";
import { indexNode } from "./index";
import ids from "../../content/ids.json";

type Entry = { id: string; name: string; side: "left" | "right" | "midline"; kind: string; meshAvailable: boolean };
const BY_ID = new Map((ids as Entry[]).map((e) => [e.id, e]));

export type PanelLink = { id: string; label: string };
export type PanelArticulation = PanelLink & { joint: string; name: string };

export type PanelModel = Omit<PlaceholderModel, "sections" | "latin" | "common"> & {
  latin: string | null;
  common: string | null;
  /** True once the object's content file is written and loaded. */
  written: boolean;
  summary: string | null;
  functions: string[] | null;
  /** Every articulation (spec §7 item 5), each a link to the partner. */
  articulations: PanelArticulation[];
  /** Teeth only: the neighbouring teeth in the arch (plan decision 3). */
  neighbours: PanelLink[];
  landmarks: string[] | null;
  /** How many landmarks have a 3D position (none yet: plan decision 9). */
  landmarkPositions: number;
  /**
   * Attached muscles (spec §5.4; M9 plan decision 9): the muscles and parts
   * with their origin, and those with their insertion, on this bone, each a
   * link. Null while the content is unwritten.
   */
  origins: PanelLink[] | null;
  insertions: PanelLink[] | null;
  clinical: string | null;
};

const TYPE_LABELS: Record<CompiledEntry["type"], string> = {
  long: "Long bone",
  short: "Short bone",
  flat: "Flat bone",
  irregular: "Irregular bone",
  sesamoid: "Sesamoid bone",
  tooth: "Tooth",
};

/** The type badge: "Flat bone", or "Tooth type: molar". */
export function typeLabel(c: CompiledEntry): string {
  if (c.type === "tooth" && c.toothType) return `Tooth type: ${c.toothType}`;
  return TYPE_LABELS[c.type];
}

/** A partner's name as listed under the focus: the side only when it differs ("Rib 1 (right)"). */
export function linkLabel(id: string, focus: string): string {
  const e = BY_ID.get(id);
  if (!e) return id;
  const f = BY_ID.get(focus);
  if (e.side === "midline" || e.kind === "tooth" || e.side === f?.side) return e.name;
  return `${e.name} (${e.side})`;
}

/** A bone's landmark name by its ID, if written (the muscle panels name an attachment's landmark). */
export function landmarkName(c: CompiledEntry | undefined, landmark: string): string | undefined {
  const i = c?.landmarkIds.indexOf(landmark) ?? -1;
  return i < 0 ? undefined : c!.landmarks[i];
}

/** A muscle or part attached to a bone: its name, with the side only when it differs from the bone's (both sides on a midline bone). */
export function attachedLabel(row: AttachedRow, boneSide: Entry["side"]): string {
  return row.side === "midline" || row.side === boneSide ? row.name : `${row.name} (${row.side})`;
}

export function panelModel(id: string, content: CompiledContent | null): PanelModel | null {
  const base = placeholderModel(id);
  if (!base) return null;
  const { sections: _sections, ...rest } = base;
  const c = content?.[id] ?? null;
  const graph = appGraph();
  const neighbours = new Set(graph.neighbours(id, "adjacent_tooth"));
  const articulations = graph
    .out(id, "articulates_with")
    .map((e) => ({ other: e.from === id ? e.to : e.from, joint: e.meta?.joint ?? "" }))
    .filter((a) => !neighbours.has(a.other))
    .map((a) => ({ id: a.other, label: linkLabel(a.other, id), joint: a.joint, name: indexNode(a.joint)?.name ?? a.joint }));
  return {
    ...rest,
    latin: c?.latin ?? null,
    common: c ? c.common : null,
    badges: c
      ? { region: groupTrail(c.region)[0] ?? base.badges.region, type: typeLabel(c), draft: !c.reviewed }
      : base.badges,
    written: c !== null,
    summary: c?.summary ?? null,
    functions: c?.functions ?? null,
    articulations,
    neighbours: [...neighbours].filter((t) => BY_ID.has(t)).map((t) => ({ id: t, label: linkLabel(t, id) })),
    landmarks: c?.landmarks ?? null,
    landmarkPositions: c?.landmarkPositions ?? 0,
    origins: c ? c.attached.origins.map((r) => ({ id: r.id, label: attachedLabel(r, base.side) })) : null,
    insertions: c ? c.attached.insertions.map((r) => ({ id: r.id, label: attachedLabel(r, base.side) })) : null,
    clinical: c ? c.clinical : null,
  };
}
