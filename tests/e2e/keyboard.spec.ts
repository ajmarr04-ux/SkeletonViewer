import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

type Soft = { id: string; layer: string; parent?: string | null; parts?: string[]; meshAvailable: boolean };
const SOFT = new Map((softIds as Soft[]).map((e) => [e.id, e]));

// Milestone 5 session O, plan step 11: the keyboard-only pass, scripted.
// Only page.keyboard is used to drive the app (no clicks, no window.__viewer
// commands); __viewer is read only to check the result.
//
// 1. Every control is reachable with Tab, shows a visible focus indicator, and
//    Tab goes round the whole page and back to the start (no trap, WCAG 2.1.2;
//    the canvas is left with Escape then Tab, as its description says).
// 2. A whole session by keyboard: orbit, pan, zoom, Tab cursor and Enter,
//    Escape, search, tiers, Back, labels, colour, settings, share, screenshot,
//    and the attribution dialog.

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());

type Focused = { name: string; tag: string; ring: boolean };
/** The focused element's accessible-ish name, and whether a focus indicator is drawn. */
const focused = (page: Page): Promise<Focused | null> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const label = el.getAttribute("aria-label");
    const by = el.getAttribute("aria-labelledby");
    const name = (label ?? (by ? document.getElementById(by)?.textContent : null) ?? el.textContent ?? "").trim().replace(/\s+/g, " ");
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1;
    const shadow = cs.boxShadow !== "none";
    return { name: name || el.tagName.toLowerCase(), tag: el.tagName.toLowerCase(), ring: outline || shadow };
  });

/** Tab once; if that lands the Tab cursor inside the canvas, leave it (Escape, then Tab). */
async function tab(page: Page, shift = false) {
  const key = shift ? "Shift+Tab" : "Tab";
  const wasCanvas = (await focused(page))?.tag === "canvas";
  await page.keyboard.press(key);
  if (wasCanvas && (await focused(page))?.tag === "canvas") {
    expect((await state(page)).cursor).not.toBeNull(); // Tab moved the bone cursor
    await page.keyboard.press("Escape");
    expect((await state(page)).cursor).toBeNull();
    await page.keyboard.press(key);
  }
}

/** Tab forward until the focused element's name matches. */
async function tabTo(page: Page, name: string | RegExp) {
  for (let i = 0; i < 120; i++) {
    await tab(page);
    const f = await focused(page);
    if (f && (typeof name === "string" ? f.name === name : name.test(f.name))) return f;
  }
  throw new Error(`never reached ${name}`);
}

