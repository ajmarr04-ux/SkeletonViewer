import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M7 session T (plan steps 1 to 3): layer state in the URL and localStorage,
// the Layers panel, lazy loading of each layer's files, and per-layer batches
// that leave every structure where its manifest says. Session W extends this file.

const TISSUE = ["cartilage", "ligaments", "muscles"] as const;
type Tissue = (typeof TISSUE)[number];
const EXPECTED: Record<Tissue, number> = { cartilage: 0, ligaments: 0, muscles: 0 };
for (const e of softIds as { layer: Tissue; meshAvailable: boolean }[]) if (e.meshAvailable) EXPECTED[e.layer]++;

const LAYER_FILE = /\/models\/(muscles|ligaments|cartilage)-(low|high)\.glb/;
const LAYER_CHUNK = /\/assets\/LayerScenes-/;

function watchLayers(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    const m = LAYER_FILE.exec(r.url());
    if (m) seen.push(`${m[1]}-${m[2]}`);
    else if (LAYER_CHUNK.test(r.url())) seen.push("chunk");
  });
  return seen;
}

async function bonesShown(page: Page) {
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
}

async function openPanel(page: Page) {
  const direct = page.getByRole("button", { name: "Layers", exact: true });
  if (await direct.isVisible()) await direct.click();
  else await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByTestId("layers-panel")).toBeVisible();
}

test("the default view requests no layer file or layer chunk", async ({ page }) => {
  const seen = watchLayers(page);
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  await page.waitForTimeout(1500);
  expect(seen).toEqual([]);
  await expect(page.getByTestId("layers-report")).toHaveCount(0);
});

test("turning a layer on from the panel loads it once, puts it in the URL and localStorage", async ({ page }) => {
  const seen = watchLayers(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("layers-preset-skeleton")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("layer-ligaments-on").check();
  await expect(page).toHaveURL(/layers=b:on,c:off,l:on,m:off/);
  const row = page.getByTestId("layers-report").locator("[data-layer=ligaments]");
  await expect(row).toHaveAttribute("data-nodes", String(EXPECTED.ligaments), { timeout: 60_000 });
  await expect(row).toHaveAttribute("data-bounds-ok", "true");
  await expect(page.locator(".layer-row[data-layer=ligaments]")).toHaveAttribute("data-status", "ready");
  expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:layers"))).toBe("b:on,c:off,l:on,m:off");
  // Ghost, Off and On again: no second download.
  await page.getByTestId("layer-ligaments-ghost").check();
  await page.getByTestId("layer-ligaments-off").check();
  await page.getByTestId("layer-ligaments-on").check();
  await page.waitForTimeout(500);
  expect(seen.filter((s) => s !== "chunk")).toEqual(["ligaments-low"]);
  // Back to the Skeleton preset: the URL and storage go back to the default.
  await page.getByTestId("layers-preset-skeleton").click();
  await expect(page).not.toHaveURL(/layers=/);
  expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:layers"))).toBeNull();
  expect(errors).toEqual([]);
});

test("a stored setting is restored and written to the URL; the URL wins over storage", async ({ page }) => {
  await page.goto("./?lod=low");
  await page.evaluate(() => localStorage.setItem("skeleton-viewer:layers", "b:on,c:on,l:off,m:off"));
  await page.goto("./?lod=low&debug");
  await expect(page).toHaveURL(/layers=b:on,c:on,l:off,m:off/);
  await expect(page.getByTestId("layers-report").locator("[data-layer=cartilage]")).toHaveAttribute("data-nodes", String(EXPECTED.cartilage), {
    timeout: 60_000,
  });
  await page.goto("./?lod=low&debug&layers=b:on,m:ghost");
  await openPanel(page);
  await expect(page.getByTestId("layer-muscles-ghost")).toBeChecked();
  await expect(page.getByTestId("layer-cartilage-off")).toBeChecked();
});

test("all layers on: every node in place, few draw calls, the bones untouched", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&layers=b:on,c:on,l:on,m:on");
  await bonesShown(page);
  const report = page.getByTestId("layers-report");
  for (const layer of TISSUE) {
    const row = report.locator(`[data-layer=${layer}]`);
    await expect(row).toHaveAttribute("data-nodes", String(EXPECTED[layer]), { timeout: 120_000 });
    await expect(row, (await row.getAttribute("data-errors")) ?? "").toHaveAttribute("data-bounds-ok", "true");
    expect(Number(await row.getAttribute("data-bounds-max-delta-mm"))).toBeLessThan(1);
  }
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-bounds-ok", "true");
  // One batch per layer drawn (plan decision 4); the budget is < 20 with a selection (session W).
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls")), { timeout: 10_000 }).toBe(4);
  await openPanel(page);
  await expect(page.getByTestId("layers-preset-full")).toHaveAttribute("aria-pressed", "true");
});

