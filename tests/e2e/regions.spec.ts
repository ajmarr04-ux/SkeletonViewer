import { expect, test, type Page } from "@playwright/test";

// M13 BM: body-region focus state (plan decision 7), driven through URLs and
// `window.__viewer`. M13 BN: the region UI (plan decision 8): the toolbar's
// "Body region" picker (list and body maps), framing, breadcrumb, announcements,
// the keyboard and the phone layout.

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}

const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const solid = (page: Page, id: string) => page.evaluate((i) => window.__viewer!.solidNow(i), id);
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);

test("reg= deep link hides everything outside the region; select inside, then Back out of both", async ({ page }) => {
  const errors = await open(page, "&reg=forearm_left");
  expect((await state(page)).reg).toBe("forearm_left");
  await expect.poll(() => solid(page, "radius_left")).toBe(true);
  expect(await solid(page, "humerus_left")).toBe(false);
  expect(await solid(page, "femur_left")).toBe(false);
  // Outside the region nothing can be picked.
  const humerus = (await page.evaluate(() => window.__viewer!.bone("humerus_left")))!.client;
  expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), humerus)).not.toBe("humerus_left");

  await page.evaluate(() => window.__viewer!.select("radius_left"));
  await expect.poll(() => page.url()).toContain("sel=radius_left&reg=forearm_left");
  await page.goBack();
  await expect.poll(async () => (await state(page)).sel).toBeNull();
  expect(param(page, "reg")).toBe("forearm_left");
  await page.evaluate(() => window.__viewer!.back());
  await expect.poll(async () => (await state(page)).reg).toBeNull();
  expect(param(page, "reg")).toBeNull();
  await expect.poll(() => solid(page, "humerus_left")).toBe(true);
  expect(errors).toEqual([]);
});

test("focusRegion from the whole body pushes an entry; browser Back leaves the region", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__viewer!.focusRegion("thigh_left"));
  await expect.poll(() => param(page, "reg")).toBe("thigh_left");
  await expect.poll(() => solid(page, "femur_left")).toBe(true);
  expect(await solid(page, "tibia_right")).toBe(false);
  await page.goBack();
  await expect.poll(async () => (await state(page)).reg).toBeNull();
  await expect.poll(() => solid(page, "tibia_right")).toBe(true);
});

test("a region applies to every layer that is On: muscles and ligaments outside it are hidden", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, "&layers=b:on,m:on,l:on&reg=forearm_left");
  await expect.poll(() => solid(page, "flexor_carpi_radialis_left"), { timeout: 120_000 }).toBe(true);
  await expect.poll(() => solid(page, "annular_ligament_radius_left"), { timeout: 120_000 }).toBe(true);
  expect(await solid(page, "biceps_brachii_short_head_left")).toBe(false);
  expect(await solid(page, "anterior_cruciate_ligament_left")).toBe(false);
  expect(await solid(page, "humerus_left")).toBe(false);
});

test("an unknown reg= is dropped from the URL", async ({ page }) => {
  await open(page, "&reg=nowhere");
  expect((await state(page)).reg).toBeNull();
  expect(param(page, "reg")).toBeNull();
});

// ---------------------------------------------------------------------------
// BN: the region UI

const picker = (page: Page) => page.getByRole("dialog", { name: "Body region" });
const announced = (page: Page) => page.getByTestId("announcer");
const crumbs = (page: Page) => page.getByTestId("breadcrumb").locator("li").allInnerTexts().then((t) => t.map((x) => x.replace("›", "").trim()));
const cam = (page: Page) => page.evaluate(() => window.__viewer!.camera());

