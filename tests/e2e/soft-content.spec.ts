import { expect, test } from "@playwright/test";

// M8 session X (plan step 2): a soft-tissue structure's panel shows its written
// Latin name, "Part of …" and summary from the layer's content chunk, and
// keeps "Not written yet" for a structure without a file.

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

test("a written ligament shows its common name; an unwritten structure keeps the placeholder", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./?lod=low&sel=anterior_cruciate_ligament_left");
  const panel = page.getByTestId("info-panel");
  await expect(panel.locator(".latin")).toHaveText("Ligamentum cruciatum anterius", { timeout: 60_000 });
  await expect(panel.getByTestId("common-name")).toContainText("ACL");
  await page.goto("./?lod=low&sel=posterior_cruciate_ligament_left");
  await expect(panel).toHaveAttribute("data-id", "posterior_cruciate_ligament_left", { timeout: 60_000 });
  await expect(page.getByTestId("section-summary")).toContainText("Not written yet");
});
