import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M9 session AJ: the spec's journey (musculoskeletal spec §11, M9; plan exit criterion 5).
// Full skeleton → turn on muscles → click triceps → click long head → Show attachments
// (scapula + ulna tinted) → Show functional group → Back ×4 → full view.
// Every step goes through the real UI: the Layers panel, canvas clicks, the panel buttons
// and the browser's Back button.

const MUSCLE_MESHES = (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === "muscles" && e.meshAvailable).length;
const MUSCLE = "triceps_brachii_left";
const LONG = "triceps_brachii_long_head_left";

const debug = (page: Page) => page.getByTestId("debug");
const panel = (page: Page) => page.getByTestId("info-panel");
const solid = (page: Page, ids: string[]) =>
  page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);

async function openLayers(page: Page) {
  const direct = page.getByRole("button", { name: "Layers", exact: true });
  if (await direct.isVisible()) await direct.click();
  else await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByTestId("layers-panel")).toBeVisible();
}

test("journey: skeleton → muscles on → triceps → long head → attachments → functional group → Back ×4 → full view", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. The full skeleton, nothing selected.
  await page.goto("./?lod=low&debug");
  await expect(debug(page)).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(panel(page)).toHaveCount(0);
  const start = await page.evaluate(() => history.length);

  // 2. Turn the muscles layer on from the Layers panel (a setting, not a history step).
  await openLayers(page);
  await page.getByTestId("layer-muscles-on").check();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layers-panel")).toHaveCount(0);
  await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:on/);
  await expect(page.getByTestId("layers-report").locator("[data-layer=muscles]")).toHaveAttribute("data-nodes", String(MUSCLE_MESHES), {
    timeout: 120_000,
  });
  expect(await page.evaluate(() => history.length)).toBe(start);

  // Frame the long head from behind and find a point on it that a click really picks.
  expect(await page.evaluate((id) => window.__viewer!.frameBone(id, "posterior"), LONG)).toBe(true);
  await page.mouse.move(5, 400);
  const at = (await page.evaluate((id) => window.__viewer!.bone(id), LONG))!.client;
  expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), at)).toBe(LONG);

  // 3. The first click selects the whole triceps.
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toHaveAttribute("data-id", MUSCLE);
  await expect(page).toHaveURL(new RegExp(`sel=${MUSCLE}(&|$)`));

  // 4. The second click selects the long head.
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await expect(page).toHaveURL(new RegExp(`sel=${LONG}(&|$)`));

  // 5. Show attachments: the scapula (origin) and ulna (inherited insertion) are drawn and marked.
  await expect(panel(page).getByTestId("show-related")).toHaveText("Show attachments");
  await panel(page).getByTestId("show-related").click();
  await expect(page).toHaveURL(/tier=1/);
  await expect.poll(() => solid(page, [LONG, "scapula_left", "ulna_left", "femur_left"])).toEqual({
    [LONG]: true,
    scapula_left: true,
    ulna_left: true,
    femur_left: false,
  });
  // Plan decision 6: the agreeing patches mark the areas on the scapula and ulna.
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "triceps_brachii_long_head_left__origin", { timeout: 60_000 });
  await expect(debug(page)).toHaveAttribute("data-patches-insertion", "triceps_brachii_left__insertion");
  await expect(page.getByTestId("legend-key").locator(".legend-chip")).toHaveText(["Bone", "Muscles", "Origin", "Insertion"]);

  // 6. Show functional group: its synergists join (e.g. teres major, latissimus dorsi).
  await expect(panel(page).getByTestId("expand-region")).toHaveText("Show functional group");
  await panel(page).getByTestId("expand-region").click();
  await expect(page).toHaveURL(/tier=2/);
  await expect.poll(() => solid(page, ["teres_major_left", "latissimus_dorsi_left", "rectus_femoris_left"])).toEqual({
    teres_major_left: true,
    latissimus_dorsi_left: true,
    rectus_femoris_left: false,
  });

  // 7. Back ×4 with the browser: tier 2 → tier 1 → long head → triceps → full view.
  await page.goBack();
  await expect(page).toHaveURL(/tier=1/);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await page.goBack();
  await expect(page).not.toHaveURL(/tier=/);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "");
  await page.goBack();
  await expect(panel(page)).toHaveAttribute("data-id", MUSCLE);
  await page.goBack();

  // 8. The full view: nothing selected, every bone and muscle drawn, the muscles layer still on.
  await expect(panel(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/sel=|tier=/);
  await expect(page).toHaveURL(/m:on/);
  await expect(debug(page)).toHaveAttribute("data-focus-ids", "");
  await expect.poll(() => solid(page, [LONG, "scapula_left", "femur_left", "rectus_femoris_left"])).toEqual({
    [LONG]: true,
    scapula_left: true,
    femur_left: true,
    rectus_femoris_left: true,
  });
  expect(await page.evaluate(() => history.length)).toBeGreaterThan(start);
  expect(errors).toEqual([]);
});
