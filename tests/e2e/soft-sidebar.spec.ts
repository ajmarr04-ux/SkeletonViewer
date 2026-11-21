import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// M9 session AI: the sidebar's Muscles, Ligaments and Cartilage roots (spec §7;
// plan decision 11), soft groups in `grp=`, and the soft-tissue search with
// group synonyms (decision 12).

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SOFT_TREE = /\/assets\/_virtual_skeleton-soft-tree-/;
const SOFT_SEARCH = /\/assets\/_virtual_skeleton-search-soft-/;

async function open(page: Page, query = "") {
  const errors: string[] = [];
  const chunks: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (SOFT_TREE.test(r.url())) chunks.push("tree");
    if (SOFT_SEARCH.test(r.url())) chunks.push("search");
  });
  await page.goto(`./?lod=low&debug${query}`);
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await page.waitForFunction(() => window.__viewer !== undefined);
  return { errors, chunks };
}
const state = (page: Page) => page.evaluate(() => window.__viewer!.state());
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);
const row = (page: Page, key: string) => page.getByTestId("tree").locator(`[data-key="${key}"]`);
const solid = (page: Page, ids: string[]) => page.evaluate((list) => Object.fromEntries(list.map((id) => [id, window.__viewer!.solidNow(id)])), ids);
const layerShown = (page: Page, layer: string) =>
  expect(page.getByTestId("layers-report").locator(`[data-layer=${layer}]`)).toHaveAttribute("data-nodes", /^[1-9]\d*$/, { timeout: 120_000 });

async function axe(page: Page, what: string) {
  await page.waitForTimeout(300);
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) }));
  expect(summary, `axe violations: ${what}`).toEqual([]);
}

test("tree: Muscles → Upper limb → … → triceps → long head; the soft tree loads only when a root opens", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors, chunks } = await open(page);
  await page.getByTestId("sidebar-toggle").click();
  await expect(row(page, "muscles")).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, "ligaments")).toBeVisible();
  await expect(row(page, "cartilage")).toBeVisible();
  await page.waitForTimeout(500);
  expect(chunks).toEqual([]); // the sidebar alone fetches nothing soft

  await row(page, "muscles").click();
  await expect(row(page, "muscles")).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, "muscles.upper_limb")).toBeVisible();
  expect(chunks).toEqual(["tree"]);
  await expect(row(page, "muscles").locator(".tree-count")).toHaveText(/\(\d+\)/);
  for (const k of ["muscles.upper_limb", "muscles.upper_limb.arm", "muscles.upper_limb.arm.arm_posterior"]) await row(page, k).click();
  const tri = row(page, "triceps_brachii_left");
  await expect(tri).toHaveText(/Triceps brachii \(left\)/);
  await expect(tri).toHaveAttribute("aria-expanded", "false");
  await expect(row(page, "triceps_brachii_right")).toBeVisible();
  await page.getByTestId("expand-triceps_brachii_left").click();
  await expect(tri).toHaveAttribute("aria-expanded", "true");
  const long = row(page, "triceps_brachii_long_head_left");
  await expect(long).toHaveText(/^Long head/);
  await expect(long).toHaveAttribute("aria-level", "6");
  await expect(param(page, "layers")).toBeNull(); // opening the tree turns nothing on

  // A part chosen from the tree is selected exactly (via its muscle in the history), its layer turned on.
  await long.click();
  await expect.poll(async () => (await state(page)).sel, { timeout: 30_000 }).toBe("triceps_brachii_long_head_left");
  await expect(page).toHaveURL(/layers=[^&]*m:on/);
  await expect(long).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect.poll(async () => (await state(page)).sel).toBe("triceps_brachii_left");
  await expect(tri).toHaveAttribute("aria-selected", "true");
  await axe(page, "soft tree open to a part");
  expect(errors).toEqual([]);
});

