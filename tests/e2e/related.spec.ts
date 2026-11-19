import { expect, test, type Page } from "@playwright/test";

// Milestone 4 session J: tiers 1 and 2 (spec §6 Isolation, the femur worked
// example, teeth), history, the side toggle at a tier, and framing the set.

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
const isolation = async (page: Page) => {
  const s = await state(page);
  return `${s.sel ?? "-"}@${s.tier}`;
};

test.describe("related isolation", () => {
  // The spec's smoke test (§11, Phase 5 exit criterion), step for step:
  // load → click femur → Show related → Expand region → Back ×3 → full skeleton.
  test("femur: Show related → Expand region → Back ×3 → full skeleton", async ({ page }) => {
    const errors = await open(page);
    const debug = page.getByTestId("debug");
    const panel = page.getByTestId("info-panel");
    const announcer = page.getByTestId("announcer");
    const femur = await bone(page, "femur_left");
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect(debug).toHaveAttribute("data-solid", "1", { timeout: 10_000 });

    await panel.getByTestId("show-related").click();
    await expect.poll(() => isolation(page)).toBe("femur_left@1");
    expect(param(page, "tier")).toBe("1");
    await expect(debug).toHaveAttribute("data-solid", "4"); // + hip bone, patella, tibia
    await expect(debug).toHaveAttribute("data-ghosts", "230");
    await expect(debug).toHaveAttribute("data-focus", "femur_left");
    await expect(debug).toHaveAttribute("data-outline-selected", "femur_left");
    await expect(announcer).toHaveText("Femur, left: related bones shown. Hip bone, patella, tibia.");
    await expect(page.getByTestId("breadcrumb")).toHaveText(/Femur\s*›\s*Related$/);
    await expect(panel.getByTestId("show-related")).toBeDisabled();
    await expect(page.getByTestId("tool-region")).toBeVisible();

    // The spec's wording (§11 Phase 5): the panel's "Expand region" button. The
    // toolbar's "Region" button does the same (keyboard.spec.ts and a11y.spec.ts press it).
    await panel.getByRole("button", { name: "Expand region" }).click();
    await expect.poll(() => isolation(page)).toBe("femur_left@2");
    await expect(debug).toHaveAttribute("data-solid", "8"); // + sacrum, coccyx, hip bone (right), fibula
    await expect(announcer).toHaveText("Femur, left: region shown, 8 bones.");
    await expect(page.getByTestId("breadcrumb")).toHaveText(/Femur\s*›\s*Region$/);
    await expect(panel.getByTestId("expand-region")).toBeDisabled();
    // Draw calls stay low, and nothing moved.
    await page.waitForTimeout(1200);
    expect(Number(await debug.getAttribute("data-draw-calls"))).toBeLessThan(20);
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");

    await page.goBack();
    await expect.poll(() => isolation(page)).toBe("femur_left@1");
    await expect(debug).toHaveAttribute("data-solid", "4");
    await page.goBack();
    await expect.poll(() => isolation(page)).toBe("femur_left@0");
    await expect(announcer).toHaveText("Femur, left, isolated.");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await page.goBack();
    await expect.poll(() => isolation(page)).toBe("-@0");
    await expect(debug).toHaveAttribute("data-solid", "234");
    await expect(announcer).toHaveText("Full skeleton");
    expect(errors).toEqual([]);
  });

  test("a tier-2 link steps back one level at a time without leaving the site", async ({ page }) => {
    await open(page, "&sel=femur_left&tier=2");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "8");
    // Opening without cam= frames the whole set: every solid bone's centre is on screen.
    for (const id of ["sacrum", "fibula_left", "hip_bone_right", "patella_left"]) {
      const b = await bone(page, id);
      expect(b.client.x, id).toBeGreaterThan(0);
      expect(b.client.y, id).toBeGreaterThan(0);
      expect(b.client.y, id).toBeLessThan(720);
    }
    const canvas = page.locator("canvas");
    await canvas.focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => isolation(page)).toBe("femur_left@1");
    await page.keyboard.press("Escape");
    await expect.poll(() => isolation(page)).toBe("femur_left@0");
    await page.keyboard.press("Escape");
    await expect.poll(() => isolation(page)).toBe("-@0");
    expect(new URL(page.url()).pathname).not.toBe("about:blank");
    expect(param(page, "sel")).toBeNull();
  });

  test("clicking a related bone makes it the new focus; the side toggle keeps the tier", async ({ page }) => {
    await open(page, "&sel=femur_left&tier=1");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "4");
    // Click the tibia (a solid, related bone) at a point that picks it.
    const tibia = await bone(page, "tibia_left");
    const hit = await page.evaluate(([x, y]) => window.__viewer!.pick(x!, y!, false), [tibia.client.x, tibia.client.y]);
    expect(hit).toBe("tibia_left");
    await page.mouse.click(tibia.client.x, tibia.client.y);
    await expect.poll(() => isolation(page)).toBe("tibia_left@0");
    await expect(debug).toHaveAttribute("data-focus", "tibia_left");
    await expect(debug).toHaveAttribute("data-solid", "1");
    // A new history entry: Back returns to the femur at tier 1.
    await page.goBack();
    await expect.poll(() => isolation(page)).toBe("femur_left@1");

    // Side toggle at tier 2: femur right at tier 2, entry replaced.
    await page.getByTestId("expand-region").click();
    await expect.poll(() => isolation(page)).toBe("femur_left@2");
    const len = await page.evaluate(() => history.length);
    await page.getByTestId("side-right").click();
    await expect.poll(() => isolation(page)).toBe("femur_right@2");
    expect(param(page, "tier")).toBe("2");
    await expect(debug).toHaveAttribute("data-solid", "8");
    expect(await page.evaluate(() => history.length)).toBe(len);
  });

  test("F frames the solid set at tier 1", async ({ page }) => {
    await open(page, "&sel=femur_left&cam=0.6,1.6,3.2,0,1,0");
    await page.getByTestId("show-related").click();
    await expect.poll(() => isolation(page)).toBe("femur_left@1");
    await page.locator("canvas").focus();
    await page.keyboard.press("f");
    await page.waitForTimeout(900);
    // The hip bone and the tibia (the set's ends) are both in view.
    for (const id of ["hip_bone_left", "tibia_left"]) {
      const b = await bone(page, id);
      expect(b.client.y, id).toBeGreaterThan(0);
      expect(b.client.y, id).toBeLessThan(720);
    }
  });

  test("teeth: tier 1 is the alveolar bone and the neighbours; tier 2 the skull and both arches; a wisdom tooth works", async ({ page }) => {
    await open(page, "&sel=tooth_11&tier=1");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "4"); // tooth 11, maxilla (right), teeth 12 and 21
    await expect(debug).toHaveAttribute("data-focus", "tooth_11");
    await page.getByTestId("expand-region").click();
    await expect.poll(() => isolation(page)).toBe("tooth_11@2");
    // Cranial (8) + facial (14) bones + 28 teeth with a mesh.
    await expect(debug).toHaveAttribute("data-solid", "50");

    await page.goto("./?lod=low&debug&sel=tooth_18&tier=1");
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-solid", "2"); // maxilla (right) and tooth 17; tooth 18 has no mesh
    await expect(debug).toHaveAttribute("data-focus", "");
    await expect(page.getByTestId("no-model-note")).toBeVisible();
  });
});
