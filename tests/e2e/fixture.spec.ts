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

// M12 session BI (plan decision 14): the demo system's edge types, the widgets'
// front matter, tier rules, panel and tree, all from the test registry. The
// widgets' content chunk and tree root are compiled by the app's generic code.
test("a widget's panel shows its links from the graph, its tiers follow its rules, and its tree root opens", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lod=low&debug&layers=b:on,w:on");
  await bonesShown(page);
  await expect(page.getByTestId("layers-report").locator("[data-layer=widgets]")).toHaveAttribute("data-nodes", String(WIDGETS.length), { timeout: 60_000 });

  const panel = page.getByTestId("info-panel");
  await page.evaluate(() => window.__viewer!.select("widget_gear_2"));
  await expect(panel).toHaveAttribute("data-id", "widget_gear_2");
  await expect(panel.getByTestId("section-summary")).toContainText("The second gear of the front train.");
  await expect(panel.getByTestId("section-meshes").getByRole("button")).toHaveText(["Gear 1", "Gear 3"]);
  await expect(panel.getByTestId("attached-drives").getByRole("button")).toHaveText(["Lever 2"]);
  await expect(panel.getByTestId("attached-driven-by").getByRole("button")).toHaveText(["Spring 2"]);
  // The bones' "Show attached muscles" belongs to their section, not to every grouped-links section.
  await expect(panel.getByTestId("show-attached")).toHaveCount(0);

  const solid = (ids: string[]) => page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);
  const all = ["widget_gear_1", "widget_gear_2", "widget_gear_3", "widget_gear_4", "widget_lever_2", "widget_spring_2", "widget_lever_4"];
  // Tier 1: what it meshes with, drives or is driven by.
  await expect(panel.getByTestId("show-related")).toHaveText("Show linked");
  await panel.getByTestId("show-related").click();
  await expect(page).toHaveURL(/tier=1/);
  await expect.poll(() => solid(all)).toEqual({
    widget_gear_1: true,
    widget_gear_2: true,
    widget_gear_3: true,
    widget_gear_4: false,
    widget_lever_2: true,
    widget_spring_2: true,
    widget_lever_4: false,
  });
  await expect(page.getByTestId("announcer")).toHaveText(/Gear 2: linked widgets shown/);
  // Tier 2: its gear train adds gear 4 (meshing with gear 3).
  await expect(panel.getByTestId("expand-region")).toHaveText("Show the train");
  await panel.getByTestId("expand-region").click();
  await expect(page).toHaveURL(/tier=2/);
  await expect.poll(() => solid(["widget_gear_4", "widget_lever_4"])).toEqual({ widget_gear_4: true, widget_lever_4: false });

  // A link selects the widget at the other end.
  await panel.getByTestId("attached-driven-by").getByRole("button", { name: "Spring 2" }).click();
  await expect(panel).toHaveAttribute("data-id", "widget_spring_2");

  // The sidebar: its root after the real ones, opened to the selected widget; kind, then assembly.
  const row = (key: string) => page.getByTestId("tree").locator(`[data-key="${key}"]`);
  await page.getByTestId("sidebar-toggle").click();
  await expect(row("widgets")).toHaveAttribute("aria-expanded", "true");
  await expect(row("widget_spring_2")).toHaveAttribute("aria-selected", "true");
  await expect(row("widgets.gear")).toHaveAttribute("aria-expanded", "false");
  await row("widgets.gear").click();
  await row("widgets.gear.rear_train").click();
  await expect(row("widget_gear_4")).toHaveText(/Gear 4/);
  expect(errors).toEqual([]);
});
