// What a screen reader hears for a soft-tissue structure (spec §10). The
// panel itself is the generic model (src/panel/model.ts, M12 BD/BE); this
// wording moves onto the tier rules in BG.

import { softEntry } from "./softRegistry";

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
