import { expect, test, type Page } from "@playwright/test";
import manifest from "../../assets/build/manifest.json" with { type: "json" };

// Milestone 3 session G: the fixed orbit pivot (backlog 1), selection in the
// store and the URL, Back / Esc / empty click, drag versus click, hit proxies
// for tiny objects and hover.

type Vec3 = [number, number, number];
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]!));

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}

const camera = (page: Page) => page.evaluate(() => window.__viewer!.camera());
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const project = (page: Page, p: Vec3) => page.evaluate((q) => window.__viewer!.project(q), p);
const bone = async (page: Page, id: string) => (await page.evaluate((i) => window.__viewer!.bone(i), id))!;
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);
/** A point on the canvas with no bone under it (left edge: the debug overlay covers the top-left, the info panel the right). */
async function emptySpot(page: Page) {
  const box = (await page.locator("canvas").boundingBox())!;
  return { x: box.x + 20, y: box.y + box.height * 0.7 };
}
/** Wait for the damping to settle. */
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms);

const centreOf = (id: string): Vec3 => {
  const o = (manifest.objects as Record<string, { lods: { low: { bboxMin: number[]; bboxMax: number[] } } }>)[id]!.lods.low;
  return [0, 1, 2].map((i) => (o.bboxMin[i]! + o.bboxMax[i]!) / 2) as Vec3;
};

test.describe("fixed orbit pivot", () => {
  test("pan, then orbit: the pivot stays put and keeps its place on screen", async ({ page }) => {
    await open(page);
    const home = await camera(page);
    const box = (await page.locator("canvas").boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // Right-drag pans.
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x - 150, y - 60, { steps: 8 });
    await page.mouse.up({ button: "right" });
    await settle(page);
    const panned = await camera(page);
    expect(dist(panned.target, home.target)).toBeLessThan(1e-9);
    const pivotOnScreen = await project(page, home.target);
    // Orbit with a left-drag that starts on empty space.
    const e = await emptySpot(page);
    await page.mouse.move(e.x, e.y);
    await page.mouse.down();
    await page.mouse.move(e.x - 200, e.y + 60, { steps: 10 });
    await page.mouse.up();
    await settle(page, 1000);
    const orbited = await camera(page);
    expect(dist(orbited.target, home.target)).toBeLessThan(1e-9);
    expect(dist(orbited.position, panned.position)).toBeGreaterThan(0.1);
    const after = await project(page, home.target);
    expect(dist([after.x, after.y], [pivotOnScreen.x, pivotOnScreen.y])).toBeLessThan(1.5);
    // The drag started on empty space and moved, so nothing was selected.
    expect((await state(page)).sel).toBeNull();
  });

  test("zoom toward the feet, then orbit: the pivot is still the skeleton's centre", async ({ page }) => {
    await open(page);
    const home = await camera(page);
    const foot = await bone(page, "calcaneus_left");
    await page.mouse.move(foot.client.x, foot.client.y);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -200);
    await settle(page, 1000);
    const zoomed = await camera(page);
    expect(dist(zoomed.target, home.target)).toBeLessThan(1e-9);
    expect(Math.hypot(...zoomed.offset!)).toBeGreaterThan(0.2);
    // The heel stayed under the cursor.
    const heel = await bone(page, "calcaneus_left");
    expect(dist([heel.client.x, heel.client.y], [foot.client.x, foot.client.y])).toBeLessThan(25);
    await page.locator("canvas").focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await settle(page);
    expect(dist((await camera(page)).target, home.target)).toBeLessThan(1e-9);
    // The URL carries the offset, and a reload restores it.
    await expect.poll(() => param(page, "cam")?.split(",").length, { timeout: 10_000 }).toBe(8);
    const before = await camera(page);
    await page.reload();
    await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await page.waitForFunction(() => window.__viewer !== undefined);
    await settle(page, 300);
    const restored = await camera(page);
    expect(dist(restored.target, before.target)).toBeLessThan(2e-4);
    expect(dist(restored.offset!, before.offset!)).toBeLessThan(2e-4);
  });

  test("a Milestone 2 link (six cam values) still opens the same view", async ({ page }) => {
    await open(page, "&cam=0.5,1.2,2.5,0,0.9,0");
    const cam = await camera(page);
    expect(dist(cam.position, [0.5, 1.2, 2.5])).toBeLessThan(1e-6);
    expect(dist(cam.target, [0, 0.9, 0])).toBeLessThan(1e-6);
    expect(cam.offset ?? [0, 0]).toEqual([0, 0]);
  });

  test("Home puts the pivot back on the skeleton's centre with no offset", async ({ page }) => {
    await open(page);
    const home = await camera(page);
    const femur = await bone(page, "femur_left");
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect.poll(async () => dist((await camera(page)).target, centreOf("femur_left")), { timeout: 10_000 }).toBeLessThan(1e-4);
    await page.locator("canvas").focus();
    await page.keyboard.press("h");
    await expect.poll(async () => dist((await camera(page)).target, home.target), { timeout: 10_000 }).toBeLessThan(1e-4);
    await expect.poll(async () => Math.hypot(...((await camera(page)).offset ?? [0, 0])), { timeout: 10_000 }).toBeLessThan(1e-6);
  });
});

