import { expect, test, type Page } from "@playwright/test";

// M13 BP: the budget governor (plan decision 10, SPEC-platform.md §6.5) on
// the real layers, with `?debug&budget=` lowering the device budget.

const ALL_ON = "layers=b:on,c:on,l:on,m:on";

/** Headless Chromium draws with SwiftShader, which `chooseLod` plans low; report a capable GPU so Auto plans high. */
async function capableGpu(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const get = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (this: WebGL2RenderingContext, p: number) {
      return p === this.RENDERER ? "Test GPU" : get.call(this, p);
    };
  });
}

const budget = (page: Page) => page.getByTestId("debug-budget");
const layerRow = (page: Page, layer: string) => page.getByTestId("layers-report").locator(`[data-layer=${layer}]`);

function errorsOf(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("parity: all four layers on, at the real budget, cap nothing and prompt nothing", async ({ page }) => {
  const errors = errorsOf(page);
  await capableGpu(page);
  await page.goto(`./?debug&${ALL_ON}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-plan", "low,high");
  await expect(budget(page)).toHaveAttribute("data-budget", "1500000");
  await expect(budget(page)).toHaveAttribute("data-drawn", "1499634");
  await expect(budget(page)).toHaveAttribute("data-caps", "");
  await expect(budget(page)).toHaveAttribute("data-over", "false");
  await expect(page.getByTestId("budget-prompt")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("step 1: a 1M budget on Auto caps the muscles to low; the bones still reach high", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = errorsOf(page);
  const files: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/(muscles|bones|skeleton)-(low|high)[.-]/.exec(r.url());
    if (m) files.push(`${m[1]}-${m[2]}`);
  });
  await capableGpu(page);
  await page.goto(`./?debug&budget=1000000&${ALL_ON}`);
  await expect(budget(page)).toHaveAttribute("data-caps", "muscles");
  await expect(budget(page)).toHaveAttribute("data-drawn", "929684");
  await expect(budget(page)).toHaveAttribute("data-over", "false");
  await expect(page.getByTestId("debug")).toHaveAttribute("data-lod", "high", { timeout: 120_000 });
  for (const l of ["ligaments", "cartilage"]) await expect(layerRow(page, l)).toHaveAttribute("data-lod", "high", { timeout: 120_000 });
  await expect(layerRow(page, "muscles")).toHaveAttribute("data-lod", "low");
  await expect(layerRow(page, "muscles")).toHaveAttribute("data-bounds-ok", "true");
  expect(files).not.toContain("muscles-high");
  await expect(page.getByTestId("budget-prompt")).toHaveCount(0);
  // A body region fits: the cap is lifted and the muscles load high.
  await page.goto(`./?debug&budget=1000000&${ALL_ON}&reg=forearm_left`);
  await expect(budget(page)).toHaveAttribute("data-caps", "");
  await expect(layerRow(page, "muscles")).toHaveAttribute("data-lod", "high", { timeout: 120_000 });
  expect(errors).toEqual([]);
});

test("step 2: still over → the prompt, announced; its button opens the picker; Not now dismisses it for this view", async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto(`./?debug&budget=300000&${ALL_ON}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-plan", "low");
  await expect(budget(page)).toHaveAttribute("data-over", "true");
  const prompt = page.getByTestId("budget-prompt");
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText("This view is heavy for this device. Focus on a body region?");
  await expect(page.getByTestId("announcer")).toContainText("This view is heavy for this device.");
  // Everything is still drawn (the view is kept).
  await expect(layerRow(page, "muscles")).toHaveAttribute("data-lod", "low", { timeout: 120_000 });
  await prompt.getByRole("button", { name: "Choose a body region" }).click();
  await expect(page.getByTestId("region-picker")).toBeVisible();
  await expect(prompt).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("region-picker")).toBeHidden();
  await expect(prompt).toHaveCount(0);
  // A new view, still over: shown again; Not now hides it.
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByTestId("layer-cartilage-off").check();
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Not now" }).click();
  await expect(prompt).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe("phone start", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("over the budget with no region: the picker opens first, held layers aren't drawn, Whole body draws them and prompts", async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto(`./?debug&budget=300000&${ALL_ON}`);
    const picker = page.getByTestId("region-picker");
    // The picker is a lazy chunk: allow for it under load (BR full run).
    await expect(picker).toBeVisible({ timeout: 20_000 });
    await expect(picker.getByTestId("region-whole")).toBeVisible();
    await expect(budget(page)).toHaveAttribute("data-held", "muscles");
    await expect(page.getByTestId("budget-prompt")).toHaveCount(0);
    // The muscles' file still loads, but nothing of it is drawn.
    await expect(layerRow(page, "muscles")).toHaveAttribute("data-lod", "low", { timeout: 120_000 });
    await expect(page.getByTestId("debug")).toHaveAttribute("data-layer-counts", /muscles:0\/0/);
    await picker.getByTestId("region-whole").tap();
    await expect(picker).toBeHidden();
    await expect(budget(page)).toHaveAttribute("data-held", "");
    await expect(page.getByTestId("debug")).not.toHaveAttribute("data-layer-counts", /muscles:0\/0/);
    await expect(page.getByTestId("budget-prompt")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("choosing a region instead draws the held layers inside it, with no prompt", async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto(`./?debug&budget=300000&${ALL_ON}`);
    const picker = page.getByTestId("region-picker");
    // The picker is a lazy chunk: allow for it under load (BR full run).
    await expect(picker).toBeVisible({ timeout: 20_000 });
    await picker.getByRole("treeitem", { name: /^Head\b/ }).first().tap();
    await expect.poll(() => new URL(page.url()).searchParams.get("reg")).toBe("head");
    await expect(budget(page)).toHaveAttribute("data-held", "");
    await expect(budget(page)).toHaveAttribute("data-over", "false");
    await expect(page.getByTestId("budget-prompt")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("at the real phone budget, all four layers fit: no picker", async ({ page }) => {
    await page.goto(`./?debug&${ALL_ON}`);
    await expect(budget(page)).toHaveAttribute("data-budget", "450000");
    await expect(budget(page)).toHaveAttribute("data-over", "false");
    await expect(budget(page)).toHaveAttribute("data-held", "");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("region-picker")).toHaveCount(0);
  });

  test("an explicit LOD is the user's choice: ?lod=both, bones only, no picker and the bones drawn (BR)", async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto("./?debug&lod=both");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-load-high", /\d/, { timeout: 120_000 });
    await expect(budget(page)).toHaveAttribute("data-held", "");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("region-picker")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
