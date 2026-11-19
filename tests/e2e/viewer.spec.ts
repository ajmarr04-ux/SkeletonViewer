import { expect, test, type Page } from "@playwright/test";
import manifest from "../../assets/build/manifest.json" with { type: "json" };

type Vec3 = [number, number, number];
type Cam = { position: Vec3; target: Vec3 };

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  // The rig frames the skeleton on the next frame.
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}

const camera = (page: Page) => page.evaluate(() => window.__viewer!.camera());
const camParam = (page: Page) => new URL(page.url()).searchParams.get("cam");

/** Wait until the URL holds a cam different from `before`. */
async function nextCam(page: Page, before: string | null) {
  await expect.poll(() => camParam(page), { timeout: 10_000 }).not.toBe(before);
  return camParam(page)!;
}

function parseCam(s: string): Cam {
  const n = s.split(",").map(Number) as number[];
  return { position: n.slice(0, 3) as Vec3, target: n.slice(3) as Vec3 };
}

const centreOf = (id: string): Vec3 => {
  const o = (manifest.objects as Record<string, { lods: { low: { bboxMin: number[]; bboxMax: number[] } } }>)[id]!.lods.low;
  return [0, 1, 2].map((i) => (o.bboxMin[i]! + o.bboxMax[i]!) / 2) as Vec3;
};

test("first load: anterior view, no cam written until the user moves", async ({ page }) => {
  const errors = await open(page);
  const cam = await camera(page);
  // Looking from +Z at the skeleton's centre.
  const d = cam.position.map((x, i) => x - cam.target[i]!);
  expect(Math.abs(d[0]!) + Math.abs(d[1]!)).toBeLessThan(1e-6);
  expect(d[2]).toBeGreaterThan(1);
  expect(camParam(page)).toBeNull();
  expect(errors).toEqual([]);
});

test("keyboard moves the camera, the URL follows, and a reload restores it", async ({ page }) => {
  const errors = await open(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("+");
  const written = await nextCam(page, null);
  // Rest is reached: the URL matches the camera to 0.1 mm.
  const now = await camera(page);
  const url = parseCam(written);
  expect(dist(url.position, now.position)).toBeLessThan(2e-4);
  expect(dist(url.target, now.target)).toBeLessThan(2e-4);
  // Other parameters are kept.
  expect(new URL(page.url()).searchParams.get("lod")).toBe("low");
  expect(new URL(page.url()).searchParams.has("debug")).toBe(true);

  await page.reload();
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  await expect.poll(async () => dist((await camera(page)).position, url.position)).toBeLessThan(1e-3);
  expect(dist((await camera(page)).target, url.target)).toBeLessThan(1e-3);
  expect(errors).toEqual([]);
});

test("H returns to the default view", async ({ page }) => {
  await open(page);
  const home = await camera(page);
  await page.locator("canvas").focus();
  for (const key of ["ArrowUp", "ArrowUp", "Shift+ArrowRight", "-"]) await page.keyboard.press(key);
  await nextCam(page, null);
  expect(dist((await camera(page)).position, home.position)).toBeGreaterThan(0.05);
  await page.keyboard.press("h");
  await expect.poll(async () => dist((await camera(page)).position, home.position), { timeout: 10_000 }).toBeLessThan(1e-3);
  expect(dist((await camera(page)).target, home.target)).toBeLessThan(1e-3);
});

test("each preset looks from the expected direction", async ({ page }) => {
  await open(page);
  const expected: Record<string, Vec3> = {
    anterior: [0, 0, 1],
    posterior: [0, 0, -1],
    left: [1, 0, 0],
    right: [-1, 0, 0],
    superior: [0, 1, 0],
    inferior: [0, -1, 0],
  };
  for (const [preset, dir] of Object.entries(expected)) {
    await page.evaluate((p) => window.__viewer!.command({ kind: "preset", preset: p as "anterior" }), preset);
    await expect
      .poll(async () => {
        const c = await camera(page);
        const d = c.position.map((x, i) => x - c.target[i]!);
        const len = Math.hypot(...d);
        return d.reduce((s, x, i) => s + (x / len) * dir[i]!, 0);
      }, { message: preset, timeout: 10_000 })
      .toBeGreaterThan(0.999);
  }
});

test("an invalid cam falls back to the default view without an error", async ({ page }) => {
  const reference = await (async () => {
    await open(page);
    return camera(page);
  })();
  const errors = await open(page, "&cam=1,2,nope,4,5,6");
  const cam = await camera(page);
  expect(dist(cam.position, reference.position)).toBeLessThan(1e-6);
  expect(errors).toEqual([]);
});

test("a cam outside the zoom clamp is brought inside it", async ({ page }) => {
  await open(page, "&cam=0,0.9,90,0,0.9,0");
  const cam = await camera(page);
  const d = dist(cam.position, cam.target);
  expect(d).toBeLessThan(10);
  expect(d).toBeGreaterThan(2);
});

test("double-clicking the femur re-centres the orbit on it", async ({ page }) => {
  await open(page);
  const femur = await page.evaluate(() => window.__viewer!.bone("femur_left"));
  expect(femur).not.toBeNull();
  const before = await camera(page);
  await page.mouse.dblclick(femur!.client.x, femur!.client.y);
  const want = centreOf("femur_left");
  await expect.poll(async () => dist((await camera(page)).target, want), { timeout: 10_000 }).toBeLessThan(1e-3);
  // The distance is kept.
  const after = await camera(page);
  expect(Math.abs(dist(after.position, after.target) - dist(before.position, before.target))).toBeLessThan(1e-3);
  await nextCam(page, null);
});

test("double-clicking empty space does nothing", async ({ page }) => {
  await open(page);
  const before = await camera(page);
  await page.mouse.dblclick(15, 300);
  await page.waitForTimeout(600);
  expect(dist((await camera(page)).target, before.target)).toBeLessThan(1e-9);
  expect(camParam(page)).toBeNull();
});

test("the wheel zooms toward the cursor and a drag orbits", async ({ page }) => {
  await open(page);
  const before = await camera(page);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => dist((await camera(page)).position, (await camera(page)).target), { timeout: 10_000 })
    .toBeLessThan(dist(before.position, before.target) * 0.9);
  const mid = await camera(page);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => dist((await camera(page)).position, mid.position), { timeout: 10_000 }).toBeGreaterThan(0.05);
});

