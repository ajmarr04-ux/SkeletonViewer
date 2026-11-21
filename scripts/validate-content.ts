// Content validation (spec §9). Runs in `npm run check` (CI) and before `build`.
//   npx tsx scripts/validate-content.ts [--allow-missing-content]
// --allow-missing-content skips "every object has a content file" while the
// files are being written (Milestone 4 sessions J and K); everything else runs.
// --allow-missing-soft does the same for the soft-tissue files (M8 plan
// decision 10): missing files are counted, every file that exists is checked.
import { join } from "node:path";
import { oppositeOf } from "../src/content/placeholder";
import { validateContent } from "../src/content/validate";
import type { DepthEntry } from "../src/content/muscleDepth";
import { validateMuscleDepth } from "../src/content/muscleDepthRules";
import { checkNoJointLists, validateSoftContent } from "../src/content/softValidate";
import {
  SOFT_LAYERS,
  glbNodeNames,
  makeOpposite,
  readBoneLandmarks,
  readContentFiles,
  readIds,
  readJson,
  readSoftFiles,
  readSoftIds,
  root,
} from "./lib/content-files";
import { readFileSync } from "node:fs";
import { isSoftNode, type SoftTreeNode } from "../src/content/softTree";
import { readSoftTree } from "./lib/soft-tree-data";

// The soft tree's group keys, for the group synonyms (M9 plan decision 12).
const groupKeys = new Set<string>();
const walkTree = (n: SoftTreeNode) => {
  groupKeys.add(n.key);
  n.children.forEach((c) => isSoftNode(c) && walkTree(c));
};
readSoftTree().roots.forEach(walkTree);

const allowMissingContent = process.argv.includes("--allow-missing-content");
const allowMissingSoft = process.argv.includes("--allow-missing-soft");
const boneFiles = readContentFiles();
const report = validateContent(
  {
    ids: readIds(),
    files: boneFiles,
    meshes: {
      high: glbNodeNames(join(root, "public/models/skeleton-high.glb")),
      low: glbNodeNames(join(root, "public/models/skeleton-low.glb")),
    },
    articulations: readJson("content/articulations.json"),
    regions: readJson("content/regions.json"),
    hierarchy: readJson("content/hierarchy.json"),
    opposite: oppositeOf,
    synonyms: readJson("content/synonyms.json"),
    softSynonyms: { ids: readSoftIds(), groupKeys },
  },
  { allowMissingContent },
);

// Muscle depth (spec §6.2 and §10; M7 plan decision 9).
report.errors.push(...validateMuscleDepth(readJson("content/muscle-depth.json"), readJson("content/soft-ids.json") as DepthEntry[]));

// Soft-tissue content (musculoskeletal spec §10; M8 plan).
const softIds = readSoftIds();
const soft = validateSoftContent(
  {
    softIds,
    boneIds: readIds().map((e) => e.id),
    boneLandmarks: readBoneLandmarks(boneFiles),
    files: readSoftFiles(),
    meshes: Object.fromEntries(
      SOFT_LAYERS.flatMap((l) => (["high", "low"] as const).map((lod) => [`${l}-${lod}`, glbNodeNames(join(root, `public/models/${l}-${lod}.glb`))])),
    ),
    articulations: readJson("content/articulations.json") as { joint: string }[],
    joints: readJson("content/joints.json"),
    movements: readJson("content/movements.json"),
    muscleHierarchy: readJson("content/muscle-hierarchy.json"),
    opposite: makeOpposite(softIds),
    questions: readFileSync(join(root, "content/QUESTIONS.md"), "utf8"),
  },
  { allowMissingSoft },
);
report.errors.push(...soft.errors, ...checkNoJointLists(softIds));
report.warnings.push(...soft.warnings);

for (const w of report.warnings) console.warn(`warning: ${w}`);
if (report.errors.length) {
  console.error(`validate-content FAILED (${report.errors.length}):\n  ${report.errors.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `validate-content: OK (${report.files} of 238 bone files${allowMissingContent ? ", missing files allowed" : ""}; ` +
    `${soft.files} of ${soft.expected} soft-tissue files${allowMissingSoft ? ", missing files allowed" : ""}; ` +
    `${report.warnings.length} warning(s))`,
);
