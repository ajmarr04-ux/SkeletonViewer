// The soft-tissue panels' M9 shapes, read off the generic panel model
// (src/panel/model.ts; M12 BD) for InfoPanel.tsx until it renders the
// sections itself (BE, which deletes the adapters). No kind switch here: the
// sections and chrome are the kinds' descriptors (src/systems/musculoskeletal/).
// `softAnnouncement` stays until the announcements move to the descriptors (BG).

import { isEagerId } from "./index";
import { softEntry, softOpposite } from "./softRegistry";
import type { SoftId } from "../layers/softIds";
import type { SoftLayerContent } from "./softCompile";
import { panelModel as generic, structureLabel as label, type ActionRow, type PanelModel as GenericModel, type SectionModel } from "../panel/model";
import type { AttachmentList } from "../systems/musculoskeletal/muscles/panel";

export { MUSCLE_REGION_LABELS, partLabel, type AttachmentList, type AttachmentRow } from "../systems/musculoskeletal/muscles/panel";
export { words, type ActionRow } from "../panel/model";

export type SoftPanelModel = {
  id: string;
  name: string;
  side: SoftId["side"];
  /** Badge row: layer, kind (with the part type for parts). */
  badges: { layer: string; kind: string };
  /** The muscle a part belongs to, or null. */
  partOf: { id: string; name: string } | null;
  /** Breadcrumb under "Skeleton" (spec §5.1 rule 4). */
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

/** A landmark's written name from its bone's content (else its ID in words, capitalised). */
export type LandmarkName = (structure: string, landmark: string) => string | undefined;

function model(id: string, content: SoftLayerContent | null, landmarkName?: LandmarkName): GenericModel | null {
  if (isEagerId(id) || !softEntry(id)) return null;
  const layer = softEntry(id)!.layer;
  return generic(id, { content: (l) => (l === layer ? (content as unknown as Record<string, unknown>) : null), opposite: softOpposite, landmarkName: landmarkName ?? (() => undefined) });
}

type Text = Extract<SectionModel, { render: "text" }>;

export function softPanelModel(id: string, content: SoftLayerContent | null = null): SoftPanelModel | null {
  const m = model(id, content);
  if (!m) return null;
  return {
    id,
    name: m.title,
    side: m.side,
    badges: { layer: m.badges[0]!, kind: m.badges[1]! },
    partOf: m.partOf ?? null,
    trail: m.trail,
    parentCrumb: m.parentCrumb ?? null,
    pair: m.pair,
    meshAvailable: m.meshAvailable,
    latin: m.subtitle.latin ? m.subtitle.text : null,
    common: m.common,
    summary: (m.sections[0] as Text).value,
    written: m.written,
  };
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
// Kind-specific sections (musculoskeletal spec §7; M9 plan decision 9).

/** A structure named in a section: what a link selects, and its label. */
export type SoftLink = { id: string; label: string };

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

/** A structure's label under a focus: its name, with the side only when it differs (a midline focus shows both sides). */
export const structureLabel = (id: string, focusSide: SoftId["side"]): string => label(id, focusSide);

const plain = (l: SoftLink): SoftLink => ({ id: l.id, label: l.label });

/**
 * The sections for a soft-tissue structure once its layer's content is
 * loaded and its file written; else null (the panel says "Not written yet").
 */
export function softSections(id: string, content: SoftLayerContent | null, landmarkName: LandmarkName = () => undefined): SoftSections | null {
  const m = model(id, content, landmarkName);
  if (!m || !m.written) return null;
  const by = new Map(m.sections.map((s) => [s.testId, s]));
  const links = (k: string) => ((by.get(k) as Extract<SectionModel, { render: "links" }> | undefined)?.links ?? []).map(plain);
  const text = (k: string) => (by.get(k) as Text | undefined)?.value ?? null;
  const functions = (by.get("functions") as Extract<SectionModel, { render: "list" }> | undefined)?.items ?? [];
  if (!by.has("origin")) {
    const joins = by.has("connects") ? "connects" : "attached-to";
    return { kind: joins === "connects" ? "ligament" : "cartilage", joint: links("joint")[0]?.label ?? null, links: links(joins), functions, clinical: text("clinical") };
  }
  const actions = by.get("actions") as Extract<SectionModel, { render: "actions-table" }>;
  const innervation = by.get("innervation") as Text;
  return {
    kind: "muscle",
    parts: links("parts"),
    partOf: m.partOf ? { id: m.partOf.id, label: label(m.partOf.id, m.side) } : null,
    origin: (by.get("origin") as Extract<SectionModel, { render: "custom" }>).data as AttachmentList,
    insertion: (by.get("insertion") as Extract<SectionModel, { render: "custom" }>).data as AttachmentList,
    actions: actions.rows,
    inheritedActions: actions.inherited,
    functions: actions.fallback,
    synergists: links("synergists"),
    antagonists: links("antagonists"),
    innervation: innervation.value === null ? null : { text: innervation.value, inheritedFrom: innervation.inherited ? plain(innervation.inherited) : null },
    clinical: text("clinical"),
  };
}
