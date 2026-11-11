import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DEST = "Destination";
const DATES = /Check-in and check-out/;
const SEARCH = { name: "Search", exact: true } as const;

async function pickParis(page: Page) {
  await page.getByRole("combobox", { name: DEST }).fill("Par");
  await page.getByRole("option", { name: /^Paris/ }).first().click();
}

/** Opens the calendar and chooses a two-night stay starting tomorrow, by keyboard. */
async function pickDates(page: Page) {
  await page.getByRole("button", { name: DATES }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
}

test("typing 'Par' lists Paris, and 'xyz' shows no results", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("combobox", { name: DEST });
  await input.fill("Par");
  await expect(page.getByRole("option", { name: /^Paris/ }).first()).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.fill("xyz");
  await expect(page.getByText("No destinations found. Try another spelling.")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("fewer than 2 characters makes no request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => r.url().includes("/api/destinations") && requests.push(r.url()));
  await page.goto("/");
  await page.getByRole("combobox", { name: DEST }).fill("P");
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(0);
});

test("shows a calm message when suggestions are unavailable", async ({ page }) => {
  await page.route("**/api/destinations*", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ regions: [], hotels: [], error: "unavailable" }) }),
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: DEST }).fill("Par");
  await expect(page.getByText("Suggestions are unavailable. Try again.")).toBeVisible();
});

test("submit is blocked with a visible message until destination and dates are chosen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", SEARCH).click();
  await expect(page.locator("#search-errors")).toContainText("Choose a destination.");
  await expect(page.locator("#search-errors")).toContainText("Choose your check-in and check-out dates.");
  await expect(page).toHaveURL(/\/$/);
});

test("the form is completable by keyboard alone; passport country is asked once", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.getByRole("combobox", { name: DEST }).focus();
  await page.keyboard.type("Par");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: DEST })).toHaveValue("Paris");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: DATES })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid").first()).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Check-in and check-out.*2 nights/ })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Guests and rooms/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Increase children in room 1" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Room 1 child 1 age" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Guests and rooms.*1 child/ })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", SEARCH)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Which country issued your passport?" })).toBeVisible();
  await page.keyboard.type("United King");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/search\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("region")).toBe("2734");
  expect(url.searchParams.get("name")).toBe("Paris");
  expect(url.searchParams.get("rooms")).toBe("2-8");
  expect(url.searchParams.get("in")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(url.searchParams.get("out")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect((await context.cookies()).find((c) => c.name === "residency")?.value).toBe("gb");

  await page.goto("/");
  await pickParis(page);
  await pickDates(page);
  await page.getByRole("button", SEARCH).click();
  await page.waitForURL(/\/search\?/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("child ages and extra rooms can be set in the guests popover", async ({ page, context }) => {
  await context.addCookies([{ name: "residency", value: "gb", url: "http://localhost:3100" }]);
  await page.goto("/");
  await pickParis(page);
  await pickDates(page);
  await page.getByRole("button", { name: /Guests and rooms/ }).click();
  await page.getByRole("button", { name: "Increase children in room 1" }).click();
  await page.getByRole("button", { name: "Increase children in room 1" }).click();
  await page.getByRole("button", { name: "Add a room" }).click();
  await page.getByRole("combobox", { name: "Room 1 child 1 age" }).click();
  await page.getByRole("option", { name: "5 years", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Room 1 child 1 age" })).toContainText("5 years");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Guests and rooms/ })).toContainText("4 adults · 2 children · 2 rooms");
  await page.getByRole("button", SEARCH).click();
  await page.waitForURL(/\/search\?/);
  expect(new URL(page.url()).searchParams.get("rooms")).toBe("2-5.8,2");
});

test("choosing a hotel sends the search to its page", async ({ page, context }) => {
  await context.addCookies([{ name: "residency", value: "gb", url: "http://localhost:3100" }]);
  await page.goto("/");
  await page.getByRole("combobox", { name: DEST }).fill("Par");
  await page.getByRole("option", { name: /Paris Appartements Services/ }).click();
  await pickDates(page);
  await page.getByRole("button", SEARCH).click();
  await page.waitForURL(/\/hotel\/8745530\?/);
  expect(new URL(page.url()).searchParams.get("rooms")).toBe("2");
});

test("an invalid residency cookie is treated as unset", async ({ page, context }) => {
  await context.addCookies([{ name: "residency", value: "zz", url: "http://localhost:3100" }]);
  await page.goto("/");
  await pickParis(page);
  await pickDates(page);
  await page.getByRole("button", SEARCH).click();
  await expect(page.getByRole("dialog", { name: "Which country issued your passport?" })).toBeVisible();
});

test.describe("accessibility", () => {
  const states: [string, (page: Page) => Promise<void>][] = [
    ["nothing open", async () => {}],
    ["suggestions open", async (page) => {
      await page.getByRole("combobox", { name: DEST }).fill("Par");
      await expect(page.getByRole("option").first()).toBeVisible();
    }],
    ["calendar open", async (page) => {
      await page.getByRole("button", { name: DATES }).click();
      await expect(page.getByRole("grid").first()).toBeVisible();
    }],
    ["guests open", async (page) => {
      await page.getByRole("button", { name: /Guests and rooms/ }).click();
      await expect(page.getByText("Room 1")).toBeVisible();
    }],
    ["passport dialog open", async (page) => {
      await pickParis(page);
      await pickDates(page);
      await page.getByRole("button", SEARCH).click();
      await expect(page.getByRole("dialog", { name: "Which country issued your passport?" })).toBeVisible();
    }],
    ["validation messages showing", async (page) => {
      await page.getByRole("button", SEARCH).click();
      await expect(page.locator("#search-errors")).toContainText("Choose a destination.");
    }],
  ];
  for (const [name, open] of states) {
    test(`no axe violations: ${name}`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto("/");
      await open(page);
      await page.waitForTimeout(300);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
});