test.describe("selection", () => {
  test("clicking the femur selects it and moves the pivot to it without moving the picture", async ({ page }) => {
    const errors = await open(page);
    const eye = await page.evaluate(() => window.__viewer!.eye());
    const femur = await bone(page, "femur_left");
    const skull = await bone(page, "frontal_bone");
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("femur_left");
    expect((await state(page)).sel).toBe("femur_left");
    await expect.poll(async () => dist((await camera(page)).target, centreOf("femur_left")), { timeout: 10_000 }).toBeLessThan(1e-4);
    await settle(page);
    // Nothing on screen moved.
    expect(dist(await page.evaluate(() => window.__viewer!.eye()), eye)).toBeLessThan(1e-6);
    const skullAfter = await bone(page, "frontal_bone");
    expect(dist([skullAfter.client.x, skullAfter.client.y], [skull.client.x, skull.client.y])).toBeLessThan(0.5);
    // The URL holds the new pivot, and a reload restores selection and view.
    await expect.poll(() => param(page, "cam"), { timeout: 10_000 }).not.toBeNull();
    await page.reload();
    await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await page.waitForFunction(() => window.__viewer !== undefined);
    expect((await state(page)).sel).toBe("femur_left");
    expect(dist((await camera(page)).target, centreOf("femur_left"))).toBeLessThan(2e-4);
    expect(errors).toEqual([]);
  });

  test("a drag that starts on the femur orbits and doesn't select", async ({ page }) => {
    await open(page);
    const femur = await bone(page, "femur_left");
    const before = await camera(page);
    await page.mouse.move(femur.client.x, femur.client.y);
    await page.mouse.down();
    await page.mouse.move(femur.client.x + 40, femur.client.y, { steps: 6 });
    await page.mouse.up();
    await settle(page);
    expect((await state(page)).sel).toBeNull();
    expect(param(page, "sel")).toBeNull();
    expect(dist((await camera(page)).position, before.position)).toBeGreaterThan(0.01);
  });

  test("switching focus replaces the entry; a click on a ghost, Back, Esc and an empty click step back", async ({ page }) => {
    await open(page);
    const femur = await bone(page, "femur_left");
    const tibia = await bone(page, "tibia_left");
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("femur_left");
    // With the femur isolated the tibia is a ghost: clicking it counts as empty space (plan step 3).
    await page.mouse.click(tibia.client.x, tibia.client.y);
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("femur_left");
    // A switch of focus at tier 0 (later: search, the side toggle) replaces the entry.
    await page.evaluate(() => window.__viewer!.select("tibia_left"));
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("tibia_left");
    const cam = await camera(page);
    // Switching focus replaced the entry, so one Back returns to the full skeleton.
    await page.goBack();
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    expect(param(page, "sel")).toBeNull();
    // Back moves only the isolation, never the camera.
    await settle(page);
    expect(dist((await camera(page)).position, cam.position)).toBeLessThan(1e-6);
    // Forward brings the selection back.
    await page.goForward();
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBe("tibia_left");
    // Esc steps back (through the history, as the app pushed this entry).
    await page.locator("canvas").focus();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    // Click on the femur, then on empty space.
    const f2 = await bone(page, "femur_left");
    await page.mouse.click(f2.client.x, f2.client.y);
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBe("femur_left");
    const e = await emptySpot(page);
    await page.mouse.click(e.x, e.y);
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    expect(param(page, "sel")).toBeNull();
  });

  test("Back from a selection the page was opened with stays on the site", async ({ page }) => {
    await open(page, "&sel=femur_left");
    expect((await state(page)).sel).toBe("femur_left");
    await page.locator("canvas").focus();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    expect(param(page, "sel")).toBeNull();
    expect(page.url()).toContain("localhost:4173");
  });

  test("opening with sel and no cam frames the selection beside the panel; F frames it again", async ({ page }) => {
    await open(page, "&sel=femur_left");
    const want = centreOf("femur_left");
    expect(dist((await camera(page)).target, want)).toBeLessThan(1e-4);
    const c = await camera(page);
    expect(dist(c.position, c.target)).toBeLessThan(1.5); // closer than the whole-skeleton view (~3 m)
    // The info panel covers the right: the femur sits in the middle of the free area (offset to the right).
    const framedOffset = c.offset ?? [0, 0];
    expect(framedOffset[0]).toBeGreaterThan(0);
    const panel = (await page.getByTestId("info-panel").boundingBox())!;
    const onScreen = (await bone(page, "femur_left")).client;
    expect(Math.abs(onScreen.x - panel.x / 2)).toBeLessThan(20);
    // Pan away, then F brings the femur back to the same place.
    await page.locator("canvas").focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("Shift+ArrowLeft");
    await settle(page);
    expect(dist((await camera(page)).offset ?? [0, 0], framedOffset)).toBeGreaterThan(1e-3);
    await page.keyboard.press("f");
    await expect.poll(async () => dist((await camera(page)).offset ?? [0, 0], framedOffset), { timeout: 10_000 }).toBeLessThan(1e-6);
    expect(dist((await camera(page)).target, want)).toBeLessThan(1e-4);
  });

  test("a wisdom tooth (no mesh) can be in the URL without errors and is never picked", async ({ page }) => {
    const errors = await open(page, "&sel=tooth_18");
    expect((await state(page)).sel).toBe("tooth_18");
    expect(await page.evaluate(() => window.__viewer!.bone("tooth_18"))).toBeNull();
    // The view is the default one (nothing to frame).
    const c = await camera(page);
    expect(dist(c.position, c.target)).toBeGreaterThan(2);
    expect(errors).toEqual([]);
  });

  test("an unknown sel is ignored", async ({ page }) => {
    await open(page, "&sel=not_a_bone");
    expect((await state(page)).sel).toBeNull();
  });

  test("hover reports the bone under the mouse", async ({ page }) => {
    await open(page);
    const femur = await bone(page, "femur_left");
    await page.mouse.move(femur.client.x, femur.client.y);
    await page.mouse.move(femur.client.x + 1, femur.client.y);
    await expect.poll(async () => (await state(page)).hovered, { timeout: 10_000 }).toBe("femur_left");
    const e = await emptySpot(page);
    await page.mouse.move(e.x, e.y);
    await expect.poll(async () => (await state(page)).hovered, { timeout: 10_000 }).toBeNull();
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a tap selects; a tap near a tiny object picks it through its enlarged hit area", async ({ page }) => {
    await open(page);
    const femur = await bone(page, "femur_right");
    await page.touchscreen.tap(femur.client.x, femur.client.y);
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBe("femur_right");
    // With the femur isolated nothing else is pickable, the teeth included.
    const t11 = await bone(page, "tooth_11");
    expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y, true), t11.client)).toBeNull();
    await page.evaluate(() => window.history.back());
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    // At the whole-skeleton view a tooth is a few pixels across; taps up to
    // 8 px off its centre still pick a tooth through the enlarged hit areas,
    // and so does a tap on the stapes, which is under a pixel.
    const tooth = await bone(page, "tooth_11");
    for (const [dx, dy] of [[0, 0], [8, 0], [0, -8], [-6, 6]]) {
      const id = await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y, true), { x: tooth.client.x + dx!, y: tooth.client.y + dy! });
      expect(id).toMatch(/^tooth_/);
    }
    const stapes = await bone(page, "stapes_right");
    expect(await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y, true), stapes.client)).not.toBeNull();
    // And a tap through the proxy selects. (On a phone the debug overlay covers
    // the skull, so the tap's pointer events go straight to the canvas.)
    await page.evaluate(({ x, y }) => {
      const c = document.querySelector("canvas")!;
      for (const type of ["pointerdown", "pointerup"])
        c.dispatchEvent(new PointerEvent(type, { pointerId: 31, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true }));
    }, { x: tooth.client.x + 6, y: tooth.client.y - 6 });
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toMatch(/^tooth_/);
  });

  test("two-finger pinch and drag zoom and pan without moving the pivot", async ({ page }) => {
    await open(page);
    const home = await camera(page);
    await page.evaluate(() => {
      const c = document.querySelector("canvas")!;
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.6;
      const send = (type: string, id: number, x: number, y: number) =>
        (type === "pointerdown" ? c : window).dispatchEvent(
          new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 21, clientX: x, clientY: y, bubbles: true }),
        );
      send("pointerdown", 21, cx - 40, cy);
      send("pointerdown", 22, cx + 40, cy);
      for (let i = 1; i <= 10; i++) {
        send("pointermove", 21, cx - 40 - i * 6 + i * 3, cy + i * 4);
        send("pointermove", 22, cx + 40 + i * 6 + i * 3, cy + i * 4);
      }
      send("pointerup", 21, cx - 10, cy + 40);
      send("pointerup", 22, cx + 130, cy + 40);
    });
    await settle(page, 1000);
    const after = await camera(page);
    expect(dist(after.target, home.target)).toBeLessThan(1e-9);
    // Fingers spread from 80 to 200 px: the eye is closer, and the drag shifted the view.
    expect(dist(after.position, after.target)).toBeLessThan(dist(home.position, home.target) * 0.7);
    expect(Math.hypot(...after.offset!)).toBeGreaterThan(0.01);
    expect((await state(page)).sel).toBeNull();
  });
});
