import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M9 session AF: tiers per kind (spec §5.2; plan decisions 3 to 5). Related
// sets take structures only from layers that are On or Ghost; the focus
// always shows.

const MUSCLE_MESHES = (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === "muscles" && e.meshAvailable).length;
const LONG = "triceps_brachii_long_head_left";

async function ready(page: Page, query: string, muscles = true) {
  await page.goto(`./?lod=low&debug&${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  if (muscles)
    await expect(page.getByTestId("layers-report").locator("[data-layer=muscles]")).toHaveAttribute("data-nodes", String(MUSCLE_MESHES), {
      timeout: 120_000,
    });
}

async function openLayers(page: Page) {
  const direct = page.getByRole("button", { name: "Layers", exact: true });
  if (await direct.isVisible()) await direct.click();
  else await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByTestId("layers-panel")).toBeVisible();
}

const solid = (page: Page, ids: string[]) =>
  page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);
const panel = (page: Page) => page.getByTestId("info-panel");

test("a muscle part's tier 1 (Show attachments): its bones with the skeleton on, none with it off", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,m:on");
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  const related = panel(page).getByTestId("show-related");
  await expect(related).toHaveText("Show attachments");
  await expect(panel(page).getByTestId("expand-region")).toHaveText("Show functional group");
  await expect(related).toBeEnabled();
  await related.click();
  await expect(page).toHaveURL(/tier=1/);
  // Its own origin (scapula) and the inherited insertion (ulna); not the humerus (the other heads' origin).
  await expect.poll(() => solid(page, [LONG, "scapula_left", "ulna_left", "humerus_left", "femur_left"])).toEqual({
    [LONG]: true,
    scapula_left: true,
    ulna_left: true,
    humerus_left: false,
    femur_left: false,
  });
  await expect(page.getByTestId("announcer")).toHaveText(/Long head of triceps brachii, left: attachments shown/);

  // Bones Off: the related set loses its bones, live, with no new history entry; the focus stays.
  const length = await page.evaluate(() => history.length);
  await openLayers(page);
  await page.getByTestId("layer-bones-off").check();
  await page.keyboard.press("Escape");
  await expect.poll(() => solid(page, [LONG, "scapula_left", "ulna_left"])).toEqual({ [LONG]: true, scapula_left: false, ulna_left: false });
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(page).toHaveURL(/tier=1/);

  // Tier 2 (Show functional group): its synergists, e.g. teres major, are drawn.
  await panel(page).getByTestId("expand-region").click();
  await expect(page).toHaveURL(/tier=2/);
  await expect.poll(() => solid(page, ["teres_major_left", "latissimus_dorsi_left", "rectus_femoris_left"])).toEqual({
    teres_major_left: true,
    latissimus_dorsi_left: true,
    rectus_femoris_left: false,
  });
  // Back steps down the tiers.
  await page.evaluate(() => window.__viewer!.back());
  await expect(page).toHaveURL(/tier=1/);
});

test("a bone's tier 1 gains its muscles with the muscles layer on, and is M8's with it off", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "sel=scapula_left&tier=1", false);
  await expect(panel(page)).toHaveAttribute("data-id", "scapula_left");
  // Bones only: exactly the bones it articulates with (M8).
  await expect.poll(() => solid(page, ["scapula_left", "humerus_left", "clavicle_left", "femur_left"])).toEqual({
    scapula_left: true,
    humerus_left: true,
    clavicle_left: true,
    femur_left: false,
  });
  const before = await page.getByTestId("debug").getAttribute("data-solid");

  await openLayers(page);
  await page.getByTestId("layer-muscles-on").check();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layers-report").locator("[data-layer=muscles]")).toHaveAttribute("data-nodes", String(MUSCLE_MESHES), { timeout: 120_000 });
  // The muscles attached to the scapula are solid; the others (and the selection) stay as they were.
  await expect.poll(() => solid(page, [LONG, "teres_major_left", "triceps_brachii_lateral_head_left", "rectus_femoris_left"])).toEqual({
    [LONG]: true,
    teres_major_left: true,
    triceps_brachii_lateral_head_left: false,
    rectus_femoris_left: false,
  });
  await expect(page.getByTestId("debug")).toHaveAttribute("data-solid", before!);
  await expect(page).toHaveURL(/sel=scapula_left/);
  await expect(page).toHaveURL(/tier=1/);

  // Muscles off again: back to the bones only.
  await openLayers(page);
  await page.getByTestId("layer-muscles-off").check();
  await page.keyboard.press("Escape");
  await expect.poll(() => solid(page, [LONG, "teres_major_left"])).toEqual({ [LONG]: false, teres_major_left: false });
  await expect(page.getByTestId("debug")).toHaveAttribute("data-solid", before!);
});

test("a ligament with no joint has Show related but no Expand region, with the reason", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,l:on", false);
  await expect(page.getByTestId("layers-report").locator("[data-layer=ligaments]")).toHaveAttribute("data-nodes", /\d+/, { timeout: 120_000 });
  await page.evaluate(() => window.__viewer!.select("sacrotuberous_ligament_left"));
  await expect(panel(page)).toHaveAttribute("data-id", "sacrotuberous_ligament_left");
  await expect(panel(page).getByTestId("show-related")).toHaveText("Show related");
  await expect(panel(page).getByTestId("show-related")).toBeEnabled();
  await panel(page).getByTestId("show-related").click();
  await expect(page).toHaveURL(/tier=1/);
  await expect(panel(page).getByTestId("expand-region")).toBeDisabled();
  await expect(panel(page).getByTestId("tier-reason")).toHaveText("Expand region: Not part of a joint.");
  await expect(page.getByTestId("tool-region")).toHaveCount(0);
});
