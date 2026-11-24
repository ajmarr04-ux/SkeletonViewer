import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M9 session AG: origin and insertion patches, the antagonist toggle, tints
// and legend chips (spec §5.2–5.3, §7; plan decisions 6–8).

const MESHES = (layer: string) => (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === layer && e.meshAvailable).length;
const LONG = "triceps_brachii_long_head_left";

async function ready(page: Page, query: string, layers: string[] = ["muscles"]) {
  await page.goto(`./?lod=low&debug&${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  for (const l of layers)
    await expect(page.getByTestId("layers-report").locator(`[data-layer=${l}]`)).toHaveAttribute("data-nodes", String(MESHES(l)), { timeout: 120_000 });
}

const debug = (page: Page) => page.getByTestId("debug");
const panel = (page: Page) => page.getByTestId("info-panel");
const solid = (page: Page, ids: string[]) =>
  page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);
const chips = (page: Page) => page.getByTestId("legend-key").locator(".legend-chip");

test("long head of triceps, tier 1: origin patch on the scapula, insertion patch on the ulna, legend chips", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,m:on");
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  // Tier 0: no patches, and the legend shows only the two layers.
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "");
  await expect(chips(page)).toHaveText(["Bone", "Muscles"]);

  await panel(page).getByTestId("show-related").click();
  await expect(page).toHaveURL(/tier=1/);
  // The patch file loads now (the first muscle at tier 1); then exactly the content's patches are drawn.
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "triceps_brachii_long_head_left__origin", { timeout: 60_000 });
  await expect(debug(page)).toHaveAttribute("data-patches-insertion", "triceps_brachii_left__insertion");
  // The bones themselves keep their colour (the patches mark the areas) and stay drawn.
  await expect(debug(page)).toHaveAttribute("data-tint-origin", "");
  expect(await solid(page, ["scapula_left", "ulna_left"])).toEqual({ scapula_left: true, ulna_left: true });
  await expect(chips(page)).toHaveText(["Bone", "Muscles", "Origin", "Insertion"]);

  // Back to tier 0: the patches and their chips go.
  await page.evaluate(() => window.__viewer!.back());
  await expect(page).not.toHaveURL(/tier=/);
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "");
  await expect(chips(page)).toHaveText(["Bone", "Muscles"]);
});

test("biceps, tier 1 with cartilage on: the glenoid labrum (no patch) is tinted whole in the origin colour", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,c:on,m:on", ["muscles", "cartilage"]);
  await page.evaluate(() => window.__viewer!.select("biceps_brachii_left"));
  await panel(page).getByTestId("show-related").click();
  await expect(debug(page)).toHaveAttribute("data-tint-origin", "glenoid_labrum_left", { timeout: 30_000 });
  await expect(debug(page)).toHaveAttribute("data-patches-insertion", "biceps_brachii_left__insertion", { timeout: 60_000 });
});

test("antagonist toggle at tier 2: off by default, ant=1 in the URL, tint and chip; gone below tier 2", async ({ page }) => {
  test.setTimeout(240_000);
  await ready(page, "layers=b:on,c:on,l:on,m:on", ["muscles", "ligaments", "cartilage"]);
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await panel(page).getByTestId("show-related").click();
  await expect(panel(page).getByTestId("show-antagonists")).toHaveCount(0);
  await panel(page).getByTestId("expand-region").click();
  await expect(page).toHaveURL(/tier=2/);
  const toggle = panel(page).getByTestId("show-antagonists");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", "");
  expect(await solid(page, ["brachialis_left"])).toEqual({ brachialis_left: false });

  const length = await page.evaluate(() => history.length);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tier=2&ant=1/);
  expect(await page.evaluate(() => history.length)).toBe(length); // a toggle, not a history step
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", /(^|,)brachialis_left(,|$)/);
  expect(await solid(page, ["brachialis_left"])).toEqual({ brachialis_left: true });
  await expect(chips(page).last()).toHaveText("Antagonist");
  // Every layer on, a selection, patches, outlines and antagonists: still under 20 draw calls (spec §8).
  await expect.poll(async () => Number(await debug(page).getAttribute("data-draw-calls")), { timeout: 10_000 }).toBeGreaterThan(0);
  expect(Number(await debug(page).getAttribute("data-draw-calls"))).toBeLessThan(20);

  await toggle.click();
  await expect(page).not.toHaveURL(/ant=1/);
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", "");
  await toggle.click();
  await expect(page).toHaveURL(/ant=1/);
  // Back to tier 1: the toggle and ant=1 go.
  await page.evaluate(() => window.__viewer!.back());
  await expect(page).toHaveURL(/tier=1/);
  await expect(page).not.toHaveURL(/ant=1/);
  await expect(panel(page).getByTestId("show-antagonists")).toHaveCount(0);
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", "");
  // Forward again: the tier-2 entry still says ant=1, so the antagonists come back with it.
  await page.goForward();
  await expect(page).toHaveURL(/tier=2&ant=1/);
  await expect(panel(page).getByTestId("show-antagonists")).toHaveAttribute("aria-pressed", "true");
});

test("ant=1 round trip: a link opens at the muscle's tier 2 with its antagonists shown", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, `layers=b:on,m:on&sel=${LONG}&tier=2&ant=1`);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await expect(page).toHaveURL(/tier=2&ant=1/);
  await expect(panel(page).getByTestId("show-antagonists")).toHaveAttribute("aria-pressed", "true");
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", /(^|,)brachialis_left(,|$)/, { timeout: 30_000 });
  // At tier 1 the link's ant=1 is dropped.
  await page.goto(`./?lod=low&debug&layers=b:on,m:on&sel=${LONG}&tier=1&ant=1`);
  await expect(panel(page)).toHaveAttribute("data-id", LONG, { timeout: 120_000 });
  await expect(page).not.toHaveURL(/ant=1/);
});

// M10 session AL (plan decision 3): the tints are Okabe–Ito colours like the
// regions (an origin patch on an upper-limb bone would be yellow on yellow), so
// colour-by-region pauses while any tint or patch is drawn, and the legend says so.
test("colour-by-region pauses while a muscle's tints are shown, and comes back after", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,m:on&color=region");
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  // Tier 0: no tints, so the regions stay (the muscle sits beside region-coloured bones).
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await expect(page.getByTestId("legend-paused")).toHaveCount(0);

  await panel(page).getByTestId("show-related").click();
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "triceps_brachii_long_head_left__origin", { timeout: 60_000 });
  await expect(debug(page)).toHaveAttribute("data-colour", "bone");
  await expect(page.getByTestId("legend-paused")).toBeVisible();
  await expect(page.getByRole("region", { name: "Colour key: regions" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("colour-toggle")).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => window.__viewer!.back());
  await expect(page).not.toHaveURL(/tier=/);
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await expect(page.getByTestId("legend-paused")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Colour key: regions" }).getByRole("button")).toHaveCount(8);
});