test("pick from the list by keyboard: arrows move, Right opens, Enter chooses; framed, announced, focus returns", async ({ page }) => {
  const errors = await open(page);
  const home = await cam(page);
  await page.getByTestId("region-tool").click();
  await expect(picker(page)).toBeVisible();
  const tree = page.getByRole("tree", { name: "Body regions" });
  // Focus starts on the first row (Head); Down to "Upper limb (left)", Right opens it, Down × 4 to the forearm.
  await expect(tree.getByRole("treeitem").first()).toBeFocused();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveAttribute("data-region", "upper_limb_left");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(":focus")).toHaveAttribute("aria-expanded", "true");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveAttribute("data-region", "forearm_left");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(":focus")).toHaveAttribute("data-region", "upper_limb_left");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(picker(page)).toBeHidden();
  await expect(page.getByTestId("region-tool")).toBeFocused();
  await expect(page.getByTestId("region-tool")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => param(page, "reg")).toBe("forearm_left");
  await expect(announced(page)).toHaveText("Body region: forearm (left). 2 bones shown.");
  expect(await crumbs(page)).toEqual(["Skeleton", "Forearm (left)"]);
  // Framed: the camera moved closer, and the radius is on screen.
  await expect.poll(async () => JSON.stringify(await cam(page))).not.toBe(JSON.stringify(home));
  await page.waitForTimeout(1200);
  const r = (await page.evaluate(() => window.__viewer!.bone("radius_left")))!.client;
  const vp = page.viewportSize()!;
  expect(r.x).toBeGreaterThan(0);
  expect(r.x).toBeLessThan(vp.width);
  expect(r.y).toBeGreaterThan(0);
  expect(r.y).toBeLessThan(vp.height);
  expect(errors).toEqual([]);
});

test("Esc closes the picker without a change; Whole body leaves the region and restores the unmoved camera", async ({ page }) => {
  await open(page);
  await page.getByTestId("region-tool").click();
  await expect(picker(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker(page)).toBeHidden();
  expect(param(page, "reg")).toBeNull();
  await expect(page.getByTestId("region-tool")).toBeFocused();

  await page.waitForTimeout(600);
  const before = await cam(page);
  await page.getByTestId("region-tool").click();
  await picker(page).locator("[data-region=head]").click();
  await expect.poll(() => param(page, "reg")).toBe("head");
  await expect.poll(async () => JSON.stringify(await cam(page))).not.toBe(JSON.stringify(before));
  await page.waitForTimeout(1200);
  await page.getByTestId("region-tool").click();
  await expect(page.getByTestId("region-whole")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("region-whole").click();
  await expect.poll(() => param(page, "reg")).toBeNull();
  await expect(announced(page)).toHaveText("Left the body region.");
  await expect.poll(async () => (await cam(page)).position.map((x) => x.toFixed(3)).join()).toBe(before.position.map((x) => x.toFixed(3)).join());
});

test("pick from the body maps: a click on the back view, the arrow keys and Enter on the front view", async ({ page }) => {
  await open(page);
  await page.getByTestId("region-tool").click();
  const back = page.getByTestId("region-map-back");
  await expect(back).toBeVisible();
  await back.locator("[data-region=back_thoracic]").click();
  await expect.poll(() => param(page, "reg")).toBe("back_thoracic");
  await expect(announced(page)).toHaveText(/^Body region: thoracic back\. \d+ bones shown\.$/);
  await expect.poll(() => solid(page, "vertebra_t6")).toBe(true);
  expect(await solid(page, "femur_left")).toBe(false);

  // The front map is one Tab stop; the arrow keys move along its regions and Enter chooses.
  await page.getByTestId("region-tool").click();
  const front = page.getByTestId("region-map-front");
  const first = front.locator("[role=button]").first();
  await first.focus();
  const firstKey = await first.getAttribute("data-region");
  await page.keyboard.press("ArrowRight");
  const next = await page.locator(":focus").getAttribute("data-region");
  expect(next).not.toBe(firstKey);
  await expect(front.locator("[tabindex='0']")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect.poll(() => param(page, "reg")).toBe(next);
  // The same region has the same name in the list and on the map.
  await page.getByTestId("region-tool").click();
  const name = await front.locator(`[data-region=${next}]`).getAttribute("aria-label");
  await expect(picker(page).getByRole("treeitem", { selected: true })).toHaveAccessibleName(new RegExp(`^${name!.replace(/[()]/g, "\\$&")}\\s*, \\d+$`));
});

test("select inside, tiers inside, Back × 4; breadcrumb crumbs and the announcements", async ({ page }) => {
  await open(page, "&reg=forearm_left");
  await page.evaluate(() => window.__viewer!.select("radius_left"));
  await expect(announced(page)).toHaveText("Radius, left, selected. Isolated.");
  expect((await crumbs(page)).slice(0, 2)).toEqual(["Skeleton", "Forearm (left)"]);
  expect((await crumbs(page)).at(-1)).toBe("Radius");
  await page.locator("canvas").focus();
  await page.keyboard.press("r");
  await expect.poll(async () => (await state(page)).tier).toBe(1);
  // The related set is cut to the region: the humerus (an articulation partner) stays hidden.
  await expect.poll(() => solid(page, "ulna_left")).toBe(true);
  expect(await solid(page, "humerus_left")).toBe(false);
  expect((await crumbs(page)).at(-1)).toBe("Related");
  await page.keyboard.press("e");
  await expect.poll(async () => (await state(page)).tier).toBe(2);

  // The region's crumb leaves the isolation and keeps the region.
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Forearm (left)" }).click();
  await expect.poll(async () => (await state(page)).sel).toBeNull();
  expect((await state(page)).reg).toBe("forearm_left");
  expect(await crumbs(page)).toEqual(["Skeleton", "Forearm (left)"]);
  await expect(announced(page)).toHaveText("Body region: forearm (left). 2 bones shown.");

  // Back × 4: the region level → tier 2 → tier 1 → tier 0 → the region level.
  await page.goBack();
  await expect.poll(async () => (await state(page)).tier).toBe(2);
  for (const t of [1, 0]) {
    await page.locator("canvas").focus();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).tier).toBe(t);
  }
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await state(page)).sel).toBeNull();
  expect((await state(page)).reg).toBe("forearm_left");
  await expect(announced(page)).toHaveText("Body region: forearm (left). 2 bones shown.");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await state(page)).reg).toBeNull();
  await expect(announced(page)).toHaveText("Left the body region.");
  await expect(page.getByTestId("breadcrumb")).toHaveCount(0);
});

