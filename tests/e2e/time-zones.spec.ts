import { expect, test, type Page } from "@playwright/test";

// The web server runs with TZ=UTC (playwright.config.ts). A visitor far west or far east of it must see, and send
// back, the same calendar days that are in the URL: stay dates cross to the browser only as YYYY-MM-DD strings.
const BASE = "http://localhost:3100";
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
const IN = iso(30);
const OUT = iso(32);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "11 Dec" from "2026-12-11", by its parts (what the date field shows). */
const day = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const EXPECTED = `${day(IN)} – ${day(OUT)} ${OUT.slice(0, 4)} · 2 nights`;
const DATES = /Check-in and check-out/;

/** Opens and closes the calendar (which needs the page to be hydrated), then checks what the field shows. */
async function expectDatesShown(page: Page) {
  const field = page.getByRole("button", { name: DATES });
  await field.click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(field).toHaveText(EXPECTED);
}

function expectSameStay(url: string) {
  const sp = new URL(url).searchParams;
  expect(sp.get("in")).toBe(IN);
  expect(sp.get("out")).toBe(OUT);
}

for (const timezoneId of ["America/Los_Angeles", "Pacific/Auckland"]) {
  test.describe(`a visitor in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("the browser really is in that zone", async ({ page }) => {
      await page.goto("/");
      expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezoneId);
    });

    test("a shared search link opened without a passport country keeps its dates through home and back", async ({ page, context }) => {
      await page.goto(`/search?region=2011&name=Paris&in=${IN}&out=${OUT}&rooms=2`);
      await page.waitForURL((u) => u.pathname === "/");
      await expectDatesShown(page);
      await context.addCookies([{ name: "residency", value: "gb", url: BASE }]);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL(/\/search\?/);
      expectSameStay(page.url());
    });

    test("Change search keeps the dates", async ({ page, context }) => {
      await context.addCookies([{ name: "residency", value: "gb", url: BASE }]);
      await page.goto(`/search?region=2011&name=Paris&in=${IN}&out=${OUT}&rooms=2`);
      await page.getByRole("link", { name: "Change search" }).click();
      await page.waitForURL((u) => u.pathname === "/");
      expectSameStay(page.url());
      await expectDatesShown(page);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL(/\/search\?/);
      expectSameStay(page.url());
    });

    test("the form under an invalid search keeps the dates", async ({ page, context }) => {
      await context.addCookies([{ name: "residency", value: "gb", url: BASE }]);
      await page.goto(`/search?region=2011&name=Paris&in=${IN}&out=${OUT}`);
      await expect(page.getByRole("alert").filter({ hasText: "Choose guests and rooms." })).toBeVisible();
      await expectDatesShown(page);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL(/\/search\?.*rooms=2/);
      expectSameStay(page.url());
    });

    test("the hotel stay picker keeps the dates", async ({ page, context }) => {
      await context.addCookies([{ name: "residency", value: "gb", url: BASE }]);
      await page.goto(`/hotel/10004834?in=${IN}&out=${OUT}`);
      await expect(page.getByRole("alert").filter({ hasText: "Choose guests and rooms." })).toBeVisible();
      await expectDatesShown(page);
      await page.getByRole("button", { name: "Show prices" }).click();
      await page.waitForURL(/\/hotel\/10004834\?.*rooms=2/);
      expectSameStay(page.url());
    });
  });
}
