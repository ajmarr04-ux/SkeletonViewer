import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Milestone 5 session O, plan step 11: axe-core (WCAG 2.0 / 2.1 / 2.2 A and AA
// rules) on every state of the UI the plan lists. Zero violations.
//
// No rule is disabled. axe can't see inside the WebGL canvas; what it checks
// there is the canvas element's accessible name and role. The 3D view's
// contents are covered by the keyboard pass (Tab cursor, tree as the twin of the
// view) in sidebar.spec.ts and the manual pass written up in the plan.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

async function open(page: Page, query = "", hash = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug${query}${hash}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}

async function axe(page: Page, what: string) {
  // Let transitions finish so colours are read at their final values.
  await page.waitForTimeout(400);
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")}: ${n.failureSummary?.split("\n").slice(1).join(" ").trim()}`),
  }));
  expect(summary, `axe violations: ${what}`).toEqual([]);
  // Sanity: axe really ran over the page.
  expect(result.passes.length, what).toBeGreaterThan(10);
}

test.describe("axe: desktop", () => {
  test("the harness catches a planted violation", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.id = "planted";
      document.body.append(b); // a button with no accessible name
    });
    const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(result.violations.map((v) => v.id)).toContain("button-name");
  });

  test("full skeleton, selected bone, tier 2, group", async ({ page }) => {
    const errors = await open(page);
    await axe(page, "full skeleton");

    await page.evaluate(() => window.__viewer!.select("femur_left"));
    await expect(page.getByTestId("info-panel").getByRole("heading", { level: 2 })).toHaveText("Femur");
    await axe(page, "selected bone, panel open");

    await page.getByTestId("tool-related").click();
    await page.getByTestId("tool-region").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("tier")).toBe("2");
    await axe(page, "tier 2");

    await page.goto("./?lod=low&debug&grp=dentition.type.molars");
    await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
    await expect(page.getByTestId("group-count")).toBeVisible();
    await axe(page, "group (molars)");
    expect(errors).toEqual([]);
  });

  test("sidebar with results and with the tree", async ({ page }) => {
    await open(page, "&sel=femur_left");
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("tree")).toBeVisible();
    await axe(page, "sidebar, tree");
    await page.getByTestId("search-input").fill("rib");
    await expect(page.getByTestId("search-results").getByRole("option").first()).toBeVisible();
    await axe(page, "sidebar, search results");
  });

  test("each toolbar popover open (and More, when used); labels and colour by region on", async ({ page }) => {
    // Tier 1, so Ghost opacity and Explode are in the toolbar too.
    await open(page, "&sel=femur_left&tier=1");
    const bar = page.getByRole("navigation", { name: "View controls" });
    const checked: string[] = [];
    for (const name of ["Views", "Ghost opacity", "Explode", "Layers", "Settings", "More"]) {
      const button = bar.getByRole("button", { name, exact: true });
      if ((await button.count()) === 0) continue; // in "More" at this width, or "More" isn't needed
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await axe(page, `popover: ${name}`);
      checked.push(name);
      await page.keyboard.press("Escape");
      await expect(button).toHaveAttribute("aria-expanded", "false");
    }
    // Every popover was seen, either on its own or inside "More".
    expect(checked).toContain("Views");
    if (!checked.includes("More")) expect(checked).toEqual(["Views", "Ghost opacity", "Explode", "Layers", "Settings"]);

    await page.getByTestId("labels-toggle").click();
    await page.getByTestId("colour-toggle").click();
    await expect(page.getByTestId("legend")).toBeVisible();
    await expect.poll(() => page.locator("[data-label]").count()).toBeGreaterThan(0);
    await axe(page, "labels and colour by region");
  });

  test("the attribution dialog", async ({ page }) => {
    await open(page, "", "#attribution");
    await expect(page.getByTestId("attribution")).toBeVisible();
    await axe(page, "attribution dialog");
  });

  test("the link copied toast", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "&sel=femur_left");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByTestId("toast")).toBeVisible();
    await axe(page, "link copied toast");
  });

  test("the manual share dialog (no clipboard)", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
    await open(page, "&sel=femur_left");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByTestId("share-url")).toBeVisible();
    await axe(page, "manual share dialog");
  });
});

test.describe("axe: phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("sheet at peek, half and full; More menu; search sheet", async ({ page }) => {
    await open(page, "&sel=femur_left");
    const sheet = page.getByTestId("info-panel");
    await expect(sheet).toHaveAttribute("data-snap", "peek");
    await axe(page, "phone, sheet at peek");
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "half");
    await axe(page, "phone, sheet at half");
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "full");
    await axe(page, "phone, sheet at full");
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "peek");

    const more = page.getByRole("button", { name: "More", exact: true });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await axe(page, "phone, More menu");
    await page.keyboard.press("Escape");

    await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("search-input").fill("molar");
    await expect(page.getByTestId("search-results").getByRole("option").first()).toBeVisible();
    await axe(page, "phone, search sheet");
  });
});

