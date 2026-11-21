import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import softIds from "../../content/soft-ids.json" with { type: "json" };

// M9 session AH: the info panel's kind-specific sections (spec §7), the bone
// panel's Origins and Insertions links (spec §5.4) and "Show attached muscles"
// (`grp=attached:<bone>`; plan decisions 9 and 10).

const MESHES = (layer: string) => (softIds as { layer: string; meshAvailable: boolean }[]).filter((e) => e.layer === layer && e.meshAvailable).length;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./?lod=low&debug&${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return errors;
}
const musclesLoaded = (page: Page) =>
  expect(page.getByTestId("layers-report").locator("[data-layer=muscles]")).toHaveAttribute("data-nodes", String(MESHES("muscles")), { timeout: 120_000 });

const panel = (page: Page) => page.getByTestId("info-panel");
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);
const solid = (page: Page, ids: string[]) => page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);

async function axe(page: Page, what: string) {
  await page.waitForTimeout(400);
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) }));
  expect(summary, `axe violations: ${what}`).toEqual([]);
}

test("bone panel: Origins and Insertions as links with every layer off; a link selects a part (via its muscle) and turns the muscles on", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await open(page, "sel=femur_left");
  const muscles = page.getByTestId("section-muscles");
  await expect(muscles.getByRole("heading", { level: 3 })).toHaveText("Attached muscles");
  await expect(page.getByTestId("attached-insertions").getByTestId("link-gluteus_maximus_left")).toHaveText("Gluteus maximus", { timeout: 10_000 });
  await expect(page.getByTestId("attached-origins").getByTestId("link-vastus_lateralis_left")).toBeVisible();
  // Nothing from the soft-tissue layers is requested to show the lists (spec §13: layers off = M8).
  expect(param(page, "layers")).toBeNull();

  await page.getByTestId("attached-origins").getByTestId("link-biceps_femoris_short_head_left").click();
  await expect.poll(() => param(page, "sel"), { timeout: 30_000 }).toBe("biceps_femoris_short_head_left");
  await expect(page).toHaveURL(/layers=[^&]*m:on/);
  await expect(panel(page)).toHaveAttribute("data-id", "biceps_femoris_short_head_left");
  await expect(panel(page).getByRole("heading", { level: 2 })).toBeFocused();
  // Chosen from elsewhere, a part goes via its muscle: Back lands on the muscle (which replaced the
  // femur's entry, as any new focus at tier 0 does).
  await page.goBack();
  await expect.poll(() => param(page, "sel")).toBe("biceps_femoris_left");
  expect(errors).toEqual([]);
});

test("hovering an attached muscle highlights it with the bone", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, "sel=femur_left&layers=b:on,m:on");
  await musclesLoaded(page);
  const row = page.getByTestId("attached-insertions").getByTestId("link-gluteus_maximus_left");
  await row.hover();
  await expect(page.getByTestId("debug")).toHaveAttribute("data-joint", "femur_left,gluteus_maximus_left");
  await expect(page.getByTestId("announcer")).toHaveText("Gluteus maximus: insertion on Femur (left), highlighted.");
  await page.mouse.move(5, 5);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-joint", "");
});

test("muscle and part panels: sections in the spec's order, Parts and Part of as links", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, "sel=triceps_brachii_left");
  await expect(panel(page)).toHaveAttribute("data-id", "triceps_brachii_left", { timeout: 30_000 });
  const headings = ["Summary", "Parts", "Origin", "Insertion", "Actions", "Synergists", "Antagonists", "Innervation", "Clinical note"];
  await expect(panel(page).locator(".panel-section > h3")).toHaveText(headings, { timeout: 10_000 });
  await expect(page.getByTestId("section-origin").getByTestId("link-scapula_left")).toContainText("Infraglenoid tubercle · Long head");
  await expect(page.getByTestId("section-insertion").getByTestId("link-ulna_left")).toContainText("Olecranon");
  await expect(page.getByTestId("section-actions")).toContainText("Elbow joint · extension · prime mover");
  await expect(page.getByTestId("section-antagonists").getByTestId("link-biceps_brachii_left")).toBeVisible();
  await expect(page.getByTestId("section-innervation")).toContainText("Radial nerve");
  await axe(page, "muscle panel");

  // A part from the Parts list: the muscle → part step (a push).
  await page.getByTestId("section-parts").getByTestId("link-triceps_brachii_long_head_left").click();
  await expect.poll(() => param(page, "sel")).toBe("triceps_brachii_long_head_left");
  await expect(panel(page).locator(".panel-section > h3")).toHaveText(headings.filter((h) => h !== "Parts"));
  await expect(page.getByTestId("section-insertion")).toContainText("As the whole muscle (Triceps brachii)");
  await expect(page.getByTestId("section-actions").getByRole("heading", { name: "With the whole muscle" })).toBeVisible();
  await expect(page.getByTestId("section-innervation")).toContainText("(as the whole muscle)");
  await axe(page, "part panel");
  // "Part of" in the title is a link: back up to the muscle (a Back step).
  await page.getByTestId("part-of").getByRole("button", { name: "Triceps brachii" }).click();
  await expect.poll(() => param(page, "sel")).toBe("triceps_brachii_left");
});

