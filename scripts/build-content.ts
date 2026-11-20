// npm run content: compile content/bones/*.md (as the Vite plugin does) and
// report the size, raw and gzipped; then each soft-tissue layer's content chunk
// (M8 plan decision 11). With --out <file>, also write the bone JSON.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { compileContent } from "../src/content/compile";
import { SOFT_LAYERS, compileSoftFromDisk, readBoneMuscles, readContentFiles, readSoftFiles } from "./lib/content-files";

const compiled = compileContent(readContentFiles(), readBoneMuscles());
const json = JSON.stringify(compiled);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`content: ${Object.keys(compiled).length} file(s), ${kb(json.length)} raw, ${kb(gzipSync(json).length)} gzipped`);
const softFiles = readSoftFiles();
for (const layer of SOFT_LAYERS) {
  const c = compileSoftFromDisk(layer, softFiles[layer]);
  const j = JSON.stringify(c);
  console.log(`content (${layer}): ${Object.keys(c.entries).length} file(s), ${kb(j.length)} raw, ${kb(gzipSync(j).length)} gzipped`);
}
const i = process.argv.indexOf("--out");
if (i > 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1]!, json);
