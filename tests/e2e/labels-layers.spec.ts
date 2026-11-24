import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M10 session AK: labels for every kind (plan step 1, decisions 1 and 2).
// With the muscles on, a muscle with parts gets one label (named by the
// muscle), its parts none; at the muscle's tier 1 its bones are labelled; at
// the part level the selected head is labelled and its muscle isn't.

const MUSCLE_MESHES = (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === "muscles" && e.meshAvailable).length;
const TRICEPS = "triceps_brachii_left";
const LONG = "triceps_brachii_long_head_left";

async function ready(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => window.localStorage.setItem("skeleton-viewer:labels", "1"));
  await page.goto(`./?lod=low&debug&layers=b:on,m:on${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect(page.getByTestId("layers-report").locator("[data-layer=muscles]")).toHaveAttribute("data-nodes", String(MUSCLE_MESHES), {
    timeout: 120_000,
  });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}

const labelIds = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-label]")].map((el) => el.dataset.label!).sort());
const labelText = (page: Page, id: string) => page.locator(`[data-label="${id}"]`).textContent();

test("muscles on: the triceps gets one label, named by the muscle, and its heads none", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await ready(page);
  expect(await page.evaluate((id) => window.__viewer!.frameBone(id, "posterior"), [LONG, "triceps_brachii_lateral_head_left", "triceps_brachii_medial_head_left"])).toBe(true);
  await page.mouse.move(5, 400);
  await expect.poll(async () => (await labelIds(page)).filter((id) => id.startsWith("triceps_brachii")), { timeout: 20_000 }).toEqual([TRICEPS]);
  expect(await labelText(page, TRICEPS)).toBe("Triceps brachii (left)");
  // No part of any muscle is labelled on its own outside the part level.
  const parts = new Set((softIds as { id: string; kind: string }[]).filter((e) => e.kind === "muscle_part").map((e) => e.id));
  expect((await labelIds(page)).filter((id) => parts.has(id))).toEqual([]);
  expect(errors).toEqual([]);
});

test("triceps at tier 1: the muscle is the focus label and its bones are labelled", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await ready(page, `&sel=${TRICEPS}&tier=1`);
  await expect.poll(async () => labelIds(page), { timeout: 20_000 }).toEqual(expect.arrayContaining([TRICEPS, "scapula_left", "ulna_left"]));
  await expect(page.locator(`[data-label="${TRICEPS}"]`)).toHaveClass(/label-focus/);
  expect((await labelIds(page)).filter((id) => id.startsWith("triceps_brachii_") && id !== TRICEPS)).toEqual([]);
  expect(errors).toEqual([]);
});

test("part level: the long head is labelled, the triceps isn't", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await ready(page, `&sel=${LONG}`);
  await expect.poll(async () => labelIds(page), { timeout: 20_000 }).toContain(LONG);
  await expect(page.locator(`[data-label="${LONG}"]`)).toHaveClass(/label-focus/);
  expect(await labelIds(page)).not.toContain(TRICEPS);
  // Its sibling heads, kept solid, are labelled one by one too.
  expect(await labelIds(page)).toEqual(expect.arrayContaining(["triceps_brachii_lateral_head_left", "triceps_brachii_medial_head_left"]));
  expect(errors).toEqual([]);
});

// Plan risk 1: up to ~1,100 solid instances become candidates. Measured as M5 did (plan step 12 of M5): ?bench, 4× CPU.
for (const where of [
  { name: "every layer on", query: "" },
  { name: "every layer on, triceps tier 2", query: `&sel=${TRICEPS}&tier=2` },
]) {
  test(`?bench with labels on (${where.name}) reports the label layout cost`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => window.localStorage.setItem("skeleton-viewer:labels", "1"));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(`./?lod=low&debug&bench&layers=b:on,c:on,l:on,m:on${where.query}`);
    const debug = page.getByTestId("debug");
    await expect(debug).toHaveAttribute("data-bench-done", "true", { timeout: 200_000 });
    const text = (await page.getByTestId("bench-labels").textContent())!;
    const m = text.match(/^on: (\d+) layouts, median ([\d.]+) ms, max ([\d.]+) ms$/);
    expect(m, text).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(0);
    expect(Number(m![2])).toBeLessThan(16);
    console.log(`bench, labels on, ${where.name}, 4× CPU (SwiftShader):`, text);
  });
}
