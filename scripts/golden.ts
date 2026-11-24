// `npm run golden` (M11 plan decision 6): compare the app with tests/golden/*.json.
// `npm run golden -- --write` records them (refusing files that exist);
// `--write --force` overwrites, only for a difference the user has approved.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--write" && a !== "--force");
if (unknown.length > 0 || (args.includes("--force") && !args.includes("--write"))) {
  console.error("usage: npm run golden [-- --write [--force]]");
  process.exit(2);
}
const env = { ...process.env, GOLDEN_WRITE: args.includes("--write") ? "1" : "", GOLDEN_FORCE: args.includes("--force") ? "1" : "" };
const r = spawnSync("npx", ["vitest", "run", "tests/golden.test.ts"], { stdio: "inherit", env });
process.exit(r.status ?? 1);