test("Isolate on a soft group: grp= in the URL, its layer turned on, members solid, Back returns", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors } = await open(page);
  await page.getByTestId("sidebar-toggle").click();
  await row(page, "ligaments").click();
  await expect(row(page, "ligaments.knee_joint_left")).toBeVisible();
  await page.getByTestId("isolate-ligaments.knee_joint_left").click();
  await expect.poll(() => param(page, "grp")).toBe("ligaments.knee_joint_left");
  await expect(page).toHaveURL(/layers=[^&]*l:on/);
  await layerShown(page, "ligaments");
  await expect.poll(() => solid(page, ["anterior_cruciate_ligament_left", "anterior_cruciate_ligament_right", "femur_left"])).toEqual({
    anterior_cruciate_ligament_left: true,
    anterior_cruciate_ligament_right: false,
    femur_left: false,
  });
  await expect(page.getByTestId("breadcrumb")).toContainText("Knee joint (tibiofemoral) (left)");
  await page.goBack();
  await expect.poll(() => param(page, "grp")).toBeNull();
  expect((await state(page)).grp).toBeNull();
  expect(errors).toEqual([]);
});

test("search: ACL selects the ligament; rotator cuff, hamstrings and quadriceps isolate groups", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors, chunks } = await open(page);
  await page.keyboard.press("/");
  const input = page.getByTestId("search-input");
  const results = page.getByTestId("search-results");
  await expect(input).toBeFocused();
  await page.waitForTimeout(300);
  expect(chunks).toEqual([]); // the soft index waits for a keystroke

  await input.fill("ACL");
  const first = results.getByRole("option").first();
  await expect(first.locator(".result-label")).toHaveText(/^Anterior cruciate ligament \((left|right)\)$/, { timeout: 15_000 });
  expect(chunks).toContain("search");
  await input.fill("left ACL");
  await expect(first.locator(".result-label")).toHaveText("Anterior cruciate ligament (left)");
  await expect(first.locator(".result-match").first()).toHaveText("ACL");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state(page)).sel, { timeout: 30_000 }).toBe("anterior_cruciate_ligament_left");
  await expect(page).toHaveURL(/layers=[^&]*l:on/);
  await layerShown(page, "ligaments");

  // Bones still come first for bone words.
  await page.keyboard.press("/");
  await input.fill("femur");
  await expect(first.locator(".result-label")).toHaveText(/^Femur \((left|right)\)$/);

  await input.fill("rotator cuff");
  await expect(first.locator(".result-label")).toHaveText("Rotator cuff");
  await expect(first).toContainText("Group");
  await axe(page, "soft search results");
  await page.keyboard.press("Enter");
  await expect.poll(() => param(page, "grp"), { timeout: 30_000 }).toBe("muscles.upper_limb.shoulder.rotator_cuff");
  expect((await state(page)).sel).toBeNull();
  await expect(page).toHaveURL(/layers=[^&]*m:on/);
  await layerShown(page, "muscles");
  await expect.poll(() => solid(page, ["supraspinatus_left", "subscapularis_right", "deltoid_acromial_part_left"])).toEqual({
    supraspinatus_left: true,
    subscapularis_right: true,
    deltoid_acromial_part_left: false,
  });
  await expect(page.getByTestId("info-panel")).toHaveAttribute("data-group", "muscles.upper_limb.shoulder.rotator_cuff");

  await page.keyboard.press("/");
  await input.fill("hamstrings");
  await expect(first.locator(".result-label")).toHaveText("Posterior compartment of the thigh");
  await expect(first.locator(".result-match").first()).toHaveText("Hamstrings");
  await input.fill("quadriceps");
  await expect(first.locator(".result-label")).toHaveText("Quadriceps femoris");
  await page.keyboard.press("Enter");
  await expect.poll(() => param(page, "grp")).toBe("muscles.sets.quadriceps_femoris");
  await expect.poll(() => solid(page, ["vastus_medialis_left", "rectus_femoris_right", "sartorius_left"])).toEqual({
    vastus_medialis_left: true,
    rectus_femoris_right: true,
    sartorius_left: false,
  });
  // A group after a group replaces it (M5): Back leaves the groups.
  await page.goBack();
  await expect.poll(() => param(page, "grp")).not.toBe("muscles.sets.quadriceps_femoris");
  expect(errors).toEqual([]);
});