test("a selection from outside the region is drawn and announced as outside; Skeleton leaves the region", async ({ page }) => {
  await open(page, "&reg=forearm_left");
  await page.evaluate(() => window.__viewer!.select("femur_left"));
  await expect(announced(page)).toHaveText("Femur, left, selected. Isolated. Outside the body region.");
  await expect.poll(() => solid(page, "femur_left")).toBe(true);
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Skeleton" }).click();
  await expect.poll(async () => (await state(page)).reg).toBeNull();
  expect((await state(page)).sel).toBe("femur_left");
  await expect(announced(page)).toHaveText("Left the body region.");
});

test.describe("phone: the picker under More", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("Body region is in More; the picker fits the screen; a choice returns focus to More", async ({ page }) => {
    const errors = await open(page);
    const bar = page.getByRole("navigation", { name: "View controls" });
    await expect(bar).toHaveAttribute("data-fit", "more");
    await expect(bar.getByTestId("region-tool")).toHaveCount(0);
    await bar.getByRole("button", { name: "More" }).tap();
    await page.getByRole("dialog", { name: "More" }).getByTestId("region-tool").tap();
    await expect(picker(page)).toBeVisible();
    const b = (await picker(page).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    await picker(page).locator("[data-region=lower_limb_right] .tree-chevron").tap();
    await picker(page).getByRole("treeitem", { name: /^Knee \(right\)/ }).tap();
    await expect.poll(() => param(page, "reg")).toBe("knee_right");
    await expect(picker(page)).toBeHidden();
    await expect(bar.getByRole("button", { name: "More" })).toBeFocused();
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BQ: the Tab cursor, `[` / `]` and label thinning in a region (plan decision 12)

const cursorNow = async (page: Page) => (await state(page)).cursor;

test("in a region, Tab walks the focus layer's members first; ] and [ jump between layers", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await open(page, "&layers=b:on,l:on&reg=forearm_left");
  await expect.poll(() => solid(page, "annular_ligament_radius_left"), { timeout: 120_000 }).toBe(true);
  await page.locator("canvas").focus();
  // The focus layer with nothing selected is the topmost On: the ligaments.
  await page.keyboard.press("Tab");
  const first = await cursorNow(page);
  expect(first).not.toBeNull();
  expect(await page.evaluate((i) => window.__viewer!.solidNow(i), first!)).toBe(true);
  expect(first).not.toMatch(/^(radius|ulna)_left$/);
  // ] : the bones' first stop.
  await page.keyboard.press("]");
  const bone = await cursorNow(page);
  expect(bone).toMatch(/_left$/);
  expect(bone).not.toBe(first);
  await expect(announced(page)).toContainText(/^Bones: /);
  await page.keyboard.press("]");
  expect(await cursorNow(page)).toBe(bone);
  await expect(announced(page)).toHaveText("No next layer.");
  await page.keyboard.press("[");
  expect(await cursorNow(page)).toBe(first);
  // Every stop stays inside the region: Tab to the end never reaches the humerus.
  const seen: string[] = [];
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press("Tab");
    const c = await cursorNow(page);
    if (c === null) break;
    seen.push(c);
  }
  expect(seen).toContain(bone);
  expect(seen).not.toContain("humerus_left");
  expect(seen).not.toContain("femur_left");
  expect(errors).toEqual([]);
});

test("labels: candidates thinned to the drawn structures of the region and to N", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => window.localStorage.setItem("skeleton-viewer:labels", "1"));
  // Bones only, whole body: never thinned.
  await open(page);
  await expect(page.getByTestId("labels")).toBeVisible();
  const whole = await page.evaluate(() => window.__viewer!.labelCandidates());
  expect(whole).toBeGreaterThan(0);
  // A region: only its members are labelled.
  await page.evaluate(() => window.__viewer!.focusRegion("forearm_left"));
  await expect.poll(() => page.locator("[data-label]").count()).toBeGreaterThan(0);
  await expect.poll(async () => (await page.locator("[data-label]").evaluateAll((els) => els.map((e) => e.getAttribute("data-label")))).includes("radius_left")).toBe(true);
  const labelled = await page.locator("[data-label]").evaluateAll((els) => els.map((e) => e.getAttribute("data-label")!));
  expect(labelled).not.toContain("humerus_left");
  for (const id of labelled) expect(await solid(page, id)).toBe(true);
  // Every layer On over the whole body: the layout gets at most N (60) candidates.
  await open(page, "&layers=b:on,c:on,l:on,m:on");
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 180_000 });
  await expect.poll(() => solid(page, "deltoid_clavicular_part_left"), { timeout: 180_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__viewer!.labelCandidates()), { timeout: 60_000 }).toBe(60);
  expect(await page.locator("[data-label]").count()).toBeGreaterThan(0);
});