test("ligament and cartilage panels: Joint, Connects / Attached to (links), Functions, Clinical note", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, "sel=anterior_cruciate_ligament_left");
  await expect(panel(page)).toHaveAttribute("data-id", "anterior_cruciate_ligament_left", { timeout: 30_000 });
  await expect(panel(page).locator(".panel-section > h3")).toHaveText(["Summary", "Joint", "Connects", "Functions", "Clinical note"], { timeout: 10_000 });
  await expect(page.getByTestId("section-joint")).toHaveText(/Knee joint/);
  await axe(page, "ligament panel");
  await page.getByTestId("section-connects").getByTestId("link-tibia_left").click();
  await expect.poll(() => param(page, "sel")).toBe("tibia_left");

  await page.evaluate(() => window.__viewer!.select("lateral_meniscus_left"));
  await expect(panel(page).locator(".panel-section > h3")).toHaveText(["Summary", "Joint", "Attached to", "Functions", "Clinical note"], { timeout: 30_000 });
  await expect(page.getByTestId("section-attached-to").getByTestId("link-tibia_left")).toBeVisible();
});

test("Show attached muscles: grp=attached:femur_left turns the muscles on, Back returns, the link round-trips", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page, "sel=femur_left");
  await page.getByTestId("show-attached").click();
  await expect.poll(() => param(page, "grp")).toBe("attached:femur_left");
  expect(page.url()).toContain("grp=attached:femur_left");
  expect(param(page, "sel")).toBeNull();
  await expect(page).toHaveURL(/layers=[^&]*m:on/);
  await expect(panel(page)).toHaveAttribute("data-group", "attached:femur_left");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Muscles attached to Femur (left)");
  await expect(page.getByTestId("group-count")).toHaveText(/^Group · \d+ muscles and parts$/, { timeout: 30_000 });
  await musclesLoaded(page);
  await expect.poll(() => solid(page, ["femur_left", "gluteus_maximus_left", "biceps_femoris_short_head_left", "brachialis_left", "tibia_left"]), { timeout: 10_000 }).toEqual({
    femur_left: true,
    gluteus_maximus_left: true,
    biceps_femoris_short_head_left: true,
    brachialis_left: false,
    tibia_left: false,
  });
  await expect(page.getByTestId("breadcrumb")).toContainText("Attached muscles");
  await axe(page, "attached-muscles group");

  // Back: the femur at tier 0. Forward: the group again.
  await page.goBack();
  await expect.poll(() => param(page, "sel")).toBe("femur_left");
  expect(param(page, "grp")).toBeNull();
  await page.goForward();
  await expect.poll(() => param(page, "grp")).toBe("attached:femur_left");
  // The breadcrumb's bone crumb selects the bone.
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Femur" }).click();
  await expect.poll(() => param(page, "sel")).toBe("femur_left");

  // The link on its own, with the muscles layer off in it: the layer is turned on.
  await open(page, "grp=attached:femur_left&layers=b:on,m:off");
  await expect(panel(page)).toHaveAttribute("data-group", "attached:femur_left");
  await expect(page).toHaveURL(/layers=[^&]*m:on/);
  await musclesLoaded(page);
  await expect.poll(() => solid(page, ["gluteus_maximus_left"]), { timeout: 10_000 }).toEqual({ gluteus_maximus_left: true });
  // A member from the group's panel is a new focus; Back returns to the group.
  await page.getByTestId("attached-insertions").getByTestId("link-gluteus_maximus_left").click();
  await expect.poll(() => param(page, "sel")).toBe("gluteus_maximus_left");
  await page.goBack();
  await expect.poll(() => param(page, "grp")).toBe("attached:femur_left");
  expect(errors).toEqual([]);
});

test('a tooth: "Show attached muscles" disabled with the reason', async ({ page }) => {
  await open(page, "sel=tooth_11");
  const button = page.getByTestId("show-attached");
  await expect(button).toBeDisabled({ timeout: 10_000 });
  await expect(button).toHaveAttribute("aria-describedby", "attached-reason");
  await expect(page.getByTestId("attached-reason")).toHaveText("Show attached muscles: no muscles attach here.");
});

test("200% reflow (640 CSS px): the muscle panel's sections and the bone's link lists fit", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 640, height: 400 });
  for (const [q, section] of [
    ["sel=triceps_brachii_left", "section-antagonists"],
    ["sel=hip_bone_left", "attached-origins"],
  ] as const) {
    await open(page, q);
    await expect(page.getByTestId(section)).toBeAttached({ timeout: 30_000 });
    const fit = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="info-panel"] .panel-body')!;
      return { page: document.documentElement.scrollWidth <= document.documentElement.clientWidth, panel: p.scrollWidth <= p.clientWidth };
    });
    expect(fit, q).toEqual({ page: true, panel: true });
  }
});
