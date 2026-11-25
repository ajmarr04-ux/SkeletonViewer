// The bones' side pairing and their aria-live wording (spec §10). The panel
// itself is the generic model (src/panel/model.ts, M12 BD/BE); the
// announcements move onto the descriptors in BG.

import ids from "../../content/ids.json";
import { kindDescriptor, type EagerKind } from "../systems/registry";

export type Side = "left" | "right" | "midline";
export type IdEntry = { id: string; name: string; kind: EagerKind; side: Side; group: string[]; meshAvailable: boolean };

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

/** False for kinds whose name says the side already (teeth). */
const sideInName = (e: IdEntry) => kindDescriptor(e.kind).sideInName !== false;

type Isolated = { sel: string | null; tier: 0 | 1 | 2 };

/** "Femur, left" (teeth name their side already). */
function spoken(e: IdEntry): string {
  const side = e.side === "midline" || !sideInName(e) ? "" : `, ${e.side}`;
  return `${e.name}${side}`;
}

/** A related bone's name in a list: no side when it matches the focus's, and lower case unless it starts with a code ("T4 vertebra"). */
function listed(id: string, focusSide: Side): string {
  const e = BY_ID.get(id);
  if (!e) return id;
  const name = /^[A-Z][a-z]/.test(e.name) ? e.name[0]!.toLowerCase() + e.name.slice(1) : e.name;
  return e.side === "midline" || !sideInName(e) || e.side === focusSide ? name : `${name} (${e.side})`;
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

/**
 * Joint highlighting (spec §6, plan step 7): "Hip joint: femur and hip bone
 * highlighted." The focus is named first; the partner keeps its side only when
 * it differs from the focus's ("Sternoclavicular joint: clavicle and sternum").
 */
export function jointAnnouncement(jointName: string, focus: string, partner: string): string {
  const f = BY_ID.get(focus);
  const side = f?.side ?? "midline";
  return `${jointName}: ${listed(focus, side)} and ${listed(partner, side)} highlighted.`;
}