// M14 session BU (plan decisions 1.2 and 5): the sidebar passes the store's
// body region and visible layers to the ranker. Inside a band, the region's
// members come first, then structures on layers that are On or Ghost.
test("search ranks the body region's members first in a band, then the visible layers", async ({ page }) => {
  const errors = await open(page, "&reg=forearm_right");
  const labels = page.getByTestId("search-results").getByRole("option").locator(".result-label");
  await page.keyboard.press("/");
  await page.getByTestId("search-input").fill("radius");
  // Both radii are exact names (band 0); outside a region the left comes first (ID order).
  await expect(labels.first()).toHaveText(/Radius \(right\)/, { timeout: 15_000 });
  await expect(labels.nth(1)).toHaveText(/Radius \(left\)/);
  await page.evaluate(() => window.__viewer!.focusRegion("forearm_left"));
  await expect(labels.first()).toHaveText(/Radius \(left\)/);

  // Visibility at the default layers (BS approval B): the trapezium bone (On) before the trapezius's parts (muscles Off).
  await page.evaluate(() => window.__viewer!.leaveRegion());
  await page.getByTestId("search-input").fill("trapezius");
  await expect(labels.first()).toHaveText(/^Trapezius/, { timeout: 15_000 });
  const all = await labels.allTextContents();
  const bone = all.findIndex((t) => /Trapezium/.test(t));
  const part = all.findIndex((t) => /part/i.test(t));
  expect(bone, all.join(" | ")).toBeGreaterThan(-1);
  if (part > -1) expect(bone, all.join(" | ")).toBeLessThan(part);
  expect(errors).toEqual([]);
});
