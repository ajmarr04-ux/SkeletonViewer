import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Milestone 5 session N: floating labels, colour-by-region and the legend,
// screenshot, share link, the attribution page and the phone toolbar's "More"
// menu (plan steps 5 to 10).

async function open(page: Page, query = "", hash = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}${hash}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const colourOf = async (page: Page, id: string) => (await page.evaluate((i) => window.__viewer!.instanceColour(i), id))!;
const isWhite = (c: number[]) => c.every((x) => Math.abs(x - 1) < 1e-6);

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function labelBoxes(page: Page): Promise<(Box & { id: string })[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-label]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.label!, x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

test.describe("floating labels", () => {
  test("never overlap each other or the toolbar, follow isolation, and are remembered", async ({ page }) => {
    const errors = await open(page);
    await expect(page.getByTestId("labels")).toHaveCount(0);
    await page.getByTestId("labels-toggle").click();
    await expect(page.getByTestId("labels-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await labelBoxes(page)).length).toBeGreaterThan(5);
    await expect(page.getByTestId("labels")).toHaveAttribute("aria-hidden", "true");
    const check = async () => {
      const boxes = await labelBoxes(page);
      const bar = (await page.getByRole("navigation", { name: "View controls" }).boundingBox())!;
      for (let i = 0; i < boxes.length; i++) {
        expect(overlap(boxes[i]!, bar), boxes[i]!.id).toBe(false);
        for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!), `${boxes[i]!.id} / ${boxes[j]!.id}`).toBe(false);
      }
      return boxes;
    };
    const full = await check();
    expect(full.map((b) => b.id)).toContain("femur_left"); // a large bone is labelled on the whole skeleton
    expect(full.map((b) => b.id)).not.toContain("stapes_left"); // a tiny one isn't

    // Isolated: the focus is always labelled, and ghosts never are.
    await page.evaluate(() => window.__viewer!.select("femur_left"));
    await page.getByTestId("tool-related").click();
    await expect.poll(async () => (await labelBoxes(page)).map((b) => b.id).sort().join(",")).toBe(
      ["femur_left", "hip_bone_left", "patella_left", "tibia_left"].join(","),
    );
    await check();
    // Labels never take a click: the bone underneath is picked.
    const femur = (await page.evaluate(() => window.__viewer!.bone("femur_left")))!.client;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [femur.x, femur.y])).toBe("CANVAS");

    // Stored in localStorage, not the URL.
    expect(page.url()).not.toContain("label");
    await page.reload();
    await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(page.getByTestId("labels-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await labelBoxes(page)).length).toBeGreaterThan(0);
    await page.getByTestId("labels-toggle").click();
    await expect(page.getByTestId("labels")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("zooming in labels more bones", async ({ page }) => {
    await open(page);
    await page.getByTestId("labels-toggle").click();
    await expect.poll(async () => (await labelBoxes(page)).length).toBeGreaterThan(5);
    const before = (await labelBoxes(page)).map((b) => b.id);
    expect(await page.evaluate(() => window.__viewer!.frameBone(["radius_left", "ulna_left", "lunate_left"]))).toBe(true);
    await expect.poll(async () => (await labelBoxes(page)).map((b) => b.id).filter((id) => !before.includes(id)).length).toBeGreaterThan(2);
  });
});

test.describe("colour-by-region", () => {
  test("colours each region, keeps the focus accent, isolates from the legend and restores white", async ({ page }) => {
    const errors = await open(page);
    const debug = page.getByTestId("debug");
    expect(isWhite(await colourOf(page, "femur_left"))).toBe(true);
    await page.getByTestId("colour-toggle").click();
    await expect(debug).toHaveAttribute("data-colour", "region");
    await expect(page).toHaveURL(/[?&]color=region/);
    const femur = await colourOf(page, "femur_left");
    const tibia = await colourOf(page, "tibia_left");
    const skull = await colourOf(page, "frontal_bone");
    expect(isWhite(femur)).toBe(false);
    expect(femur).toEqual(tibia); // one colour per region
    expect(skull).not.toEqual(femur);
    expect(isWhite(await colourOf(page, "tooth_36"))).toBe(true); // teeth stay ivory
    const legend = page.getByRole("region", { name: "Colour key: regions" });
    await expect(legend.getByRole("button")).toHaveCount(8);

    // The selected bone keeps its accent (and outline) over the region colour; deselecting gives the region colour back.
    await page.evaluate(() => window.__viewer!.select("femur_left"));
    await expect(debug).toHaveAttribute("data-focus", "femur_left");
    expect(await colourOf(page, "femur_left")).not.toEqual(femur);
    await page.evaluate(() => window.__viewer!.back());
    await expect(debug).toHaveAttribute("data-focus", "");
    expect(await colourOf(page, "femur_left")).toEqual(femur);

    // A legend entry isolates its region as a group.
    await legend.getByRole("button", { name: "Lower limbs" }).click();
    await expect.poll(async () => (await state(page)).grp).toBe("appendicular.lower_limb");
    await expect(debug).toHaveAttribute("data-solid", "60");
    await expect(legend.getByRole("button", { name: "Lower limbs" })).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/grp=appendicular\.lower_limb&color=region/);

    // Off: every instance is white again, and nothing moved.
    await page.getByTestId("colour-toggle").click();
    await expect(debug).toHaveAttribute("data-colour", "bone");
    await expect(page).not.toHaveURL(/color=/);
    await expect(legend).toHaveCount(0);
    for (const id of ["femur_left", "frontal_bone", "sternum", "humerus_right"]) expect(isWhite(await colourOf(page, id)), id).toBe(true);
    await expect(debug).toHaveAttribute("data-bounds-ok", "true");
    expect(errors).toEqual([]);
  });

  test("a color=region link turns it on, and a choice made with the button is remembered", async ({ page }) => {
    await open(page, "&color=region");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-colour", "region");
    await expect(page.getByTestId("colour-toggle")).toHaveAttribute("aria-pressed", "true");
    // A link alone doesn't change the stored choice; pressing the button does.
    await page.goto("./?lod=low&debug");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-colour", "bone", { timeout: 60_000 });
    await page.getByTestId("colour-toggle").click();
    await page.goto("./?lod=low&debug");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-colour", "region", { timeout: 60_000 });
    await expect(page).toHaveURL(/color=region/);
  });
});

test.describe("screenshot", () => {
  test("downloads a PNG at the canvas's pixel size, named after the selection, with the attribution strip", async ({ page }) => {
    const errors = await open(page, "&sel=femur_left");
    await page.getByTestId("labels-toggle").click();
    await expect.poll(async () => (await labelBoxes(page)).length).toBeGreaterThan(0);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("screenshot").click()]);
    expect(download.suggestedFilename()).toBe("skeleton-femur-left.png");
    await expect(page.getByTestId("toast")).toHaveText("Screenshot saved: skeleton-femur-left.png");
    await expect(page.getByTestId("announcer")).toHaveText("Screenshot saved: skeleton-femur-left.png");
    const png = readFileSync((await download.path())!);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("canvas")!;
      return { w: c.width, h: c.height };
    });
    expect({ w: width, h: height }).toEqual(canvas);
    // Decode in the page: not blank, the femur's accent is there, and the strip's white text sits bottom right.
    const stats = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = (x: number, y: number, w: number, h: number) => ctx.getImageData(x, y, w, h).data;
      const count = (d: Uint8ClampedArray, f: (r: number, g: number, b: number) => boolean) => {
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (f(d[i]!, d[i + 1]!, d[i + 2]!)) n++;
        return n;
      };
      const all = px(0, 0, c.width, c.height);
      const corner = px(c.width - 200, c.height - 20, 200, 20);
      const left = px(0, c.height - 20, 200, 20);
      return {
        distinct: new Set(Array.from({ length: 2000 }, (_, i) => all[Math.floor((i * all.length) / 2000 / 4) * 4])).size,
        cornerWhite: count(corner, (r, g, b) => r > 200 && g > 200 && b > 200),
        leftWhite: count(left, (r, g, b) => r > 200 && g > 200 && b > 200),
      };
    }, png.toString("base64"));
    expect(stats.distinct).toBeGreaterThan(5);
    expect(stats.cornerWhite).toBeGreaterThan(20); // the strip's text
    expect(stats.leftWhite).toBe(0); // the strip is only bottom right
    expect(errors).toEqual([]);
  });

  test("a group's file name, and the full skeleton's", async ({ page }) => {
    await open(page, "&grp=dentition.type.molars");
    const [d1] = await Promise.all([page.waitForEvent("download"), page.getByTestId("screenshot").click()]);
    expect(d1.suggestedFilename()).toBe("skeleton-molars-upper-and-lower.png");
    await page.goto("./?lod=low&debug");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    const [d2] = await Promise.all([page.waitForEvent("download"), page.getByTestId("screenshot").click()]);
    expect(d2.suggestedFilename()).toBe("skeleton.png");
  });
});

