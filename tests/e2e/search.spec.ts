import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3100";

const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
// Dates are computed at run time so the URL is always valid, whatever day the suite runs.
const SEARCH = `/search?region=2011&name=Paris&in=${iso(30)}&out=${iso(32)}&rooms=2`;

async function cookie(context: BrowserContext, name: string, value: string) {
  await context.addCookies([{ name, value, url: BASE }]);
}

test.describe("with a passport country", () => {
  test.beforeEach(async ({ context }) => {
    await cookie(context, "residency", "us");
  });

  test("lists hotels with all-in prices, no urgency and no strike-throughs", async ({ page }) => {
    await page.goto(SEARCH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hotels in Paris");
    const cards = page.getByRole("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(1);
    await expect(cards.first().getByText(/for 2 nights, taxes and fees included/)).toBeVisible();
    await expect(cards.first().getByRole("link")).toHaveAttribute("href", new RegExp(`^/hotel/\\d+\\?in=${iso(30)}&out=${iso(32)}&rooms=2$`));
    await expect(page.getByText(/\bleft\b/i)).toHaveCount(0);
    await expect(page.locator('s, del, strike, [class*="line-through"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("shows a designed state for hotels without photos, and omits missing stars and ratings", async ({ page }) => {
    await page.goto(SEARCH);
    await expect(page.getByText("Photo not available").first()).toBeVisible();
    await expect(page.getByRole("article").locator("img").first()).toHaveAttribute("alt", /.+/);
    // No hotel in the fixture has a review rating, so no card may show one (and none may show a bare 0).
    await expect(page.getByRole("article").getByText("guest rating")).toHaveCount(0);
    await expect(page.getByRole("article").getByText(/^0(\.0)?$/)).toHaveCount(0);
  });

  test("never sends net price or markup to the browser", async ({ page, context }) => {
    const response = await page.goto(SEARCH);
    await expect(page.getByRole("article").first()).toBeVisible();
    const html = await page.content();
    const raw = await response!.text();
    const rsc = await (await context.request.get(`${BASE}${SEARCH}`, { headers: { RSC: "1" } })).text();
    for (const body of [html, raw, rsc]) {
      expect(body).not.toContain("markupPercent");
      expect(body).not.toContain('"net"');
    }
  });

  test("sorting by price orders the list lowest first", async ({ page }) => {
    await page.goto(`${SEARCH}&sort=price`);
    await expect(page.getByRole("article").first()).toBeVisible();
    const prices = (await page.getByRole("article").locator("p.text-2xl").allTextContents()).map((t) => Number(t.replace(/[^0-9.]/g, "")));
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("filters apply from the form, and clearing them restores the list", async ({ page }) => {
    await page.goto(SEARCH);
    await expect(page.getByRole("article").first()).toBeVisible();
    await page.getByLabel("Highest total price (USD)").fill("1");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/max=1/);
    await expect(page.getByRole("heading", { name: "No hotels match these filters." })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).first().click();
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page).not.toHaveURL(/max=/);
  });

  test("shows a skeleton as tall as a card while prices load", async ({ page, context }) => {
    await cookie(context, "etg_fixture_delay", "1500");
    await page.goto(SEARCH, { waitUntil: "commit" });
    // The page shell has a skeleton of its own; wait for the real header so we measure the results' skeleton.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hotels in Paris");
    const skeleton = page.getByTestId("results-skeleton").locator("li").first();
    await expect(skeleton).toBeVisible();
    const skeletonHeight = (await skeleton.boundingBox())!.height;
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 10_000 });
    expect((await page.getByRole("article").first().boundingBox())!.height).toBeCloseTo(skeletonHeight, 0);
  });

  test("a retryable failure offers to try again", async ({ page, context }) => {
    await cookie(context, "etg_fixture_fail", "serp");
    await page.goto(SEARCH);
    await expect(page.getByText("Prices are taking longer than usual.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", SEARCH);
    await expect(page.getByRole("article")).toHaveCount(0);
    // Once the cause is gone, trying again brings the list back.
    await context.clearCookies({ name: "etg_fixture_fail" });
    await page.getByRole("link", { name: "Try again" }).click();
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("a fatal failure says so and still offers to try again", async ({ page, context }) => {
    await cookie(context, "etg_fixture_fail", "serp-fatal");
    await page.goto(SEARCH);
    await expect(page.getByText("We could not load prices for this search.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
  });

  test("an empty search says no hotels are available for these dates", async ({ page, context }) => {
    await cookie(context, "etg_fixture_fail", "serp-empty");
    await page.goto(SEARCH);
    await expect(page.getByRole("heading", { name: "No hotels are available for these dates." })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(0);
  });

  test("an invalid URL names the problem and shows the form, pre-filled", async ({ page }) => {
    await page.goto(`/search?region=2011&name=Paris&in=${iso(30)}&out=${iso(32)}`);
    const alert = page.getByRole("alert").filter({ hasText: "Choose guests and rooms." });
    await expect(alert).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Destination" })).toHaveValue("Paris");
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("has no accessibility violations: results, failure and invalid URL", async ({ page, context }) => {
    const scan = async () => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(SEARCH);
    await expect(page.getByRole("article").first()).toBeVisible();
    await scan();
    await page.goto(`${SEARCH}&max=1`);
    await expect(page.getByText("No hotels match these filters.")).toBeVisible();
    await scan();
    await page.goto(`/search?region=2011`);
    await expect(page.getByRole("alert").filter({ hasText: "We could not use this search" })).toBeVisible();
    await scan();
    await cookie(context, "etg_fixture_fail", "serp");
    await page.goto(SEARCH);
    await expect(page.getByText("Prices are taking longer than usual.")).toBeVisible();
    await scan();
    await cookie(context, "etg_fixture_fail", "serp-empty");
    await page.goto(SEARCH);
    await expect(page.getByText("No hotels are available for these dates.")).toBeVisible();
    await scan();
  });
});

test("without a passport country the search returns home, pre-filled", async ({ page }) => {
  await page.goto(SEARCH);
  await page.waitForURL((u) => u.pathname === "/");
  expect(new URL(page.url()).searchParams.get("region")).toBe("2011");
  await expect(page.getByRole("combobox", { name: "Destination" })).toHaveValue("Paris");
  await expect(page.getByRole("button", { name: /Check-in and check-out/ })).toContainText("2 nights");
});

test("without a passport country and without JavaScript, the visitor still lands on home, pre-filled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${BASE}${SEARCH}`);
  // Before the refresh the page shows only a loading skeleton; the meta refresh then takes the visitor home.
  await page.waitForURL((u) => u.pathname === "/", { timeout: 10_000 });
  expect(new URL(page.url()).searchParams.get("rooms")).toBe("2");
  await expect(page.locator("#destination-input")).toHaveValue("Paris");
  await context.close();
});
