import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { Rate } from "@/lib/etg/schemas";
import { CANCELLATION_FALLBACK } from "@/lib/policy/cancellation-sentence";
import { buildRateRows, type RateRowContext } from "@/lib/hotel/rate-rows";
import hp10004834 from "../../fixtures/etg/hp-10004834.json";
import hp8819557 from "../../fixtures/etg/hp-8819557.json";

// Fixed clock: the fixtures hold absolute dates from December 2026.
const NOW = new Date("2026-11-11T00:00:00Z");
const CTX: RateRowContext = {
  markupPercent: 10,
  timeZone: "America/Los_Angeles",
  now: NOW,
  currency: "USD",
  mealNames: { nomeal: "No meals included", breakfast: "Breakfast included" },
  taxNames: { city_tax: "City tax" },
};

const fixtureRates = (f: { hotels: { rates: unknown[] }[] }): Rate[] => f.hotels[0]!.rates.map((r) => Rate.parse(r));
const rates = fixtureRates(hp10004834);

type PT = Rate["payment_options"]["payment_types"][number];
function paymentType(o: Partial<PT> & { amount?: string } = {}): PT {
  const amount = o.amount ?? "100.00";
  return {
    amount,
    currency_code: "USD",
    show_amount: amount,
    show_currency_code: "USD",
    type: "now",
    tax_data: { taxes: [] },
    cancellation_penalties: { free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_charge: amount, amount_show: amount }] },
    ...o,
  };
}
function rate(o: { name?: string; meal?: string; bedding?: string | null; hash?: string | null; pts?: PT[] } = {}): Rate {
  return {
    book_hash: o.hash === undefined ? "h-1" : o.hash,
    search_hash: null,
    room_name: o.name ?? "Room",
    room_data_trans: { main_name: "Room", bedding_type: o.bedding === undefined ? null : o.bedding, misc_room_type: null },
    meal_data: { value: o.meal ?? "nomeal", has_breakfast: false },
    amenities_data: [],
    payment_options: { payment_types: o.pts ?? [paymentType()] },
  };
}

describe("buildRateRows against the 10004834 fixture", () => {
  const rows = buildRateRows(rates, CTX);

  it("builds one row for each rate and its eligible payment type", () => {
    expect(rows).toHaveLength(rates.length);
  });
  it("keeps every room name exactly as the supplier sent it", () => {
    const names = new Set(rates.map((r) => r.room_name));
    for (const row of rows) expect(names.has(row.roomName)).toBe(true);
  });
  it("is sorted by total, lowest first", () => {
    const totals = rows.map((r) => new Decimal(r.price.total.amount));
    for (let i = 1; i < totals.length; i++) expect(totals[i]!.gte(totals[i - 1]!)).toBe(true);
  });
  it("gives every row a sentence ending in a full stop", () => {
    for (const row of rows) {
      expect(row.cancellation.length).toBeGreaterThan(0);
      expect(row.cancellation.endsWith(".")).toBe(true);
    }
  });
  it("labels deposit payments as pay now", () => {
    expect(rows.every((r) => r.paymentType === "deposit" && r.paymentLabel === "Pay now")).toBe(true);
  });
  it("uses the dictionary for meals and falls back to the raw value", () => {
    const nomeal = rows.find((r) => r.meal === "nomeal")!;
    expect(nomeal.mealLabel).toBe("No meals included");
    const allInclusive = rows.find((r) => r.meal === "all-inclusive")!;
    expect(allInclusive.mealLabel).toBe("all-inclusive"); // not in this made-up dictionary
  });
  it("keeps pay-at-hotel charges out of the total and shows them beside it", () => {
    const row = rows[0]!;
    expect(row.price.payAtHotel.length).toBeGreaterThan(0);
    // 354.00 net at 10% markup
    expect(row.price.total).toEqual({ amount: "389.40", currency: "USD" });
  });
  it("does not count a free-cancellation sentence as the fallback when the dates are in the future", () => {
    expect(rows.filter((r) => r.cancellation === CANCELLATION_FALLBACK)).toHaveLength(0);
  });
  it("gives every row a unique key that does not contain the book hash", () => {
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    const hashes = rates.map((r) => r.book_hash!);
    for (const k of keys) for (const h of hashes) expect(k).not.toContain(h);
  });
  it("builds rows for the other fixture too", () => {
    expect(buildRateRows(fixtureRates(hp8819557), CTX).length).toBe(fixtureRates(hp8819557).length);
  });
});