test("Shift + left-drag pans: the target moves and the view direction doesn't", async ({ page }) => {
  await open(page);
  const before = await camera(page);
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.keyboard.down("Shift");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 40, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await nextCam(page, null);
  const after = await camera(page);
  expect(dist(after.target, before.target)).toBeGreaterThan(0.05);
  const dirB = before.position.map((v, i) => v - before.target[i]!);
  const dirA = after.position.map((v, i) => v - after.target[i]!);
  expect(dist(dirA as Vec3, dirB as Vec3)).toBeLessThan(1e-4);
});

test("reduced motion: moves are instant cuts", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const home = await camera(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowLeft");
  // No easing: one frame later the camera is already where it is going.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const moved = await camera(page);
  const angle = Math.acos(
    ((moved.position[2] - moved.target[2]) * (home.position[2] - home.target[2]) +
      (moved.position[0] - moved.target[0]) * (home.position[0] - home.target[0])) /
      (dist(moved.position, moved.target) * dist(home.position, home.target)),
  );
  expect(angle).toBeCloseTo((5 * Math.PI) / 180, 4);
  await nextCam(page, null);
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("double-tapping the femur re-centres the orbit on it", async ({ page }) => {
    await open(page);
    const femur = await page.evaluate(() => window.__viewer!.bone("femur_right"));
    // Software WebGL leaves ~800 ms between two touchscreen.tap() calls, longer
    // than a double tap allows, so send the two taps' pointer events in one go.
    // (touchscreen.tap does reach the canvas as pointerType "touch" events.)
    await page.evaluate(({ x, y }) => {
      const c = document.querySelector("canvas")!;
      for (const id of [11, 12])
        for (const type of ["pointerdown", "pointerup"])
          c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true }));
    }, femur!.client);
    const want = centreOf("femur_right");
    await expect.poll(async () => dist((await camera(page)).target, want), { timeout: 10_000 }).toBeLessThan(1e-3);
  });

  test("the whole skeleton is framed on a phone", async ({ page }) => {
    await open(page);
    for (const id of ["parietal_bone_left", "calcaneus_left", "distal_phalanx_hand_3_right"]) {
      const b = await page.evaluate((i) => window.__viewer!.bone(i), id);
      expect(b, id).not.toBeNull();
      expect(b!.client.x).toBeGreaterThan(0);
      expect(b!.client.x).toBeLessThan(390);
      expect(b!.client.y).toBeGreaterThan(0);
      expect(b!.client.y).toBeLessThan(844);
    }
  });
});
