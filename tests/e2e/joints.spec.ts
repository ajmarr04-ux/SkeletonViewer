import { expect, test, type Page } from "@playwright/test";

// Milestone 4 session L: joint highlighting from the panel (plan step 7) and
// the Explode slider (plan step 8).

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const boneNow = async (page: Page, id: string) => (await page.evaluate((i) => window.__viewer!.boneNow(i), id))!;
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test.describe("joint highlighting", () => {
  test("hovering an articulation shows and outlines the partner; leaving puts it back", async ({ page }) => {
    const errors = await open(page, "&sel=femur_left");
    const debug = page.getByTestId("debug");
    const panel = page.getByTestId("info-panel");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await expect(debug).toHaveAttribute("data-ghosts", "233");

    const hip = panel.getByTestId("section-articulations").getByTestId("link-hip_bone_left");
    await hip.hover();
    await expect(debug).toHaveAttribute("data-joint", "femur_left,hip_bone_left");
    await expect(debug).toHaveAttribute("data-solid", "2"); // the ghosted hip bone is drawn solid for the hover
    await expect(debug).toHaveAttribute("data-outline-hover", "hip_bone_left");
    await expect(debug).toHaveAttribute("data-outline-selected", "femur_left");
    await expect(page.getByTestId("announcer")).toHaveText("Hip joint: femur and hip bone highlighted.");
    await page.waitForTimeout(500);
    expect(Number(await debug.getAttribute("data-draw-calls"))).toBeLessThan(20);

    await page.mouse.move(5, 300);
    await expect(debug).toHaveAttribute("data-joint", "");
    await expect(debug).toHaveAttribute("data-solid", "1");
    await expect(debug).toHaveAttribute("data-outline-hover", "");
    // Nothing moved, and the selection didn't change.
    expect((await state(page)).sel).toBe("femur_left");
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    expect(errors).toEqual([]);
  });

  test("keyboard focus on an articulation highlights it; a click still selects the partner", async ({ page }) => {
    await open(page, "&sel=femur_left");
    const debug = page.getByTestId("debug");
    const panel = page.getByTestId("info-panel");
    const links = panel.getByTestId("section-articulations").locator("button[data-joint]");
    await expect(links).toHaveCount(3);
    // Tab to the first articulation from the control just before the section.
    await panel.getByTestId("side-right").focus();
    let focused = "";
    for (let i = 0; i < 20 && !focused.startsWith("link-"); i++) {
      await page.keyboard.press("Tab");
      focused = (await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))) ?? "";
    }
    const partner = focused.replace("link-", "");
    await expect(debug).toHaveAttribute("data-joint", `femur_left,${partner}`);
    await expect(debug).toHaveAttribute("data-outline-hover", partner);

    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe(partner);
    await expect(debug).toHaveAttribute("data-joint", "");
    await expect(debug).toHaveAttribute("data-focus", partner);
  });

  test("phone: press-and-hold highlights, letting go clears it without selecting; a tap selects", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await open(page, "&sel=patella_left");
    const debug = page.getByTestId("debug");
    const link = page.getByTestId("info-panel").getByTestId("link-femur_left");
    await page.getByTestId("sheet-handle").click(); // peek → half
    await page.getByTestId("sheet-handle").click(); // half → full
    await expect(page.getByTestId("info-panel")).toHaveAttribute("data-snap", "full");
    await link.scrollIntoViewIfNeeded();
    const fire = (type: string) =>
      link.dispatchEvent(type, { pointerType: "touch", isPrimary: true, pointerId: 7, bubbles: true });
    await fire("pointerdown");
    await expect(debug).toHaveAttribute("data-joint", "patella_left,femur_left");
    await expect(page.getByTestId("announcer")).toHaveText("Patellofemoral joint: patella and femur highlighted.");
    await fire("pointerup");
    await link.dispatchEvent("click");
    await expect(debug).toHaveAttribute("data-joint", "");
    expect((await state(page)).sel).toBe("patella_left"); // the hold didn't select

    await link.tap();
    await expect.poll(async () => (await state(page)).sel).toBe("femur_left");
    await context.close();
  });
});