// Text contrast measured directly (axe leaves text over translucent or canvas
// backgrounds "incomplete" rather than failing it): every text node inside the
// region against its nearest opaque background. Same method as panel.spec.ts.
async function contrastIn(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const parse = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) =>
      [r!, g!, b!]
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const bgOf = (el: Element): number[] => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const p = getComputedStyle(e).backgroundColor.match(/[\d.]+/g)!.map(Number);
        if (p.length < 4 || p[3]! > 0.9) return p.slice(0, 3);
      }
      return [29, 33, 38];
    };
    const out: { text: string; ratio: number }[] = [];
    for (const el of document.querySelectorAll(`${sel} *`)) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      if ((el as HTMLButtonElement).disabled || el.closest(":disabled")) continue;
      const a = lum(parse(getComputedStyle(el).color));
      const b = lum(bgOf(el));
      out.push({ text: el.textContent!.trim().slice(0, 30), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
    }
    return out;
  }, selector);
}

test.describe("contrast and 200% reflow: sidebar and legend", () => {
  test("sidebar (tree and results) and legend text is at least 4.5:1", async ({ page }) => {
    await open(page, "&sel=femur_left&color=region");
    await expect(page.getByTestId("legend")).toBeVisible();
    const legend = await contrastIn(page, '[data-testid="legend"]');
    expect(legend.length).toBeGreaterThanOrEqual(7);
    for (const r of legend) expect(r.ratio, `legend: ${r.text}`).toBeGreaterThanOrEqual(4.5);

    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("tree")).toBeVisible();
    const tree = await contrastIn(page, '[data-testid="sidebar"]');
    expect(tree.length).toBeGreaterThan(10);
    for (const r of tree) expect(r.ratio, `sidebar: ${r.text}`).toBeGreaterThanOrEqual(4.5);

    await page.getByTestId("search-input").fill("rib");
    await expect(page.getByTestId("search-results").getByRole("option").first()).toBeVisible();
    await page.keyboard.press("ArrowDown"); // a highlighted result too
    const results = await contrastIn(page, '[data-testid="sidebar"]');
    expect(results.length).toBeGreaterThan(5);
    for (const r of results) expect(r.ratio, `results: ${r.text}`).toBeGreaterThanOrEqual(4.5);
  });

  test("reflows at 200% zoom (640 CSS px wide) with the sidebar and the legend", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await open(page, "&color=region");
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("tree")).toBeVisible();
    await page.getByTestId("search-input").fill("metacarpal");
    await expect(page.getByTestId("search-results").getByRole("option").first()).toBeVisible();
    const fit = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
      const sb = document.querySelector('[data-testid="sidebar"]')!;
      const inner = [...sb.querySelectorAll<HTMLElement>("*")].filter((e) => !e.classList.contains("visually-hidden") && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible");
      return {
        page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        sidebarScrollsSideways: inner.map((e) => e.className),
        sidebar: box('[data-testid="sidebar"]'),
        legend: box('[data-testid="legend"]'),
        width: window.innerWidth,
      };
    });
    expect(fit.page, "no horizontal page scroll").toBe(true);
    expect(fit.sidebarScrollsSideways, "nothing in the sidebar scrolls sideways").toEqual([]);
    expect(fit.sidebar!.x).toBeGreaterThanOrEqual(0);
    expect(fit.sidebar!.x + fit.sidebar!.width).toBeLessThanOrEqual(fit.width);
    // The legend stays on screen and clear of the toolbar.
    const bar = (await page.getByRole("navigation", { name: "View controls" }).boundingBox())!;
    const lg = fit.legend!;
    expect(lg.x).toBeGreaterThanOrEqual(0);
    expect(lg.x + lg.width).toBeLessThanOrEqual(fit.width);
    const overlaps = lg.x < bar.x + bar.width && bar.x < lg.x + lg.width && lg.y < bar.y + bar.height && bar.y < lg.y + lg.height;
    expect(overlaps, "legend clear of the toolbar").toBe(false);
    await page.screenshot({ path: "test-results/sidebar-legend-200pct.png" });
  });
});

test.describe("axe: M7 session U", () => {
  test("a ligament's placeholder panel and the hidden chip", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await open(page, "&sel=inguinal_ligament_left");
    await expect(page.getByTestId("info-panel")).toHaveAttribute("data-id", "inguinal_ligament_left", { timeout: 120_000 });
    await axe(page, "ligament placeholder panel");
    await page.getByTestId("panel-hide").click();
    await expect(page.getByTestId("show-all-hidden")).toBeVisible();
    await axe(page, "hidden chip");
    expect(errors).toEqual([]);
  });
});