test("the bones layer can be ghosted and turned off", async ({ page }) => {
  await page.goto("./?lod=low&debug&layers=b:ghost");
  await bonesShown(page);
  const debug = page.getByTestId("debug");
  // Ghost: the solid batch shows nothing; the ghost batch draws instead.
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls"))).toBe(1);
  await page.goto("./?lod=low&debug&layers=b:off");
  await bonesShown(page);
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls"))).toBe(0);
});

test("M6's debug format keeps the debug view and disables the panel", async ({ page }) => {
  await page.goto("./?lod=low&debug&layers=c");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("layers-debug-note")).toBeVisible();
  await expect(page.getByTestId("layer-muscles-on")).toBeDisabled();
  await expect(page).toHaveURL(/layers=c(&|$)/);
});

// --- Session U (plan steps 4 to 6): layer-aware isolation, picking across layers, Hide ---------

async function layerReady(page: Page, layer: Tissue) {
  await expect(page.getByTestId("layers-report").locator(`[data-layer=${layer}]`)).toHaveAttribute("data-nodes", String(EXPECTED[layer]), {
    timeout: 120_000,
  });
}

/** A structure's centre on screen (from the debug hooks). */
async function centreOf(page: Page, id: string) {
  const b = await page.evaluate((i) => window.__viewer!.bone(i), id);
  expect(b, id).not.toBeNull();
  return b!.client;
}

const counts = async (page: Page) => (await page.getByTestId("debug").getAttribute("data-layer-counts")) ?? "";

test("clicking a muscle over a bone selects the muscle; the placeholder panel and breadcrumb name it", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&layers=b:on,m:on");
  await bonesShown(page);
  await layerReady(page, "muscles");
  const at = await centreOf(page, "biceps_brachii_short_head_left");
  const picked = await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), at);
  expect(picked).toMatch(/^biceps_brachii_(short|long)_head_left$/);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("info-panel");
  await expect(panel).toHaveAttribute("data-id", picked!);
  await expect(page).toHaveURL(new RegExp(`sel=${picked}`));
  await expect(page.getByTestId("breadcrumb")).toContainText("Muscles");
  await expect(panel.getByTestId("part-of")).toHaveText(/Part of Biceps brachii/);
  await expect(panel.getByTestId("show-related")).toBeDisabled();
  await expect(panel.getByTestId("expand-region")).toBeDisabled();
  await expect(page.getByTestId("tool-related")).toHaveCount(0);
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-focus", picked!);
  await expect(debug).toHaveAttribute("data-outline-selected", picked!);
  // Tier 0: the bones become ghosts, the muscle stays solid, the other muscles ghosted.
  await expect(debug).toHaveAttribute("data-solid", "0");
  await expect.poll(() => counts(page)).toMatch(/muscles:1\/476/);
  // Same point with the muscles ghosted: no part of the biceps can be picked (a bone or nothing).
  await page.keyboard.press("Escape");
  await openPanel(page);
  await page.getByTestId("layer-muscles-ghost").check();
  await expect.poll(() => counts(page)).toMatch(/muscles:0\/477/);
  expect((await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), at)) ?? "").not.toMatch(/^biceps/);
});

test("draw calls stay under 20 with every layer on and a selection active", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("./?lod=low&debug&layers=b:on,c:on,l:on,m:on");
  await bonesShown(page);
  for (const l of TISSUE) await layerReady(page, l);
  await page.evaluate(() => window.__viewer!.select("femur_left"));
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-focus", "femur_left");
  await page.mouse.move(5, 400); // no hover outline from a stray pointer
  // Bones solid + bone ghosts + three layer ghost batches + the selection outline = 6.
  await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls")), { timeout: 10_000 }).toBe(6);
  expect(Number(await debug.getAttribute("data-draw-calls"))).toBeLessThan(20);
});

