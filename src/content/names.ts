import ids from "../../content/ids.json";
import { softDisplayName, softEntry } from "./softRegistry";

type Entry = { id: string; name: string; side: "left" | "right" | "midline"; kind: string };
const BY_ID = new Map((ids as Entry[]).map((e) => [e.id, e]));

/**
 * The name shown for an object: "Femur (left)". Teeth already name their side
 * ("Upper right canine"), and midline bones have none.
 */
export function displayName(id: string): string {
  const e = BY_ID.get(id);
  if (!e) {
    // M7: a soft-tissue structure, once its table is loaded ("Biceps brachii (left)").
    const soft = softEntry(id);
    return soft ? softDisplayName(soft) : id;
  }
  if (e.side === "midline" || e.kind === "tooth") return e.name;
  return `${e.name} (${e.side})`;
}
