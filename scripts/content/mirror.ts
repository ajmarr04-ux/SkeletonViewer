// Write every right-side content file from its left-side twin (plan decision 2).
//   npx tsx scripts/content/mirror.ts       (npm run content:mirror)
// Paired objects share their text; authors edit the left file only.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { mirrorFile } from "../../src/content/frontmatter";
import { oppositeOf } from "../../src/content/placeholder";
import { bonesDir, readContentFiles, readIds } from "../lib/content-files";

const files = readContentFiles();
let written = 0;
let unchanged = 0;
for (const e of readIds()) {
  if (e.side !== "left") continue;
  const text = files.get(e.id);
  const right = oppositeOf(e.id);
  if (text === undefined || right === null) continue;
  const out = mirrorFile(text, e.id, oppositeOf);
  if (files.get(right) === out) unchanged++;
  else {
    writeFileSync(join(bonesDir, `${right}.md`), out);
    written++;
  }
}
console.log(`content:mirror: ${written} right-side file(s) written, ${unchanged} unchanged`);