test("a link selecting a ligament turns its layer on and frames it", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&sel=inguinal_ligament_left");
  await bonesShown(page);
  await expect(page.getByTestId("info-panel")).toHaveAttribute("data-id", "inguinal_ligament_left", { timeout: 120_000 });
  await expect(page).toHaveURL(/layers=b:on,c:off,l:on,m:off/);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-focus", "inguinal_ligament_left");
  await expect(page.getByTestId("breadcrumb")).toContainText("Ligaments");
  // An unknown ID is dropped, as for bones.
  await page.goto("./?lod=low&debug&sel=not_a_structure");
  await bonesShown(page);
  await expect(page).not.toHaveURL(/sel=/, { timeout: 30_000 });
});

test("Hide: the button and X hide, the chip shows all, browser Back un-hides", async ({ page }) => {
  await page.goto("./?lod=low&debug");
  await bonesShown(page);
  const debug = page.getByTestId("debug");
  await page.evaluate(() => window.__viewer!.select("femur_left"));
  await expect(page.getByTestId("info-panel")).toHaveAttribute("data-id", "femur_left");
  await page.getByTestId("panel-hide").click();
  await expect(page.getByTestId("info-panel")).toHaveCount(0);
  await expect(page).toHaveURL(/hid=femur_left/);
  await expect(page).not.toHaveURL(/sel=/);
  await expect(debug).toHaveAttribute("data-solid", "233");
  await expect(debug).toHaveAttribute("data-hidden", "1");
  await expect(page.getByTestId("announcer")).toHaveText("Femur (left) hidden. 1 hidden.");
  // A hidden bone can't be picked.
  const femur = await centreOf(page, "femur_left");
  expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), femur)).not.toBe("femur_left");
  // X on another selection; the chip counts both.
  await page.evaluate(() => window.__viewer!.select("humerus_left"));
  await expect(page.getByTestId("info-panel")).toHaveAttribute("data-id", "humerus_left");
  await page.locator("canvas").focus();
  await page.keyboard.press("x");
  await expect(page).toHaveURL(/hid=femur_left,humerus_left/);
  const chip = page.getByTestId("show-all-hidden");
  await expect(chip).toHaveAccessibleName(/2 hidden/);
  // Back: the humerus is back, selected; the femur stays hidden.
  await page.goBack();
  await expect(page.getByTestId("info-panel")).toHaveAttribute("data-id", "humerus_left");
  await expect(debug).toHaveAttribute("data-hidden", "1");
  // Show all: one replace, nothing hidden.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("info-panel")).toHaveCount(0);
  await page.getByTestId("show-all-hidden").click();
  await expect(debug).toHaveAttribute("data-hidden", "0");
  await expect(page).not.toHaveURL(/hid=/);
  await expect(debug).toHaveAttribute("data-solid", "234");
});

test("a hid= link keeps bones and soft-tissue structures hidden", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&layers=b:on,l:on&hid=femur_left,inguinal_ligament_left");
  await bonesShown(page);
  await layerReady(page, "ligaments");
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-solid", "233");
  await expect.poll(() => counts(page)).toMatch(new RegExp(`ligaments:${EXPECTED.ligaments - 1}/0`));
  await expect(page.getByTestId("show-all-hidden")).toBeAttached();
});

test.describe("phone: hit proxies with the ligaments on (plan risk 3)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("small hand bones stay tappable among the ligaments' proxies", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("./?lod=low&debug&layers=b:on,l:on");
    await bonesShown(page);
    await layerReady(page, "ligaments");
    // Measured in session U (plan notes): proxies never took a tap from a bone in view; these are a sample.
    const cases = ["lunate_left", "trapezium_left", "hamate_left", "pisiform_left", "distal_phalanx_hand_2_left"];
    for (const id of cases) {
      expect(await page.evaluate((i) => window.__viewer!.frameBone(i, "anterior"), id), id).toBe(true);
      await page.waitForTimeout(150);
      const got = await page.evaluate((i) => {
        const b = window.__viewer!.bone(i)!;
        return window.__viewer!.pick(b.client.x, b.client.y, true);
      }, id);
      expect(got, id).toBe(id);
    }
  });
});

// --- Session V (plan steps 7 and 8): muscle depth and the existing tools with layers on -----------

const muscleCounts = async (page: Page) => {
  const m = /muscles:(\d+)\/(\d+)/.exec(await counts(page));
  return m ? { solid: Number(m[1]), ghost: Number(m[2]) } : null;
};

