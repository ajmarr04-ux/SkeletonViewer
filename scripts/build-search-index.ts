// npm run search-index: build each layer's search index (as the Vite plugin does,
// one per layer since M14 plan decision 4) and report their sizes, raw and
// gzipped (Milestone 5 plan decision 2: expect the bone index under 20 KB
// gzipped). Also the soft tree (M9).
import { gzipSync } from "node:zlib";
import { LAYER_IDS } from "../src/systems/registry";
import { layerContent } from "../src/systems/registry.content";
import { readAllSearchData } from "./lib/search-data";
import { readSoftTree } from "./lib/soft-tree-data";

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const report = (what: string, data: unknown, n: string) => {
  const js = `export default ${JSON.stringify(data)};`;
  console.log(`${what}: ${n}, ${kb(js.length)} raw, ${kb(gzipSync(js, { level: 9 }).length)} gzipped`);
};
const all = readAllSearchData();
for (const l of LAYER_IDS) {
  const { docs } = all[l];
  const groups = docs.filter((d) => d.group).length;
  report(`search index ${layerContent(l).searchChunk}`, all[l], `${docs.length} documents${groups ? ` (${groups} groups)` : ""}`);
}
const tree = readSoftTree();
report("soft tree", tree, `${tree.roots.length} roots`);