test.describe("explode", () => {
  test("holding the slider moves the tier-1 bones apart; letting go restores them exactly", async ({ page }) => {
    const errors = await open(page, "&sel=femur_left&tier=2");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-solid", "8");
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    const ids = ["femur_left", "hip_bone_left", "patella_left", "tibia_left", "fibula_left", "sacrum"];
    const rest = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await boneNow(page, id)] as const)));

    await page.getByRole("button", { name: "Explode" }).click();
    const slider = page.getByTestId("explode");
    await expect(slider).toBeVisible();
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
    await expect.poll(async () => Number(await debug.getAttribute("data-explode"))).toBeGreaterThan(0.9);

    // Tier-1 bones moved away from the femur; the focus and tier-2-only bones didn't.
    const femur = rest.femur_left!;
    for (const id of ["hip_bone_left", "patella_left", "tibia_left"]) {
      const now = await boneNow(page, id);
      expect(dist(now, rest[id]!), id).toBeGreaterThan(0.005);
      expect(dist(now, femur), id).toBeGreaterThan(dist(rest[id]!, femur));
    }
    for (const id of ["femur_left", "fibula_left", "sacrum"]) expect(dist(await boneNow(page, id), rest[id]!), id).toBe(0);
    await page.waitForTimeout(300);
    expect(Number(await debug.getAttribute("data-draw-calls"))).toBeLessThan(20);

    // Picking is off while exploded: a click on the canvas changes nothing.
    // (The pointer is held on the slider, so test the release first, then the state.)
    await page.mouse.up();
    await expect(debug).toHaveAttribute("data-explode", "0", { timeout: 2_000 });
    for (const id of ids) expect(await boneNow(page, id), id).toEqual(rest[id]);
    // The ?debug bounds check runs again after the release and passes.
    await expect(debug).toHaveAttribute("data-bounds-ok", "true", { timeout: 10_000 });
    expect((await state(page)).tier).toBe(2);
    expect(errors).toEqual([]);
  });

  test("keyboard: arrows move it, key release eases it back; not offered at tier 0", async ({ page }) => {
    await open(page, "&sel=femur_left&tier=1");
    const debug = page.getByTestId("debug");
    await page.getByRole("button", { name: "Explode" }).click();
    const slider = page.getByTestId("explode");
    await slider.focus();
    await page.keyboard.down("End");
    await expect(debug).toHaveAttribute("data-explode", "1");
    await page.keyboard.up("End");
    await expect(debug).toHaveAttribute("data-explode", "0", { timeout: 2_000 });
    await page.keyboard.press("Escape"); // close the popover
    await page.evaluate(() => window.__viewer!.back());
    await expect.poll(async () => (await state(page)).tier).toBe(0);
    await expect(page.getByRole("button", { name: "Explode" })).toHaveCount(0);
  });

  test("picking is off while exploded: a click on empty space doesn't step back", async ({ page }) => {
    await open(page, "&sel=femur_left&tier=1");
    const debug = page.getByTestId("debug");
    await page.getByRole("button", { name: "Explode" }).click();
    await page.getByTestId("explode").focus();
    const femur = (await page.evaluate(() => window.__viewer!.bone("femur_left")))!.client;
    expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), femur)).toBe("femur_left");
    await page.keyboard.down("End"); // held: stays exploded
    await expect(debug).toHaveAttribute("data-explode", "1");
    expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), femur)).toBeNull();
    // Empty space normally steps back a tier (spec §6); while exploded it does nothing.
    await page.mouse.click(5, 300);
    await expect(debug).toHaveAttribute("data-explode", "0", { timeout: 2_000 });
    await page.keyboard.up("End");
    expect((await state(page)).tier).toBe(1);
  });
});
