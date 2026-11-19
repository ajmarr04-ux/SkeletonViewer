// Milestone 5 plan step 12: load budgets in Chromium with throttling.
//
// Usage: `npx vite build`, then npm run perf-load [-- [--strict] <base URL>]. With no URL
// it serves dist/ itself, gzipping text files as GitHub Pages does (vite
// preview doesn't compress, which would overstate the JavaScript's cost by
// about 4×). The .glb files are sent as they are, as on Pages (they are
// already meshopt-compressed).
//
// Network: DevTools' "Fast 4G" preset (9 Mbit/s down, 1.5 Mbit/s up, 165 ms
// round trip, the latency DevTools actually applies for that preset).
// CPU: 4× slowdown. A fresh browser context per run (cold cache), 3 runs per
// profile, the median reported. Times are the debug overlay's: when each LOD's
// file has been fetched and parsed (performance.now() from navigation start).
// Targets (spec §8): desktop ≤ 3 s to the skeleton and ≤ 8 s to full detail;
// phone ≤ 5 s and ≤ 12 s. Both profiles load both LODs (?lod=both), so "full
// detail" is the high LOD even where the automatic choice would stop at low.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { createGzip } from "node:zlib";
import { chromium, devices, type BrowserContextOptions } from "playwright";

const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".md": "text/markdown", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".png": "image/png",
};
const GZIP = new Set([".html", ".js", ".css", ".json", ".md", ".svg"]);

/** A static server for dist/ that gzips text, like GitHub Pages. */
function serveDist(): Promise<{ server: Server; url: string }> {
  const root = join(process.cwd(), "dist");
  if (!existsSync(join(root, "index.html"))) throw new Error("dist/ is missing: run `npx vite build` first");
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) return void res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return void res.writeHead(404).end();
    const ext = extname(file);
    const gz = GZIP.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
    res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream", ...(gz ? { "content-encoding": "gzip" } : {}) });
    const stream = createReadStream(file);
    (gz ? stream.pipe(createGzip({ level: 6 })) : stream).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => {
    const a = server.address();
    ok({ server, url: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}/` });
  }));
}
const RUNS = Number(process.env.RUNS ?? 3);
/** For diagnosis: PERF_NET=0 or PERF_CPU=1 turn one kind of throttling off. */
const NET = process.env.PERF_NET !== "0";
const CPU = Number(process.env.PERF_CPU ?? 4);
const profiles: { name: string; ctx: BrowserContextOptions; first: number; full: number }[] = [
  { name: "desktop", ctx: { viewport: { width: 1280, height: 800 } }, first: 3000, full: 8000 },
  { name: "phone", ctx: { ...devices["iPhone 13"], defaultBrowserType: undefined } as BrowserContextOptions, first: 5000, full: 12000 },
];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const own = arg ? null : await serveDist();
  const base = arg ?? own!.url;
  const browser = await chromium.launch();
  let ok = true;
  for (const p of profiles) {
    const rows: { low: number; high: number; lowBytes: number; highBytes: number; blocked: number }[] = [];
    let renderer = "";
    for (let i = 0; i < RUNS; i++) {
      const context = await browser.newContext(p.ctx);
      const page = await context.newPage();
      // Long tasks: main-thread time the browser can't spend on anything else.
      await page.addInitScript(() => {
        const w = window as unknown as { __longTasks: [number, number][] };
        w.__longTasks = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) w.__longTasks.push([e.startTime, e.duration]);
        }).observe({ type: "longtask", buffered: true });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      if (NET) await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 165,
        downloadThroughput: (9_000_000 * 0.9) / 8,
        uploadThroughput: (1_500_000 * 0.9) / 8,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
      await page.goto(new URL("./?lod=both&debug", base).toString());
      const debug = page.getByTestId("debug");
      await debug.and(page.locator("[data-load-high]")).waitFor({ timeout: 120_000 });
      const low = Number(await debug.getAttribute("data-load-low"));
      const high = Number(await debug.getAttribute("data-load-high"));
      const t = await page.evaluate((lowAt) => {
        // No named helper functions in here: tsx's __name wrapper doesn't exist in the page.
        const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const lowRes = res.find((r) => r.name.includes("skeleton-low.glb"));
        const highRes = res.find((r) => r.name.includes("skeleton-high.glb"));
        const gl = document.createElement("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        const tasks = (window as unknown as { __longTasks: [number, number][] }).__longTasks;
        return {
          lowBytes: lowRes?.responseEnd ?? NaN,
          highBytes: highRes?.responseEnd ?? NaN,
          blocked: tasks.filter(([s]) => s < lowAt).reduce((a, [, d]) => a + d, 0),
          renderer: ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown",
        };
      }, low);
      renderer = t.renderer;
      rows.push({ low, high, ...t });
      console.log(
        `${p.name} run ${i + 1}: skeleton ${low} ms, full detail ${high} ms ` +
          `(low file received ${Math.round(t.lowBytes)} ms, high file ${Math.round(t.highBytes)} ms; ` +
          `main thread blocked ${Math.round(t.blocked)} ms before the skeleton)`,
      );
      await context.close();
    }
    const f = median(rows.map((r) => r.low));
    const h = median(rows.map((r) => r.high));
    const pass = f <= p.first && h <= p.full;
    ok &&= pass;
    console.log(`${p.name}: median skeleton ${(f / 1000).toFixed(2)} s (≤ ${p.first / 1000} s), full detail ${(h / 1000).toFixed(2)} s (≤ ${p.full / 1000} s): ${pass ? "PASS" : "FAIL"}`);
    if (/swiftshader|llvmpipe|software/i.test(renderer)) {
      console.log(
        `  note: the GPU here is ${renderer}, a software renderer. Its shader compilation shows up as main-thread time ` +
          `("blocked" above) that a real GPU doesn't spend, so these times overstate a real device's. ` +
          `The network-bound part is the "file received" times.`,
      );
    }
  }
  await browser.close();
  own?.server.close();
  // Report only, unless --strict: in a container the software GPU fails the desktop budget on its own.
  process.exit(ok || !process.argv.includes("--strict") ? 0 : 1);
}

void main();
