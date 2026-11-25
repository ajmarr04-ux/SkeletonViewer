// The bone and tooth panels (spec §7; M12 plan decision 11): Summary,
// Functions, Articulations (with the teeth's neighbours), Key landmarks,
// Attached muscles, Clinical note; the badges and breadcrumb from the group
// paths in content/ids.json and the written `region` and `type`.

import ids from "../../../../content/ids.json";
import { groupTrail, regionLabel, TOOTH_TYPES } from "../../../content/labels";
import type { PanelChrome, PanelContext, PanelSection } from "../../types";

const GROUPS = new Map((ids as { id: string; group: string[] }[]).map((e) => [e.id, e.group]));
const groupOf = (id: string): readonly string[] => GROUPS.get(id) ?? [];

const TYPE_LABELS: Record<string, string> = {
  long: "Long bone",
  short: "Short bone",
  flat: "Flat bone",
  irregular: "Irregular bone",
  sesamoid: "Sesamoid bone",
  tooth: "Tooth",
};

/** The type badge from the written file: "Flat bone", or "Tooth type: molar". */
export function typeLabel(c: { type: string; toothType?: string | null }): string {
  if (c.type === "tooth" && c.toothType) return `Tooth type: ${c.toothType}`;
  return TYPE_LABELS[c.type]!;
}

/** The type badge before the file is written: the kind's label, or (teeth) the tooth type from the group path. */
const placeholderType = (ctx: PanelContext, label: string, byGroup: boolean): string => {
  const g = groupOf(ctx.id);
  return byGroup ? (TOOTH_TYPES[g[g.length - 1] ?? ""] ?? label) : label;
};

export const NO_MODEL_NOTE = "No 3D model: this tooth is absent from the source model.";

const chrome = (label: string, typeByGroup: boolean): PanelChrome => ({
  typeLine: (ctx) => (ctx.record ? "" : "Latin name not written yet"),
  badges(ctx) {
    const r = ctx.record as { region: string[]; type: string; toothType?: string | null } | undefined;
    const region = regionLabel(groupOf(ctx.id));
    if (!r) return [region, placeholderType(ctx, label, typeByGroup)];
    return [groupTrail(r.region)[0] ?? region, typeLabel(r)];
  },
  draft: "unreviewed",
  trail: (ctx) => ({ trail: [...groupTrail(groupOf(ctx.id)), ctx.name] }),
  noModelNote: NO_MODEL_NOTE,
  common: "always",
  unwritten: "all-sections",
});

const sections = (noMuscles: string): readonly PanelSection[] => [
  { title: "Summary", testId: "summary", render: "text", field: "summary", format: "html" },
  { title: "Functions", testId: "functions", render: "list", field: "functions" },
  {
    title: "Articulations",
    testId: "articulations",
    render: "links",
    edges: "articulates_with",
    detail: { meta: "joint" },
    highlight: "pair",
    also: { title: "Neighbouring teeth", edges: "adjacent_tooth" },
    empty: "No bony articulation.",
  },
  { title: "Key landmarks", testId: "landmarks", render: "list", field: "landmarks", inline: true, count: "landmarkPositions", empty: "None listed." },
  {
    title: "Attached muscles",
    testId: "muscles",
    render: "grouped-links",
    groups: [
      { edges: "origin of", title: "Origins", testId: "origins", role: "origin" },
      { edges: "insertion of", title: "Insertions", testId: "insertions", role: "insertion" },
    ],
    exceptMeta: "inherited",
    order: "name",
    needsContent: true,
    empty: noMuscles,
  },
  { title: "Clinical note", testId: "clinical", render: "text", field: "clinical", format: "prose", empty: "None." },
];

export const BONE_PANEL = { panel: sections("None."), chrome: chrome("Bone", false) };
export const TOOTH_PANEL = { panel: sections("None (teeth have no muscle attachments)."), chrome: chrome("Tooth", true) };
