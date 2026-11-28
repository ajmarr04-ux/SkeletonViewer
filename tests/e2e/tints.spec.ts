import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M9 session AG: origin and insertion patches, the antagonist toggle, tints
// and legend chips (spec §5.2–5.3, §7; plan decisions 6–8).

const MESHES = (layer: string) => (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === layer && e.meshAvailable).length;
const LONG = "triceps_brachii_long_head_left";

async function ready(page: Page, query: string, layers: string[] = ["muscles"]) {
  await page.goto(`./?lod=low&debug&${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  for (const l of layers)
    await expect(page.getByTestId("layers-report").locator(`[data-layer=${l}]`)).toHaveAttribute("data-nodes", String(MESHES(l)), { timeout: 120_000 });
}

const debug = (page: Page) => page.getByTestId("debug");
const panel = (page: Page) => page.getByTestId("info-panel");
const solid = (page: Page, ids: string[]) =>
  page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);
const chips = (page: Page) => page.getByTestId("legend-key").locator(".legend-chip");

test("long head of triceps, tier 1: origin patch on the scapula, insertion patch on the ulna, legend chips", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,m:on");
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  // Tier 0: no patches, and the legend shows only the two layers.
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "");
  await expect(chips(page)).toHaveText(["Bone", "Muscles"]);

  await panel(page).getByTestId("show-related").click();
  await expect(page).toHaveURL(/tier=1/);
  // The patch file loads now (the first muscle at tier 1); then exactly the content's patches are drawn.
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "triceps_brachii_long_head_left__origin", { timeout: 60_000 });
  await expect(debug(page)).toHaveAttribute("data-patches-insertion", "triceps_brachii_left__insertion");
  // The bones themselves keep their colour (the patches mark the areas) and stay drawn.
  await expect(debug(page)).toHaveAttribute("data-tint-origin", "");
  expect(await solid(page, ["scapula_left", "ulna_left"])).toEqual({ scapula_left: true, ulna_left: true });
  await expect(chips(page)).toHaveText(["Bone", "Muscles", "Origin", "Insertion"]);
  // M14 BX: each tint chip shows its pattern; the layer chips have none.
  await expect(chips(page).locator("svg")).toHaveCount(2);
  expect(await chips(page).locator("svg").evaluateAll((els) => els.map((e) => e.getAttribute("data-pattern")))).toEqual(["stripes", "dots"]);

  // Back to tier 0: the patches and their chips go.
  await page.evaluate(() => window.__viewer!.back());
  await expect(page).not.toHaveURL(/tier=/);
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "");
  await expect(chips(page)).toHaveText(["Bone", "Muscles"]);
});

test("biceps, tier 1 with cartilage on: the glenoid labrum (no patch) is tinted whole in the origin colour", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,c:on,m:on", ["muscles", "cartilage"]);
  await page.evaluate(() => window.__viewer!.select("biceps_brachii_left"));
  await panel(page).getByTestId("show-related").click();
  await expect(debug(page)).toHaveAttribute("data-tint-origin", "glenoid_labrum_left", { timeout: 30_000 });
  await expect(debug(page)).toHaveAttribute("data-patches-insertion", "biceps_brachii_left__insertion", { timeout: 60_000 });
});

test("antagonist toggle at tier 2: off by default, ant=1 in the URL, tint and chip; gone below tier 2", async ({ page }) => {
  test.setTimeout(240_000);
  await ready(page, "layers=b:on,c:on,l:on,m:on", ["muscles", "ligaments", "cartilage"]);
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await panel(page).getByTestId("show-related").click();
  await expect(panel(page).getByTestId("show-antagonists")).toHaveCount(0);
  await panel(page).getByTestId("expand-region").click();
  await expect(page).toHaveURL(/tier=2/);
  const toggle = panel(page).getByTestId("show-antagonists");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", "");
  expect(await solid(page, ["brachialis_left"])).toEqual({ brachialis_left: false });

  const length = await page.evaluate(() => history.length);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tier=2&ant=1/);
  expect(await page.evaluate(() => history.length)).toBe(length); // a toggle, not a history step
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", /(^|,)brachialis_left(,|$)/);
  expect(await solid(page, ["brachialis_left"])).toEqual({ brachialis_left: true });
  await expect(chips(page).last()).toHaveText("Antagonist");
  // Every layer on, a selection, patches, outlines and antagonists: still under 20 draw calls (spec §8).
  await expect.poll(async () => Number(await debug(page).getAttribute("data-draw-calls")), { timeout: 10_000 }).toBeGreaterThan(0);
  expect(Number(await debug(page).getAttribute("data-draw-calls"))).toBeLessThan(20);

  await toggle.click();
  await expect(page).not.toHaveURL(/ant=1/);
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", "");
  await toggle.click();
  await expect(page).toHaveURL(/ant=1/);
  // Back to tier 1: the toggle and ant=1 go.
  await page.evaluate(() => window.__viewer!.back());
  await expect(page).toHaveURL(/tier=1/);
  await expect(page).not.toHaveURL(/ant=1/);
  await expect(panel(page).getByTestId("show-antagonists")).toHaveCount(0);
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", "");
  // Forward again: the tier-2 entry still says ant=1, so the antagonists come back with it.
  await page.goForward();
  await expect(page).toHaveURL(/tier=2&ant=1/);
  await expect(panel(page).getByTestId("show-antagonists")).toHaveAttribute("aria-pressed", "true");
});

test("ant=1 round trip: a link opens at the muscle's tier 2 with its antagonists shown", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, `layers=b:on,m:on&sel=${LONG}&tier=2&ant=1`);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  await expect(page).toHaveURL(/tier=2&ant=1/);
  await expect(panel(page).getByTestId("show-antagonists")).toHaveAttribute("aria-pressed", "true");
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", /(^|,)brachialis_left(,|$)/, { timeout: 30_000 });
  // At tier 1 the link's ant=1 is dropped.
  await page.goto(`./?lod=low&debug&layers=b:on,m:on&sel=${LONG}&tier=1&ant=1`);
  await expect(panel(page)).toHaveAttribute("data-id", LONG, { timeout: 120_000 });
  await expect(page).not.toHaveURL(/ant=1/);
});

// M10 session AL (plan decision 3): the tints are Okabe–Ito colours like the
// regions (an origin patch on an upper-limb bone would be yellow on yellow), so
// colour-by-region pauses while any tint or patch is drawn, and the legend says so.
test("colour-by-region pauses while a muscle's tints are shown, and comes back after", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, "layers=b:on,m:on&color=region");
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await page.evaluate((id) => window.__viewer!.select(id), LONG);
  await expect(panel(page)).toHaveAttribute("data-id", LONG);
  // Tier 0: no tints, so the regions stay (the muscle sits beside region-coloured bones).
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await expect(page.getByTestId("legend-paused")).toHaveCount(0);

  await panel(page).getByTestId("show-related").click();
  await expect(debug(page)).toHaveAttribute("data-patches-origin", "triceps_brachii_long_head_left__origin", { timeout: 60_000 });
  await expect(debug(page)).toHaveAttribute("data-colour", "bone");
  await expect(page.getByTestId("legend-paused")).toBeVisible();
  await expect(page.getByRole("region", { name: "Colour key: regions" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("colour-toggle")).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => window.__viewer!.back());
  await expect(page).not.toHaveURL(/tier=/);
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await expect(page.getByTestId("legend-paused")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Colour key: regions" }).getByRole("button")).toHaveCount(8);
});

// M14 BX (plan decision 8): the pattern cue. Within a small square on a tinted
// structure, neighbouring pixels jump between two shades (the pattern's marks
// are 25 % darker); on the untinted focus they don't.
async function shadeJumps(page: Page, ids: string[], want: (picked: string | null) => boolean): Promise<{ picked: string; jumps: number }> {
  // The first structure and view where the structure's centre is what a click there would pick (not covered).
  let p: { x: number; y: number } | null = null;
  let picked: string | null = null;
  search: for (const id of ids)
    for (const from of ["anterior", "left", "right", "posterior"] as const) {
      await page.evaluate(({ x, f }) => window.__viewer!.frameBone(x, f), { x: id, f: from });
      await page.waitForTimeout(300);
      p = await page.evaluate((x) => window.__viewer!.bone(x)!.client, id);
      picked = await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), p);
      if (want(picked)) break search;
      p = null;
    }
  if (!p || !picked) throw new Error(`no uncovered point on ${ids.join(", ")}`);
  const png = await page.screenshot({ clip: { x: p.x - 12, y: p.y - 12, width: 24, height: 24 } });
  const jumps = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const lum = (i: number) => 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]! + 1;
    let n = 0;
    let big = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x + 1 < c.width; x++) {
        const a = lum((y * c.width + x) * 4);
        const b = lum((y * c.width + x + 1) * 4);
        n++;
        if (Math.min(a, b) / Math.max(a, b) < 0.88) big++;
      }
    return big / n;
  }, png.toString("base64"));
  return { picked, jumps };
}

test("the tints carry their pattern: cross-hatch on an antagonist, two shades on screen; none on the focus", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, `layers=b:on,m:on&sel=${LONG}&tier=2&ant=1`);
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", /(^|,)brachialis_left(,|$)/, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__viewer!.instancePattern("brachialis_left"))).toBe("hatch");
  expect(await page.evaluate((id) => window.__viewer!.instancePattern(id), LONG)).toBe("none");
  await expect(page.getByTestId("legend-key").locator("[data-key=tint-antagonist] svg")).toHaveAttribute("data-pattern", "hatch");

  const antagonists = ((await debug(page).getAttribute("data-tint-antagonist")) ?? "").split(",");
  const tinted = await shadeJumps(page, antagonists, (x) => x !== null && antagonists.includes(x));
  expect(await page.evaluate((id) => window.__viewer!.instancePattern(id), tinted.picked)).toBe("hatch");
  expect(tinted.jumps).toBeGreaterThan(0.15);
  const focus = await shadeJumps(page, [LONG], (x) => x === LONG);
  expect(focus.jumps).toBeLessThan(0.05);
  console.log(`BX pattern sample: ${tinted.picked} ${tinted.jumps.toFixed(3)}, focus ${focus.jumps.toFixed(3)}`);
});

test("the screenshot's legend shows the key with each tint's pattern", async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page, `layers=b:on,m:on&sel=${LONG}&tier=2&ant=1`);
  await expect(debug(page)).toHaveAttribute("data-tint-antagonist", /(^|,)brachialis_left(,|$)/, { timeout: 30_000 });
  await expect(chips(page)).toHaveText(["Bone", "Muscles", "Origin", "Insertion", "Antagonist"], { timeout: 60_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("screenshot").click()]);
  const png = readFileSync((await download.path())!);
  // The legend is drawn bottom left: in it, the antagonist's pink and the pattern's darker pink (25 % darker in linear light) both appear.
  const found = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, c.height - 200, 220, 200).data;
    const k = Math.pow(0.75, 1 / 2.2);
    const pink = [0xcc, 0x79, 0xa7];
    const dark = pink.map((v) => Math.round(v * k));
    const near = (i: number, t: number[]) => Math.abs(d[i]! - t[0]!) + Math.abs(d[i + 1]! - t[1]!) + Math.abs(d[i + 2]! - t[2]!) < 12;
    let base = 0;
    let marks = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (near(i, pink)) base++;
      else if (near(i, dark)) marks++;
    }
    return { base, marks };
  }, png.toString("base64"));
  expect(found.base).toBeGreaterThan(20);
  expect(found.marks).toBeGreaterThan(20);
});

// M14 BY (plan decision 9): context dimming. A bone at tier 1 with the muscles
// on: its related muscles (another layer) are drawn less saturated, at the
// same brightness; colour-by-region switches the dimming off.
test("context dimming: a femur's tier-1 muscles are drawn desaturated; off with colour-by-region", async ({ page }) => {
  test.setTimeout(180_000);
  const MUSCLE = "vastus_lateralis_left";
  await ready(page, "layers=b:on,m:on&sel=femur_left&tier=1");
  await expect(debug(page)).toHaveAttribute("data-dimmed", new RegExp(`(^|,)${MUSCLE}(,|$)`), { timeout: 30_000 });
  // The focus layer (bones) never dims; the dimmed colour carries no pattern.
  expect(((await debug(page).getAttribute("data-dimmed")) ?? "").split(",").some((id) => id === "femur_left" || id === "tibia_left")).toBe(false);
  expect(await page.evaluate((id) => window.__viewer!.instancePattern(id), MUSCLE)).toBe("none");

  let p: { x: number; y: number } | null = null;
  for (const from of ["right", "anterior", "left", "posterior"] as const) {
    await page.evaluate(({ x, f }) => window.__viewer!.frameBone(x, f), { x: MUSCLE, f: from });
    await page.waitForTimeout(300);
    const q = await page.evaluate((x) => window.__viewer!.bone(x)!.client, MUSCLE);
    if ((await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y), q)) === MUSCLE) {
      p = q;
      break;
    }
  }
  if (!p) throw new Error(`no uncovered point on ${MUSCLE}`);
  const sample = async () => {
    const png = await page.screenshot({ clip: { x: p!.x - 8, y: p!.y - 8, width: 16, height: 16 } });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sat = 0;
      let lum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b] = [d[i]!, d[i + 1]!, d[i + 2]!];
        const max = Math.max(r, g, b);
        sat += max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
        lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const n = d.length / 4;
      return { sat: sat / n, lum: lum / n };
    }, png.toString("base64"));
  };
  const dimmed = await sample();
  await page.getByTestId("colour-toggle").click();
  await expect(debug(page)).toHaveAttribute("data-colour", "region");
  await expect(debug(page)).toHaveAttribute("data-dimmed", "");
  await page.waitForTimeout(300);
  const full = await sample();
  console.log(`BY dimming sample: saturation ${dimmed.sat.toFixed(3)} dimmed, ${full.sat.toFixed(3)} full; luminance ${dimmed.lum.toFixed(1)}, ${full.lum.toFixed(1)}`);
  expect(dimmed.sat).toBeLessThan(full.sat * 0.85);
  expect(Math.abs(dimmed.lum - full.lum) / full.lum).toBeLessThan(0.15);
});
