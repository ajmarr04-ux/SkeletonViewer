import { expect, test, type Page } from "@playwright/test";
import manifest from "../../assets/build/manifest.json" with { type: "json" };

type Vec3 = [number, number, number];
type Cam = { position: Vec3; target: Vec3; offset?: [number, number] };

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

test("double-clicking the femur re-centres the orbit on it, keeping its size on screen", async ({ page }) => {
  await open(page);
  const femur = await page.evaluate(() => window.__viewer!.bone("femur_left"));
  expect(femur).not.toBeNull();
  const want = centreOf("femur_left");
  // The femur's depth: distance from the eye along the view axis.
  const before = await camera(page);
  const eye = await page.evaluate(() => window.__viewer!.eye());
  const fwd = before.target.map((t, i) => t - before.position[i]!);
  const n = Math.hypot(...fwd);
  const depth = want.reduce((acc, w, i) => acc + ((w - eye[i]!) * fwd[i]!) / n, 0);
  await page.mouse.dblclick(femur!.client.x, femur!.client.y);
  await expect.poll(async () => dist((await camera(page)).target, want), { timeout: 10_000 }).toBeLessThan(1e-3);
  // Centred in the area the info panel leaves free (the first click selected,
  // so the panel is open), at the same depth as before, so the femur keeps its
  // size. From this far out the offset is shortened by the pan limit
  // (clampOffset), so the femur lands between the canvas centre and the free
  // area's centre, nearer the latter.
  const panel = (await page.getByTestId("info-panel").boundingBox())!;
  const canvas = (await page.locator("canvas").boundingBox())!;
  await expect.poll(async () => (await camera(page)).offset?.[0] ?? 0, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  const x = (await page.evaluate(() => window.__viewer!.bone("femur_left")))!.client.x;
  expect(x).toBeLessThan(canvas.x + canvas.width / 2 - 50);
  expect(Math.abs(x - panel.x / 2)).toBeLessThan(Math.abs(x - (canvas.x + canvas.width / 2)));
  const after = await camera(page);
  expect(Math.abs(dist(after.position, after.target) - depth)).toBeLessThan(1e-3);
  await nextCam(page, null);
});

test("double-clicking empty space does nothing", async ({ page }) => {
  await open(page);
  const before = await camera(page);
  const box = (await page.locator("canvas").boundingBox())!;
  // Right edge, mid-height: no bone there, and clear of the debug overlay (top-left).
  await page.mouse.dblclick(box.x + box.width - 20, box.y + box.height * 0.45);
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

test("Shift + left-drag pans: the picture moves, the pivot and the view direction don't", async ({ page }) => {
  await open(page);
  const before = await camera(page);
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const pivotBefore = await page.evaluate((p) => window.__viewer!.project(p), before.target);
  await page.keyboard.down("Shift");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 40, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await nextCam(page, null);
  const after = await camera(page);
  expect(dist(after.target, before.target)).toBeLessThan(1e-9);
  expect(dist(after.position, before.position)).toBeLessThan(1e-9);
  expect(Math.hypot(...after.offset!)).toBeGreaterThan(0.05);
  // The picture followed the pointer: the pivot moved right and down on screen
  // (by about the drag: the grabbed bone is a little nearer than the pivot).
  await expect.poll(async () => (await page.evaluate((p) => window.__viewer!.project(p), before.target)).x - pivotBefore.x, { timeout: 10_000 }).toBeGreaterThan(60);
  const pivotAfter = await page.evaluate((p) => window.__viewer!.project(p), before.target);
  expect(pivotAfter.y - pivotBefore.y).toBeGreaterThan(20);
  // Shift-drag never selects.
  expect(new URL(page.url()).searchParams.get("sel")).toBeNull();
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

const viewDir = (c: Cam): Vec3 => {
  const d = c.position.map((x, i) => x - c.target[i]!) as Vec3;
  const len = Math.hypot(...d);
  return d.map((x) => x / len) as Vec3;
};
const PRESET_DIRS: Record<string, Vec3> = {
  anterior: [0, 0, 1],
  posterior: [0, 0, -1],
  left: [1, 0, 0],
  right: [-1, 0, 0],
  superior: [0, 1, 0],
  inferior: [0, -1, 0],
};

test.describe("toolbar", () => {
  test("the Views menu moves to each preset, and Home returns to the default view", async ({ page }) => {
    const errors = await open(page);
    const home = await camera(page);
    const views = page.getByRole("button", { name: "Views" });
    for (const [preset, dir] of Object.entries(PRESET_DIRS)) {
      await views.click();
      await expect(views).toHaveAttribute("aria-expanded", "true");
      await page.locator(`[role=menuitem][data-preset=${preset}]`).click();
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect
        .poll(async () => viewDir(await camera(page)).reduce((s, x, i) => s + x * dir[i]!, 0), { message: preset, timeout: 10_000 })
        .toBeGreaterThan(0.999);
    }
    await page.getByRole("button", { name: "Home view" }).click();
    await expect.poll(async () => dist((await camera(page)).position, home.position), { timeout: 10_000 }).toBeLessThan(1e-3);
    expect(errors).toEqual([]);
  });

  test("the Views menu works from the keyboard", async ({ page }) => {
    await open(page);
    const views = page.getByRole("button", { name: "Views" });
    await views.focus();
    await page.keyboard.press("Enter");
    // Focus lands on the first item; arrows move through the list.
    await expect(page.getByRole("menuitem", { name: /Anterior/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /Posterior/ })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: /Inferior/ })).toBeFocused();
    // Escape closes the menu and gives focus back to its button, without moving the camera.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(views).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => viewDir(await camera(page))[2], { timeout: 10_000 })
      .toBeLessThan(-0.999);
  });

  test("Settings switches the model detail, stores it, and reports the active LOD", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Start from a stored Low (what Auto picks depends on the browser's GPU).
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("skeleton-viewer:lod", "low");
      }
    });
    await page.goto("./?debug");
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-plan-source", "setting");
    await expect(debug).toHaveAttribute("data-lod", "low");

    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog.getByLabel(/^Low/)).toBeChecked();
    await expect(dialog.getByTestId("lod-active")).toHaveText("Showing: low detail");
    await dialog.getByLabel(/^High/).check();
    await expect(debug).toHaveAttribute("data-lod", "high", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    await expect(dialog.getByTestId("lod-active")).toHaveText("Showing: high detail");
    expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:lod"))).toBe("high");

    // A reload keeps the stored High.
    await page.reload();
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-plan-source", "setting");
    await expect(debug).toHaveAttribute("data-loaded", "low,high");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(dialog.getByLabel(/^High/)).toBeChecked();

    // Back to Low: the low model is shown again, and Auto clears the stored value.
    await dialog.getByLabel(/^Low/).check();
    await expect(debug).toHaveAttribute("data-lod", "low", { timeout: 60_000 });
    await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await dialog.getByLabel(/^Auto/).check();
    expect(await page.evaluate(() => localStorage.getItem("skeleton-viewer:lod"))).toBeNull();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a Settings choice overrides ?lod= and drops it from the URL", async ({ page }) => {
    await open(page); // ?lod=low&debug
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog", { name: "Settings" }).getByLabel(/^High/).check();
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-lod", "high", { timeout: 60_000 });
    const url = new URL(page.url());
    expect(url.searchParams.has("lod")).toBe(false);
    expect(url.searchParams.has("debug")).toBe(true);
  });

  test("without ?debug there is no debug overlay", async ({ page }) => {
    await page.goto("./?lod=low");
    await expect(page.getByRole("button", { name: "Home view" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("debug")).toHaveCount(0);
  });
});

test("?bench orbits once and reports FPS, frame times and draw calls", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./?lod=low&debug&bench");
  const debug = page.getByTestId("debug");
  await expect(debug).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(page.getByTestId("bench")).toContainText("Orbiting");
  await expect(debug).toHaveAttribute("data-bench-done", "true", { timeout: 40_000 });
  await expect(debug).toHaveAttribute("data-bench-lod", "low");
  expect(Number(await debug.getAttribute("data-bench-frames"))).toBeGreaterThan(5);
  expect(Number(await debug.getAttribute("data-bench-median-fps"))).toBeGreaterThan(0);
  const drawCalls = Number(await debug.getAttribute("data-bench-draw-calls"));
  expect(drawCalls).toBeGreaterThan(0);
  expect(drawCalls).toBeLessThan(20);
  await expect(page.getByTestId("bench")).toContainText("Median FPS");
  // FPS in this container is software WebGL and means nothing; log it anyway.
  console.log("bench (SwiftShader):", await debug.getAttribute("data-bench-median-fps"), "median FPS");
});

test.describe("phone toolbar", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("fits on screen, shows icons only, and its buttons work", async ({ page }) => {
    await open(page);
    const bar = (await page.getByRole("navigation", { name: "View controls" }).boundingBox())!;
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(390);
    expect(bar.y + bar.height).toBeLessThanOrEqual(844);
    await expect(page.locator(".tool-label").first()).toBeHidden();
    for (const b of await page.locator(".toolbar .tool").all()) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const home = await camera(page);
    await page.getByRole("button", { name: "Views" }).tap();
    const item = page.locator("[role=menuitem][data-preset=left]");
    const ib = (await item.boundingBox())!;
    expect(ib.x).toBeGreaterThanOrEqual(0);
    expect(ib.x + ib.width).toBeLessThanOrEqual(390);
    await item.tap();
    await expect.poll(async () => viewDir(await camera(page))[0], { timeout: 10_000 }).toBeGreaterThan(0.999);
    await page.getByRole("button", { name: "Home view" }).tap();
    await expect.poll(async () => dist((await camera(page)).position, home.position), { timeout: 10_000 }).toBeLessThan(1e-3);
    // Settings is in "More" on a phone (plan decision 12).
    await page.getByRole("button", { name: "More" }).tap();
    const sb = (await page.getByRole("dialog", { name: "More" }).boundingBox())!;
    expect(sb.x).toBeGreaterThanOrEqual(0);
    expect(sb.x + sb.width).toBeLessThanOrEqual(390);
  });
});
