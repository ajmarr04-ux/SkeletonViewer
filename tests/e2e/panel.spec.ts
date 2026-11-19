import { expect, test, type Page } from "@playwright/test";

// Milestone 3 session I: the info panel (placeholder content), breadcrumb,
// Milestone 4 session K: the real content (compiled from content/bones),
// side toggle, Back and focus, aria-live announcements, the phone's bottom
// sheet, and 200% zoom (spec §7, §10).

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);
const bone = async (page: Page, id: string) => (await page.evaluate((i) => window.__viewer!.bone(i), id))!;

test.describe("desktop panel", () => {
  test("click the femur: panel, breadcrumb and announcement; side toggle; Back returns focus to the canvas", async ({ page }) => {
    const errors = await open(page);
    const panel = page.getByTestId("info-panel");
    await expect(panel).toHaveCount(0);
    const femur = await bone(page, "femur_left");
    await page.mouse.click(femur.client.x, femur.client.y);
    await expect(panel).toHaveAttribute("data-id", "femur_left", { timeout: 10_000 });
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Femur");
    await expect(panel).toContainText("Latin name not written yet");
    await expect(panel).toContainText("Draft — not yet reviewed");
    await expect(panel).toContainText("Lower limb");
    for (const h of ["Summary", "Functions", "Articulations", "Key landmarks", "Major muscle attachments", "Clinical note"]) {
      await expect(panel.getByRole("heading", { level: 3, name: h })).toBeVisible();
    }
    await expect(panel.getByRole("button", { name: "Show related" })).toBeEnabled();
    await expect(panel.getByRole("button", { name: "Expand region" })).toBeDisabled();
    await expect(page.getByTestId("breadcrumb")).toHaveText(/Skeleton\s*›\s*Lower limb\s*›\s*Femur/);
    await expect(page.getByTestId("announcer")).toHaveText("Femur, left, selected. Isolated.");
    // Focus stays on the canvas after a mouse selection.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("CANVAS");

    // Side toggle: to the right femur, replacing the entry (one Back still leaves).
    await expect(page.getByTestId("side-left")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("side-right").click();
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("femur_right");
    await expect(panel).toHaveAttribute("data-id", "femur_right");
    await expect(page.getByTestId("side-right")).toHaveAttribute("aria-pressed", "true");
    expect((await state(page)).tier).toBe(0);
    const target = (await page.evaluate(() => window.__viewer!.camera())).target;
    const want = (await bone(page, "femur_right")).centre;
    expect(Math.hypot(...target.map((t, i) => t - want[i]!))).toBeLessThan(1e-4); // pivot moved to it
    await page.getByTestId("side-left").click();
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("femur_left");

    // Panel Back: full skeleton, panel gone, focus on the canvas.
    await page.getByTestId("panel-back").click();
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId("announcer")).toHaveText("Full skeleton");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("CANVAS");
    expect(errors).toEqual([]);
  });

  test("breadcrumb 'Skeleton' and Esc inside the panel step back; the panel collapses", async ({ page }) => {
    await open(page, "&sel=tooth_13");
    await expect(page.getByTestId("breadcrumb")).toHaveText(/Skeleton\s*›\s*Teeth\s*›\s*Upper right\s*›\s*Canines\s*›\s*Upper right canine/);
    const panel = page.getByTestId("info-panel");
    await expect(panel).toContainText("Tooth type: canine");
    // Collapse and expand.
    await page.getByTestId("panel-collapse").click();
    await expect(panel.getByRole("heading", { name: "Summary" })).toHaveCount(0);
    await page.getByTestId("panel-collapse").click();
    await expect(panel.getByRole("heading", { name: "Summary" })).toBeVisible();
    // Esc while focus is in the panel.
    await page.getByTestId("side-left").focus();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
    // Breadcrumb link.
    await page.evaluate(() => window.__viewer!.select("femur_left"));
    await page.getByRole("button", { name: "Skeleton" }).click();
    await expect.poll(async () => (await state(page)).sel, { timeout: 10_000 }).toBeNull();
  });

  test("a wisdom tooth shows the no-model note and its pair", async ({ page }) => {
    const errors = await open(page, "&sel=tooth_18");
    const panel = page.getByTestId("info-panel");
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Upper right third molar");
    await expect(page.getByTestId("no-model-note")).toHaveText("No 3D model: this tooth is absent from the source model.");
    await page.getByTestId("side-left").click();
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("tooth_28");
    await expect(page.getByTestId("no-model-note")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a midline bone has no side toggle", async ({ page }) => {
    await open(page, "&sel=sternum");
    await expect(page.getByTestId("info-panel")).toContainText("Sternum");
    await expect(page.getByTestId("side-left")).toHaveCount(0);
  });

  test("real content (session K): Latin name, badges, summary, sections; an articulation selects its bone", async ({ page }) => {
    const errors = await open(page, "&sel=rib_1_left");
    const panel = page.getByTestId("info-panel");
    await expect(panel.locator(".latin")).toHaveText("Costa I", { timeout: 10_000 });
    await expect(panel.locator(".badges")).toContainText("Flat bone");
    await expect(panel.locator(".badges")).toContainText("Draft — not yet reviewed");
    await expect(page.getByTestId("section-summary")).toContainText("The first rib is the shortest");
    await expect(page.getByTestId("section-functions").getByRole("listitem")).toHaveCount(3);
    await expect(page.getByTestId("section-landmarks")).toContainText("Scalene tubercle");
    await expect(page.getByTestId("section-landmarks")).toContainText("no positions yet");
    await expect(page.getByTestId("section-muscles")).toContainText("Scalenus anterior");
    await expect(page.getByTestId("section-clinical")).toContainText("thoracic outlet");
    await expect(panel).not.toContainText("Not written yet");
    // Articulations: T1 and the sternum, each a link with the joint's name.
    const links = page.getByTestId("section-articulations").getByRole("button");
    await expect(links).toHaveCount(2);
    await expect(page.getByTestId("link-sternum")).toContainText("Sternocostal joint, rib 1");
    await page.getByTestId("link-vertebra_t1").click();
    await expect.poll(() => param(page, "sel"), { timeout: 10_000 }).toBe("vertebra_t1");
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("T1 vertebra");
    await expect(panel.locator(".latin")).toHaveText("Vertebra thoracica I");
    // Focus moves to the new title, so keyboard users keep their place.
    await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
    expect((await state(page)).tier).toBe(0);
    expect(errors).toEqual([]);
  });

  test("a tooth: tooth-type badge, alveolar bone and neighbouring teeth; the hyoid has no articulation", async ({ page }) => {
    await open(page, "&sel=tooth_36");
    const panel = page.getByTestId("info-panel");
    await expect(panel.locator(".badges")).toContainText("Tooth type: molar", { timeout: 10_000 });
    await expect(page.getByTestId("link-mandible")).toContainText("gomphosis");
    await expect(page.getByTestId("section-articulations").getByRole("heading", { name: "Neighbouring teeth" })).toBeVisible();
    await expect(page.getByTestId("link-tooth_35")).toBeVisible();
    await expect(page.getByTestId("link-tooth_37")).toBeVisible();
    await expect(page.getByTestId("section-muscles")).toContainText("None (teeth have no muscle attachments)");
    await page.evaluate(() => window.__viewer!.select("hyoid_bone"));
    await expect(page.getByTestId("section-articulations")).toContainText("No bony articulation.");
  });

  test("panel text contrast is at least 4.5:1", async ({ page }) => {
    await open(page, "&sel=mandible");
    await expect(page.getByTestId("section-summary")).toContainText("The mandible", { timeout: 10_000 });
    const ratios = await page.evaluate(() => {
      const parse = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) =>
        [r!, g!, b!].map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const bgOf = (el: Element): number[] => {
        for (let e: Element | null = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          const p = c.match(/[\d.]+/g)!.map(Number);
          if (p.length < 4 || p[3]! > 0.9) return p.slice(0, 3);
        }
        return [29, 33, 38];
      };
      const out: { text: string; ratio: number }[] = [];
      for (const el of document.querySelectorAll('[data-testid="info-panel"] *')) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
        if ((el as HTMLButtonElement).disabled || el.closest(":disabled") || el.closest(".disabled")) continue; // WCAG exempts disabled controls
        const a = lum(parse(getComputedStyle(el).color));
        const b = lum(bgOf(el));
        out.push({ text: el.textContent!.slice(0, 30), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
      }
      return out;
    });
    expect(ratios.length).toBeGreaterThan(10);
    for (const r of ratios) expect(r.ratio, r.text).toBeGreaterThanOrEqual(4.5);
  });

  test("reflows at 200% zoom (640 CSS px wide)", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await open(page, "&sel=mandible"); // real text, the longest muscle list
    const panel = page.getByTestId("info-panel");
    await expect(page.getByTestId("section-summary")).toContainText("The mandible", { timeout: 10_000 });
    // No horizontal scrolling: the page and the panel fit.
    const { scroll, client, panelScroll, panelClient } = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="info-panel"] .panel-body')!;
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, panelScroll: p.scrollWidth, panelClient: p.clientWidth };
    });
    expect(scroll).toBeLessThanOrEqual(client);
    expect(panelScroll).toBeLessThanOrEqual(panelClient);
    // The toolbar fits on screen, beside the panel.
    const bar = (await page.getByRole("navigation", { name: "View controls" }).boundingBox())!;
    const side = (await panel.boundingBox())!;
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(side.x);
    await page.screenshot({ path: "test-results/panel-200pct.png" });
  });
});

