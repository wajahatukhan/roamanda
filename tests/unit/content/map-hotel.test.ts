import fixture from "../../fixtures/etg/content-10004834.json";
import { chunk } from "@/lib/content/chunk";
import { imageUrl } from "@/lib/content/image-url";
import { mapEtgHotel, mapEtgHotels } from "@/lib/content/map-hotel";

const SYNCED = "2026-11-11T00:00:00.000Z";
const map = (raw: unknown, reviews?: Parameters<typeof mapEtgHotel>[2]) => mapEtgHotel(raw, SYNCED, reviews);

describe("mapEtgHotel", () => {
  test("maps the recorded hotel", () => {
    const h = map(fixture);
    expect(h.hid).toBe(10004834);
    expect(h.name.length).toBeGreaterThan(0);
    expect(typeof h.latitude).toBe("number");
    expect(typeof h.longitude).toBe("number");
    expect(h.timeZone).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+/);
    expect(h.images[0]?.url).toContain("{size}");
    expect(h.images[0]).toEqual({ category: "unspecified", url: expect.any(String) });
    expect(h.starRating).toBe(5);
    expect(h.kind).toBe("hotel");
    expect(h.regionId).toBe(2011);
    expect(h.regionName).toBe("Los Angeles");
    expect(h.countryCode).toBe("US");
    expect(h.checkInTime).toBe("15:00:00");
    expect(h.checkOutTime).toBe("12:00:00");
    expect(h.amenityGroups[0]).toEqual({ groupName: "General", amenities: expect.any(Array), nonFreeAmenities: [] });
    expect(h.description[0]?.paragraphs.length).toBeGreaterThan(0);
    expect(h.metapolicyStruct).toHaveProperty("no_show");
    expect(typeof h.metapolicyExtraInfo).toBe("string");
    expect(h.reviewRating).toBeNull();
    expect(h.reviewDetailed).toBeNull();
    expect(h.syncedAt).toBe(SYNCED);
  });

  test("a hotel without coordinates maps with timeZone null", () => {
    const rest: Record<string, unknown> = { ...fixture };
    delete rest.latitude;
    delete rest.longitude;
    const h = map(rest);
    expect(h.latitude).toBeNull();
    expect(h.longitude).toBeNull();
    expect(h.timeZone).toBeNull();
    const nulls = map({ ...rest, latitude: null, longitude: null });
    expect(nulls.timeZone).toBeNull();
  });

  test("coordinates outside the valid range give timeZone null instead of throwing", () => {
    expect(map({ ...fixture, latitude: 123, longitude: 400 }).timeZone).toBeNull();
  });

  test("star_rating 0 maps to null", () => {
    expect(map({ ...fixture, star_rating: 0 }).starRating).toBeNull();
    expect(map({ ...fixture, star_rating: 3 }).starRating).toBe(3);
  });

  test("an out-of-range star rating maps to null", () => {
    expect(map({ ...fixture, star_rating: 9 }).starRating).toBeNull();
  });

  test("tolerates unknown fields and missing optional fields", () => {
    const h = map({ hid: 1, name: "X", something_new: { a: 1 } });
    expect(h).toMatchObject({ hid: 1, name: "X", address: null, images: [], amenityGroups: [], description: [], metapolicyStruct: null, regionId: null });
  });

  test("throws when hid or name is missing", () => {
    expect(() => map({ name: "X" })).toThrow();
    expect(() => map({ hid: 1, name: "" })).toThrow();
    expect(() => map(null)).toThrow();
  });

  test("merges review summaries", () => {
    const h = map(fixture, { rating: 8.46, detailed_ratings: { cleanness: 9.1, wifi: null } });
    expect(h.reviewRating).toBe(8.5);
    expect(h.reviewDetailed).toEqual({ cleanness: 9.1, wifi: null });
  });

  test("an all-null detailed breakdown maps to null", () => {
    expect(map(fixture, { rating: null, detailed_ratings: { cleanness: null, wifi: null } }).reviewDetailed).toBeNull();
  });

  test("a null review rating stays null", () => {
    expect(map(fixture, { rating: null, detailed_ratings: null }).reviewRating).toBeNull();
  });
});

describe("mapEtgHotels", () => {
  test("skips invalid hotels and closed or deleted hotels, and counts them", () => {
    const raws = [
      fixture,
      { hid: 2, name: "Closed", is_closed: true },
      { hid: 3, name: "Deleted", deleted: true },
      { hid: "nope", name: "Bad" },
      { hid: 4, name: "Fine", star_rating: 0 },
    ];
    const r = mapEtgHotels(raws, SYNCED);
    expect(r.hotels.map((h) => h.hid)).toEqual([10004834, 4]);
    expect(r.skippedInvalid).toBe(1);
    expect(r.skippedClosed).toBe(2);
  });

  test("attaches review summaries by hid", () => {
    const r = mapEtgHotels([fixture], SYNCED, [{ hid: 10004834, rating: 7.2, detailed_ratings: { room: 7 } }]);
    expect(r.hotels[0]?.reviewRating).toBe(7.2);
  });
});

describe("imageUrl", () => {
  test("replaces the size placeholder", () => {
    expect(imageUrl("https://h/{size}/a.jpg", "640x350")).toBe("https://h/640x350/a.jpg");
    expect(imageUrl("https://h/t/{size}/a.jpg", "x220")).toBe("https://h/t/x220/a.jpg");
  });
});

describe("chunk", () => {
  test("splits into pieces of at most size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
  test("rejects a non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
