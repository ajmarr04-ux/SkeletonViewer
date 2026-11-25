// The ligament and cartilage panels (musculoskeletal spec §7; M12 plan
// decision 11): Summary, Joint, Connects or Attached to, Functions, Clinical
// note. The breadcrumb is the layer, then the name.

import type { PanelChrome, PanelSection } from "../types";

/** `edges`: what the structure joins ("connects", "attached_to"), shown as `title`. */
export const jointPanel = (title: string, testId: string, edges: string): readonly PanelSection[] => [
  { title: "Summary", testId: "summary", render: "text", field: "summary", format: "html" },
  { title: "Joint", testId: "joint", render: "links", edges: "member_of_joint", nameOnly: true, empty: "Not part of a joint." },
  { title, testId, render: "links", edges, empty: "None listed." },
  { title: "Functions", testId: "functions", render: "list", field: "functions" },
  { title: "Clinical note", testId: "clinical", render: "text", field: "clinicalNote", format: "prose", empty: "None." },
];

export const jointChrome = (label: string, layerLabel: string): PanelChrome => ({
  typeLine: (ctx) => (ctx.side === "midline" ? label : `${label}, ${ctx.side}`),
  badges: () => [layerLabel, label],
  draft: "always",
  trail: (ctx) => ({ trail: [layerLabel, ctx.name], parentCrumb: null }),
  partOf: true,
  common: "when-written",
  unwritten: "first-section",
});
