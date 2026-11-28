// `npm run bench-container` (M11 session AS): the `?bench` runs of the M11
// baseline and AY's parity table, in this container's headless Chromium
// (SwiftShader). Serves dist/ (run `npx vite build` first), opens each bench
// link N times (default 3) and prints the medians: median and 5th-percentile
// FPS, draw calls, triangles, LOD. Container FPS only compares builds measured
// here on the same day; real-device figures stay with the user (M14).
//
//   npx tsx scripts/bench-container.ts [runs] [dist dir]
//
// LABELS=1 turns the floating labels on and adds a body-region link (M13 BQ):
// the label layout median and max per link. LABELMAX=<n> runs with
// `labelmax=<n>` (the thinning cap; 0 = none), as BQ measured N.
//
// DEVICE=1 runs instead the three real-device links of M14 BZ (plan decision
// 11), with labels on: all four layers On; the same in a dense fine region;
// a forearm muscle at tier 2 with antagonists (and so the role patterns).
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const RUNS = Number(process.argv[2] ?? 3);
const ROOT = join(process.cwd(), process.argv[3] ?? "dist");
const LABELS = process.env.LABELS === "1" || process.env.DEVICE === "1";
const LABELMAX = process.env.LABELMAX;
const DEVICE = process.env.DEVICE === "1";
const ALL = "layers=b:on,c:on,l:on,m:on";
const DEVICE_LINKS = [
  { name: "1. all four layers on", query: `?bench&${ALL}` },
  { name: "2. all four layers on, left forearm", query: `?bench&${ALL}&reg=forearm_left` },
  { name: "3. flexor carpi radialis (left), tier 2, antagonists", query: `?bench&${ALL}&sel=flexor_carpi_radialis_left&tier=2&ant=1` },
];
const LINKS = (DEVICE ? DEVICE_LINKS.map((l) => ({ ...l, query: l.query.replace("?bench", "?debug&bench") })) : [
  { name: "bones only", query: "?debug&bench" },
  { name: "all four layers on", query: "?debug&bench&layers=b:on,c:on,l:on,m:on" },
  ...(LABELS ? [{ name: "all four layers on, thorax", query: "?debug&bench&layers=b:on,c:on,l:on,m:on&reg=thorax" }] : []),
]).map((l) => ({ ...l, query: LABELMAX === undefined ? l.query : `${l.query}&labelmax=${LABELMAX}` }));
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
      const runs: { fps: number; p5: number; draws: number; tris: number; lod: string; labels: string }[] = [];
      for (let i = 0; i < RUNS; i++) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        if (LABELS) await page.addInitScript(() => window.localStorage.setItem("skeleton-viewer:labels", "1"));
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
          labels: LABELS ? `${((await page.getByTestId("bench-labels").textContent()) ?? "").trim()}, ${await page.evaluate(() => window.__viewer?.labelCandidates?.() ?? "n/a")} candidates` : "",
        });
        await page.close();
      }
      const r = runs.map((x) => `${x.fps}/${x.p5}`).join(", ");
      console.log(
        `${link.name} (${link.query}): median FPS ${median(runs.map((x) => x.fps)).toFixed(1)}, 5th pct ${median(runs.map((x) => x.p5)).toFixed(1)}, ` +
          `draw calls ${median(runs.map((x) => x.draws))}, triangles ${median(runs.map((x) => x.tris)).toLocaleString("en-GB")}, LOD ${runs.map((x) => x.lod).join("/")} [runs: ${r}]`,
      );
      if (LABELS) for (const x of runs) console.log(`  labels ${x.labels}`);
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
