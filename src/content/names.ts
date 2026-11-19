import ids from "../../content/ids.json";

type Entry = { id: string; name: string; side: "left" | "right" | "midline"; kind: string };
const BY_ID = new Map((ids as Entry[]).map((e) => [e.id, e]));

/**
 * The name shown for an object: "Femur (left)". Teeth already name their side
 * ("Upper right canine"), and midline bones have none.
 */
export function displayName(id: string): string {
  const e = BY_ID.get(id);
  if (!e) return id;
  if (e.side === "midline" || e.kind === "tooth") return e.name;
  return `${e.name} (${e.side})`;
}
