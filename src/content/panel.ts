// The info panel's model (spec §7) from the compiled content (plan step 4).
// Objects whose file isn't written yet fall back to the placeholder text
// ("Not written yet"); the articulations always come from articulations.json.

import type { CompiledContent, CompiledEntry } from "./compile";
import { groupTrail } from "./labels";
import { panelModel as placeholderModel, type PanelModel as PlaceholderModel } from "./placeholder";
import { adjacentTeeth, relations as appRelations, type Relations } from "./relations";
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
  muscles: string[] | null;
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

export function panelModel(id: string, content: CompiledContent | null, rel: Relations = appRelations): PanelModel | null {
  const base = placeholderModel(id);
  if (!base) return null;
  const { sections: _sections, ...rest } = base;
  const c = content?.[id] ?? null;
  const neighbours = new Set(adjacentTeeth(id));
  const articulations = rel
    .articulationsOf(id)
    .filter((a) => !neighbours.has(a.other))
    .map((a) => ({ id: a.other, label: linkLabel(a.other, id), joint: a.joint, name: a.name }));
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
    muscles: c?.muscles ?? null,
    clinical: c ? c.clinical : null,
  };
}
