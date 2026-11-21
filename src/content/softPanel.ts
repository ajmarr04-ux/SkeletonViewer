// The info panel's model for the new kinds: built from the soft-tissue table
// (name, kind, layer, side, the muscle a part belongs to; M7 plan decision 12)
// plus, once its layer's content chunk is loaded, the written Latin name and
// summary (M8 plan decision 11). The kind-specific sections are M9's. Nothing is
// invented here (spec §12).

import { LAYER_LABELS, softEntry, softOpposite } from "./softRegistry";
import type { SoftKind, SoftId } from "../layers/softIds";
import type { SoftLayerContent } from "./softCompile";
import type { Action, Attachment } from "./softSchema";
import boneIds from "../../content/ids.json";

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
export function softAnnouncement(id: string, tier: 0 | 1 | 2 = 0, shown = 0): string | null {
  const e = softEntry(id);
  if (!e) return null;
  const side = e.side === "midline" ? "" : `, ${e.side}`;
  if (tier > 0) {
    const muscle = e.kind === "muscle" || e.kind === "muscle_part";
    const what = tier === 1 ? (muscle ? "attachments" : "related structures") : muscle ? "functional group" : "joint";
    return `${e.name}${side}: ${what} shown, ${shown} ${shown === 1 ? "structure" : "structures"}.`;
  }
  const drawn = e.mesh || (e.parts?.length ?? 0) > 0;
  return `${e.name}${side}, selected. ${drawn ? "Isolated." : "No 3D model."}`;
}

// ---------------------------------------------------------------------------
// Kind-specific sections (musculoskeletal spec §7; M9 plan decision 9), from
// the front matter in the layer's lazy content chunk. Every structure named
// is a link; a part's inherited origin, insertion, actions and innervation
// come from its muscle's file and say so. Nothing here is invented: an
// unwritten field stays empty.

/** A structure named in a section: what a link selects, and its label. */
export type SoftLink = { id: string; label: string };
/** One origin or insertion: a structure (link) with its landmark, or the free text of a non-object (spec §4.2). */
export type AttachmentRow = {
  link: SoftLink | null;
  landmark: string | null;
  text: string | null;
  /** For a muscle whose parts declare their own (spec §4.1: its list is then empty): the part's short name ("Long head"). */
  part: string | null;
};
export type AttachmentList = { rows: AttachmentRow[]; inheritedFrom: SoftLink | null };
/** "Elbow joint · extension · prime mover". */
export type ActionRow = { joint: string; movement: string; role: string };

export type MuscleSections = {
  kind: "muscle";
  parts: SoftLink[];
  partOf: SoftLink | null;
  origin: AttachmentList;
  insertion: AttachmentList;
  /** Its own actions (a part: those that differ from or add to its muscle's). */
  actions: ActionRow[];
  /** A part's: the muscle's actions it shares; else empty. */
  inheritedActions: ActionRow[];
  /** Written where a muscle has no actions (spec §4.3). */
  functions: string[];
  synergists: SoftLink[];
  antagonists: SoftLink[];
  innervation: { text: string; inheritedFrom: SoftLink | null } | null;
  clinical: string | null;
};
export type JoinSections = {
  kind: "ligament" | "cartilage";
  /** The joint's name, or null for a structure that is not part of one. */
  joint: string | null;
  /** Connects (ligament) or Attached to (cartilage, disc, meniscus). */
  links: SoftLink[];
  functions: string[];
  clinical: string | null;
};
export type SoftSections = MuscleSections | JoinSections;

type BoneEntry = { id: string; name: string; side: "left" | "right" | "midline"; kind: string };
const BONES = new Map((boneIds as BoneEntry[]).map((e) => [e.id, e]));

/** A structure's label under a focus: its name, with the side only when it differs (a midline focus shows both sides). */
export function structureLabel(id: string, focusSide: SoftId["side"]): string {
  const b = BONES.get(id);
  const e = b ?? softEntry(id);
  if (!e) return id;
  if (e.side === "midline" || e.side === focusSide || (b && b.kind === "tooth")) return e.name;
  return `${e.name} (${e.side})`;
}

/** snake_case → words ("lateral_rotation" → "lateral rotation"). */
export const words = (snake: string): string => snake.replace(/_/g, " ");
const ROLE_LABELS: Record<Action["role"], string> = { prime: "prime mover", assist: "assists", stabiliser: "stabiliser" };

