import { expect, test, type Page } from "@playwright/test";

// M13 BM: body-region focus state (plan decision 7), driven through URLs and
// `window.__viewer` (the picker UI arrives in BN, which extends this file).

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

test("a region applies to every layer: muscles outside it are hidden", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, "&layers=b:on,m:on&reg=forearm_left");
  await expect.poll(() => solid(page, "flexor_carpi_radialis_left"), { timeout: 120_000 }).toBe(true);
  expect(await solid(page, "biceps_brachii_short_head_left")).toBe(false);
  expect(await solid(page, "humerus_left")).toBe(false);
});

test("an unknown reg= is dropped from the URL", async ({ page }) => {
  await open(page, "&reg=nowhere");
  expect((await state(page)).reg).toBeNull();
  expect(param(page, "reg")).toBeNull();
});
