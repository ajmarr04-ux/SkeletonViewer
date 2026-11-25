// `npm run bench-container` (M11 session AS): the `?bench` runs of the M11
// baseline and AY's parity table, in this container's headless Chromium
// (SwiftShader). Serves dist/ (run `npx vite build` first), opens each bench
// link N times (default 3) and prints the medians: median and 5th-percentile
// FPS, draw calls, triangles, LOD. Container FPS only compares builds measured
// here on the same day; real-device figures stay with the user (M14).
//
//   npx tsx scripts/bench-container.ts [runs] [dist dir]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const RUNS = Number(process.argv[2] ?? 3);
const ROOT = join(process.cwd(), process.argv[3] ?? "dist");
const LINKS = [
  { name: "bones only", query: "?debug&bench" },
  { name: "all four layers on", query: "?debug&bench&layers=b:on,c:on,l:on,m:on" },
];
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".md": "text/markdown", ".svg": "image/svg+xml", ".wasm": "application/wasm" };

function serve(): Promise<{ url: string; close: () => void }> {
  if (!existsSync(join(ROOT, "index.html"))) throw new Error(`${ROOT}/index.html is missing: run \`npx vite build\` first`);
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!)).replace(/^(\.\.[/\\])+/, "");
    let file = join(ROOT, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) =>
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      ok({ url: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}/`, close: () => server.close() });
    }),
  );
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function main() {
  const { url, close } = await serve();
  const browser = await chromium.launch();
  try {
    for (const link of LINKS) {
      const runs: { fps: number; p5: number; draws: number; tris: number; lod: string }[] = [];
      for (let i = 0; i < RUNS; i++) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.goto(url + link.query);
        const debug = page.getByTestId("debug");
        await debug.and(page.locator('[data-bench-done="true"]')).waitFor({ timeout: 180_000 });
        const attr = async (n: string) => (await debug.getAttribute(n)) ?? "";
        runs.push({
          fps: Number(await attr("data-bench-median-fps")),
          p5: Number(await attr("data-bench-p5-fps")),
          draws: Number(await attr("data-bench-draw-calls")),
          tris: Number(((await page.getByTestId("bench-triangles").textContent()) ?? "").replace(/[^\d]/g, "")),
          lod: await attr("data-bench-lod"),
        });
        await page.close();
      }
      const r = runs.map((x) => `${x.fps}/${x.p5}`).join(", ");
      console.log(
        `${link.name} (${link.query}): median FPS ${median(runs.map((x) => x.fps)).toFixed(1)}, 5th pct ${median(runs.map((x) => x.p5)).toFixed(1)}, ` +
          `draw calls ${median(runs.map((x) => x.draws))}, triangles ${median(runs.map((x) => x.tris)).toLocaleString("en-GB")}, LOD ${runs.map((x) => x.lod).join("/")} [runs: ${r}]`,
      );
    }
  } finally {
    await browser.close();
    close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
