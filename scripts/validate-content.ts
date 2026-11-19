// Content validation (spec §9). Runs in `npm run check` (CI) and before `build`.
//   npx tsx scripts/validate-content.ts [--allow-missing-content]
// --allow-missing-content skips "every object has a content file" while the
// files are being written (Milestone 4 sessions J and K); everything else runs.
import { join } from "node:path";
import { oppositeOf } from "../src/content/placeholder";
import { validateContent } from "../src/content/validate";
import { glbNodeNames, readContentFiles, readIds, readJson, root } from "./lib/content-files";

const allowMissingContent = process.argv.includes("--allow-missing-content");
const report = validateContent(
  {
    ids: readIds(),
    files: readContentFiles(),
    meshes: {
      high: glbNodeNames(join(root, "public/models/skeleton-high.glb")),
      low: glbNodeNames(join(root, "public/models/skeleton-low.glb")),
    },
    articulations: readJson("content/articulations.json"),
    regions: readJson("content/regions.json"),
    hierarchy: readJson("content/hierarchy.json"),
    opposite: oppositeOf,
    synonyms: readJson("content/synonyms.json"),
  },
  { allowMissingContent },
);

for (const w of report.warnings) console.warn(`warning: ${w}`);
if (report.errors.length) {
  console.error(`validate-content FAILED (${report.errors.length}):\n  ${report.errors.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `validate-content: OK (${report.files} of 238 content files${allowMissingContent ? ", missing files allowed" : ""}, ` +
    `${report.warnings.length} warning(s))`,
);