test.describe("keyboard only", () => {
  test("every control is reachable, has a visible focus ring, and Tab goes all the way round", async ({ page }) => {
    // Tier 1 with the panel open, so the panel and every toolbar tool are present.
    const errors = await open(page, "&sel=femur_left&tier=1");
    await page.locator("body").focus();
    const seen: Focused[] = [];
    let first: string | null = null;
    for (let i = 0; i < 200; i++) {
      await tab(page);
      const f = await focused(page);
      if (!f) continue; // the browser's own UI, between the end and the start
      const key = `${f.tag}:${f.name}`;
      if (key === first) break;
      first ??= key;
      seen.push(f);
    }
    expect(seen.length, "Tab came back round to the start").toBeLessThan(200);
    for (const f of seen) expect(f.ring, `focus ring on ${f.tag} "${f.name}"`).toBe(true);
    const names = seen.map((f) => f.name);
    for (const n of [
      "Search and browse",
      "Home view",
      "Views",
      "Region", // at tier 1 the isolation button offers the next tier
      "Expand region", // the panel's own button
      "Back",
      "Ghosts",
      "Breadcrumb", // a breadcrumb link (matched below)
      "Collapse the information panel",
    ]) {
      if (n === "Breadcrumb") expect(names.some((x) => x === "Skeleton")).toBe(true);
      else expect(names, n).toContain(n);
    }
    // The rest of the tools: in the bar, or behind "More".
    const tools = ["Ghost opacity", "Explode", "Labels", "Colour by region", "Screenshot", "Share", "Settings"];
    if (names.includes("More")) expect(tools.filter((t) => names.includes(t)).length).toBeLessThan(tools.length);
    else for (const t of tools) expect(names, t).toContain(t);
    expect(seen.some((f) => f.tag === "canvas"), "the 3D view").toBe(true);
    expect(names, "the attribution link").toContain("Attribution");
    expect(errors).toEqual([]);
  });

  test("a whole session by keyboard", async ({ page }) => {
    const errors = await open(page);
    await page.locator("body").focus();

    // The 3D view: orbit, pan and zoom by keys.
    await tabTo(page, /^3D skeleton/);
    const cam = () => new URL(page.url()).searchParams.get("cam");
    const cam0 = cam();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Shift+ArrowUp");
    await page.keyboard.press("+");
    await expect.poll(cam).not.toBe(cam0);

    // Tab cursor, Enter selects; Escape goes back.
    await page.keyboard.press("Tab");
    const cursor = (await state(page)).cursor;
    expect(cursor).not.toBeNull();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe(cursor);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).sel).toBeNull();

    // "/" opens search; Enter chooses the first result.
    await page.keyboard.press("/");
    await expect(page.getByTestId("search-input")).toBeFocused();
    await page.keyboard.type("femur left");
    // The first keystroke also fetches the soft index (M9); allow for it under load.
    await expect(page.getByTestId("search-results").getByRole("option").first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("femur_left");
    await expect(page.getByTestId("info-panel").getByRole("heading", { level: 2 })).toHaveText("Femur");

    // Tiers from the toolbar, then Back ×2 by Escape from the canvas.
    await tabTo(page, "Related");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).tier).toBe(1);
    await tabTo(page, "Region");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).tier).toBe(2);
    await tabTo(page, /^3D skeleton/);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).tier).toBe(1);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).tier).toBe(0);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await state(page)).sel).toBeNull();

    // Labels and colour by region (toggle buttons; Space and Enter both work).
    await tabTo(page, "Labels");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("labels-toggle")).toHaveAttribute("aria-pressed", "true");
    await tabTo(page, "Colour by region");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("legend")).toBeVisible();

    // Settings: opens, Escape closes it and focus goes back to its button.
    await tabTo(page, "Settings");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
    expect((await focused(page))?.name).toBe("Settings");

    // Screenshot downloads a PNG; Share copies the link.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("body").focus();
    await tabTo(page, "Screenshot");
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(download.suggestedFilename()).toMatch(/^skeleton.*\.png$/);
    await tabTo(page, "Share");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("toast")).toContainText("Link copied");

    // The attribution dialog: opens from its link, Escape closes it, focus returns.
    await tabTo(page, "Attribution");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("attribution")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("attribution")).toBeHidden();
    expect((await focused(page))?.name).toBe("Attribution");
    expect(errors).toEqual([]);
  });

  test("M7: the Layers panel, Hide and Show all by keyboard", async ({ page }) => {
    // Loads the muscles layer under SwiftShader: about 60 s alone, more beside other workers (as in layers.spec.ts).
    test.setTimeout(180_000);
    const errors = await open(page);
    await page.locator("body").focus();
    // Layers: Enter opens it; Tab reaches the muscles' radio group; the arrows choose Ghost, then On.
    await tabTo(page, "Layers");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("layers-panel")).toBeVisible();
    const rowOfFocus = () => page.evaluate(() => (document.activeElement?.closest(".layer-row") as HTMLElement | null)?.dataset.layer ?? null);
    for (let i = 0; i < 12 && (await rowOfFocus()) !== "muscles"; i++) await page.keyboard.press("Tab");
    expect(await rowOfFocus()).toBe("muscles");
    expect((await focused(page))?.ring, "focus ring on the radio").toBe(true);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:ghost/);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:on/);
    await expect(page.locator(".layer-row[data-layer=muscles]")).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layers-panel")).toHaveCount(0);
    expect((await focused(page))?.name).toBe("Layers");

    // Select a bone by search, hide it with X from the canvas, then Show all from the chip.
    await page.keyboard.press("/");
    await page.keyboard.type("femur left");
    // The first keystroke also fetches the soft index (M9); allow for it under load.
    await expect(page.getByTestId("search-results").getByRole("option").first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("femur_left");
    await tabTo(page, /^3D skeleton/);
    await page.keyboard.press("x");
    await expect.poll(async () => (await state(page)).sel).toBeNull();
    await expect(page).toHaveURL(/hid=femur_left/);
    await page.locator("body").focus();
    const chip = await tabTo(page, /hidden · Show all$/);
    expect(chip.ring).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/hid=/);
    await expect(page.getByTestId("show-all-hidden")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test("M10: the M9 journey by keys only (decision 5)", async ({ page }) => {
    // The muscles load under SwiftShader (60–120 s), then the content chunk.
    test.setTimeout(420_000);
    const errors = await open(page);
    await page.locator("body").focus();
    // Open Layers and turn the muscles on.
    await tabTo(page, "Layers");
    await page.keyboard.press("Enter");
    const rowOfFocus = () => page.evaluate(() => (document.activeElement?.closest(".layer-row") as HTMLElement | null)?.dataset.layer ?? null);
    for (let i = 0; i < 12 && (await rowOfFocus()) !== "muscles"; i++) await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/layers=b:on,c:off,l:off,m:on/);
    await expect(page.locator(".layer-row[data-layer=muscles]")).toHaveAttribute("data-status", "ready", { timeout: 120_000 });
    await page.keyboard.press("Escape");

    // Reach the triceps through search; Enter selects it.
    await page.keyboard.press("/");
    await page.keyboard.type("left triceps brachii");
    await expect(page.getByTestId("search-results").getByRole("option").first()).toHaveText(/Triceps brachii \(left\)/, { timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("triceps_brachii_left");

    // Its long head: the Tab cursor walks the triceps' parts now; Enter selects the part.
    await tabTo(page, /^3D skeleton/);
    const stops: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const c = (await state(page)).cursor;
      if (c === null) break;
      stops.push(c);
      if (c === "triceps_brachii_long_head_left") break;
    }
    expect(stops.every((c) => c.startsWith("triceps_brachii_") && c.endsWith("_head_left")), stops.join()).toBe(true);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).sel).toBe("triceps_brachii_long_head_left");

    // R: Show attachments; E: Show functional group (once the muscles' content has loaded).
    await expect(page.getByTestId("show-related")).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByTestId("show-related")).toHaveAttribute("aria-keyshortcuts", "R");
    await page.keyboard.press("r");
    await expect.poll(async () => (await state(page)).tier).toBe(1);
    await page.keyboard.press("e");
    await expect.poll(async () => (await state(page)).tier).toBe(2);

    // The antagonist toggle, by Tab and Enter.
    await tabTo(page, "Show antagonists");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("show-antagonists")).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/ant=1/);

    // Back ×4 by Escape from the canvas: tier 1, the part, the muscle, the full skeleton.
    await tabTo(page, /^3D skeleton/);
    for (const want of [
      { sel: "triceps_brachii_long_head_left", tier: 1 },
      { sel: "triceps_brachii_long_head_left", tier: 0 },
      { sel: "triceps_brachii_left", tier: 0 },
      { sel: null, tier: 0 },
    ]) {
      await page.keyboard.press("Escape");
      await expect.poll(async () => ({ sel: (await state(page)).sel, tier: (await state(page)).tier })).toEqual(want);
    }
    expect(errors).toEqual([]);
  });

  test("M10: the Tab cursor across layers; X hides its structure, Shift+X shows all", async ({ page }) => {
    test.setTimeout(420_000);
    const errors = await open(page, "&layers=b:on,c:off,l:on,m:on");
    for (const l of ["ligaments", "muscles"])
      await expect(page.locator(`[data-testid=layers-report] [data-layer=${l}]`)).toHaveAttribute("data-nodes", /^[1-9]\d*$/, { timeout: 120_000 });
    await page.locator("body").focus();
    await tabTo(page, /^3D skeleton/);
    // The first stops are bones (layer order: bones, cartilage, ligaments, muscles).
    await page.keyboard.press("Tab");
    const first = (await state(page)).cursor!;
    await page.keyboard.press("Tab");
    const second = (await state(page)).cursor!;
    expect(SOFT.has(first) || SOFT.has(second)).toBe(false);
    await page.keyboard.press("Shift+Tab");
    expect((await state(page)).cursor).toBe(first);
    // X hides the cursor's bone (nothing selected stays so), and the next Tab goes on to the following stop.
    await page.keyboard.press("x");
    await expect(page).toHaveURL(new RegExp(`hid=${first}(&|$)`));
    expect((await state(page)).sel).toBeNull();
    await expect(page.getByTestId("announcer")).toHaveText(/, hidden\. 1 hidden\.$/);
    await page.keyboard.press("Tab");
    expect((await state(page)).cursor).toBe(second);
    // Leave the view, come back, Shift+Tab: the last stop is a muscle, as one stop, never one of its parts.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await focused(page))?.tag).toBe("canvas");
    await page.keyboard.press("Shift+Tab");
    const last = (await state(page)).cursor!;
    expect(SOFT.get(last)?.layer).toBe("muscles");
    expect(SOFT.get(last)?.parent ?? null).toBeNull();
    // X on it hides it (a muscle with parts: all its parts); Shift+X shows everything again.
    await page.keyboard.press("x");
    const hid = () => (new URL(page.url()).searchParams.get("hid") ?? "").split(",").filter(Boolean);
    const want = (SOFT.get(last)?.parts ?? [last]).filter((p) => SOFT.get(p)?.meshAvailable);
    await expect.poll(hid).toEqual(expect.arrayContaining([first, ...want]));
    await page.keyboard.press("Shift+X");
    await expect(page).not.toHaveURL(/hid=/);
    await expect(page.getByTestId("announcer")).toHaveText("All hidden structures shown.");
    expect(errors).toEqual([]);
  });
});