/** A landmark's written name from its bone's content (else its ID in words, capitalised). */
export type LandmarkName = (structure: string, landmark: string) => string | undefined;
const fallbackLandmark = (l: string) => {
  const w = words(l);
  return w[0]!.toUpperCase() + w.slice(1);
};

/**
 * The sections for a soft-tissue structure once its layer's content is
 * loaded and its file written; else null (the panel says "Not written yet").
 */
export function softSections(id: string, content: SoftLayerContent | null, landmarkName: LandmarkName = () => undefined): SoftSections | null {
  const entry = content?.entries[id];
  const e = softEntry(id);
  if (!entry || !e) return null;
  const fm = entry.fm;
  const link = (x: string): SoftLink => ({ id: x, label: structureLabel(x, e.side) });
  const joint = (j: string) => content.joints?.[j] ?? words(j);
  if (fm.kind === "ligament") return { kind: "ligament", joint: fm.joint === null ? null : joint(fm.joint), links: fm.connects.map(link), functions: fm.functions, clinical: fm.clinicalNote };
  if (fm.kind !== "muscle" && fm.kind !== "muscle_part")
    return { kind: "cartilage", joint: fm.joint === null ? null : joint(fm.joint), links: fm.attachedTo.map(link), functions: fm.functions, clinical: fm.clinicalNote };
  const parent = fm.kind === "muscle_part" && fm.parent !== null ? content.entries[fm.parent]?.fm : undefined;
  const parentFm = parent && parent.kind === "muscle" ? parent : undefined;
  const parentLink = fm.kind === "muscle_part" && fm.parent !== null ? link(fm.parent) : null;
  const rows = (list: Attachment[], part: string | null = null): AttachmentRow[] =>
    list.map((a) =>
      "structure" in a
        ? { link: link(a.structure), landmark: a.landmark === undefined ? null : (landmarkName(a.structure, a.landmark) ?? fallbackLandmark(a.landmark)), text: null, part }
        : { link: null, landmark: null, text: a.soft, part },
    );
  const attachments = (own: Attachment[] | "inherit", key: "origin" | "insertion"): AttachmentList => {
    if (own === "inherit") return { rows: rows(parentFm?.[key] ?? []), inheritedFrom: parentLink };
    if (own.length > 0 || fm.kind !== "muscle") return { rows: rows(own), inheritedFrom: null };
    // A muscle whose parts declare their own: each part's, named by the part.
    const fromParts = fm.parts.flatMap((p) => {
      const pf = content.entries[p]?.fm;
      return pf && pf.kind === "muscle_part" && pf[key] !== "inherit" ? rows(pf[key], partLabel(softEntry(p)?.name ?? pf.name, e.name)) : [];
    });
    return { rows: fromParts, inheritedFrom: null };
  };
  const action = (a: Action): ActionRow => ({ joint: joint(a.joint), movement: words(a.movement), role: ROLE_LABELS[a.role] });
  const inherited = fm.kind === "muscle_part" ? (parentFm?.actions ?? []).filter((a) => !fm.actions.some((o) => o.joint === a.joint && o.movement === a.movement)) : [];
  const synergists = content.derived?.synergists[id] ?? [];
  const syn = new Set(synergists);
  const innervation =
    fm.kind === "muscle" ? { text: fm.innervation, inheritedFrom: null } : fm.innervation ? { text: fm.innervation, inheritedFrom: null } : parentFm ? { text: parentFm.innervation, inheritedFrom: parentLink } : null;
  return {
    kind: "muscle",
    parts: fm.kind === "muscle" ? fm.parts.map(link) : [],
    partOf: parentLink,
    origin: attachments(fm.origin, "origin"),
    insertion: attachments(fm.insertion, "insertion"),
    actions: fm.actions.map(action),
    inheritedActions: inherited.map(action),
    functions: fm.functions ?? [],
    synergists: synergists.map(link),
    // A structure that is both shows as a synergist, as in the 3D view (M9 plan decision 7).
    antagonists: (content.derived?.antagonists[id] ?? []).filter((x) => !syn.has(x)).map(link),
    innervation,
    clinical: fm.clinicalNote ?? null,
  };
}
