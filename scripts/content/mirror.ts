// Write every right-side content file from its left-side twin (plan decision 2;
// M8 plan decision 12 adds the soft-tissue folders).
//   npx tsx scripts/content/mirror.ts       (npm run content:mirror)
// Paired objects share their text; authors edit the left file only.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { mirrorFile } from "../../src/content/frontmatter";
import { oppositeOf } from "../../src/content/placeholder";
import { SOFT_LAYERS, bonesDir, makeOpposite, readContentFiles, readIds, readSoftFiles, readSoftIds, softDir } from "../lib/content-files";

let written = 0;
let unchanged = 0;
function mirrorAll(lefts: string[], files: Map<string, string>, dir: string, opposite: (id: string) => string | null) {
  for (const id of lefts) {
    const text = files.get(id);
    const right = opposite(id);
    if (text === undefined || right === null) continue;
    const out = mirrorFile(text, id, opposite);
    if (files.get(right) === out) unchanged++;
    else {
      writeFileSync(join(dir, `${right}.md`), out);
      written++;
    }
  }
}

mirrorAll(
  readIds().filter((e) => e.side === "left").map((e) => e.id),
  readContentFiles(),
  bonesDir,
  oppositeOf,
);
const softIds = readSoftIds();
const opposite = makeOpposite(softIds);
const softFiles = readSoftFiles();
for (const layer of SOFT_LAYERS)
  mirrorAll(
    softIds.filter((e) => e.layer === layer && e.side === "left").map((e) => e.id),
    softFiles[layer],
    softDir(layer),
    opposite,
  );
console.log(`content:mirror: ${written} right-side file(s) written, ${unchanged} unchanged`);