test.describe("phone sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("peek, half, full by tap; drag snaps; toolbar stays usable at peek", async ({ page }) => {
    await open(page, "&sel=femur_left");
    const sheet = page.getByTestId("info-panel");
    await expect(sheet).toHaveAttribute("data-snap", "peek");
    await expect(sheet.getByRole("heading", { level: 2 })).toHaveText("Femur");
    const peek = (await sheet.boundingBox())!;
    expect(peek.height).toBeLessThan(100);
    // The toolbar sits above the sheet and its buttons work.
    const home = (await page.getByRole("button", { name: "Home view" }).boundingBox())!;
    expect(home.y + home.height).toBeLessThanOrEqual(peek.y);
    // Tap the handle: half, then full, then peek.
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "half");
    await expect(sheet.getByRole("heading", { name: "Summary" })).toBeVisible();
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "full");
    await expect(page.getByRole("button", { name: "Home view" })).toBeHidden();
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "peek");
    // Drag the header up by ~half the screen: snaps to half.
    await page.evaluate(() => {
      const h = document.querySelector(".sheet-head")!;
      const r = h.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y0 = r.top + 40;
      const send = (type: string, y: number) =>
        h.dispatchEvent(new PointerEvent(type, { pointerId: 41, pointerType: "touch", isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true }));
      send("pointerdown", y0);
      for (let i = 1; i <= 8; i++) send("pointermove", y0 - i * 45);
      send("pointerup", y0 - 360);
    });
    await expect(sheet).toHaveAttribute("data-snap", "half");
    // F frames the femur above the sheet (pivot on it, moved up on screen).
    await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement).focus());
    await page.keyboard.press("f");
    await page.waitForTimeout(800);
    const f = await bone(page, "femur_left");
    const top = (await sheet.boundingBox())!.y;
    expect(f.client.y).toBeLessThan(top);
  });
});
