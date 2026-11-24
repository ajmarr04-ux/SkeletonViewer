import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M10 session AM: what the polite live region says (plan decision 4), read
// from the page. Every message is recorded as it is set, so a short-lived one
// (a "loading" replaced by "loaded") is still seen, and the tests can check
// that one action says one thing (risk 3).

const MESHES = (layer: string) => (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === layer && e.meshAvailable).length;
const TRICEPS = "triceps_brachii_left";
const LONG = "triceps_brachii_long_head_left";

declare global {
  interface Window {
    __said?: string[];
  }
}

/** Open the page and record every text the announcer is given. */
async function open(page: Page, query = "") {
  await page.addInitScript(() => {
    window.__said = [];
    const watch = () => {
      const el = document.querySelector("[data-testid=announcer]");
      if (!el) return void requestAnimationFrame(watch);
      new MutationObserver(() => {
        const t = el.textContent ?? "";
        if (t) window.__said!.push(t);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    };
    document.addEventListener("DOMContentLoaded", watch);
  });
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
}

const said = (page: Page) => page.evaluate(() => window.__said ?? []);
/** Messages said from now on. */
async function mark(page: Page): Promise<() => Promise<string[]>> {
  const from = (await said(page)).length;
  return async () => (await said(page)).slice(from);
}
const announcer = (page: Page) => page.getByTestId("announcer");
const panel = (page: Page) => page.getByTestId("info-panel");

async function layerReady(page: Page, layer: string) {
  await expect(page.getByTestId("layers-report").locator(`[data-layer=${layer}]`)).toHaveAttribute("data-nodes", String(MESHES(layer)), {
    timeout: 120_000,
  });
}

async function openLayers(page: Page) {
  const direct = page.getByRole("button", { name: "Layers", exact: true });
  if (await direct.isVisible()) await direct.click();
  else await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByTestId("layers-panel")).toBeVisible();
}

test("nothing is said on page load, even with a soft selection or group in the link", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, `&layers=b:on,m:on&sel=${TRICEPS}`);
  await layerReady(page, "muscles");
  await expect(panel(page)).toHaveAttribute("data-id", TRICEPS);
  await page.waitForTimeout(300);
  expect(await said(page)).toEqual([]);
  // The link turns the layer on itself (no `layers=`): still silent, and no "loaded" later.
  await open(page, `&sel=anterior_cruciate_ligament_left`);
  await layerReady(page, "ligaments");
  await expect(panel(page)).toHaveAttribute("data-id", "anterior_cruciate_ligament_left");
  await open(page, `&grp=muscles.upper_limb.shoulder.rotator_cuff`);
  await layerReady(page, "muscles");
  await page.waitForTimeout(300);
  expect(await said(page)).toEqual([]);
});

test("a selection that turns its layer on: one folded message, then loaded; Hide, Show all; Back", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  // Search chooses a muscle with every soft layer off: the selection, then the layer folded in.
  let since = await mark(page);
  await page.keyboard.press("/");
  await page.getByTestId("search-input").fill("left triceps brachii");
  const first = page.getByTestId("search-results").getByRole("option").first();
  await expect(first.locator(".result-label")).toHaveText("Triceps brachii (left)", { timeout: 15_000 });
  await page.keyboard.press("Enter");
  await expect(announcer(page)).toHaveText("Muscles loaded.", { timeout: 120_000 });
  expect(await since()).toEqual(["Triceps brachii, left, selected. Isolated. Muscles on, loading.", "Muscles loaded."]);
  await layerReady(page, "muscles");

  // Muscle → part, Back to the muscle.
  since = await mark(page);
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(announcer(page)).toHaveText("Long head of triceps brachii, left, selected. Part of triceps brachii.");
  await page.evaluate(() => window.__viewer!.back());
  await expect(announcer(page)).toHaveText("Triceps brachii, left, selected.");
  expect(await since()).toHaveLength(2);

  // Hide (one message, not "Full skeleton" as well), Show all, Back un-hides.
  since = await mark(page);
  await panel(page).getByTestId("panel-hide").click();
  await expect(announcer(page)).toHaveText("Triceps brachii, left, hidden. 3 hidden.");
  await page.goBack();
  await expect(announcer(page)).toHaveText("Triceps brachii, left, selected. Isolated.");
  await page.evaluate((id) => window.__viewer!.select(id), "biceps_brachii_left");
  await panel(page).getByTestId("panel-hide").click();
  await expect(announcer(page)).toHaveText("Biceps brachii, left, hidden. 2 hidden.");
  await page.getByTestId("show-all-hidden").click();
  await expect(announcer(page)).toHaveText("All hidden structures shown.");
  expect(await since()).toEqual([
    "Triceps brachii, left, hidden. 3 hidden.",
    "Triceps brachii, left, selected. Isolated.",
    "Biceps brachii, left, selected. Isolated.",
    "Biceps brachii, left, hidden. 2 hidden.",
    "All hidden structures shown.",
  ]);
});

