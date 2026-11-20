import { expect, test } from "@playwright/test";

// M8 session X (plan step 2): a soft-tissue structure's panel shows its written
// Latin name, "Part of …" and summary from the layer's content chunk. Since
// session AC every structure has a file, so the "Not written yet" fallback is
// covered by the panel model's unit test (tests/sceneView.test.ts) instead.

test("a written part shows its Latin name, its muscle and its summary", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./?lod=low&sel=triceps_brachii_long_head_left");
  const panel = page.getByTestId("info-panel");
  await expect(panel).toHaveAttribute("data-id", "triceps_brachii_long_head_left", { timeout: 60_000 });
  await expect(panel.locator(".latin")).toHaveText("Caput longum musculi tricipitis brachii", { timeout: 30_000 });
  await expect(panel.getByTestId("part-of")).toHaveText(/Part of Triceps brachii/);
  await expect(page.getByTestId("section-summary")).toContainText("infraglenoid tubercle");
  await expect(panel).not.toContainText("Not written yet");
});

test("written ligaments show their Latin and common names (session AC: every structure is written)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./?lod=low&sel=anterior_cruciate_ligament_left");
  const panel = page.getByTestId("info-panel");
  await expect(panel.locator(".latin")).toHaveText("Ligamentum cruciatum anterius", { timeout: 60_000 });
  await expect(panel.getByTestId("common-name")).toContainText("ACL");
  await page.goto("./?lod=low&sel=posterior_cruciate_ligament_left");
  await expect(panel).toHaveAttribute("data-id", "posterior_cruciate_ligament_left", { timeout: 60_000 });
  await expect(panel.locator(".latin")).toHaveText("Ligamentum cruciatum posterius", { timeout: 30_000 });
  await expect(panel.getByTestId("common-name")).toContainText("PCL");
  await expect(page.getByTestId("section-summary")).toContainText("posterior intercondylar area");
  await expect(panel).not.toContainText("Not written yet");
});
