import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M7 session T (plan steps 1 to 3): layer state in the URL and localStorage,
// the Layers panel, lazy loading of each layer's files, and per-layer batches
// that leave every structure where its manifest says. Session W extends this file.

const TISSUE = ["cartilage", "ligaments", "muscles"] as const;
type Tissue = (typeof TISSUE)[number];
const EXPECTED: Record<Tissue, number> = { cartilage: 0, ligaments: 0, muscles: 0 };
for (const e of softIds as { layer: Tissue; meshAvailable: boolean }[]) if (e.meshAvailable) EXPECTED[e.layer]++;

const LAYER_FILE = /\/models\/(muscles|ligaments|cartilage)-(low|high)\.glb/;
const LAYER_CHUNK = /\/assets\/LayerScenes-/;

function watchLayers(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    const m = LAYER_FILE.exec(r.url());
    if (m) seen.push(`${m[1]}-${m[2]}`);
    else if (LAYER_CHUNK.test(r.url())) seen.push("chunk");
  });
  return seen;
}

async function bonesShown(page: Page) {
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
}

async function openPanel(page: Page) {
  const direct = page.getByRole("button", { name: "Layers", exact: true });
  if (await direct.isVisible()) await direct.click();
  else await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByTestId("layers-panel")).toBeVisible();
}

test("the default view requests no layer file or layer chunk", async ({ page }) => {
  const seen = watchLayers(page);
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  await page.waitForTimeout(1500);
  expect(seen).toEqual([]);
  await expect(page.getByTestId("layers-report")).toHaveCount(0);
});

test("turning a layer on from the panel loads it once, puts it in the URL and localStorage", async ({ page }) => {
  const seen = watchLayers(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("layers-preset-skeleton")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("layer-ligaments-on").check();
  await expect(page).toHaveURL(/layers=b:on,c:off,l:on,m:off/);
  const row = page.getByTestId("layers-report").locator("[data-layer=ligaments]");
  await expect(row).toHaveAttribute("data-nodes", String(EXPECTED.ligaments), { timeout: 60_000 });
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  await expect(page.locator(".layer-row[data-layer=ligaments]")).toHaveAttribute("data-status", "ready");
  expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:layers"))).toBe("b:on,c:off,l:on,m:off");
  // Ghost, Off and On again: no second download.
  await page.getByTestId("layer-ligaments-ghost").check();
  await page.getByTestId("layer-ligaments-off").check();
  await page.getByTestId("layer-ligaments-on").check();
  await page.waitForTimeout(500);
  expect(seen.filter((s) => s !== "chunk")).toEqual(["ligaments-low"]);
  // Back to the Skeleton preset: the URL and storage go back to the default.
  await page.getByTestId("layers-preset-skeleton").click();
  await expect(page).not.toHaveURL(/layers=/);
  expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:layers"))).toBeNull();
  expect(errors).toEqual([]);
});

test("a stored setting is restored and written to the URL; the URL wins over storage", async ({ page }) => {
  await page.goto("./?lod=low");
  await page.evaluate(() => localStorage.setItem("skeleton-viewer:layers", "b:on,c:on,l:off,m:off"));
  await page.goto("./?lod=low&debug");
  await expect(page).toHaveURL(/layers=b:on,c:on,l:off,m:off/);
  await expect(page.getByTestId("layers-report").locator("[data-layer=cartilage]")).toHaveAttribute("data-nodes", String(EXPECTED.cartilage), {
    timeout: 60_000,
  });
  await page.goto("./?lod=low&debug&layers=b:on,m:ghost");
  await openPanel(page);
  await expect(page.getByTestId("layer-muscles-ghost")).toBeChecked();
  await expect(page.getByTestId("layer-cartilage-off")).toBeChecked();
});

test("all layers on: every node in place, few draw calls, the bones untouched", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&layers=b:on,c:on,l:on,m:on");
  await bonesShown(page);
  const report = page.getByTestId("layers-report");
  for (const layer of TISSUE) {
    const row = report.locator(`[data-layer=${layer}]`);
    await expect(row).toHaveAttribute("data-nodes", String(EXPECTED[layer]), { timeout: 120_000 });
    await expect(row, (await row.getAttribute("data-errors")) ?? "").toHaveAttribute("data-bounds-ok", "true");
    expect(Number(await row.getAttribute("data-bounds-max-delta-mm"))).toBeLessThan(1);
  }
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-bounds-ok", "true");
  // One batch per layer drawn (plan decision 4); the budget is < 20 with a selection (session W).
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls")), { timeout: 10_000 }).toBe(4);
  await openPanel(page);
  await expect(page.getByTestId("layers-preset-full")).toHaveAttribute("aria-pressed", "true");
});

test("the bones layer can be ghosted and turned off", async ({ page }) => {
  await page.goto("./?lod=low&debug&layers=b:ghost");
  await bonesShown(page);
  const debug = page.getByTestId("debug");
  // Ghost: the solid batch shows nothing; the ghost batch draws instead.
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls"))).toBe(1);
  await page.goto("./?lod=low&debug&layers=b:off");
  await bonesShown(page);
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls"))).toBe(0);
});

test("M6's debug format keeps the debug view and disables the panel", async ({ page }) => {
  await page.goto("./?lod=low&debug&layers=c");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("layers-debug-note")).toBeVisible();
  await expect(page.getByTestId("layer-muscles-on")).toBeDisabled();
  await expect(page).toHaveURL(/layers=c(&|$)/);
});