test("muscle tiers and antagonists, counted by kind", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, `&layers=b:on,m:on&sel=${TRICEPS}`);
  await layerReady(page, "muscles");
  await expect(panel(page)).toHaveAttribute("data-id", TRICEPS);
  await expect(panel(page).getByTestId("show-related")).toBeEnabled({ timeout: 30_000 });
  await panel(page).getByTestId("show-related").click();
  await expect(announcer(page)).toHaveText(/^Triceps brachii, left: attachments shown, \d+ bones? and 3 parts\.$/);
  await panel(page).getByTestId("expand-region").click();
  await expect(announcer(page)).toHaveText(/^Triceps brachii, left: functional group shown, .*\d+ muscles?.*\.$/);
  await panel(page).getByTestId("show-antagonists").click();
  await expect(announcer(page)).toHaveText(/^Antagonists shown: \d+ muscles?\.$/);
  await panel(page).getByTestId("show-antagonists").click();
  await expect(announcer(page)).toHaveText("Antagonists hidden.");
  // Back from tier 2 → 1 → 0.
  await page.goBack();
  await expect(announcer(page)).toHaveText(/^Triceps brachii, left: attachments shown/);
  await page.goBack();
  await expect(announcer(page)).toHaveText("Triceps brachii, left, isolated.");
});

test("layers from the panel and presets; depth; a ligament's tiers; a bone's tier with muscles on; Show attached muscles", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await openLayers(page);
  let since = await mark(page);
  await page.getByTestId("layer-ligaments-on").check();
  await expect(announcer(page)).toHaveText("Ligaments loaded.", { timeout: 120_000 });
  expect(await since()).toEqual(["Ligaments on, loading.", "Ligaments loaded."]);
  await page.getByTestId("layer-ligaments-ghost").check();
  await expect(announcer(page)).toHaveText("Ligaments ghosted.");
  await page.getByTestId("layer-ligaments-off").check();
  await expect(announcer(page)).toHaveText("Ligaments off.");
  // Already loaded once: no "loading" the second time.
  await page.getByTestId("layer-ligaments-on").check();
  await expect(announcer(page)).toHaveText("Ligaments on.");
  since = await mark(page);
  await page.getByTestId("layers-preset-full").click();
  await expect(announcer(page)).toHaveText(/^(Muscles|Cartilage) loaded\.$/, { timeout: 120_000 });
  const full = await since();
  expect(full[0]).toBe("Full musculoskeletal: all layers on. Loading cartilage and muscles.");
  await layerReady(page, "muscles");
  await layerReady(page, "cartilage");
  await expect.poll(async () => (await since()).filter((t) => / loaded\.$/.test(t)).sort()).toEqual(["Cartilage loaded.", "Muscles loaded."]);
  await page.getByTestId("muscle-depth-1").check();
  await expect(announcer(page)).toHaveText(/^Superficial muscles hidden: \d+ muscles\.$/);
  await page.getByTestId("muscle-depth-0").check();
  await expect(announcer(page)).toHaveText("All muscles shown.");
  await page.keyboard.press("Escape");

  // A ligament's tiers: related structures, joint (menisci from the cartilage layer).
  await page.evaluate((id) => window.__viewer!.select(id), "anterior_cruciate_ligament_left");
  await expect(panel(page).getByTestId("show-related")).toBeEnabled({ timeout: 30_000 });
  await panel(page).getByTestId("show-related").click();
  await expect(announcer(page)).toHaveText(/^Anterior cruciate ligament, left: related structures shown, \d+ bones?\.$/);
  await panel(page).getByTestId("expand-region").click();
  await expect(announcer(page)).toHaveText(/^Anterior cruciate ligament, left: joint shown, .*ligaments.*menisc.*\.$/);

  // A bone's tier with muscles on: M5's wording plus the soft structures.
  await page.evaluate((id) => window.__viewer!.select(id), "femur_left");
  await panel(page).getByTestId("show-related").click();
  await expect(announcer(page)).toHaveText(/^Femur, left: related bones shown\. Hip bone, patella, tibia\. Also \d+ muscles.*\.$/);
  await page.goBack();
  await expect(announcer(page)).toHaveText("Femur, left, isolated.");

  // Show attached muscles.
  // (The pointer then rests on a row of the new panel, whose highlight is announced after; so read the record.)
  since = await mark(page);
  await panel(page).getByTestId("show-attached").click();
  await expect.poll(async () => (await since())[0]).toMatch(/^Femur, left: attached muscles shown, \d+ muscles/);
  await page.mouse.move(5, 5);

  // Skeleton preset.
  await openLayers(page);
  await page.getByTestId("layers-preset-skeleton").click();
  await expect(announcer(page)).toHaveText("Skeleton: bones only.");
});
