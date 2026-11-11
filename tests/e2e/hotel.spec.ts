import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE = "http://localhost:3100";
const HID = 10004834;
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
// Dates are computed at run time so the URL is always valid, whatever day the suite runs.
const STAY = `in=${iso(30)}&out=${iso(32)}&rooms=2`;
const HOTEL = `/hotel/${HID}?${STAY}`;
const DATES = /Check-in and check-out/;

async function cookie(context: BrowserContext, name: string, value: string) {
  await context.addCookies([{ name, value, url: BASE }]);
}

// Each test counts its own reads, so tests running at the same time do not disturb each other.
test.beforeEach(async ({ context }) => {
  await cookie(context, "etg_fixture_tag", `t-${randomUUID()}`);
});

/** How many times the server has read the hotel-page rates for this test (fixture mode counter). */
async function reads(context: BrowserContext): Promise<number> {
  const tag = (await context.cookies()).find((c) => c.name === "etg_fixture_tag")!.value;
  const res = await context.request.get(`${BASE}/api/fixture-reads?tag=${tag}`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { hotelPage: number }).hotelPage;
}

const rows = (page: Page) => page.getByRole("list", { name: /Rooms and prices/ }).locator(":scope > li");

test.describe("with a passport country", () => {
  test.beforeEach(async ({ context }) => {
    await cookie(context, "residency", "us");
  });

  test("shows the hotel, its rates with all-in prices and cancellation sentences, and its policies", async ({ page }) => {
    await page.goto(HOTEL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conrad Los Angeles");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page).toHaveTitle("Conrad Los Angeles");
    await expect(page.getByText("5-star hotel")).toBeAttached();

    await expect(rows(page).first()).toBeVisible();
    expect(await rows(page).count()).toBe(18);
    const first = rows(page).first();
    await expect(first.getByRole("heading", { level: 3 })).toHaveText(/Standard Double room/);
    await expect(first.getByText(/^\$\d[\d,]*\.\d\d$/)).toBeVisible();
    await expect(first.getByText(/for 2 nights, taxes and fees charged at booking included/)).toBeVisible();
    // Both fixture hotels have taxes paid at the hotel: shown beside the price, never added into it.
    await expect(first.getByText(/^\+ \$[\d.]+ .+ at the hotel$/).first()).toBeVisible();
    await expect(first.getByText("Pay now", { exact: true })).toBeVisible();
    await expect(first.getByText("No meals included")).toBeVisible();
    await expect(first.getByText(/Bedding: full double bed/)).toBeVisible();

    // Every row has a cancellation sentence, and the control is present but disabled.
    const count = await rows(page).count();
    for (let i = 0; i < count; i++) {
      const text = (await rows(page).nth(i).locator("p", { hasText: /^Cancellation:/ }).textContent()) ?? "";
      expect(text.replace("Cancellation:", "").trim()).toMatch(/.+\.$/);
    }
    await expect(page.getByRole("button", { name: "Booking opens soon" })).toHaveCount(count);
    await expect(page.getByRole("button", { name: "Booking opens soon" }).first()).toBeDisabled();

    // Ascending by total.
    const totals = (await rows(page).locator("p.text-2xl").allTextContents()).map((t) => Number(t.replace(/[^0-9.]/g, "")));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));

    // Policies: each populated group, and the supplier's extra text.
    await expect(page.getByRole("heading", { level: 2, name: "Policies" })).toBeVisible();
    const policies = page.getByRole("region", { name: "Policies" });
    for (const group of ["Extra fees", "Children", "Deposits", "Pets", "Parking", "Shuttle", "No-show"]) {
      await expect(policies.getByRole("heading", { level: 3, name: group, exact: true })).toBeVisible();
    }
    await expect(page.getByText("SANDBOX DEMO PROPERTY (no real bookings).")).toBeVisible();
    await expect(page.getByText("Check-in from")).toBeVisible();

    // Nothing urgent, nothing struck through.
    await expect(page.getByText(/\b(\d+ left|only \d+|hurry|booked \d+|last chance|limited time)\b/i)).toHaveCount(0);
    await expect(page.locator('s, del, strike, [class*="line-through"]')).toHaveCount(0);
  });

  test("heading order is logical: h1, then h2 sections, then h3", async ({ page }) => {
    await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    const levels = await page.locator("h1, h2, h3, h4").evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { level: 2 })).toContainText(["Rooms and prices", "About this hotel", "Amenities", "Policies"]);
  });

  test("the first photo is eager and large, the rest lazy and smaller, and alt text names each photo", async ({ page }) => {
    await page.goto(HOTEL);
    const imgs = page.getByRole("region", { name: "Photos" }).locator("img");
    await expect(imgs.first()).toBeAttached();
    expect(await imgs.count()).toBe(12);
    await expect(imgs.first()).toHaveAttribute("loading", "eager");
    await expect(imgs.first()).toHaveAttribute("src", /1024x768/);
    await expect(imgs.nth(1)).toHaveAttribute("loading", "lazy");
    await expect(imgs.nth(1)).not.toHaveAttribute("src", /1024x768/);
    await expect(imgs.nth(1)).toHaveAttribute("alt", "Photo 2 of 50");
    const srcs = await imgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute("src")));
    expect(srcs.every((s) => s?.startsWith("https://"))).toBe(true);
    // Aspect boxes are fixed: the box has a height before any photo has loaded.
    const box = await imgs.first().evaluate((e) => e.parentElement!.getBoundingClientRect().height);
    expect(box).toBeGreaterThan(100);
    await expect(page.getByText("Showing 12 of 50 photos.")).toBeVisible();
  });

  test("a hotel without photos or reviews gets a designed no-photo state and no review block or stars", async ({ page }) => {
    await page.goto(`/hotel/10282085?${STAY}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Place Just To Sleep");
    await expect(page.getByText("Photos are not available for this hotel yet.")).toBeVisible();
    await expect(page.getByRole("img", { name: "No photos are available for this hotel yet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guest reviews" })).toHaveCount(0);
    await expect(page.getByText(/-star hotel/)).toHaveCount(0);
    await expect(page.getByText(/^0(\.0)?$/)).toHaveCount(0);
  });

  test("review block is absent for the fixture hotels (no ratings)", async ({ page }) => {
    await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guest reviews" })).toHaveCount(0);
    await expect(page.getByText("out of 10")).toHaveCount(0);
  });

  test("the loading state reserves space and is announced, then the rates replace it without moving what is above", async ({ page, context }) => {
    await cookie(context, "etg_fixture_delay", "2500");
    // "commit": do not wait for the stream to finish, or the loading state would already be gone.
    await page.goto(HOTEL, { waitUntil: "commit" });
    const skeleton = page.getByTestId("rates-skeleton");
    await expect(skeleton).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading prices for your stay" })).toBeAttached();
    const heading = page.getByRole("heading", { level: 2, name: "Rooms and prices" });
    const gallery = page.getByRole("region", { name: "Photos" });
    const before = { h: (await heading.boundingBox())!.y, g: (await gallery.boundingBox())!.y };
    const skeletonRow = skeleton.locator("li").first();
    expect((await skeletonRow.boundingBox())!.height).toBeGreaterThanOrEqual(176);
    await expect(rows(page).first()).toBeVisible();
    await expect(skeleton).toHaveCount(0);
    const after = { h: (await heading.boundingBox())!.y, g: (await gallery.boundingBox())!.y };
    expect(after).toEqual(before);
    const realRow = (await rows(page).first().boundingBox())!;
    expect(realRow.height).toBeGreaterThanOrEqual(176);
  });

  test("two loads make two reads of the rates: they are not served from cache", async ({ page, context }) => {
    const start = await reads(context);
    await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    expect(await reads(context)).toBe(start + 1);
    await page.reload();
    await expect(rows(page).first()).toBeVisible();
    expect(await reads(context)).toBe(start + 2);
    // A plain request for the same URL reads again too.
    await context.request.get(`${BASE}${HOTEL}`);
    expect(await reads(context)).toBe(start + 3);
  });

  test("never sends net price, markup, booking hash or search hash to the browser", async ({ page, context }) => {
    const response = await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    const html = await page.content();
    const raw = await response!.text();
    const rsc = await (await context.request.get(`${BASE}${HOTEL}`, { headers: { RSC: "1" } })).text();
    for (const body of [html, raw, rsc]) {
      for (const secret of ["markupPercent", '"net"', "book_hash", "bookHash", "search_hash"]) expect(body).not.toContain(secret);
    }
  });

  test("no dates: asks for them with a date and guest picker, and makes no rates request", async ({ page, context }) => {
    const start = await reads(context);
    await page.goto(`/hotel/${HID}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conrad Los Angeles");
    await expect(page.getByRole("heading", { name: "Choose your dates to see prices" })).toBeVisible();
    await expect(page.getByRole("button", { name: DATES })).toBeVisible();
    await expect(page.getByRole("button", { name: /Guests and rooms/ })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Destination" })).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
    expect(await reads(context)).toBe(start);

    // Submitting without dates is blocked with a message.
    await page.getByRole("button", { name: "Show prices" }).click();
    await expect(page.locator("#stay-errors")).toContainText("Choose your check-in and check-out dates.");
    await expect(page).toHaveURL(new RegExp(`/hotel/${HID}$`));
  });

  test("no dates: choosing dates and guests loads the rates", async ({ page }) => {
    await page.goto(`/hotel/${HID}`);
    await page.getByRole("button", { name: DATES }).click();
    await expect(page.getByRole("grid").first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Show prices" }).click();
    await page.waitForURL(new RegExp(`/hotel/${HID}\\?in=`));
    expect(new URL(page.url()).searchParams.get("rooms")).toBe("2");
    await expect(rows(page).first()).toBeVisible();
  });

  test("invalid dates or guests: names the problem, shows the picker, and makes no rates request", async ({ page, context }) => {
    const start = await reads(context);
    await page.goto(`/hotel/${HID}?in=2020-01-01&out=2020-01-03&rooms=9`);
    const alert = page.getByRole("alert").filter({ hasText: "We could not use these dates or guests" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Check-in is in the past.");
    await expect(alert).toContainText("Up to 6 adults per room.");
    await expect(page.getByRole("button", { name: /Check-in and check-out/ })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    expect(await reads(context)).toBe(start);
    await page.goto(`/hotel/${HID}?in=${iso(30)}&out=${iso(32)}`);
    await expect(page.getByRole("alert").filter({ hasText: "Choose guests and rooms." })).toBeVisible();
    expect(await reads(context)).toBe(start);
  });

  test("no rooms available: says so and offers the picker", async ({ page, context }) => {
    await cookie(context, "etg_fixture_fail", "hp-empty");
    await page.goto(HOTEL);
    await expect(page.getByRole("heading", { name: "No rooms are available for these dates." })).toBeVisible();
    await expect(page.getByRole("button", { name: DATES })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  test("a retryable failure says prices are slow and Try again brings the rates back", async ({ page, context }) => {
    await cookie(context, "etg_fixture_fail", "hp");
    await page.goto(HOTEL);
    await expect(page.getByRole("heading", { name: "Prices are taking longer than usual." })).toBeVisible();
    await expect(page.getByRole("alert").getByText("Prices are taking longer than usual.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conrad Los Angeles"); // content still shows
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", HOTEL);
    await context.clearCookies({ name: "etg_fixture_fail" });
    await page.getByRole("link", { name: "Try again" }).click();
    await expect(rows(page).first()).toBeVisible();
  });

  test("a fatal failure says so and still offers Try again", async ({ page, context }) => {
    await cookie(context, "etg_fixture_fail", "hp-fatal");
    await page.goto(HOTEL);
    await expect(page.getByText("We could not load prices for this hotel.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  test("has no accessibility violations: rates, failure, no dates", async ({ page, context }) => {
    const scan = async () => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    await scan();
    await page.goto(`/hotel/${HID}`);
    await expect(page.getByRole("heading", { name: "Choose your dates to see prices" })).toBeVisible();
    await scan();
    await cookie(context, "etg_fixture_fail", "hp");
    await page.goto(HOTEL);
    await expect(page.getByRole("heading", { name: "Prices are taking longer than usual." })).toBeVisible();
    await scan();
    await cookie(context, "etg_fixture_fail", "hp-empty");
    await page.goto(HOTEL);
    await expect(page.getByRole("heading", { name: "No rooms are available for these dates." })).toBeVisible();
    await scan();
    await page.goto(`/hotel/${HID}?in=2020-01-01&out=2020-01-03&rooms=2`);
    await expect(page.getByRole("alert").filter({ hasText: "We could not use these dates" })).toBeVisible();
    await scan();
  });

  test("rate rows and the picker can be reached and used with the keyboard", async ({ page }) => {
    await page.goto(`/hotel/${HID}`);
    const dates = page.getByRole("button", { name: DATES });
    await dates.focus();
    await expect(dates).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Guests and rooms/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Show prices" })).toBeFocused();
  });

  test("full-page screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    await page.waitForLoadState("load");
    await page.screenshot({ path: "test-results/hotel-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(HOTEL);
    await expect(rows(page).first()).toBeVisible();
    await page.screenshot({ path: "test-results/hotel-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("without a passport country", () => {
  test("shows the content, asks for the passport country, and loads rates once it is set", async ({ page, context }) => {
    const start = await reads(context);
    await page.goto(HOTEL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conrad Los Angeles");
    await expect(page.getByText("Tell us your passport country to see prices.")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    expect(await reads(context)).toBe(start);

    await page.getByRole("button", { name: "Choose passport country" }).click();
    await expect(page.getByRole("dialog", { name: "Which country issued your passport?" })).toBeVisible();
    await page.keyboard.type("United States");
    await page.keyboard.press("Enter");
    await expect(rows(page).first()).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "residency")?.value).toBe("us");
    expect(await reads(context)).toBe(start + 1);
  });

  test("has no accessibility violations", async ({ page }) => {
    await page.goto(HOTEL);
    await expect(page.getByText("Tell us your passport country to see prices.")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});

test.describe("hotels that are not available", () => {
  test("a hotel with no stored content is a 404 page that says so, with a link back to search and no rates request", async ({ page, context }) => {
    await cookie(context, "residency", "us");
    const start = await reads(context);
    const response = await page.goto(`/hotel/99999999?${STAY}`);
    expect(response!.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We don't have details for this hotel yet.");
    await expect(page.getByRole("link", { name: "Back to search" })).toHaveAttribute("href", "/");
    await expect(rows(page)).toHaveCount(0);
    expect(await reads(context)).toBe(start);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("a non-numeric or absurd hotel id is a plain 404 without the hotel wording", async ({ page, context }) => {
    const start = await reads(context);
    for (const id of ["abc", "0", "-5", "12abc", "123456789012345", "1e5"]) {
      const response = await page.goto(`/hotel/${id}?${STAY}`);
      expect(response!.status(), id).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("We could not find that page.");
      await expect(page.getByText("We don't have details for this hotel yet.")).toHaveCount(0);
    }
    expect(await reads(context)).toBe(start);
  });

  test("a visitor cannot make a bad id look like a missing hotel by sending the marker header", async ({ context }) => {
    const res = await context.request.get(`${BASE}/hotel/abc`, { headers: { "x-missing-hotel": "1" } });
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain("We could not find that page.");
  });
});
