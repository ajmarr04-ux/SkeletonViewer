import { expect, test, type Page } from "@playwright/test";
import ids from "../fixtures/systems/demo/widgets/ids.json" with { type: "json" };

// M11 session AX (plan decision 8): the app built with the test registry
// (`vite build --mode fixture`: the real layers plus the fixture layer
// `widgets`, system `demo`). Adding the layer to a registry is the only
// difference, and it reaches the Layers panel and its system group, the URL,
// the loader, the batches (bounds checked against the generated manifest) and
// picking.

const WIDGETS = ids.map((e) => e.id);

async function bonesShown(page: Page) {
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
}

async function openPanel(page: Page) {
  const direct = page.getByRole("button", { name: "Layers", exact: true });
  if (await direct.isVisible()) await direct.click();
  else await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByTestId("layers-panel")).toBeVisible();
}

test("the demo layer is turned on from its system group, loads 12 instances, is picked and is in the URL", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const files: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/(widgets-(?:low|high))\.glb/.exec(r.url());
    if (m) files.push(m[1]!);
  });
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  expect(files).toEqual([]);

  await openPanel(page);
  // Its own system group, after the musculoskeletal one, with a group control.
  const headers = page.locator(".layer-system");
  await expect(headers).toHaveCount(2);
  await expect(page.getByTestId("system-demo-toggle")).toHaveText(/Demo/);
  await expect(page.getByTestId("system-demo-off")).toBeChecked();
  await page.getByTestId("layer-widgets-on").check();
  await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:off,w:on(&|$)/);
  await expect(page.getByTestId("system-demo-on")).toBeChecked();
  await expect(page.getByTestId("announcer")).toHaveText(/Widgets/);

  // 12 batched instances, each where the generated manifest says.
  const row = page.getByTestId("layers-report").locator("[data-layer=widgets]");
  await expect(row).toHaveAttribute("data-nodes", String(WIDGETS.length), { timeout: 60_000 });
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  expect(files).toContain("widgets-low");

  // Picking: a click on a box selects it.
  await page.keyboard.press("Escape");
  const target = WIDGETS[WIDGETS.length - 2]!;
  const b = await page.evaluate((i) => window.__viewer!.bone(i), target);
  expect(b, target).not.toBeNull();
  expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), b!.client)).toBe(target);
  await page.mouse.click(b!.client.x, b!.client.y);
  await expect.poll(() => page.evaluate(() => window.__viewer!.state().sel)).toBe(target);
  await expect(page).toHaveURL(new RegExp(`sel=${target}(&|$)`));
  await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:off,w:on(&|$)/);
  expect(errors).toEqual([]);
});

test("layers= with the demo code round-trips through a reload", async ({ page }) => {
  await page.goto("./?lod=low&debug&layers=b:on,w:ghost");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("layer-widgets-ghost")).toBeChecked();
  await expect(page.getByTestId("layer-muscles-off")).toBeChecked();
  await expect(page.getByTestId("system-demo-ghost")).toBeChecked();
  // The URL is written on the next change, in registry order with the demo code last.
  await page.getByTestId("layer-cartilage-on").check();
  await expect(page).toHaveURL(/layers=b:on,c:on,l:off,m:off,w:ghost(&|$)/);
});
