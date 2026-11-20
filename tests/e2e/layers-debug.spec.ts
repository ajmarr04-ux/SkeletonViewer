import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };
import softMap from "../../assets/mapping/soft-to-id.json" with { type: "json" };
import { LAYER_BUDGETS, SOFT_LAYERS, type SoftLayer } from "../../scripts/lib/model-checks";

// M6 plan step 9: the debug layer view (`?debug&layers=all`) and no regression without it.

const EXPECTED_NODES: Record<SoftLayer, number> = {
  muscles: 0,
  ligaments: 0,
  cartilage: 0,
  attachments: Object.keys((softMap as { attachments: Record<string, unknown> }).attachments).length,
};
for (const e of softIds as { layer: SoftLayer; meshAvailable: boolean }[]) {
  if (e.meshAvailable) EXPECTED_NODES[e.layer]++;
}

const LAYER_FILE = /\/models\/(muscles|ligaments|cartilage|attachments)-(low|high)\.glb/;
const LAYER_CHUNK = /\/assets\/(manifest-(muscles|ligaments|cartilage|attachments)|DebugLayers|debugLayers)-/;

async function openLayers(page: Page, query: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  const panel = page.getByTestId("debug-layers");
  await expect(panel).toHaveAttribute("data-complete", "true", { timeout: 90_000 });
  return { errors, panel };
}

for (const lod of ["low", "high"] as const) {
  test(`?lod=${lod}&layers=all: every layer loads, every node where the manifest says`, async ({ page }) => {
    const { errors, panel } = await openLayers(page, `?lod=${lod}&debug&layers=all`);
    await expect(panel).toHaveAttribute("data-layers", SOFT_LAYERS.join(","));
    for (const layer of SOFT_LAYERS) {
      const row = panel.locator(`[data-layer=${layer}]`);
      await expect(row).toHaveAttribute("data-lod", lod);
      // Node counts equal the meshAvailable IDs of the layer (and the patches' map).
      await expect(row).toHaveAttribute("data-nodes", String(EXPECTED_NODES[layer]));
      await expect(row).toHaveAttribute("data-bounds-checked", String(EXPECTED_NODES[layer]));
      // World bounds within 1 mm of manifest-<layer>.json: nothing moved.
      await expect(row, (await row.getAttribute("data-errors")) ?? "").toHaveAttribute("data-bounds-ok", "true");
      expect(Number(await row.getAttribute("data-bounds-max-delta-mm"))).toBeLessThan(1);
      const tris = Number(await row.getAttribute("data-triangles"));
      const { targetTris } = LAYER_BUDGETS[layer][lod];
      expect(Math.abs(tris - targetTris) / targetTris, `${layer} ${lod} triangles`).toBeLessThan(0.15);
    }
    // The bones are untouched by the layers.
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-instances", "234");
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    expect(errors).toEqual([]);
  });
}

test("layers=l,c loads only the ligament and cartilage files", async ({ page }) => {
  const files: string[] = [];
  page.on("request", (r) => {
    const m = LAYER_FILE.exec(r.url());
    if (m) files.push(`${m[1]}-${m[2]}`);
  });
  const { panel } = await openLayers(page, "?lod=low&debug&layers=l,c");
  await expect(panel).toHaveAttribute("data-layers", "ligaments,cartilage");
  await expect(panel.locator("[data-layer]")).toHaveCount(2);
  expect(files.sort()).toEqual(["cartilage-low", "ligaments-low"]);
});

for (const query of ["?lod=low&debug", "?lod=low&layers=all", "?lod=low"]) {
  test(`${query}: no layer file or layer chunk is requested`, async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (r) => {
      if (LAYER_FILE.test(r.url()) || LAYER_CHUNK.test(r.url())) requested.push(r.url());
    });
    await page.goto(`./${query}`);
    // Wait until the bones are on screen, then a little longer for anything lazy.
    await page.waitForFunction(() => document.querySelector("canvas") !== null);
    if (query.includes("debug")) {
      await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    } else {
      // index.html preloads the low model, so its response can come before any listener.
      await page.waitForFunction(
        () => performance.getEntriesByType("resource").some((e) => e.name.includes("skeleton-low.glb")),
        null,
        { timeout: 60_000 },
      );
    }
    await page.waitForTimeout(1500);
    expect(requested).toEqual([]);
    await expect(page.getByTestId("debug-layers")).toHaveCount(0);
  });
}

// Screenshots for the user to look at for misalignment (plan step 9), attached to the report.
test("screenshots: all layers and ligaments + cartilage + patches, front and side", async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [name, layers] of [
    ["all", "all"],
    ["no-muscles", "l,c,a"],
  ] as const) {
    await openLayers(page, `?lod=high&debug&layers=${layers}`);
    await page.waitForFunction(() => window.__viewer !== undefined);
    await page.addStyleTag({ content: ".debug, .toolbar { visibility: hidden !important; }" });
    for (const preset of ["anterior", "left"] as const) {
      await page.evaluate((p) => window.__viewer!.command({ kind: "preset", preset: p }), preset);
      await page.waitForTimeout(800);
      const path = testInfo.outputPath(`layers-${name}-${preset}.png`);
      await page.screenshot({ path });
      await testInfo.attach(`layers-${name}-${preset}`, { path, contentType: "image/png" });
    }
  }
  await page.close();
});
