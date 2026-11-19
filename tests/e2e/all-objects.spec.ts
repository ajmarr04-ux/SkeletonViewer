import { expect, test, type Page } from "@playwright/test";
import ids from "../../content/ids.json" with { type: "json" };

// Milestone 3 exit criterion: every object, the ossicles and teeth included,
// can be selected on a 390 px wide phone (plan step 10). For each of the 234
// objects with a mesh: frame it (as `F` would, without selecting) from the
// current direction or, if something covers it there, from the other preset
// directions; find a point where a tap would pick it (`__viewer.pick`, with the
// touch hit areas); tap there with a real touch; check that it is selected;
// step back. Split into chunks so they run in parallel.

type Entry = { id: string; kind: string; group: string[]; meshAvailable: boolean };
const WITH_MESH = (ids as Entry[]).filter((e) => e.meshAvailable).map((e) => e.id);
const CHUNKS = 4;
const PRESETS = ["anterior", "posterior", "left", "right", "superior", "inferior"] as const;

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.describe.configure({ mode: "parallel" });

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" }); // instant cuts: no easing to wait for
  await page.goto("./?lod=low&debug");
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  // The debug overlay covers part of a phone screen: hide it (its data attributes still work).
  await page.addStyleTag({ content: ".debug { visibility: hidden; }" });
}

/**
 * Frame `ids` from each preset direction in turn (the current one first) and
 * return the first tap point that picks `want`, or null.
 */
async function tapPoint(page: Page, frame: string | string[], want: string, presets: readonly (string | undefined)[]) {
  return page.evaluate(
    async ({ frame, want, presets }) => {
      const v = window.__viewer!;
      const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const p of presets) {
        v.frameBone(frame, p as never);
        await frames();
        const c = v.bone(want)!.client;
        // Spiral out from the projected centre, 4 px steps, up to 200 px: framed
        // close up, a lower tooth is mostly inside the mandible and only its
        // crown, well away from the centre, shows.
        for (let r = 0; r <= 200; r += 4) {
          const n = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 6);
          for (let k = 0; k < n; k++) {
            const x = c.x + r * Math.cos((2 * Math.PI * k) / n);
            const y = c.y + r * Math.sin((2 * Math.PI * k) / n);
            if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue;
            if (document.elementFromPoint(x, y)?.tagName !== "CANVAS") continue;
            if (v.pick(x, y, true) === want) return { x, y, preset: p ?? "current", r };
          }
        }
      }
      return null;
    },
    { frame, want, presets: [...presets] },
  );
}

async function tapAndCheck(page: Page, id: string, at: { x: number; y: number }) {
  await page.touchscreen.tap(at.x, at.y);
  await expect.poll(async () => (await page.evaluate(() => window.__viewer!.state())).sel, { timeout: 5_000, message: id }).toBe(id);
  await page.evaluate(() => window.__viewer!.back());
  await expect.poll(async () => (await page.evaluate(() => window.__viewer!.state())).sel, { timeout: 5_000 }).toBeNull();
  await page.waitForTimeout(350); // past the double-tap window
}

for (let chunk = 0; chunk < CHUNKS; chunk++) {
  const mine = WITH_MESH.filter((_, i) => i % CHUNKS === chunk);
  test(`every object can be tapped on a 390 px phone (${chunk + 1}/${CHUNKS}: ${mine.length} objects)`, async ({ page }) => {
    test.setTimeout(600_000);
    await open(page);
    const failures: string[] = [];
    const views: Record<string, number> = {};
    for (const id of mine) {
      const at = await tapPoint(page, id, id, [undefined, ...PRESETS]);
      if (!at) {
        failures.push(id);
        continue;
      }
      views[at.preset] = (views[at.preset] ?? 0) + 1;
      await tapAndCheck(page, id, at);
    }
    test.info().annotations.push({ type: "views", description: JSON.stringify(views) });
    expect(failures, "objects no tap could pick").toEqual([]);
  });
}

test("teeth at a moderate zoom (the whole skull in view): each can be tapped", async ({ page }) => {
  test.setTimeout(600_000);
  await open(page);
  const skull = (ids as Entry[]).filter((e) => e.meshAvailable && e.group[1] === "skull").map((e) => e.id);
  const teeth = (ids as Entry[]).filter((e) => e.meshAvailable && e.kind === "tooth").map((e) => e.id);
  const failures: string[] = [];
  let viaProxy = 0;
  for (const id of teeth) {
    // Skull framed from the front or the tooth's own side; the camera is not moved closer.
    const at = await tapPoint(page, skull, id, ["anterior", "left", "right", "inferior"]);
    if (!at) {
      failures.push(id);
      continue;
    }
    // Would a plain mouse click (6 px hit area) at that point have missed it? Then the touch proxy did the work.
    if ((await page.evaluate(({ x, y }) => window.__viewer!.pick(x, y, false), at)) !== id) viaProxy++;
    await tapAndCheck(page, id, at);
  }
  test.info().annotations.push({ type: "via-proxy", description: `${viaProxy} of ${teeth.length}` });
  expect(failures).toEqual([]);
});
