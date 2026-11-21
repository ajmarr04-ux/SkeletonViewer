import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M9 session AE: nested muscle → part selection (spec §5.1; plan decisions 1 and 2).
// The first click on any part of the triceps selects the whole muscle; a second
// click selects the head; Esc, the breadcrumb and browser Back walk back up.

const MUSCLE_MESHES = (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === "muscles" && e.meshAvailable).length;
const LONG = "triceps_brachii_long_head_left";
const HEADS = ["triceps_brachii_lateral_head_left", LONG, "triceps_brachii_medial_head_left"].join(",");

async function ready(page: Page) {
  await page.goto("./?lod=low&debug&layers=b:on,m:on");
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(page.getByTestId("layers-report").locator("[data-layer=muscles]")).toHaveAttribute("data-nodes", String(MUSCLE_MESHES), {
    timeout: 120_000,
  });
}

/** Frame the long head from behind and return a point on it that a click really picks. */
async function longHeadPoint(page: Page) {
  expect(await page.evaluate((id) => window.__viewer!.frameBone(id, "posterior"), LONG)).toBe(true);
  await page.mouse.move(5, 400);
  const b = await page.evaluate((id) => window.__viewer!.bone(id), LONG);
  const at = b!.client;
  expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), at)).toBe(LONG);
  return at;
}

const debug = (page: Page) => page.getByTestId("debug");
const panel = (page: Page) => page.getByTestId("info-panel");
const crumbs = (page: Page) => page.getByTestId("breadcrumb");

test("click the triceps, then its long head; Esc twice goes back to the full view", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page);
  const at = await longHeadPoint(page);

  // Hover names what a click would select: the muscle.
  await page.mouse.move(at.x, at.y);
  await expect(page.getByTestId("tooltip")).toHaveText("Triceps brachii (left)");

  // Rule 1: the whole muscle; every head focused and outlined.
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left");
  await expect(page).toHaveURL(/sel=triceps_brachii_left(&|$)/);
  await expect(debug(page)).toHaveAttribute("data-focus-ids", HEADS);
  await expect(debug(page)).toHaveAttribute("data-outlines-selected", HEADS);
  await expect(crumbs(page)).toHaveText(/Muscles›Upper limb›Triceps brachii$/);

  // Rule 2: the long head; the other heads stay solid (3 solid muscles) without the accent.
  await page.mouse.move(at.x + 1, at.y);
  await expect(page.getByTestId("tooltip")).toHaveText("Long head of triceps brachii (left)");
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await expect(page).toHaveURL(new RegExp(`sel=${LONG}(&|$)`));
  await expect(debug(page)).toHaveAttribute("data-focus-ids", LONG);
  await expect(debug(page)).toHaveAttribute("data-outlines-selected", LONG);
  await expect(debug(page)).toHaveAttribute("data-layer-counts", new RegExp(`muscles:3/${MUSCLE_MESHES - 3}`));
  await expect(crumbs(page)).toHaveText(/Muscles›Upper limb›Triceps brachii›Long head$/);

  // Rule 3: a sibling head (selected exactly, as a second click on it would) replaces, no new entry.
  const length = await page.evaluate(() => history.length);
  await page.evaluate(() => window.__viewer!.click("triceps_brachii_medial_head_left"));
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_medial_head_left");
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.evaluate((id) => window.__viewer!.click(id), LONG);

  // Rule 4: Esc goes up one level at a time.
  await page.locator("canvas").focus();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left");
  await expect(debug(page)).toHaveAttribute("data-focus-ids", HEADS);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/sel=/);
});

test("browser Back walks part → muscle → full view; the muscle crumb goes up one level", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page);
  const at = await longHeadPoint(page);
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left");
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);

  await page.goBack();
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left");
  await page.goForward();
  await expect(panel(page)).toHaveAttribute("data-id", LONG);

  await crumbs(page).getByRole("button", { name: "Triceps brachii" }).click();
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left");
  await page.goBack();
  await expect(panel(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/sel=/);
});

test("a part chosen directly (a link) goes via its muscle in the history", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page);
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await page.goBack();
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left");
  await page.goBack();
  await expect(panel(page)).toHaveCount(0);
});