test("a grp= link to a soft group, with every layer off, loads the tree and turns the layer on", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors, chunks } = await open(page, "&grp=muscles.back.erector_spinae");
  await expect.poll(async () => (await state(page)).grp, { timeout: 30_000 }).toBe("muscles.back.erector_spinae");
  expect(chunks).toContain("tree");
  await expect(page).toHaveURL(/layers=[^&]*m:on/);
  await expect(page).toHaveURL(/grp=muscles\.back\.erector_spinae/);
  await layerShown(page, "muscles");
  await expect.poll(() => solid(page, ["longissimus_thoracis_left", "trapezius_ascending_part_left"])).toEqual({
    longissimus_thoracis_left: true,
    trapezius_ascending_part_left: false,
  });
  await expect(page.getByTestId("breadcrumb")).toContainText("Erector spinae");
  // The region crumb isolates the region.
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Back", exact: true }).click();
  await expect.poll(() => param(page, "grp")).toBe("muscles.back");

  // An unknown soft key is dropped from the URL.
  await page.goto("./?lod=low&debug&grp=muscles.nowhere");
  await expect(page.getByTestId("debug")).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  await expect.poll(() => param(page, "grp"), { timeout: 15_000 }).toBeNull();
  expect(errors).toEqual([]);
});

test("keyboard pass through the new roots: open, move in, open a muscle's parts, select, isolate", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors } = await open(page);
  await page.getByTestId("sidebar-toggle").click();
  await page.keyboard.press("Tab"); // from the search field into the tree
  await expect(row(page, "axial")).toBeFocused();
  await page.keyboard.press("End");
  await expect(row(page, "cartilage")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(row(page, "muscles")).toBeFocused();
  await page.keyboard.press("ArrowRight"); // opens (and loads the soft tree)
  await expect(row(page, "muscles")).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, "muscles.head")).toBeVisible();
  await page.keyboard.press("ArrowRight"); // into the first child
  await expect(row(page, "muscles.head")).toBeFocused();
  await page.keyboard.type("up"); // type-ahead
  await expect(row(page, "muscles.upper_limb")).toBeFocused();
  const steps: [string, string][] = [
    ["ArrowRight", "muscles.upper_limb"], // opens
    ["ArrowRight", "muscles.upper_limb.shoulder"],
    ["ArrowDown", "muscles.upper_limb.arm"],
    ["ArrowRight", "muscles.upper_limb.arm"],
    ["ArrowRight", "muscles.upper_limb.arm.arm_anterior"],
    ["ArrowDown", "muscles.upper_limb.arm.arm_posterior"],
    ["ArrowRight", "muscles.upper_limb.arm.arm_posterior"],
    ["ArrowRight", "triceps_brachii_left"],
  ];
  for (const [key, at] of steps) {
    await page.keyboard.press(key);
    await expect(row(page, at)).toBeFocused();
  }
  await page.keyboard.press("ArrowRight"); // a muscle with parts opens
  await expect(row(page, "triceps_brachii_left")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowRight");
  await expect(row(page, "triceps_brachii_lateral_head_left")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(row(page, "triceps_brachii_left")).toBeFocused();
  await page.keyboard.press("Enter"); // selects the muscle
  await expect.poll(async () => (await state(page)).sel, { timeout: 30_000 }).toBe("triceps_brachii_left");
  await expect(row(page, "triceps_brachii_left")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft"); // closes its parts
  await expect(row(page, "triceps_brachii_left")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowLeft"); // to the compartment
  await expect(row(page, "muscles.upper_limb.arm.arm_posterior")).toBeFocused();
  await page.keyboard.press("i");
  await expect.poll(() => param(page, "grp")).toBe("muscles.upper_limb.arm.arm_posterior");
  await expect(row(page, "muscles.upper_limb.arm.arm_posterior")).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});
