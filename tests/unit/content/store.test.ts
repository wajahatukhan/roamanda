import { resetEnvCache } from "@/env";
import { getDictionaries, getHotel, getHotelCards, getMarkupPercent, hotelToRow, recordMissing, resetStoreCache, rowToHotel } from "@/lib/content/store";
import { mapEtgHotel } from "@/lib/content/map-hotel";
import serp from "../../fixtures/etg/serp-region.json";
import raw from "../../fixtures/etg/content-10004834.json";

beforeEach(() => {
  vi.stubEnv("ETG_MODE", "fixture");
  vi.stubEnv("ETG_BASE_URL", "https://etg.test");
  vi.stubEnv("SUPABASE_URL", "https://dummy.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "dummy");
  resetEnvCache();
  resetStoreCache();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network must not be used in fixture mode"); }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
  resetStoreCache();
});

const serpHids = (serp as { hotels: { hid: number }[] }).hotels.map((h) => h.hid);

describe("fixture mode", () => {
  test("serves every hid in the recorded search and both feature hotels, without the network", async () => {
    const map = await getHotelCards([...serpHids, 10004834, 8819557]);
    expect(map.size).toBe(new Set([...serpHids, 10004834, 8819557]).size);
    for (const h of map.values()) expect(h.name.length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("cards carry only the card's fields and at most the first photo", async () => {
    const card = (await getHotelCards([10004834])).get(10004834)!;
    expect(Object.keys(card).sort()).toEqual(["address", "hid", "images", "name", "reviewRating", "starRating"]);
    const full = (await getHotel(10004834))!;
    expect(full.images.length).toBeGreaterThan(1);
    expect(card.images).toEqual(full.images.slice(0, 1));
  });

  test("omits unknown hids and handles an empty list", async () => {
    expect((await getHotelCards([1])).size).toBe(0);
    expect((await getHotelCards([])).size).toBe(0);
    expect(await getHotel(1)).toBeNull();
  });

  test("getHotel returns a mapped hotel", async () => {
    const h = await getHotel(10004834);
    expect(h?.starRating).toBe(5);
    expect(h?.timeZone).toBe("America/Los_Angeles");
  });

  test("markup is 12 and dictionaries come from the recorded static fixture", async () => {
    expect(await getMarkupPercent()).toBe(12);
    const d = await getDictionaries();
    expect(d.taxNames.city_tax).toBe("City tax");
    expect(d.mealNames.breakfast).toBeTruthy();
  });

  test("recordMissing does not touch the network or database", async () => {
    await expect(recordMissing([1, 2, 3])).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("row mapping", () => {
  test("a hotel survives a round trip through the row shape", () => {
    const h = mapEtgHotel(raw, "2026-11-11T00:00:00.000Z");
    expect(rowToHotel(hotelToRow(h))).toEqual(h);
  });

  test("hotelToRow uses the snake_case column names", () => {
    const row = hotelToRow(mapEtgHotel(raw, "2026-11-11T00:00:00.000Z"));
    expect(Object.keys(row).sort()).toEqual(
      ["hid", "name", "address", "latitude", "longitude", "star_rating", "kind", "region_id", "region_name", "country_code", "time_zone", "check_in_time", "check_out_time", "images", "amenity_groups", "description", "metapolicy_struct", "metapolicy_extra_info", "review_rating", "review_detailed", "synced_at"].sort(),
    );
  });
});
