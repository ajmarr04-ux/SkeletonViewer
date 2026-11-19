// Placeholder info-panel content (Milestone 3): built from content/ids.json
// only. Everything that needs written anatomy (Latin name, summary, functions,
// articulations, landmarks, muscles, clinical note) says "Not written yet";
// the real content files arrive in Milestone 4. Nothing is invented (spec §12).

import ids from "../../content/ids.json";
import { groupTrail, regionLabel, TOOTH_TYPES } from "./labels";

export type Side = "left" | "right" | "midline";
export type IdEntry = { id: string; name: string; kind: "bone" | "tooth"; side: Side; group: string[]; meshAvailable: boolean };

export const NOT_WRITTEN = "Not written yet";
export const NO_MODEL_NOTE = "No 3D model: this tooth is absent from the source model.";

/** The text sections of the panel, in spec §7 order (after the name and badges). */
export const SECTION_TITLES = ["Summary", "Functions", "Articulations", "Key landmarks", "Major muscle attachments", "Clinical note"] as const;
export type SectionTitle = (typeof SECTION_TITLES)[number];

export type PanelModel = {
  id: string;
  name: string;
  /** Latin name, or null until the content is written. */
  latin: string | null;
  /** Common name ("kneecap"), or null until the content is written. */
  common: string | null;
  side: Side;
  kind: "bone" | "tooth";
  /** Badge row: region, bone or tooth type, and the draft note. */
  badges: { region: string; type: string; draft: boolean };
  /** Breadcrumb under "Skeleton", ending with the object's name. */
  trail: string[];
  meshAvailable: boolean;
  /** Shown for objects without a mesh (the wisdom teeth). */
  note: string | null;
  sections: { title: SectionTitle; text: string }[];
  /** The same object on the other side, for paired objects; else null. */
  opposite: string | null;
  /** Both sides of a pair, left first (for the side toggle); else null. */
  pair: { left: string; right: string } | null;
};

const ENTRIES = ids as IdEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

const swapSide = (s: string) => s.replace(/\b(left|right)\b/gi, (m) => {
  const swapped = m.toLowerCase() === "left" ? "right" : "left";
  return m[0] === m[0]!.toUpperCase() ? swapped[0]!.toUpperCase() + swapped.slice(1) : swapped;
});
const pairKey = (e: IdEntry, side: Side) => `${side}|${e.kind}|${e.name}|${e.group.join("/")}`;
const BY_PAIR_KEY = new Map(ENTRIES.map((e) => [pairKey(e, e.side), e.id]));

/**
 * The same object on the other side: same kind, the same name and group with
 * "left" and "right" swapped (teeth carry the side in both). Null for midline
 * objects and anything without a match.
 */
export function oppositeOf(id: string): string | null {
  const e = BY_ID.get(id);
  if (!e || e.side === "midline") return null;
  const other: Side = e.side === "left" ? "right" : "left";
  const want = { ...e, name: swapSide(e.name), group: e.group.map(swapSide) };
  return BY_PAIR_KEY.get(pairKey(want, other)) ?? null;
}

export function entryOf(id: string): IdEntry | undefined {
  return BY_ID.get(id);
}

/** The panel's content for one object, or null for an unknown ID. */
export function panelModel(id: string): PanelModel | null {
  const e = BY_ID.get(id);
  if (!e) return null;
  const opposite = oppositeOf(id);
  const last = e.group[e.group.length - 1] ?? "";
  return {
    id,
    name: e.name,
    latin: null,
    common: null,
    side: e.side,
    kind: e.kind,
    badges: { region: regionLabel(e.group), type: e.kind === "tooth" ? (TOOTH_TYPES[last] ?? "Tooth") : "Bone", draft: true },
    trail: [...groupTrail(e.group), e.name],
    meshAvailable: e.meshAvailable,
    note: e.meshAvailable ? null : NO_MODEL_NOTE,
    sections: SECTION_TITLES.map((title) => ({ title, text: NOT_WRITTEN })),
    opposite,
    pair: opposite === null ? null : e.side === "left" ? { left: id, right: opposite } : { left: opposite, right: id },
  };
}

type Isolated = { sel: string | null; tier: 0 | 1 | 2 };

/** "Femur, left" (teeth name their side already). */
function spoken(e: IdEntry): string {
  const side = e.side === "midline" || e.kind === "tooth" ? "" : `, ${e.side}`;
  return `${e.name}${side}`;
}

/** A related bone's name in a list: no side when it matches the focus's, and lower case unless it starts with a code ("T4 vertebra"). */
function listed(id: string, focusSide: Side): string {
  const e = BY_ID.get(id);
  if (!e) return id;
  const name = /^[A-Z][a-z]/.test(e.name) ? e.name[0]!.toLowerCase() + e.name.slice(1) : e.name;
  return e.side === "midline" || e.kind === "tooth" || e.side === focusSide ? name : `${name} (${e.side})`;
}

/**
 * What a screen reader hears when the isolation changes (spec §10, aria-live):
 * "Femur, left, selected. Isolated."; at tier 1 "Femur, left: related bones
 * shown. Hip bone, patella, tibia."; at tier 2 "Femur, left: region shown, 8
 * bones."; back at tier 0 from a higher tier "Femur, left, isolated.".
 * `related` gives the tier-1 IDs, `visible` the number of solid bones.
 */
export function announcement(
  now: Isolated,
  prev: Isolated | null = null,
  related: (id: string) => string[] = () => [],
  visible: number = 0,
): string {
  if (now.sel === null) return "Full skeleton";
  const e = BY_ID.get(now.sel);
  if (!e) return "Full skeleton";
  if (now.tier === 1) {
    const names = related(now.sel).map((id) => listed(id, e.side));
    const list = names.length ? ` ${names.join(", ")}.` : " None.";
    return `${spoken(e)}: related bones shown.${list.replace(/^ ([a-z])/, (_, c: string) => ` ${c.toUpperCase()}`)}`;
  }
  if (now.tier === 2) return `${spoken(e)}: region shown, ${visible} bones.`;
  if (prev && prev.sel === now.sel && prev.tier > 0) return `${spoken(e)}, ${e.meshAvailable ? "isolated" : "no 3D model"}.`;
  return `${spoken(e)}, selected. ${e.meshAvailable ? "Isolated." : "No 3D model."}`;
}
