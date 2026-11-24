// The two-way check of the `muscleAttachments` migration (M8 plan decision 13,
// session AD): every old string's muscle (or one of its parts, or a part that
// serves it through `alsoServes`) must really attach to that bone in the
// derived data, unless the string is `indirect` (attached through a cartilage,
// ligament or fascia) or `unmatched` (a muscle the source doesn't have; its
// question must be answered). Pure, so Vitest can run it on fixtures.

import { layerOfKind, NESTED_LAYER } from "../../src/systems/registry";

export type MigrationRow = {
  rule: "name" | "variant" | "unmatched";
  indirect?: boolean;
  /** Any one of the IDs attaching is enough (a series split by region). */
  series?: boolean;
  question?: number;
  /** Bone ID (left or midline) → side-free muscle or part IDs. */
  bones: Record<string, string[]>;
};
export type SoftEntry = { id: string; kind: string; side: string; parent?: string | null; alsoServes?: string[] };
export type Attached = (structure: string) => { origins: readonly string[]; insertions: readonly string[] };

export type MigrationCheck = {
  /** Strings whose muscle isn't attached to the bone, and isn't indirect or unmatched. */
  errors: string[];
  /** Expected misses: indirect strings, and unmatched strings with an answered question. */
  accepted: { indirect: number; unmatched: number };
  /** (string, bone) pairs confirmed by the derived data. */
  confirmed: number;
};

/** The side-specific IDs a side-free muscle ID can stand for on a bone of this side. */
function sided(id: string, boneSide: "left" | "midline"): string[] {
  return boneSide === "left" ? [`${id}_left`, id] : [id, `${id}_left`, `${id}_right`];
}

export function checkMigration(
  table: Record<string, MigrationRow>,
  soft: readonly SoftEntry[],
  attached: Attached,
  answered: (question: number) => boolean,
): MigrationCheck {
  // A muscle stands for itself, its parts, and the parts that serve it.
  const family = new Map<string, Set<string>>();
  const add = (owner: string, member: string) => {
    let s = family.get(owner);
    if (!s) family.set(owner, (s = new Set([owner])));
    s.add(member);
  };
  for (const e of soft) {
    if (layerOfKind(e.kind) !== NESTED_LAYER) continue;
    add(e.id, e.id);
    if (e.parent) add(e.parent, e.id);
    for (const m of e.alsoServes ?? []) add(m, e.id);
  }
  const errors: string[] = [];
  const accepted = { indirect: 0, unmatched: 0 };
  let confirmed = 0;
  for (const [s, row] of Object.entries(table)) {
    for (const [bone, ids] of Object.entries(row.bones)) {
      if (row.rule === "unmatched") {
        if (row.question !== undefined && answered(row.question)) accepted.unmatched++;
        else errors.push(`"${s}" on ${bone}: unmatched, and question ${row.question ?? "(none)"} isn't answered`);
        continue;
      }
      const side = bone.endsWith("_left") ? "left" : "midline";
      const { origins, insertions } = attached(bone);
      const here = new Set([...origins, ...insertions]);
      const missing = ids.filter((id) => !sided(id, side).some((x) => [...(family.get(x) ?? [x])].some((m) => here.has(m))));
      if (missing.length === 0 || (row.series && missing.length < ids.length)) confirmed++;
      else if (row.indirect) accepted.indirect++;
      else errors.push(`"${s}" on ${bone}: ${missing.join(", ")} has no origin or insertion on ${bone}`);
    }
  }
  return { errors, accepted, confirmed };
}
