// The info panel's placeholder for the new kinds in M7 (plan decision 12):
// built from the soft-tissue table only (name, kind, layer, side, the muscle a
// part belongs to). The written content arrives in M8 and M9; nothing is
// invented here (spec §12).

import { LAYER_LABELS, softEntry, softOpposite } from "./softRegistry";
import type { SoftKind, SoftId } from "../layers/softIds";

export const KIND_LABELS: Record<SoftKind, string> = {
  muscle: "Muscle",
  muscle_part: "Muscle part",
  ligament: "Ligament",
  cartilage: "Cartilage",
  disc: "Intervertebral disc",
  meniscus: "Meniscus",
};

const PART_LABELS: Record<NonNullable<SoftId["partType"]>, string> = {
  head: "Head",
  belly: "Belly",
  portion: "Portion",
  tendon: "Tendon",
  aponeurosis: "Aponeurosis",
};

export type SoftPanelModel = {
  id: string;
  name: string;
  side: SoftId["side"];
  /** Badge row: layer, kind (with the part type for parts). */
  badges: { layer: string; kind: string };
  /** The muscle a part belongs to, or null. */
  partOf: { id: string; name: string } | null;
  /** Breadcrumb under "Skeleton": `Muscles › <name>`. */
  trail: string[];
  /** Both sides of a pair, left first (for the side toggle); else null. */
  pair: { left: string; right: string } | null;
  meshAvailable: boolean;
};

export function softPanelModel(id: string): SoftPanelModel | null {
  const e = softEntry(id);
  if (!e) return null;
  const parent = e.parent ? softEntry(e.parent) : undefined;
  const opposite = softOpposite(id);
  const kind = e.kind === "muscle_part" && e.partType ? `Muscle part: ${PART_LABELS[e.partType].toLowerCase()}` : KIND_LABELS[e.kind];
  return {
    id,
    name: e.name,
    side: e.side,
    badges: { layer: LAYER_LABELS[e.layer], kind },
    partOf: parent ? { id: parent.id, name: parent.name } : null,
    trail: [LAYER_LABELS[e.layer], e.name],
    pair: opposite === null ? null : e.side === "left" ? { left: id, right: opposite } : { left: opposite, right: id },
    meshAvailable: e.mesh,
  };
}

/** What a screen reader hears on selecting one: "Biceps brachii, left, selected. Isolated." */
export function softAnnouncement(id: string): string | null {
  const e = softEntry(id);
  if (!e) return null;
  const side = e.side === "midline" ? "" : `, ${e.side}`;
  return `${e.name}${side}, selected. ${e.mesh ? "Isolated." : "No 3D model."}`;
}
