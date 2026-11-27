import AxeBuilder from "@axe-core/playwright";
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
    const m = /\/models\/(widgets-[a-z_]+-(?:low|high))\.glb/.exec(r.url());
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
  // M13: the layer is chunked by body region; with no region, every chunk.
  expect(files.sort()).toEqual(["widgets-head-low", "widgets-lower_limb_left-low", "widgets-thorax-low"]);

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

// M14 session BT (plan decision 4): the widgets have their own search index,
// built from their kinds' `searchFields`; it's fetched while their layer isn't
// Off, or on the first keystroke, and choosing a widget selects it and turns
// its layer on.
const WIDGET_SEARCH = /\/assets\/_fixture_virtual_skeleton-search-widgets-/;

test("search finds a widget by name from its own index, loaded on the first keystroke or while its layer is on", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const fetched: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => WIDGET_SEARCH.test(r.url()) && fetched.push(r.url()));
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  await page.keyboard.press("/");
  const input = page.getByTestId("search-input");
  await expect(input).toBeFocused();
  await page.waitForTimeout(300);
  expect(fetched).toEqual([]); // the layer is Off: its index waits for a keystroke

  await input.fill("Spring 3");
  const first = page.getByTestId("search-results").getByRole("option").first();
  await expect(first.locator(".result-label")).toHaveText("Spring 3", { timeout: 15_000 });
  expect(fetched).toHaveLength(1);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__viewer!.state().sel), { timeout: 30_000 }).toBe("widget_spring_3");
  await expect(page).toHaveURL(/layers=[^&]*w:on/);
  expect(errors).toEqual([]);
});

test("with the widgets on, opening the sidebar fetches their search index before anything is typed", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (r) => WIDGET_SEARCH.test(r.url()) && fetched.push(r.url()));
  await page.goto("./?lod=low&debug&layers=b:on,w:on");
  await bonesShown(page);
  expect(fetched).toEqual([]); // nothing before the sidebar opens
  await page.keyboard.press("/");
  await expect.poll(() => fetched.length, { timeout: 15_000 }).toBe(1);
});

// M13 session BO (plan decisions 9 and 11): the widgets are chunked by coarse
// body region (gears in the head, springs in the thorax, levers in the left
// lower limb), and the loader fetches only the chunks a region needs, more as
// the focus moves, and the rest for the whole body. Each step adds instances
// to the layer's batch, still where the manifest says.
test("a chunked layer fetches only the chunks of the body region in focus, then more as the focus moves", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const files: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/widgets-([a-z_]+)-(low|high)\.glb/.exec(r.url());
    if (m) files.push(`${m[1]}-${m[2]}`);
  });
  const row = page.getByTestId("layers-report").locator("[data-layer=widgets]");
  const solid = () => page.evaluate((ids) => ids.filter((id) => window.__viewer!.solidNow(id)), WIDGETS);

  await page.goto("./?lod=low&debug&layers=b:on,w:on&reg=head");
  await bonesShown(page);
  await expect(row).toHaveAttribute("data-nodes", "4", { timeout: 60_000 });
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  expect(files).toEqual(["head-low"]);
  await expect.poll(solid).toEqual(["widget_gear_1", "widget_gear_2", "widget_gear_3", "widget_gear_4"]);

  // The thorax: its chunk is added to the batch; the head's stays loaded (drawn only in the head).
  await page.evaluate(() => window.__viewer!.focusRegion("thorax"));
  await expect(row).toHaveAttribute("data-nodes", "8", { timeout: 30_000 });
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  expect(files).toEqual(["head-low", "thorax-low"]);
  await expect.poll(solid).toEqual(["widget_spring_1", "widget_spring_2", "widget_spring_3", "widget_spring_4"]);

  // Back to the head: nothing new to fetch.
  await page.evaluate(() => window.__viewer!.focusRegion("head"));
  await expect.poll(solid).toEqual(["widget_gear_1", "widget_gear_2", "widget_gear_3", "widget_gear_4"]);
  expect(files).toEqual(["head-low", "thorax-low"]);

  // The whole body: the last chunk.
  await page.evaluate(() => window.__viewer!.leaveRegion());
  await expect(row).toHaveAttribute("data-nodes", "12", { timeout: 30_000 });
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  expect(files).toEqual(["head-low", "thorax-low", "lower_limb_left-low"]);
  await expect.poll(solid).toEqual(WIDGETS);
  expect(errors).toEqual([]);
});

