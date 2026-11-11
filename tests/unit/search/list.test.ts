import { describe, expect, it } from "vitest";
import type { Rate } from "@/lib/etg/schemas";
import type { Hotel } from "@/lib/content/types";
import { buildList, filterItems, parseListParams, sortItems, type ListItem } from "@/lib/search/list";

const NOW = new Date("2026-11-11T00:00:00Z");
const CTX = { markupPercent: 10, taxNames: { city_tax: "City tax" }, now: NOW };

function rate(amount: string, o: { free?: string | null; breakfast?: boolean; tax?: boolean; extraType?: string } = {}): Rate {
  const pt = {
    amount,
    currency_code: "USD",
    show_amount: amount,
    show_currency_code: "USD",
    type: "now" as const,
    tax_data: { taxes: o.tax ? [{ name: "city_tax", included_by_supplier: false, amount: "7.00", currency_code: "USD" }] : [] },
    cancellation_penalties: { free_cancellation_before: o.free ?? null, policies: [] },
  };
  return {
    book_hash: null,
    search_hash: null,
    room_name: "Room",
    room_data_trans: { main_name: "Room", bedding_type: null, misc_room_type: null },
    meal_data: { value: o.breakfast ? "breakfast" : "nomeal", has_breakfast: !!o.breakfast },
    amenities_data: [],
    payment_options: { payment_types: [pt] },
  };
}

function hotel(hid: number, o: Partial<Hotel> = {}): Hotel {
  return {
    hid, name: `Hotel ${hid}`, address: null, latitude: null, longitude: null, starRating: null, kind: null, regionId: null, regionName: null,
    countryCode: null, timeZone: null, checkInTime: null, checkOutTime: null, images: [], amenityGroups: [], description: [],
    metapolicyStruct: null, metapolicyExtraInfo: null, reviewRating: null, reviewDetailed: null, syncedAt: "2026-11-11T00:00:00.000Z", ...o,
  };
}

const hotels = (...hs: Hotel[]) => new Map(hs.map((h) => [h.hid, h]));

function item(hid: number, total: string, o: Partial<Hotel> & { free?: boolean; breakfast?: boolean } = {}): ListItem {
  const { free = false, breakfast = false, ...h } = o;
  return { hotel: hotel(hid, h), from: { total: { amount: total, currency: "USD" }, payAtHotel: [], net: { amount: total, currency: "USD" }, markupPercent: 0 }, freeCancellation: free, hasBreakfast: breakfast };
}

