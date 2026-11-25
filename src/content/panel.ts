// The bone panel's M4 shape, read off the generic panel model (src/panel/model.ts;
// M12 BD) for InfoPanel.tsx until it renders the sections itself (BE, which
// deletes this file). No kind switch here: the sections are the bone kinds'
// descriptors (src/systems/musculoskeletal/bones/panel.ts).

import { isEagerId } from "./index";
import type { CompiledContent, CompiledEntry } from "./compile";
import { oppositeOf, type PanelModel as PlaceholderModel } from "./placeholder";
import { panelModel as generic, structureLabel, type PanelLink as GenericLink, type SectionModel } from "../panel/model";
import { EAGER_LAYER } from "../systems/registry";
import ids from "../../content/ids.json";

export { typeLabel } from "../systems/musculoskeletal/bones/panel";

type Entry = { id: string; side: "left" | "right" | "midline" };
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
  /** Attached muscles (spec §5.4): the muscles and parts with their origin, and those with their insertion, on this bone. Null while unwritten. */
  origins: PanelLink[] | null;
  insertions: PanelLink[] | null;
  clinical: string | null;
};

/** A partner's name as listed under the focus: the side only when it differs ("Rib 1 (right)"). */
export function linkLabel(id: string, focus: string): string {
  return BY_ID.has(id) ? structureLabel(id, BY_ID.get(focus)?.side ?? "midline") : id;
}

/** A bone's landmark name by its ID, if written (the muscle panels name an attachment's landmark). */
export function landmarkName(c: CompiledEntry | undefined, landmark: string): string | undefined {
  const i = c?.landmarkIds.indexOf(landmark) ?? -1;
  return i < 0 ? undefined : c!.landmarks[i];
}

/** A muscle or part attached to a bone: its name, with the side only when it differs from the bone's (both sides on a midline bone). */
export function attachedLabel(row: { id: string; name: string; side: Entry["side"] }, boneSide: Entry["side"]): string {
  return row.side === "midline" || row.side === boneSide ? row.name : `${row.name} (${row.side})`;
}

const plain = (l: GenericLink): PanelLink => ({ id: l.id, label: l.label });

export function panelModel(id: string, content: CompiledContent | null): PanelModel | null {
  if (!isEagerId(id)) return null;
  const m = generic(id, { content: (layer) => (layer === EAGER_LAYER ? content : null), opposite: oppositeOf });
  if (!m) return null;
  const by = new Map(m.sections.map((s) => [s.testId, s]));
  const text = (k: string) => (by.get(k) as Extract<SectionModel, { render: "text" }> | undefined)?.value ?? null;
  const list = (k: string) => by.get(k) as Extract<SectionModel, { render: "list" }> | undefined;
  const links = m.sections.find((s): s is Extract<SectionModel, { render: "links" }> => s.render === "links")!;
  const groups = m.sections.find((s): s is Extract<SectionModel, { render: "grouped-links" }> => s.render === "grouped-links")!.groups;
  return {
    id,
    name: m.title,
    side: m.side,
    kind: m.kind as PlaceholderModel["kind"],
    latin: m.subtitle.latin ? m.subtitle.text : null,
    common: m.common,
    badges: { region: m.badges[0]!, type: m.badges[1]!, draft: m.draft },
    trail: m.trail,
    meshAvailable: m.meshAvailable,
    note: m.note ?? null,
    opposite: oppositeOf(id),
    pair: m.pair,
    written: m.written,
    summary: text("summary"),
    functions: list("functions")?.items ?? null,
    articulations: (links.links ?? []).map((l) => ({ id: l.id, label: l.label, joint: l.node ?? "", name: l.detail ?? "" })),
    neighbours: (links.also?.links ?? []).map(plain),
    landmarks: list("landmarks")?.items ?? null,
    landmarkPositions: list("landmarks")?.count ?? 0,
    origins: groups ? groups[0]!.links.map(plain) : null,
    insertions: groups ? groups[1]!.links.map(plain) : null,
    clinical: text("clinical"),
  };
}
