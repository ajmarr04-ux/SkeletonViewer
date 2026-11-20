// The info panel's model for the new kinds: built from the soft-tissue table
// (name, kind, layer, side, the muscle a part belongs to; M7 plan decision 12)
// plus, once its layer's content chunk is loaded, the written Latin name and
// summary (M8 plan decision 11). The kind-specific sections are M9's. Nothing is
// invented here (spec §12).

import { LAYER_LABELS, softEntry, softOpposite } from "./softRegistry";
import type { SoftKind, SoftId } from "../layers/softIds";
import type { SoftLayerContent } from "./softCompile";

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
  /**
   * Breadcrumb under "Skeleton" (spec §5.1 rule 4): `Muscles › Upper limb ›
   * Triceps brachii › Long head` for a part, `Muscles › Upper limb › Triceps
   * brachii` for a muscle (the region once the muscles' content is loaded),
   * `Ligaments › <name>` for the others.
   */
  trail: string[];
  /** The crumb that names a selected part's muscle (one level up), else null. */
  parentCrumb: number | null;
  /** Both sides of a pair, left first (for the side toggle); else null. */
  pair: { left: string; right: string } | null;
  /** Something is drawn for it: its own mesh, or (a muscle with parts) its parts'. */
  meshAvailable: boolean;
  /** From the content file, or null while it is unwritten (or its chunk not loaded). */
  latin: string | null;
  common: string | null;
  /** The summary as HTML, or null. */
  summary: string | null;
  /** The content file exists (and is loaded). */
  written: boolean;
};

/** The regions of content/muscle-hierarchy.json (checked in tests/nestedSelection.test.ts). */
export const MUSCLE_REGION_LABELS: Record<string, string> = {
  head: "Head",
  neck: "Neck",
  back: "Back",
  thorax: "Thorax",
  abdomen: "Abdomen",
  pelvis_perineum: "Pelvis and perineum",
  upper_limb: "Upper limb",
  lower_limb: "Lower limb",
};

/** A part's crumb: its name without "of <muscle>" ("Long head of triceps brachii" → "Long head"). */
export function partLabel(name: string, muscle: string): string {
  const tail = ` of ${muscle}`;
  if (!name.toLowerCase().endsWith(tail.toLowerCase()) || name.length === tail.length) return name;
  const head = name.slice(0, name.length - tail.length);
  return head[0]!.toUpperCase() + head.slice(1);
}

/** A muscle's region label from its content file's `region`, if loaded. */
function regionLabel(muscleId: string, content: SoftLayerContent | null): string | null {
  const fm = content?.entries[muscleId]?.fm;
  const key = fm && "region" in fm && Array.isArray(fm.region) ? fm.region[0] : undefined;
  return key ? (MUSCLE_REGION_LABELS[key] ?? null) : null;
}

export function softPanelModel(id: string, content: SoftLayerContent | null = null): SoftPanelModel | null {
  const e = softEntry(id);
  if (!e) return null;
  const parent = e.parent ? softEntry(e.parent) : undefined;
  const opposite = softOpposite(id);
  const written = content?.entries[id];
  const kind = e.kind === "muscle_part" && e.partType ? `Muscle part: ${PART_LABELS[e.partType].toLowerCase()}` : KIND_LABELS[e.kind];
  return {
    id,
    name: e.name,
    side: e.side,
    badges: { layer: LAYER_LABELS[e.layer], kind },
    partOf: parent ? { id: parent.id, name: parent.name } : null,
    ...trailOf(e, parent, content),
    pair: opposite === null ? null : e.side === "left" ? { left: id, right: opposite } : { left: opposite, right: id },
    meshAvailable: e.mesh || (e.parts?.length ?? 0) > 0,
    latin: written?.latin ?? null,
    common: written?.common ?? null,
    summary: written?.summary ?? null,
    written: written !== undefined,
  };
}

function trailOf(e: SoftId, parent: SoftId | undefined, content: SoftLayerContent | null): { trail: string[]; parentCrumb: number | null } {
  const layer = LAYER_LABELS[e.layer];
  if (e.layer !== "muscles") return { trail: [layer, e.name], parentCrumb: null };
  const muscle = parent ?? e;
  const region = regionLabel(muscle.id, content);
  const top = region ? [layer, region] : [layer];
  if (!parent) return { trail: [...top, e.name], parentCrumb: null };
  return { trail: [...top, parent.name, partLabel(e.name, parent.name)], parentCrumb: top.length };
}

/** What a screen reader hears on selecting one: "Biceps brachii, left, selected. Isolated." */
export function softAnnouncement(id: string): string | null {
  const e = softEntry(id);
  if (!e) return null;
  const side = e.side === "midline" ? "" : `, ${e.side}`;
  const drawn = e.mesh || (e.parts?.length ?? 0) > 0;
  return `${e.name}${side}, selected. ${drawn ? "Isolated." : "No 3D model."}`;
}
