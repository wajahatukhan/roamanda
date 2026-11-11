import { describe, expect, it } from "vitest";
import type { Hotel } from "@/lib/content/types";
import { formatClock, humanize } from "@/lib/hotel/format";
import { galleryPhotos, MAX_PHOTOS } from "@/lib/hotel/gallery";
import { htmlToLines, policyData, policyGroups } from "@/lib/hotel/policy";
import { reviewModel } from "@/lib/hotel/review";
import content from "../../fixtures/etg/content-hotels.json";

const RATINGS = { cleanness: 9, location: 8.5, price: 7, services: null, room: 8, meal: null, wifi: 6.5, hygiene: 9.5 };

describe("reviewModel", () => {
  it("is null when the hotel has no rating, so no block (not a 0, not an empty box)", () => {
    expect(reviewModel({ reviewRating: null, reviewDetailed: null })).toBeNull();
    expect(reviewModel({ reviewRating: null, reviewDetailed: RATINGS })).toBeNull();
  });
  it("shows the score and only the categories that have a value", () => {
    const m = reviewModel({ reviewRating: 8.43, reviewDetailed: RATINGS })!;
    expect(m.score).toBe("8.4");
    expect(m.categories.map((c) => c.key)).toEqual(["cleanness", "location", "price", "room", "wifi", "hygiene"]);
    expect(m.categories[0]).toMatchObject({ label: "Cleanliness", score: "9.0", fraction: 0.9 });
  });
  it("shows the score alone when there are no category scores", () => {
    expect(reviewModel({ reviewRating: 7, reviewDetailed: null })).toEqual({ score: "7.0", categories: [] });
  });
  it("ignores out-of-range category values", () => {
    expect(reviewModel({ reviewRating: 7, reviewDetailed: { room: 11, wifi: -1, location: 5 } })!.categories.map((c) => c.key)).toEqual(["location"]);
  });
  it("hides a rating that is not a sane score", () => {
    expect(reviewModel({ reviewRating: Number.NaN, reviewDetailed: null })).toBeNull();
    expect(reviewModel({ reviewRating: 42, reviewDetailed: null })).toBeNull();
  });
  it("matches the fixture: no hotel has a rating", () => {
    const all = (content as unknown as { reviews: { rating: number | null }[] }).reviews;
    expect(all.every((r) => r.rating === null)).toBe(true);
  });
});

describe("galleryPhotos", () => {
  const img = (n: number, category = "unspecified", url = `https://cdn.example.test/t/{size}/p${n}.jpg`) => ({ category, url });
  it("sizes the first photo large and the rest smaller, with alt text that names the photo", () => {
    const { photos, total } = galleryPhotos([img(1), img(2, "bedroom_view")]);
    expect(total).toBe(2);
    expect(photos[0]).toEqual({ n: 1, large: "https://cdn.example.test/t/1024x768/p1.jpg", small: "https://cdn.example.test/t/640x350/p1.jpg", alt: "Photo 1 of 2" });
    expect(photos[1]!.alt).toBe("Photo 2 of 2: Bedroom view");
  });
  it("accepts https only and counts only the accepted photos", () => {
    const { photos, total } = galleryPhotos([img(1, "x", "http://cdn.example.test/{size}/a.jpg"), img(2), img(3, "x", "javascript:alert(1)"), img(4, "x", "//cdn.example.test/{size}/b.jpg"), img(5, "x", "not a url")]);
    expect(total).toBe(1);
    expect(photos).toHaveLength(1);
    expect(photos[0]!.alt).toBe("Photo 1 of 1");
  });
  it("shows at most MAX_PHOTOS but reports the full count", () => {
    const { photos, total } = galleryPhotos(Array.from({ length: 30 }, (_, i) => img(i)));
    expect(photos).toHaveLength(MAX_PHOTOS);
    expect(total).toBe(30);
    expect(photos[MAX_PHOTOS - 1]!.alt).toBe(`Photo ${MAX_PHOTOS} of 30`);
  });
  it("never uses the hotel name as alt text, and has no photos for an empty list", () => {
    expect(galleryPhotos([])).toEqual({ photos: [], total: 0 });
  });
});

describe("formatClock and humanize", () => {
  it("formats 24-hour times", () => {
    expect(formatClock("14:00:00")).toBe("2:00 pm");
    expect(formatClock("00:30")).toBe("12:30 am");
    expect(formatClock("12:00:00")).toBe("12:00 pm");
    expect(formatClock("09:05:00")).toBe("9:05 am");
  });
  it("passes odd values through and treats empty as absent", () => {
    expect(formatClock("after lunch")).toBe("after lunch");
    expect(formatClock("25:00:00")).toBe("25:00:00");
    expect(formatClock("")).toBeNull();
    expect(formatClock(null)).toBeNull();
  });
  it("humanizes keys", () => {
    expect(humanize("late_checkin")).toBe("Late checkin");
    expect(humanize("")).toBe("");
  });
});

