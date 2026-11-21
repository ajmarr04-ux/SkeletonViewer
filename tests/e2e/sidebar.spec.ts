import { expect, test, type Page } from "@playwright/test";

// Milestone 5 session M: the sidebar (search and tree), group isolation and
// Tab through the visible objects (plan steps 1 to 4).

async function open(page: Page, query = "", viewport?: { width: number; height: number }) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);
const camera = (page: Page) => page.evaluate(() => window.__viewer!.camera());

test.describe("search", () => {
  test("by English, Latin, common name and synonym; keyboard through results; Enter selects and frames", async ({ page }) => {
    const errors = await open(page);
    const input = page.getByTestId("search-input");
    const results = page.getByTestId("search-results");
    await page.keyboard.press("/");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(input).toBeFocused();
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");

    for (const [q, first, match] of [
      ["femur", /^Femur \((left|right)\)$/, null],
      ["os coxae", /^Hip bone/, "Os coxae"],
      ["kneecap", /^Patella/, "Kneecap"],
      ["tailbone", /^Coccyx$/, "Tailbone"],
      ["innominate", /^Hip bone/, "Innominate bone"],
    ] as const) {
      await input.fill(q);
      const opt = results.getByRole("option").first();
      await expect(opt.locator(".result-label")).toHaveText(first);
      if (match) await expect(opt.locator(".result-match")).toHaveText(match);
    }

    await input.fill("femur");
    // M9 (session AI): the soft index is merged in after the first keystroke, so the two femurs
    // come first, then the ligament of the head of the femur, left and right.
    await expect(results.getByRole("option")).toHaveCount(4);
    await expect(results.getByRole("option").locator(".result-label")).toHaveText([
      /^Femur \(left\)$/,
      /^Femur \(right\)$/,
      /ligament.*head.*femur.*left/i,
      /ligament.*head.*femur.*right/i,
    ]);
    await expect(input).toHaveAttribute("aria-activedescendant", "result-femur_left");
    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", "result-femur_right");
    await expect(results.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    const before = await camera(page);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("femur_right");
    expect(param(page, "sel")).toBe("femur_right");
    // Framed: the camera moved to the femur.
    await expect.poll(async () => JSON.stringify(await camera(page))).not.toBe(JSON.stringify(before));
    await expect(page.getByTestId("debug")).toHaveAttribute("data-solid", "1");

    // Esc clears the field, then closes the sidebar.
    await input.focus();
    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sidebar")).toHaveCount(0);
    await expect(page.getByTestId("sidebar-toggle")).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("'left' narrows to a side; nonsense finds nothing", async ({ page }) => {
    await open(page);
    await page.getByTestId("sidebar-toggle").click();
    const input = page.getByTestId("search-input");
    await input.fill("left femur");
    await expect(page.getByTestId("search-results").getByRole("option")).toHaveCount(1);
    await input.fill("xqzvw");
    await expect(page.getByTestId("search-status")).toHaveText("No matches.");
    await expect(page.getByTestId("search-results")).toBeHidden();
  });
});

test.describe("tree", () => {
  test("keyboard navigation, a leaf selects, the branch follows a 3D selection", async ({ page }) => {
    await open(page);
    await page.getByTestId("sidebar-toggle").click();
    const tree = page.getByTestId("tree");
    const row = (key: string) => tree.locator(`[data-key="${key}"]`);
    await page.keyboard.press("Tab"); // from the search field into the tree
    await expect(row("axial")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(row("axial.skull")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(row("axial.skull")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowRight");
    await expect(row("axial.skull.cranial")).toBeFocused();
    await page.keyboard.press("Enter"); // opens the group
    await expect(row("axial.skull.cranial")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowDown");
    await expect(row("frontal_bone")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("frontal_bone");
    await expect(row("frontal_bone")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(row("axial.skull.cranial")).toBeFocused();
    await page.keyboard.press("o"); // type-ahead: the next row starting with O
    await expect(row("occipital_bone")).toBeFocused();
    await page.keyboard.press("o");
    await expect(row("axial.skull.ossicles")).toBeFocused();
    await expect(row("axial.skull.cranial")).toContainText("Cranial bones (8)");

    // A selection made elsewhere opens its branch and marks the leaf.
    await page.evaluate(() => window.__viewer!.select("tooth_36"));
    await expect(row("tooth_36")).toBeVisible();
    await expect(row("tooth_36")).toHaveAttribute("aria-selected", "true");
    await expect(row("dentition.lower.left.molars")).toHaveAttribute("aria-expanded", "true");
    await expect(row("tooth_36")).toBeInViewport();

    // A wisdom tooth is selectable and says it has no model.
    await row("dentition.lower.left.molars").locator(".tree-isolate").isVisible();
    await row("tooth_38").click();
    await expect.poll(async () => (await state(page)).sel).toBe("tooth_38");
    await expect(page.getByTestId("no-model-note")).toBeVisible();
  });
});

test.describe("group isolation", () => {
  test("molars: solid count, URL, panel, member click, Back to the group, Back to the start", async ({ page }) => {
    const errors = await open(page);
    const debug = page.getByTestId("debug");
    const announcer = page.getByTestId("announcer");
    const panel = page.getByTestId("info-panel");
    await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("tree").locator('[data-key="dentition.type.molars"]').click();
    await expect.poll(async () => (await state(page)).grp).toBe("dentition.type.molars");
    expect(param(page, "grp")).toBe("dentition.type.molars");
    expect(param(page, "sel")).toBeNull();
    await expect(debug).toHaveAttribute("data-solid", "8");
    await expect(debug).toHaveAttribute("data-ghosts", "226");
    await expect(debug).toHaveAttribute("data-focus", "");
    await expect(announcer).toHaveText("Molars, upper and lower: 8 shown, 8 of 12 have a 3D model.");
    await expect(panel).toHaveAttribute("data-group", "dentition.type.molars");
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Molars, upper and lower");
    await expect(page.getByTestId("breadcrumb")).toHaveText(/Skeleton\s*›\s*Teeth\s*›\s*All molars/);
    // No tiers and no Explode for a group; Ghosts still apply.
    await expect(page.getByTestId("tool-related")).toHaveCount(0);
    await expect(page.getByTestId("ghost-toggle")).toBeVisible();

    await panel.getByTestId("link-tooth_36").click();
    await expect.poll(async () => `${(await state(page)).sel}|${(await state(page)).grp}`).toBe("tooth_36|null");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await page.goBack();
    await expect.poll(async () => (await state(page)).grp).toBe("dentition.type.molars");
    await expect(announcer).toHaveText("Back to Molars, upper and lower: 8 shown, 8 of 12 have a 3D model.");
    await page.goBack();
    await expect.poll(async () => `${(await state(page)).sel}|${(await state(page)).grp}`).toBe("null|null");
    await expect(debug).toHaveAttribute("data-solid", "234");
    await expect(announcer).toHaveText("Full skeleton");
    expect(errors).toEqual([]);
  });

  test("a grp link opens the group; the Isolate button and the breadcrumb isolate groups", async ({ page }) => {
    await open(page, "&grp=axial.skull.ossicles");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "6");
    await page.getByTestId("breadcrumb").getByRole("button", { name: "Skull" }).click();
    await expect.poll(async () => (await state(page)).grp).toBe("axial.skull");
    await expect(debug).toHaveAttribute("data-solid", "29");
    await page.getByTestId("sidebar-toggle").click();
    const row = page.getByTestId("tree").locator('[data-key="axial.vertebral_column.cervical"]');
    await page.getByTestId("tree").locator('[data-key="axial.vertebral_column"]').click();
    await row.hover();
    await page.getByTestId("isolate-axial.vertebral_column.cervical").click();
    await expect.poll(async () => (await state(page)).grp).toBe("axial.vertebral_column.cervical");
    await expect(debug).toHaveAttribute("data-solid", "7");
    // I on a focused group row isolates it.
    await row.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("i");
    await expect.poll(async () => (await state(page)).grp).toBe("axial.vertebral_column.thoracic");
  });
});

test.describe("Tab through visible objects", () => {
  test("Tab moves a cursor, Enter selects, focus leaves after the last; Escape then Tab leaves early", async ({ page }) => {
    await open(page, "&grp=axial.skull.ossicles");
    const canvas = page.locator(".viewport canvas");
    const announcer = page.getByTestId("announcer");
    await canvas.focus();
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await state(page)).cursor).toBe("malleus_left");
    await expect(page.getByTestId("tooltip")).toHaveText("Malleus (left)");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-outline-hover", "malleus_left");
    await expect(announcer).toHaveText(/^Malleus, left\. 1 of 6\./);
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await state(page)).cursor).toBe("malleus_right");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    // Shift+Tab before the first leaves the canvas (no keyboard trap).
    await expect(canvas).not.toBeFocused();
    await expect.poll(async () => (await state(page)).cursor).toBeNull();

    await canvas.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await expect.poll(async () => (await state(page)).cursor).toBe("incus_left"); // ids.json order
    await expect(announcer).toHaveText(/^Incus, left\. 3 of 6\./);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("incus_left");
    await expect.poll(async () => (await state(page)).cursor).toBeNull();

    // Back to the group; Escape then Tab leaves the canvas at once.
    await page.goBack();
    await canvas.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).grp).toBe("axial.skull.ossicles"); // Escape left the cursor, not the group
    await page.keyboard.press("Tab");
    await expect(canvas).not.toBeFocused();

    // Tab past the last object leaves too.
    await canvas.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    await expect.poll(async () => (await state(page)).cursor).toBe("stapes_right");
    await page.keyboard.press("Tab");
    await expect(canvas).not.toBeFocused();
  });
});

test.describe("phone", () => {
  test("the search icon opens a full-screen sheet; choosing a result closes it", async ({ page }) => {
    await open(page, "", { width: 390, height: 844 });
    await page.getByTestId("sidebar-toggle").click();
    const sidebar = page.getByTestId("sidebar");
    const box = (await sidebar.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(389);
    expect(box.height).toBeGreaterThanOrEqual(843);
    await page.getByTestId("search-input").fill("collarbone");
    await page.getByTestId("search-results").getByRole("option").first().click();
    await expect(sidebar).toHaveCount(0);
    await expect.poll(async () => (await state(page)).sel).toMatch(/^clavicle_/);
  });
});
