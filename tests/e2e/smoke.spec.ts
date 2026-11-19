import { expect, test } from "@playwright/test";

const MISSING = ["tooth_18", "tooth_28", "tooth_38", "tooth_48"];

test("loads low then high LOD with all 234 meshes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(debug).toHaveAttribute("data-loaded", "low,high");
  await expect(debug).toHaveAttribute("data-lod", "high");
  await expect(debug).toHaveAttribute("data-objects", "234");
  expect((await debug.getAttribute("data-known-missing"))!.split(",").sort()).toEqual(MISSING);
  await expect(debug).toHaveAttribute("data-unexpected-missing", "");
  await expect(debug).toHaveAttribute("data-unknown", "");
  // 234 meshes + 4 known-missing = the 238 canonical IDs.
  await expect(debug).toContainText("234 meshes of 238 IDs");
  expect(errors).toEqual([]);
});

for (const lod of ["low", "high"] as const) {
  test(`?lod=${lod} loads only that file`, async ({ page }) => {
    await page.goto(`./?lod=${lod}`);
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-loaded", lod);
    await expect(debug).toHaveAttribute("data-objects", "234");
    const tris = Number(await debug.getAttribute("data-triangles"));
    const target = lod === "high" ? 500_000 : 150_000;
    expect(Math.abs(tris - target) / target).toBeLessThan(0.15);
  });
}

test("shows the WebGL 2 fallback", async ({ page }) => {
  await page.goto("./?nowebgl");
  await expect(page.getByRole("alert")).toContainText("WebGL 2");
});

test("attribution dialog shows the credits", async ({ page }) => {
  await page.goto("./?lod=low");
  await page.getByRole("button", { name: "Attribution" }).click();
  await expect(page.getByRole("dialog")).toContainText("Z-Anatomy");
  await expect(page.getByRole("dialog")).toContainText("BodyParts3D");
});