test("the depth control peels muscles away (hidden, not ghosted), in the URL and announced", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&layers=b:on,m:off");
  await bonesShown(page);
  await openPanel(page);
  await expect(page.getByTestId("muscle-depth-1")).toBeDisabled();
  await page.getByTestId("layer-muscles-on").check();
  await expect(page.getByTestId("muscle-depth-1")).toBeEnabled();
  await layerReady(page, "muscles");
  await expect.poll(() => muscleCounts(page)).toEqual({ solid: EXPECTED.muscles, ghost: 0 });
  await page.getByTestId("muscle-depth-1").check();
  await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:on:1/);
  await expect(page.getByTestId("announcer")).toHaveText(/^Superficial muscles hidden\. \d+ muscles hidden$/);
  const s1 = (await muscleCounts(page))!;
  expect(s1.ghost).toBe(0);
  expect(s1.solid).toBeLessThan(EXPECTED.muscles);
  // The deltoid is superficial: peeled, so the supraspinatus under it can be picked.
  const deltoid = await centreOf(page, "deltoid_acromial_part_left");
  expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), deltoid)).not.toMatch(/^deltoid/);
  // Three stops, each one layer deeper (the user's choice in session V).
  await expect(page.getByTestId("muscle-depth-3")).toHaveCount(0);
  await page.getByTestId("muscle-depth-2").check();
  await expect(page).toHaveURL(/m:on:2/);
  await expect.poll(async () => (await muscleCounts(page))!.solid).toBeLessThan(s1.solid);
  const s2 = (await muscleCounts(page))!;
  // Ghost keeps the peel; All brings everything back; storage remembers the stop.
  await page.getByTestId("layer-muscles-ghost").check();
  await expect.poll(() => muscleCounts(page)).toEqual({ solid: 0, ghost: s2.solid });
  expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:layers"))).toBe("b:on,c:off,l:off,m:ghost:2");
  await page.getByTestId("muscle-depth-0").check();
  await expect(page.getByTestId("announcer")).toHaveText("All muscles shown");
  await expect.poll(() => muscleCounts(page)).toEqual({ solid: 0, ghost: EXPECTED.muscles });
  await expect(page).toHaveURL(/m:ghost(&|$)/);
});

test("Explode is off while a soft-tissue layer shows; labels come from every solid layer", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&sel=femur_left&tier=1&layers=b:on,m:on");
  await bonesShown(page);
  await layerReady(page, "muscles");
  await page.getByRole("button", { name: "Explode" }).click();
  await expect(page.getByTestId("explode")).toBeDisabled();
  await expect(page.getByTestId("explode-note")).toHaveText("Turn off the soft-tissue layers to explode");
  await page.keyboard.press("Escape");
  // Labels: with a bone isolated its bones are labelled; nothing selected and the muscles solid, only muscles are.
  await page.getByTestId("labels-toggle").click();
  const labels = page.getByTestId("labels").locator("[data-label]");
  await expect.poll(async () => labels.evaluateAll((els) => els.map((e) => e.getAttribute("data-label")))).toContain("femur_left");
  await page.evaluate(() => window.__viewer!.back());
  await page.evaluate(() => window.__viewer!.back());
  await expect(page.getByTestId("info-panel")).toHaveCount(0);
  await expect
    .poll(async () => {
      const ids = await labels.evaluateAll((els) => els.map((e) => e.getAttribute("data-label") ?? ""));
      return ids.length > 0 && ids.every((id) => softIds.some((e) => (e as { id: string }).id === id));
    })
    .toBe(true);
  // Turning the muscles off gives Explode back.
  await openPanel(page);
  await page.getByTestId("layer-muscles-off").check();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__viewer!.select("femur_left"));
  await page.getByTestId("tool-related").click();
  await page.getByRole("button", { name: "Explode" }).click();
  await expect(page.getByTestId("explode")).toBeEnabled();
});

test("a screenshot with the muscles on is named after a selected muscle", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?lod=low&debug&sel=gluteus_maximus_left");
  await bonesShown(page);
  await expect(page.getByTestId("info-panel")).toHaveAttribute("data-id", "gluteus_maximus_left", { timeout: 120_000 });
  const shot = page.getByTestId("screenshot");
  if (!(await shot.isVisible())) await page.getByRole("button", { name: "More", exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("screenshot").click()]);
  expect(download.suggestedFilename()).toBe("skeleton-gluteus-maximus-left.png");
});
