import ids from "../../content/ids.json";
import { kindDescriptor, type KindId } from "../systems/registry";
import { softDisplayName, softEntry } from "./softRegistry";

type Entry = { id: string; name: string; side: "left" | "right" | "midline"; kind: KindId };
const BY_ID = new Map((ids as Entry[]).map((e) => [e.id, e]));

/**
 * The name shown for an object: "Femur (left)". A kind whose names say the
 * side already (`sideInName: false`: "Upper right canine") and midline
 * objects get none.
 */
export function displayName(id: string): string {
  const e = BY_ID.get(id);
  if (!e) {
    // M7: a soft-tissue structure (from the ID index; unknown in the build scripts, which never load it) ("Biceps brachii (left)").
    const soft = softEntry(id);
    return soft ? softDisplayName(soft) : id;
  }
  if (e.side === "midline" || kindDescriptor(e.kind).sideInName === false) return e.name;
  return `${e.name} (${e.side})`;
}
