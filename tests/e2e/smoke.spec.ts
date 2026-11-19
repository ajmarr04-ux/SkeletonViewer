import { expect, test } from "@playwright/test";

const MISSING = ["tooth_18", "tooth_28", "tooth_38", "tooth_48"];

test("loads low then high LOD with all 234 bones in one batch", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lod=both&debug");
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(debug).toHaveAttribute("data-loaded", "low,high");
  await expect(debug).toHaveAttribute("data-lod", "high");
  await expect(debug).toHaveAttribute("data-objects", "234");
  await expect(debug).toHaveAttribute("data-instances", "234");
  expect((await debug.getAttribute("data-known-missing"))!.split(",").sort()).toEqual(MISSING);
  await expect(debug).toHaveAttribute("data-unexpected-missing", "");
  await expect(debug).toHaveAttribute("data-unknown", "");
  // 234 meshes + 4 known-missing = the 238 canonical IDs.
  await expect(debug).toContainText("234 meshes of 238 IDs");
  expect(errors).toEqual([]);
});

for (const lod of ["low", "high"] as const) {
  test(`?lod=${lod}: one batch, under 20 draw calls, no bone moved`, async ({ page }) => {
    await page.goto(`./?lod=${lod}&debug`);
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-loaded", lod);
    await expect(debug).toHaveAttribute("data-instances", "234");
    const tris = Number(await debug.getAttribute("data-triangles"));
    const target = lod === "high" ? 500_000 : 150_000;
    expect(Math.abs(tris - target) / target).toBeLessThan(0.15);
    // Every batched bone's world bounds match the Blender manifest within 1 mm.
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    await expect(debug).toHaveAttribute("data-bounds-checked", "234");
    // Draw calls are sampled twice a second; wait for a reading.
    await expect.poll(async () => Number(await debug.getAttribute("data-draw-calls")), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(Number(await debug.getAttribute("data-draw-calls"))).toBeLessThan(20);
  });
}

test("auto LOD: a 390 px phone gets low only", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("./?debug");
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(debug).toHaveAttribute("data-plan-source", "auto");
  await expect(debug).toHaveAttribute("data-plan", "low");
  await page.close();
});

test("a stored High setting streams in high after low", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("skeleton-viewer:lod", "high"));
  await page.goto("./?debug");
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(debug).toHaveAttribute("data-plan-source", "setting");
  await expect(debug).toHaveAttribute("data-loaded", "low,high");
});

test("shows the WebGL 2 fallback", async ({ page }) => {
  await page.goto("./?nowebgl");
  await expect(page.getByRole("alert")).toContainText("WebGL 2");
});

test("attribution dialog shows the credits", async ({ page }) => {
  await page.goto("./?lod=low");
  await page.getByRole("link", { name: "Attribution" }).click();
  await expect(page.getByRole("dialog")).toContainText("Z-Anatomy");
  await expect(page.getByRole("dialog")).toContainText("BodyParts3D");
});
