import { expect, test, type Page } from "@playwright/test";

// Milestone 3 session H: highlight and outline, tier-0 isolation (ghost and
// hide), and the hover tooltip.

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const bone = async (page: Page, id: string) => (await page.evaluate((i) => window.__viewer!.bone(i), id))!;
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);

test.describe("isolation", () => {
  test("clicking the femur isolates it: accent, outline, ghosts, quick highlight, nothing moved", async ({ page }) => {
    const errors = await open(page);
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "234");
    await expect(debug).toHaveAttribute("data-ghosts", "0");
    const femur = await bone(page, "femur_left");
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("femur_left");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await expect(debug).toHaveAttribute("data-ghosts", "233");
    await expect(debug).toHaveAttribute("data-focus", "femur_left");
    await expect(debug).toHaveAttribute("data-outline-selected", "femur_left");
    // Click → highlight is measured (spec §8). SwiftShader is slow, so the
    // bound here is loose; real numbers come from devices (plan step 9).
    await expect(debug).not.toHaveAttribute("data-highlight-ms", "");
    const ms = Number(await debug.getAttribute("data-highlight-ms"));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
    // Solid + ghosts + outline: well under budget.
    await page.waitForTimeout(1200);
    expect(Number(await debug.getAttribute("data-draw-calls"))).toBeLessThan(20);
    // Both batches still match the manifest: isolation moved nothing.
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    await expect(debug).toHaveAttribute("data-bounds-checked", "234");
    await expect(debug).toHaveAttribute("data-bounds-ghost-checked", "234");
    // A reload restores the isolation from the URL.
    await page.reload();
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-focus", "femur_left");
    await expect(debug).toHaveAttribute("data-solid", "1");
    expect(errors).toEqual([]);
  });

  test("ghost / hide toggle and the opacity slider", async ({ page }) => {
    await open(page);
    const debug = page.getByTestId("debug");
    // The controls only exist while something is isolated.
    await expect(page.getByTestId("ghost-toggle")).toHaveCount(0);
    await page.evaluate(() => window.__viewer!.select("femur_left"));
    const toggle = page.getByTestId("ghost-toggle");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(debug).toHaveAttribute("data-ghosts", "0");
    expect(param(page, "ghost")).toBe("0");
    await expect(page.getByRole("button", { name: "Ghost opacity" })).toHaveCount(0);
    await toggle.click();
    await expect(debug).toHaveAttribute("data-ghosts", "233");
    expect(param(page, "ghost")).toBeNull();
    // Opacity: the slider sets the ghost material and is kept in localStorage.
    await page.getByRole("button", { name: "Ghost opacity" }).click();
    const slider = page.getByTestId("ghost-opacity");
    await slider.fill("0.4");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("skeleton-viewer:ghost-opacity"))).toBe("0.4");
    await page.reload();
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await page.getByRole("button", { name: "Ghost opacity" }).click();
    await expect(page.getByTestId("ghost-opacity")).toHaveValue("0.4");
  });

  test("opening a link in hide mode hides the rest; Back returns the full skeleton", async ({ page }) => {
    await open(page, "&sel=humerus_right&ghost=0");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await expect(debug).toHaveAttribute("data-ghosts", "0");
    await page.locator("canvas").focus();
    await page.keyboard.press("Escape");
    await expect(debug).toHaveAttribute("data-solid", "234");
    await expect(debug).toHaveAttribute("data-focus", "");
    await expect(debug).toHaveAttribute("data-outline-selected", "");
  });

  test("a wisdom tooth in the URL isolates nothing", async ({ page }) => {
    await open(page, "&sel=tooth_38");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "234");
    await expect(debug).toHaveAttribute("data-ghosts", "0");
    await expect(page.getByTestId("ghost-toggle")).toHaveCount(0);
  });

  test("an LOD swap keeps the isolation", async ({ page }) => {
    await page.goto("./?lod=both&debug&sel=femur_left");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 90_000 });
    await expect(debug).toHaveAttribute("data-lod", "high");
    await expect(debug).toHaveAttribute("data-focus", "femur_left");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await expect(debug).toHaveAttribute("data-ghosts", "233");
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
  });
});

test.describe("hover", () => {
  test("outline at once, name after 150 ms; none for the selected bone", async ({ page }) => {
    await open(page);
    const debug = page.getByTestId("debug");
    const femur = await bone(page, "femur_left");
    await page.mouse.move(femur.client.x, femur.client.y);
    await page.mouse.move(femur.client.x + 1, femur.client.y);
    await expect(debug).toHaveAttribute("data-outline-hover", "femur_left", { timeout: 10_000 });
    const tip = page.getByTestId("tooltip");
    await expect(tip).toHaveText("Femur (left)");
    // Wheel hides it.
    await page.mouse.wheel(0, 40);
    await expect(tip).toHaveCount(0);
    // Off the skeleton: no outline, no name.
    const box = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width - 20, box.y + box.height * 0.45);
    await expect(debug).toHaveAttribute("data-outline-hover", "", { timeout: 10_000 });
    await expect(tip).toHaveCount(0);
    // Selected: the hover outline and the name stay off for it.
    await page.evaluate(() => window.__viewer!.select("femur_left"));
    await page.waitForTimeout(800); // damping settles (the select doesn't move the picture anyway)
    const f2 = await bone(page, "femur_left");
    await page.mouse.move(f2.client.x, f2.client.y);
    await page.mouse.move(f2.client.x + 1, f2.client.y);
    await expect.poll(async () => (await state(page)).hovered, { timeout: 10_000 }).toBe("femur_left");
    await page.waitForTimeout(400);
    await expect(debug).toHaveAttribute("data-outline-hover", "");
    await expect(tip).toHaveCount(0);
  });
});