describe("policyGroups", () => {
  const real = (content as unknown as { hotels: { hid: number; metapolicy_struct: Record<string, unknown> }[] }).hotels.find((h) => h.hid === 10004834)!;

  it("renders every populated group of the real 10004834 policy and none of the empty ones", () => {
    const groups = policyGroups(real.metapolicy_struct);
    const populated = Object.entries(real.metapolicy_struct).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : true) && !(typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every((x) => x === "unspecified" || x === "")));
    expect(groups.map((g) => g.key)).toEqual(populated.map(([k]) => k));
    expect(groups.map((g) => g.key)).toEqual(expect.arrayContaining(["add_fee", "children", "deposit", "meal", "pets", "parking", "shuttle", "no_show", "visa"]));
    for (const g of groups) expect(g.items.length).toBeGreaterThan(0);
  });
  it("writes a fee as text with its price and currency together", () => {
    const g = policyGroups({ add_fee: [{ currency: "EUR", fee_type: "luggage_storage", price: "2", price_unit: "per_hour" }] })[0]!;
    expect(g.title).toBe("Extra fees");
    expect(g.items).toEqual(["Luggage storage \u2014 Price: 2 EUR \u00b7 Price unit: per hour"]);
  });
  it("reads a percent price as a percentage", () => {
    expect(policyGroups({ deposit: [{ currency: "", price: "20", pricing_method: "percent", deposit_type: "breakage" }] })[0]!.items[0]).toBe("Breakage \u2014 Price: 20%");
  });
  it("reads an age range as one phrase and leads each entry with what it is about", () => {
    const g = policyGroups({ children: [{ age_end: 3, age_start: 0, currency: "USD", extra_bed: "available", price: "20" }], meal: [{ currency: "USD", inclusion: "not_included", meal_type: "breakfast", price: "3" }] });
    expect(g[0]!.items).toEqual(["Ages 0 to 3 \u2014 Extra bed: available \u00b7 Price: 20 USD"]);
    expect(g[1]!.items).toEqual(["Breakfast \u2014 Inclusion: not included \u00b7 Price: 3 USD"]);
  });
  it("skips groups that say nothing", () => {
    expect(policyGroups({ add_fee: [], no_show: { availability: "unspecified", day_period: "unspecified", time: "" }, visa: { visa_support: "unspecified" } })).toEqual([]);
  });
  it("shows a one-object group such as no-show", () => {
    expect(policyGroups({ no_show: { availability: "available", day_period: "after_midday", time: "09:00:00" } })[0]!.items).toEqual(["Availability: available · Day period: after midday · Time: 09:00:00"]);
  });
  it("renders unknown groups and unknown shapes as plain key/value text instead of dropping them", () => {
    const groups = policyGroups({ spa_rules: [{ min_age: 16, hours: { open: "9", close: "17" } }], note: "Quiet hours at night", tags: ["a", "b"], weird: { nested: { deep: "x" } } });
    expect(groups.map((g) => g.title)).toEqual(["Spa rules", "Note", "Tags", "Weird"]);
    expect(groups[0]!.items[0]).toBe("Min age: 16 · Hours: Open: 9; Close: 17");
    expect(groups[1]!.items).toEqual(["Quiet hours at night"]);
    expect(groups[2]!.items).toEqual(["a", "b"]);
    expect(groups[3]!.items).toEqual(["Nested: Deep: x"]);
  });
  it("is empty for missing data", () => {
    expect(policyGroups(null)).toEqual([]);
    expect(policyGroups(undefined)).toEqual([]);
  });
  it("keeps markup in supplier values as literal text", () => {
    expect(policyGroups({ note: "<img src=x onerror=alert(1)>" })[0]!.items).toEqual(["<img src=x onerror=alert(1)>"]);
  });
});

describe("htmlToLines", () => {
  it("turns the supplier HTML into plain lines, with bullets for list items", () => {
    const lines = htmlToLines("<p><b>Fees</b> <br /><p>Pay at the property:</p> <ul><li>Pet fee: USD 50 per pet</li> <li>Deposit&nbsp;&amp; keys: USD 100</li></ul>");
    expect(lines).toEqual(["Fees", "Pay at the property:", "• Pet fee: USD 50 per pet", "• Deposit & keys: USD 100"]);
  });
  it("drops script and style content and decodes numeric entities", () => {
    expect(htmlToLines("<style>p{}</style><script>alert(1)</script>Caf&#233; &#x41;")).toEqual(["Café A"]);
  });
  it("leaves no tags, and keeps decoded angle brackets as text", () => {
    expect(htmlToLines("a &lt;b&gt; c")).toEqual(["a <b> c"]);
    for (const l of htmlToLines("<div class='x'>one</div><span>two</span>")) expect(l).not.toMatch(/<\w/);
  });
  it("is empty for null or blank input and converts the real 8819557 text", () => {
    expect(htmlToLines(null)).toEqual([]);
    expect(htmlToLines("  ")).toEqual([]);
    const real = (content as unknown as { hotels: { hid: number; metapolicy_extra_info: string }[] }).hotels.find((h) => h.hid === 8819557)!;
    const lines = htmlToLines(real.metapolicy_extra_info);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join("\n")).toContain("Deposit: USD 100.0 per stay");
    expect(lines.join("\n")).not.toMatch(/<[a-z/]/i);
  });
});

describe("policyData", () => {
  it("combines the groups and the extra text", () => {
    const d = policyData({ pets: [{ price: "5", currency: "USD" }] }, "<p>Hello</p>");
    expect(d.groups).toHaveLength(1);
    expect(d.extra).toEqual(["Hello"]);
  });
});

// Type check only: a made-up hotel is accepted by reviewModel.
const _hotel: Pick<Hotel, "reviewRating" | "reviewDetailed"> = { reviewRating: 9.1, reviewDetailed: RATINGS };
void _hotel;
