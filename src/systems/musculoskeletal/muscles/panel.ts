// The muscle and part panels (musculoskeletal spec §7; M9 plan decision 9,
// M12 plan decision 11): Summary, Parts, Origin, Insertion, Actions,
// Synergists, Antagonists, Innervation, Clinical note. A part's inherited
// origin, insertion, actions and innervation come from its muscle's file and
// say so. The breadcrumb is `Muscles › region › muscle › part`.

import type { PanelChrome, PanelContext, PanelSection, PartTypeSpec } from "../../types";

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

// --- Origin and insertion: the `attachments` custom section (plan decision 11) ---

/** One origin or insertion: a structure (link) with its landmark, or the free text of a non-object (spec §4.2). */
export type AttachmentRow = {
  link: { id: string; label: string } | null;
  landmark: string | null;
  text: string | null;
  /** For a muscle whose parts declare their own (spec §4.1: its list is then empty): the part's short name ("Long head"). */
  part: string | null;
};
export type AttachmentList = { rows: AttachmentRow[]; inheritedFrom: { id: string; label: string } | null };

type Attachment = { structure: string; landmark?: string } | { soft: string };
type Ends = { origin?: Attachment[] | "inherit"; insertion?: Attachment[] | "inherit"; parts?: string[]; name?: string };

const capitalised = (l: string) => {
  const w = l.replace(/_/g, " ");
  return w[0]!.toUpperCase() + w.slice(1);
};

/**
 * A muscle's or part's origin or insertion: its own rows; a part's `inherit`,
 * its muscle's; a muscle whose list is empty, each part's own, named by the part.
 */
export function attachments(ctx: PanelContext, end: "origin" | "insertion"): AttachmentList {
  const r = ctx.record as Ends | undefined;
  const own = r?.[end] ?? [];
  const rows = (list: readonly Attachment[], part: string | null = null): AttachmentRow[] =>
    list.map((a) =>
      "structure" in a
        ? { link: ctx.link(a.structure), landmark: a.landmark === undefined ? null : (ctx.landmarkName(a.structure, a.landmark) ?? capitalised(a.landmark)), text: null, part }
        : { link: null, landmark: null, text: a.soft, part },
    );
  if (own === "inherit") {
    const theirs = ctx.parent ? (ctx.recordOf(ctx.parent) as Ends | undefined)?.[end] : undefined;
    return { rows: rows(Array.isArray(theirs) ? theirs : []), inheritedFrom: ctx.parent ? ctx.link(ctx.parent) : null };
  }
  if (own.length > 0 || !Array.isArray(r?.parts)) return { rows: rows(own), inheritedFrom: null };
  const fromParts = r!.parts!.flatMap((p) => {
    const pf = ctx.recordOf(p) as Ends | undefined;
    const list = pf?.[end];
    return list && list !== "inherit" ? rows(list, partLabel(ctx.nameOf(p), ctx.name)) : [];
  });
  return { rows: fromParts, inheritedFrom: null };
}

const ROLES = { prime: "prime mover", assist: "assists", stabiliser: "stabiliser" };

const sections = (withParts: boolean): readonly PanelSection[] => [
  { title: "Summary", testId: "summary", render: "text", field: "summary", format: "html" },
  ...(withParts ? [{ title: "Parts", testId: "parts", render: "links", edges: "has part", exceptMeta: "also", omitEmpty: true } as const] : []),
  { title: "Origin", testId: "origin", render: "custom", component: "attachments", model: (ctx) => attachments(ctx, "origin") },
  { title: "Insertion", testId: "insertion", render: "custom", component: "attachments", model: (ctx) => attachments(ctx, "insertion") },
  { title: "Actions", testId: "actions", render: "actions-table", field: "actions", roles: ROLES, inherit: "parent", fallback: "functions", empty: "None listed." },
  { title: "Synergists", testId: "synergists", render: "links", edges: "synergist_of", order: "id", empty: "None found." },
  { title: "Antagonists", testId: "antagonists", render: "links", edges: "antagonist_of", exclude: "synergist_of", order: "id", empty: "None found." },
  { title: "Innervation", testId: "innervation", render: "text", field: "innervation", format: "line", inherit: "parent", empty: "Not listed." },
  { title: "Clinical note", testId: "clinical", render: "text", field: "clinicalNote", format: "prose", empty: "None." },
];

/** "Muscle", or a part's "Muscle part: head". */
const kindLine = (ctx: PanelContext, label: string, partTypes: readonly PartTypeSpec[]): string => {
  const t = partTypes.find((p) => p.id === ctx.partType);
  return t ? `${label}: ${t.label.toLowerCase()}` : label;
};

export function muscleChrome(label: string, layerLabel: string, partTypes: readonly PartTypeSpec[] = []): PanelChrome {
  return {
    typeLine: (ctx) => (ctx.side === "midline" ? kindLine(ctx, label, partTypes) : `${kindLine(ctx, label, partTypes)}, ${ctx.side}`),
    badges: (ctx) => [layerLabel, kindLine(ctx, label, partTypes)],
    draft: "always",
    trail(ctx) {
      const muscle = ctx.parent ?? ctx.id;
      const region = (ctx.recordOf(muscle) as { region?: unknown } | undefined)?.region;
      const key = Array.isArray(region) ? (region[0] as string | undefined) : undefined;
      const label = key ? MUSCLE_REGION_LABELS[key] : undefined;
      const top = label ? [layerLabel, label] : [layerLabel];
      if (!ctx.parent) return { trail: [...top, ctx.name], parentCrumb: null };
      const parentName = ctx.nameOf(ctx.parent);
      return { trail: [...top, parentName, partLabel(ctx.name, parentName)], parentCrumb: top.length };
    },
    partOf: true,
    common: "when-written",
    unwritten: "first-section",
  };
}

export const MUSCLE_SECTIONS = sections(true);
export const PART_SECTIONS = sections(false);
