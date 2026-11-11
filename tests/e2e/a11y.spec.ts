import { expect, test, type Page } from "@playwright/test";

const BASE = "http://localhost:3100";
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
// Dates are computed at run time so the URLs are valid whatever day the suite runs.
const STAY = `in=${iso(30)}&out=${iso(32)}&rooms=2`;
const PAGES = [
  { name: "home", path: "/", // The form streams in after the heading, so wait for its button.
    ready: (page: Page) => page.getByRole("button", { name: "Search", exact: true }) },
  { name: "results", path: `/search?region=2011&name=Paris&${STAY}`, ready: (page: Page) => page.getByRole("article").first() },
  { name: "hotel", path: `/hotel/10004834?${STAY}`, ready: (page: Page) => page.getByRole("button", { name: "Booking opens soon" }).first() },
];

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "residency", value: "us", url: BASE }]);
});

const INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Marks every visible, enabled, tabbable control with a running number in document order. Returns how many there are. */
async function markControls(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if ((el as HTMLButtonElement).disabled || el.closest("[inert]") || !el.checkVisibility({ visibilityProperty: true })) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      el.dataset.a11yControl = String(n++);
    }
    return n;
  }, INTERACTIVE);
}

for (const { name, path, ready } of PAGES) {
  test.describe(`${name} page`, () => {
    test("Tab reaches every interactive control, in reading order, with focus always visible", async ({ page }) => {
      await page.goto(path);
      await expect(ready(page)).toBeVisible();
      const total = await markControls(page);
      expect(total).toBeGreaterThan(0);

      const reached: number[] = [];
      const missing: string[] = [];
      for (let i = 0; i < total + 10; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(async () => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body || el.dataset.a11yControl === undefined) return null;
          const settle = () => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
          // The element and the ancestors that may carry its indicator (a card takes a ring when its link is focused).
          const chain = [el, el.parentElement, el.parentElement?.parentElement, el.closest("article, li, label")].filter((e): e is HTMLElement => !!e);
          const look = () =>
            chain.map((e) => {
              const s = getComputedStyle(e);
              return { outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 ? s.outlineWidth : "", shadow: s.boxShadow };
            });
          await settle();
          const focused = look();
          const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`;
          // Compare with the same chain unfocused: an indicator is something that appears when focus arrives.
          el.blur();
          await settle();
          const plain = look();
          el.focus({ focusVisible: true } as FocusOptions);
          await settle();
          const shows = focused.some((f, k) => f.outline !== "" || (f.shadow !== plain[k]!.shadow && f.shadow !== "none"));
          return { index: Number(el.dataset.a11yControl), label, shows };
        });
        if (!info) break; // focus has left the page's controls
        if (reached.includes(info.index)) break; // wrapped round
        reached.push(info.index);
        if (!info.shows) missing.push(info.label);
      }

      // Every control was reached, and the order is the order on the page.
      expect([...reached].sort((a, b) => a - b)).toEqual(Array.from({ length: total }, (_, i) => i));
      expect(reached).toEqual([...reached].sort((a, b) => a - b));
      // Focus is visible on every control: an outline, or a ring that appears when it takes focus.
      expect(missing).toEqual([]);
    });

    for (const view of [
      { label: "200% zoom (640 x 360 CSS pixels)", size: { width: 640, height: 360 } },
      { label: "320 px width", size: { width: 320, height: 640 } },
    ]) {
      test(`works at ${view.label} without horizontal scrolling`, async ({ page }) => {
        await page.setViewportSize(view.size);
        await page.goto(path);
        await expect(ready(page)).toBeVisible();
        const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
        // Nothing is cut off to the right of the viewport.
        const clipped = await page.evaluate(() => {
          const limit = document.documentElement.clientWidth + 1;
          return [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((el) => el.checkVisibility() && el.getBoundingClientRect().right > limit && !el.closest("[aria-hidden=true], .sr-only, [class*=overflow]"))
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
        });
        expect(clipped).toEqual([]);
      });
    }
  });
}

test("the hotel page's Show all control is in the tab order and opens from the keyboard", async ({ page }) => {
  await page.goto(`/hotel/10004834?${STAY}`);
  const summary = page.getByText(/^Show all \d+ options$/);
  await expect(summary).toBeVisible();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    if (await summary.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("details")).toHaveJSProperty("open", true);
});
