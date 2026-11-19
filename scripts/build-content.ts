// npm run content: compile content/bones/*.md (as the Vite plugin does) and
// report the size, raw and gzipped. With --out <file>, also write the JSON.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { compileContent } from "../src/content/compile";
import { readContentFiles } from "./lib/content-files";

const compiled = compileContent(readContentFiles());
const json = JSON.stringify(compiled);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`content: ${Object.keys(compiled).length} file(s), ${kb(json.length)} raw, ${kb(gzipSync(json).length)} gzipped`);
const i = process.argv.indexOf("--out");
if (i > 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1]!, json);