test.describe("share link", () => {
  test("copies the URL, and the link restores the same view", async ({ page, context, browser }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "&sel=femur_left&ghost=0&color=region");
    await page.getByTestId("tool-related").click();
    await expect.poll(async () => (await state(page)).tier).toBe(1);
    await page.evaluate(() => window.__viewer!.command({ kind: "preset", preset: "left" }));
    await expect(page).toHaveURL(/cam=/, { timeout: 10_000 });
    await page.getByTestId("share").click();
    await expect(page.getByTestId("toast")).toHaveText("Link copied");
    await expect(page.getByTestId("announcer")).toHaveText("Link copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());
    expect(copied).toMatch(/sel=femur_left&tier=1&ghost=0&color=region&cam=/);
    const cam = await page.evaluate(() => window.__viewer!.camera());

    const other = await browser.newPage();
    await other.goto(copied);
    await expect(other.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await other.waitForFunction(() => window.__viewer !== undefined);
    expect(await other.evaluate(() => window.__viewer!.state())).toMatchObject({ sel: "femur_left", tier: 1, grp: null });
    await expect(other.getByTestId("debug")).toHaveAttribute("data-colour", "region");
    await expect(other.getByTestId("debug")).toHaveAttribute("data-ghosts", "0");
    await expect(other.getByTestId("ghost-toggle")).toHaveAttribute("aria-pressed", "false");
    const cam2 = await other.evaluate(() => window.__viewer!.camera());
    for (let i = 0; i < 3; i++) {
      expect(cam2.position[i]).toBeCloseTo(cam.position[i]!, 3);
      expect(cam2.target[i]).toBeCloseTo(cam.target[i]!, 3);
    }
    await other.close();
  });

  test("a group link round-trips too", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "&grp=dentition.type.molars");
    await page.getByTestId("share").click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("grp=dentition.type.molars");
  });

  test("without a clipboard, shows the link to copy by hand", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
    await open(page, "&sel=sternum");
    await page.getByTestId("share").click();
    const dialog = page.getByRole("dialog", { name: "Copy this link" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("share-url")).toHaveValue(page.url());
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("attribution page", () => {
  test("#attribution opens it as HTML, closing clears the hash, and the footer link opens it again", async ({ page }) => {
    await open(page, "", "#attribution");
    const dialog = page.getByRole("dialog", { name: "Attribution" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "3D model" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Text content" })).toBeVisible();
    await expect(dialog).toContainText("not yet been reviewed");
    await expect(dialog.getByRole("link", { name: "https://creativecommons.org/licenses/by-sa/4.0/" })).toHaveAttribute("target", "_blank");
    await expect(dialog).not.toContainText("## "); // compiled, not raw markdown
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    expect(new URL(page.url()).hash).toBe("");
    await page.getByRole("link", { name: "Attribution" }).click();
    await expect(dialog).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#attribution");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(new URL(page.url()).hash).toBe("");
  });
});

test.describe("toolbar fit", () => {
  test("desktop: labels when there is room; icons beside the panel; More when even that won't fit", async ({ page }) => {
    await open(page);
    const bar = page.getByRole("navigation", { name: "View controls" });
    await expect(bar).toHaveAttribute("data-fit", "labels");
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);
    await page.setViewportSize({ width: 900, height: 700 });
    await page.evaluate(() => window.__viewer!.select("femur_left"));
    await page.getByTestId("tool-related").click();
    await expect(bar).toHaveAttribute("data-fit", "more");
    const b = (await bar.boundingBox())!;
    const panel = (await page.getByTestId("info-panel").boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(panel.x);
  });
});

test.describe("phone toolbar: More", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("fits at 390 px, and every action is within two taps", async ({ page }) => {
    const errors = await open(page, "&sel=femur_left");
    await page.getByTestId("tool-related").tap();
    const bar = page.getByRole("navigation", { name: "View controls" });
    await expect(bar).toHaveAttribute("data-fit", "more");
    const b = (await bar.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    // In the bar: Search, Home, Views, Region, Ghosts, More.
    for (const name of ["Search and browse", "Home view", "Views", "Ghosts", "More"]) await expect(bar.getByRole("button", { name })).toBeVisible();
    await expect(bar.getByTestId("tool-region")).toBeVisible();
    for (const name of ["Settings", "Explode", "Ghost opacity"]) await expect(bar.getByRole("button", { name, exact: true })).toHaveCount(0);

    await bar.getByRole("button", { name: "More" }).tap();
    const more = page.getByRole("dialog", { name: "More" });
    const mb = (await more.boundingBox())!;
    expect(mb.x).toBeGreaterThanOrEqual(0);
    expect(mb.x + mb.width).toBeLessThanOrEqual(390);
    expect(mb.y).toBeGreaterThanOrEqual(0);
    for (const id of ["labels-toggle", "colour-toggle", "screenshot", "share", "ghost-opacity", "explode"]) await expect(more.getByTestId(id)).toBeVisible();
    await expect(more.getByLabel(/^High/)).toBeVisible();
    // Two taps: More, then the action.
    await more.getByTestId("colour-toggle").tap();
    await expect(page.getByTestId("debug")).toHaveAttribute("data-colour", "region");
    await expect(more.getByTestId("colour-toggle")).toHaveAttribute("aria-pressed", "true");
    await more.getByTestId("labels-toggle").tap();
    await expect(page.getByTestId("labels-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
});