describe("buildRateRows details", () => {
  it("maps meal values through mealNames, with the raw value as the fallback", () => {
    const [a, b] = buildRateRows([rate({ meal: "nomeal" }), rate({ meal: "mystery-plan", hash: "h-2" })], { ...CTX, mealNames: { nomeal: "Room only" } });
    const byMeal = Object.fromEntries([a!, b!].map((r) => [r.meal, r.mealLabel]));
    expect(byMeal).toEqual({ nomeal: "Room only", "mystery-plan": "mystery-plan" });
  });
  it("does not read inherited object keys as meal names", () => {
    const [row] = buildRateRows([rate({ meal: "constructor" })], { ...CTX, mealNames: {} });
    expect(row!.mealLabel).toBe("constructor");
  });
  it("makes one row per eligible payment type", () => {
    const r = rate({ pts: [paymentType({ type: "now", amount: "100.00" }), paymentType({ type: "deposit", amount: "120.00" })] });
    const rows = buildRateRows([r], CTX);
    expect(rows.map((x) => x.paymentType)).toEqual(["now", "deposit"]);
    expect(rows.every((x) => x.paymentLabel === "Pay now")).toBe(true);
  });
  it("builds no rows for hotel-type payments", () => {
    expect(buildRateRows([rate({ pts: [paymentType({ type: "hotel" })] })], CTX)).toEqual([]);
    const mixed = buildRateRows([rate({ pts: [paymentType({ type: "hotel" }), paymentType({ type: "now" })] })], CTX);
    expect(mixed.map((x) => x.paymentType)).toEqual(["now"]);
  });
  it("builds no rows for a payment type shown in another currency", () => {
    expect(buildRateRows([rate({ pts: [paymentType({ show_currency_code: "EUR" })] })], CTX)).toEqual([]);
  });
  it("sorts by decimal value, not text, and keeps equal totals in supplier order", () => {
    const mk = (amount: string, name: string, hash: string) => rate({ name, hash, pts: [paymentType({ amount })] });
    const rows = buildRateRows([mk("1000.00", "c", "h3"), mk("99.50", "a", "h1"), mk("99.50", "b", "h2")], { ...CTX, markupPercent: 0 });
    expect(rows.map((r) => r.roomName)).toEqual(["a", "b", "c"]);
  });
  it("keeps the room name unchanged and carries bedding only when present", () => {
    const [withBed, without] = buildRateRows(
      [rate({ name: "  Odd   Name (X) ", bedding: "king bed", hash: "a" }), rate({ name: "Plain", bedding: null, hash: "b", pts: [paymentType({ amount: "200.00" })] })],
      CTX,
    );
    expect(withBed!.roomName).toBe("  Odd   Name (X) ");
    expect(withBed!.bedding).toBe("king bed");
    expect(without!.bedding).toBeNull();
  });
  it("carries the book hash on the row for the server to use later", () => {
    expect(buildRateRows([rate({ hash: "abc" })], CTX)[0]!.bookHash).toBe("abc");
  });
  it("leaves out rates that have no book hash, since they cannot be booked", () => {
    expect(buildRateRows([rate({ hash: null })], CTX)).toEqual([]);
    expect(buildRateRows([rate({ hash: "" })], CTX)).toEqual([]);
  });
  it("uses UTC when the hotel has no time zone", () => {
    const pt = paymentType({
      cancellation_penalties: { free_cancellation_before: "2026-12-10T12:00:00", policies: [{ start_at: null, end_at: "2026-12-10T12:00:00", amount_charge: "0.00", amount_show: "0.00" }, { start_at: "2026-12-10T12:00:00", end_at: null, amount_charge: "100.00", amount_show: "100.00" }] },
    });
    const [row] = buildRateRows([rate({ pts: [pt] })], { ...CTX, timeZone: null as unknown as string });
    expect(row!.cancellation).toMatch(/12:00 pm/);
    expect(row!.cancellation).toMatch(/UTC/);
  });
  it("carries the full policy lines, in selling-price terms and the hotel's zone, and none for malformed data", () => {
    const fixtureRows = buildRateRows(rates, CTX);
    for (const row of fixtureRows) expect(row.policyLines.length).toBeGreaterThan(0);
    const pt = paymentType({
      amount: "100.00",
      cancellation_penalties: { free_cancellation_before: "2026-12-10T12:00:00", policies: [{ start_at: null, end_at: "2026-12-10T12:00:00", amount_charge: "0.00", amount_show: "0.00" }, { start_at: "2026-12-10T12:00:00", end_at: null, amount_charge: "100.00", amount_show: "100.00" }] },
    });
    expect(buildRateRows([rate({ pts: [pt] })], CTX)[0]!.policyLines).toEqual([
      "Until 10 December, 4:00 am Los Angeles time: free",
      "From 10 December, 4:00 am Los Angeles time: you lose $110.00",
      "Free cancellation deadline stated by the hotel: 10 December, 4:00 am Los Angeles time",
    ]);
    const bad = paymentType({ cancellation_penalties: { free_cancellation_before: "not-a-date", policies: [] } });
    const [row] = buildRateRows([rate({ pts: [bad] })], CTX);
    expect(row!.policyLines).toEqual([]);
  });
  it("uses the fallback sentence for a row whose cancellation data is malformed, and keeps the other rows", () => {
    const bad = paymentType({ cancellation_penalties: { free_cancellation_before: "not-a-date", policies: [] } });
    const negative = paymentType({ cancellation_penalties: { free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_charge: "1", amount_show: "-5" }] } });
    const rows = buildRateRows([rate({ hash: "a", pts: [bad] }), rate({ hash: "b", pts: [negative] }), rate({ hash: "c", pts: [paymentType({ amount: "500.00" })] })], CTX);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.cancellation === CANCELLATION_FALLBACK)).toEqual([true, true, false]);
  });
});