describe("buildList", () => {
  it("uses the lowest total among a hotel's rates as from, with markup applied", () => {
    const { items } = buildList([{ hid: 1, rates: [rate("200.00"), rate("100.00"), rate("150.00")] }], hotels(hotel(1)), CTX);
    expect(items).toHaveLength(1);
    expect(items[0]!.from.total).toEqual({ amount: "110.00", currency: "USD" });
  });

  it("compares amounts as decimals, not strings", () => {
    const { items } = buildList([{ hid: 1, rates: [rate("100.00"), rate("99.00")] }], hotels(hotel(1)), CTX);
    expect(items[0]!.from.total.amount).toBe("108.90");
  });

  it("returns hids with no content as missing and leaves them out of items", () => {
    const { items, missing } = buildList([{ hid: 1, rates: [rate("50.00")] }, { hid: 2, rates: [rate("60.00")] }], hotels(hotel(1)), CTX);
    expect(items.map((i) => i.hotel.hid)).toEqual([1]);
    expect(missing).toEqual([2]);
  });

  it("omits a hotel with no rates, and does not report it as missing", () => {
    const { items, missing } = buildList([{ hid: 1, rates: [] }, { hid: 2, rates: [] }], hotels(hotel(1), hotel(2)), CTX);
    expect(items).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("carries pay-at-hotel amounts of the cheapest rate", () => {
    const { items } = buildList([{ hid: 1, rates: [rate("100.00", { tax: true }), rate("300.00")] }], hotels(hotel(1)), CTX);
    expect(items[0]!.from.payAtHotel).toEqual([{ label: "City tax", money: { amount: "7.00", currency: "USD" } }]);
  });

  it("flags free cancellation only when a deadline is after now", () => {
    const run = (free: string | null) => buildList([{ hid: 1, rates: [rate("100.00", { free })] }], hotels(hotel(1)), CTX).items[0]!.freeCancellation;
    expect(run("2026-12-10T00:00:00")).toBe(true);
    expect(run("2026-11-10T23:59:59")).toBe(false);
    expect(run(null)).toBe(false);
  });

  it("flags breakfast when any rate includes it", () => {
    const { items } = buildList([{ hid: 1, rates: [rate("100.00"), rate("120.00", { breakfast: true })] }], hotels(hotel(1)), CTX);
    expect(items[0]!.hasBreakfast).toBe(true);
  });
});

describe("sortItems", () => {
  it("price orders by decimal value so 99.00 precedes 100.00", () => {
    const out = sortItems([item(1, "100.00"), item(2, "99.00"), item(3, "1000.00")], "price");
    expect(out.map((i) => i.hotel.hid)).toEqual([2, 1, 3]);
  });

  it("recommended is review rating descending, then price ascending, unrated last", () => {
    const out = sortItems([item(1, "50.00"), item(2, "90.00", { reviewRating: 9 }), item(3, "80.00", { reviewRating: 9 }), item(4, "10.00", { reviewRating: 7 })], "recommended");
    expect(out.map((i) => i.hotel.hid)).toEqual([3, 2, 4, 1]);
  });

  it("rating orders by review rating descending", () => {
    const out = sortItems([item(1, "10.00", { reviewRating: 6 }), item(2, "20.00", { reviewRating: 8.5 })], "rating");
    expect(out.map((i) => i.hotel.hid)).toEqual([2, 1]);
  });

  it("does not mutate its input", () => {
    const input = [item(1, "100.00"), item(2, "99.00")];
    sortItems(input, "price");
    expect(input.map((i) => i.hotel.hid)).toEqual([1, 2]);
  });
});

describe("filterItems", () => {
  const items = [
    item(1, "99.00", { free: true, starRating: 3 }),
    item(2, "100.00", { breakfast: true, starRating: 5, reviewRating: 9 }),
    item(3, "250.50", { reviewRating: 6.5 }),
  ];
  const ids = (f: Parameters<typeof filterItems>[1]) => filterItems(items, f).map((i) => i.hotel.hid);

  it("no filters keeps everything", () => expect(ids({})).toEqual([1, 2, 3]));
  it("freeCancellation keeps only hotels with a future free-cancellation rate", () => expect(ids({ freeCancellation: true })).toEqual([1]));
  it("breakfast keeps hotels with a breakfast rate", () => expect(ids({ breakfast: true })).toEqual([2]));
  it("minStars drops hotels with fewer or unknown stars", () => expect(ids({ minStars: 4 })).toEqual([2]));
  it("minRating drops hotels with a lower or missing rating", () => expect(ids({ minRating: 7 })).toEqual([2]));
  it("maxPrice compares decimals and is inclusive", () => {
    expect(ids({ maxPrice: "100" })).toEqual([1, 2]);
    expect(ids({ maxPrice: "99.99" })).toEqual([1]);
    expect(ids({ maxPrice: "1000" })).toEqual([1, 2, 3]);
  });
  it("combines filters with and", () => expect(ids({ freeCancellation: true, breakfast: true })).toEqual([]));
});

describe("parseListParams", () => {
  it("defaults to recommended with no filters", () => {
    expect(parseListParams({})).toEqual({ sort: "recommended", filters: {}, active: false });
  });
  it("reads sort and filters from the URL", () => {
    expect(parseListParams({ sort: "price", stars: "4", rating: "8", free: "1", breakfast: "1", max: "250.5" })).toEqual({
      sort: "price",
      filters: { minStars: 4, minRating: 8, freeCancellation: true, breakfast: true, maxPrice: "250.5" },
      active: true,
    });
  });
  it("ignores invalid values", () => {
    expect(parseListParams({ sort: "cheapest", stars: "9", rating: "abc", free: "yes", max: "-5" })).toEqual({ sort: "recommended", filters: {}, active: false });
  });
  it("sort alone is not an active filter", () => {
    expect(parseListParams({ sort: "rating" }).active).toBe(false);
  });
  it("uses the first value of a repeated param", () => {
    expect(parseListParams({ stars: ["3", "5"] }).filters.minStars).toBe(3);
  });
});
