// npm run search-index: build the search indexes (as the Vite plugin does) and
// report their sizes, raw and gzipped (plan decision 2: expect the bone index
// under 20 KB gzipped). Also the soft-tissue index and the soft tree (M9).
import { gzipSync } from "node:zlib";
import { readSearchData, readSoftSearchData } from "./lib/search-data";
import { readSoftTree } from "./lib/soft-tree-data";

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const report = (what: string, data: unknown, n: string) => {
  const js = `export default ${JSON.stringify(data)};`;
  console.log(`${what}: ${n}, ${kb(js.length)} raw, ${kb(gzipSync(js).length)} gzipped`);
};
const bones = readSearchData();
report("search index (bones)", bones, `${bones.docs.length} objects`);
const soft = readSoftSearchData();
report("search index (soft tissue)", soft, `${soft.docs.length} documents (${soft.docs.filter((d) => d.group).length} groups)`);
report("soft tree", readSoftTree(), "3 roots");
