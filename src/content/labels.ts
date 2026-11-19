// Display labels for the `group` paths in content/ids.json (breadcrumb, region
// badge). Labels only: no anatomy is added here (spec §12).

/** One label per group segment. "axial" and "appendicular" are a classification, not a place, so the breadcrumb skips them. */
export const GROUP_LABELS: Record<string, string> = {
  skull: "Skull",
  cranial: "Cranial bones",
  facial: "Facial bones",
  ossicles: "Ossicles",
  hyoid: "Hyoid",
  vertebral_column: "Vertebral column",
  cervical: "Cervical vertebrae",
  thoracic: "Thoracic vertebrae",
  lumbar: "Lumbar vertebrae",
  sacrococcygeal: "Sacrum and coccyx",
  thorax: "Thorax",
  ribs: "Ribs",
  pectoral_girdle: "Pectoral girdle",
  upper_limb: "Upper limb",
  carpals: "Carpals",
  metacarpals: "Metacarpals",
  phalanges: "Phalanges",
  pelvic_girdle: "Pelvic girdle",
  lower_limb: "Lower limb",
  tarsals: "Tarsals",
  metatarsals: "Metatarsals",
  dentition: "Teeth",
  incisors: "Incisors",
  canines: "Canines",
  premolars: "Premolars",
  molars: "Molars",
};

/** Singular tooth type for the badge row, from the last group segment. */
export const TOOTH_TYPES: Record<string, string> = {
  incisors: "Incisor",
  canines: "Canine",
  premolars: "Premolar",
  molars: "Molar",
};

const SKIPPED = new Set(["axial", "appendicular"]);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Breadcrumb labels for a group path, top down, without "Skeleton" and the
 * object itself: `["appendicular", "lower_limb"]` → `["Lower limb"]`. Teeth
 * join arch and side: `["dentition", "upper", "right", "molars"]` →
 * `["Teeth", "Upper right", "Molars"]`.
 */
export function groupTrail(group: readonly string[]): string[] {
  if (group[0] === "dentition") {
    const [, arch, side, type] = group;
    const out = ["Teeth"];
    if (arch && side) out.push(`${capitalise(arch)} ${side}`);
    if (type) out.push(GROUP_LABELS[type] ?? capitalise(type));
    return out;
  }
  return group.filter((g) => !SKIPPED.has(g)).map((g) => GROUP_LABELS[g] ?? capitalise(g.replace(/_/g, " ")));
}

/** The region badge: the first level of the trail ("Lower limb", "Skull", "Teeth"). */
export function regionLabel(group: readonly string[]): string {
  return groupTrail(group)[0] ?? "Skeleton";
}