test("a region with no member in a chunked layer fetches none of its chunks", async ({ page }) => {
  const files: string[] = [];
  page.on("request", (r) => /\/models\/widgets-/.test(r.url()) && files.push(r.url()));
  await page.goto("./?lod=low&debug&layers=b:on,w:on&reg=forearm_left");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("layer-widgets-on")).toBeChecked();
  // Neither loading nor failed: the Layers panel shows no progress or Retry for it.
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("layer-widgets-progress")).toHaveCount(0);
  await expect(page.getByTestId("layers-panel").getByRole("button", { name: "Retry" })).toHaveCount(0);
  expect(files).toEqual([]);
});

test("budget governor (M13 BP) with a chunked layer: the bones are capped, the widgets fetch only the region's chunk at each LOD", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const files: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/(widgets-[a-z_]+|skeleton)-(low|high)[.-]/.exec(r.url());
    if (m) files.push(`${m[1]}-${m[2]}`);
  });
  // Headless Chromium's SwiftShader plans low; report a capable GPU so Auto plans high.
  await page.addInitScript(() => {
    const get = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (this: WebGL2RenderingContext, p: number) {
      return p === this.RENDERER ? "Test GPU" : get.call(this, p);
    };
  });
  await page.goto("./?debug&budget=1000&layers=b:on,w:on&reg=head");
  const budget = page.getByTestId("debug-budget");
  // The bones are the heaviest layer; the widgets' two LODs are the same boxes, so capping them would save nothing.
  await expect(budget).toHaveAttribute("data-caps", "bones");
  await expect(budget).toHaveAttribute("data-over", "true");
  await expect(page.getByTestId("budget-prompt")).toBeVisible();
  const row = page.getByTestId("layers-report").locator("[data-layer=widgets]");
  await expect(row).toHaveAttribute("data-lod", "high", { timeout: 60_000 });
  await expect(row).toHaveAttribute("data-nodes", "4");
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  await expect(page.getByTestId("debug")).toHaveAttribute("data-lod", "low");
  expect(files.filter((f) => f.startsWith("widgets")).sort()).toEqual(["widgets-head-high", "widgets-head-low"]);
  expect(files).not.toContain("skeleton-high");
  expect(errors).toEqual([]);
});

// M14 session BU (plan decision 5): with two systems, filter chips under the
// search box: a radio group, "All" by default; a chip keeps that system's
// results only and is announced; "All" restores. axe on the row.
test("search filter chips: one per system, a chip filters by system, All restores", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  await page.keyboard.press("/");
  const chips = page.getByTestId("search-chips");
  await expect(chips).toHaveCount(0); // only the bones' index so far: one system
  await page.getByTestId("search-input").fill("2");
  await expect(chips).toBeVisible({ timeout: 15_000 });
  await expect(chips.getByRole("radio")).toHaveCount(3);
  await expect(page.getByTestId("search-chip-all")).toBeChecked();
  const ids = () => page.getByTestId("search-results").getByRole("option").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")!));
  const isWidget = (id: string) => id.startsWith("widget") || id.startsWith("widgets.");
  await expect.poll(async () => (await ids()).some(isWidget)).toBe(true);
  const before = await ids();
  expect(before.some((id) => !isWidget(id))).toBe(true);

  await page.getByTestId("search-chip-demo").check();
  await expect.poll(async () => (await ids()).every(isWidget)).toBe(true);
  const n = (await ids()).length;
  await expect(page.getByTestId("announcer")).toHaveText(`Search limited to Demo. ${n} ${n === 1 ? "result" : "results"}.`);
  // Keyboard: the arrows move within the group.
  await page.getByTestId("search-chip-demo").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("search-chip-musculoskeletal")).toBeChecked();
  await expect.poll(async () => (await ids()).some(isWidget)).toBe(false);

  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).join(", ")}`)).toEqual([]);

  await page.getByTestId("search-chip-all").check();
  await expect.poll(ids).toEqual(before);
  await expect(page.getByTestId("announcer")).toHaveText(/^Search in all systems\./);
  expect(errors).toEqual([]);
});
