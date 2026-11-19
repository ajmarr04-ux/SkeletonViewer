// npm run search-index: build the search index (as the Vite plugin does) and
// report its size, raw and gzipped (plan decision 2: expect under 20 KB gzipped).
import { gzipSync } from "node:zlib";
import { readSearchData } from "./lib/search-data";

const data = readSearchData();
const js = `export default ${JSON.stringify(data)};`;
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`search index: ${data.docs.length} objects, ${kb(js.length)} raw, ${kb(gzipSync(js).length)} gzipped`);
