import { resetEnvCache } from "@/env";
import { HotelPageData, MulticompleteData, SearchRegionData } from "@/lib/etg/schemas";
import { hotelPage, multicomplete, parseHotelsLenient, searchRegion } from "@/lib/etg/search";
import hp10004834 from "../../fixtures/etg/hp-10004834.json";
import hp8819557 from "../../fixtures/etg/hp-8819557.json";
import multicompleteFixture from "../../fixtures/etg/multicomplete.json";
import serpRegion from "../../fixtures/etg/serp-region.json";

// Fixtures carry absolute dates from the day they were recorded; nothing here depends on today's date.
const query = {
  checkin: "2030-01-10",
  checkout: "2030-01-12",
  residency: "gb",
  guests: [{ adults: 2, children: [] }],
  currency: "USD",
};

beforeEach(() => {
  vi.stubEnv("ETG_MODE", "fixture");
  vi.stubEnv("ETG_BASE_URL", "https://etg.test");
  vi.stubEnv("SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  resetEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
});

test("hotel page fixture parses and every rate has a payment type", () => {
  const rates = HotelPageData.parse(hp10004834).hotels[0]!.rates;
  expect(rates.length).toBeGreaterThan(0);
  for (const r of rates) expect(r.payment_options.payment_types.length).toBeGreaterThan(0);
});

test("the second hotel page fixture, the region fixture and multicomplete also parse", () => {
  expect(HotelPageData.parse(hp8819557).hotels[0]!.rates.length).toBeGreaterThan(0);
  expect(SearchRegionData.parse(serpRegion).hotels.length).toBeGreaterThan(0);
  expect(MulticompleteData.parse(multicompleteFixture).regions.length).toBeGreaterThan(0);
});

test("unknown extra fields are tolerated", () => {
  const data = structuredClone(hp10004834) as { hotels: { rates: Record<string, unknown>[] }[] };
  data.hotels[0]!.rates[0]!.foo = 1;
  expect(() => HotelPageData.parse(data)).not.toThrow();
});

test("empty tax_data ({} as the sandbox sends it) parses to an empty tax list", () => {
  const rates = HotelPageData.parse(hp8819557).hotels[0]!.rates;
  expect(rates[0]!.payment_options.payment_types[0]!.tax_data.taxes).toEqual([]);
});

test("a rate missing room_name is rejected", () => {
  const data = structuredClone(hp10004834) as { hotels: { rates: Record<string, unknown>[] }[] };
  delete data.hotels[0]!.rates[0]!.room_name;
  expect(() => HotelPageData.parse(data)).toThrow();
});

test("fixture mode returns fixture data without fetch", async () => {
  vi.stubGlobal("fetch", () => {
    throw new Error("network call in fixture mode");
  });
  const rates = await hotelPage(10004834, query);
  expect(rates.length).toBe(hp10004834.hotels[0]!.rates.length);
  const hotels = await searchRegion(2011, query);
  expect(hotels.length).toBe(serpRegion.hotels.length);
  const found = await multicomplete("Paris");
  expect(found.regions.map((r) => r.id)).toContain(2734);
});

test("fixture mode hotelPage returns the recorded fixture for that hid, else the 10004834 one", async () => {
  expect((await hotelPage(8819557, query)).length).toBe(hp8819557.hotels[0]!.rates.length);
  expect((await hotelPage(123, query)).length).toBe(hp10004834.hotels[0]!.rates.length);
});

test("live mode posts the stay to the hotel page endpoint with language en and returns that hotel's rates", async () => {
  vi.stubEnv("ETG_MODE", "live");
  vi.stubEnv("ETG_KEY_ID", "id");
  vi.stubEnv("ETG_API_KEY", "key");
  resetEnvCache();
  const fetchSpy = vi.fn<typeof fetch>(async () =>
    Response.json({ status: "ok", error: null, data: hp10004834, debug: {} }),
  );
  vi.stubGlobal("fetch", fetchSpy);
  const rates = await hotelPage(10004834, query);
  expect(rates.length).toBe(hp10004834.hotels[0]!.rates.length);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://etg.test/api/b2b/v3/search/hp/");
  expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ ...query, language: "en", hid: 10004834 });
});

describe("lenient hotel parsing", () => {
  // Test-only loose shape so fixtures can be corrupted in place.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Raw = { hotels: { rates: Record<string, any>[] }[] };
  const copy = () => structuredClone(hp10004834) as unknown as Raw;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  test("a malformed amount is rejected", () => {
    const data = copy();
    data.hotels[0]!.rates[0]!.payment_options.payment_types[0].amount = "abc";
    expect(() => HotelPageData.parse(data)).toThrow();
    for (const bad of ["", "-5", "NaN"]) {
      data.hotels[0]!.rates[0]!.payment_options.payment_types[0].amount = bad;
      expect(() => HotelPageData.parse(data)).toThrow();
    }
  });

  test("a null room_name drops only that rate and warns once without payload", () => {
    const data = copy();
    const total = data.hotels[0]!.rates.length;
    data.hotels[0]!.rates[0]!.room_name = null;
    const out = parseHotelsLenient(data);
    expect(out.droppedRates).toBe(1);
    expect(out.hotels[0]!.rates.length).toBe(total - 1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("room_name");
  });

  test("an unknown payment type drops only that rate", () => {
    const data = copy();
    data.hotels[0]!.rates[1]!.payment_options.payment_types[0].type = "installments";
    const out = parseHotelsLenient(data);
    expect(out.droppedRates).toBe(1);
    expect(out.hotels[0]!.rates.length).toBe(data.hotels[0]!.rates.length - 1);
  });

  test("a rate with empty payment_types is dropped", () => {
    const data = copy();
    data.hotels[0]!.rates[0]!.payment_options.payment_types = [];
    expect(parseHotelsLenient(data).droppedRates).toBe(1);
  });

  test("an invalid hotel is dropped", () => {
    const data = copy() as unknown as { hotels: unknown[] };
    data.hotels.push({ hid: "x", rates: [] });
    const out = parseHotelsLenient(data);
    expect(out.droppedHotels).toBe(1);
    expect(out.hotels.length).toBe(1);
  });

  test("all rates invalid throws unexpected_response", () => {
    const data = copy();
    for (const r of data.hotels[0]!.rates) r.room_name = null;
    expect(() => parseHotelsLenient(data)).toThrow(expect.objectContaining({ code: "unexpected_response" }));
  });

  test("zero rates is a normal empty result", () => {
    expect(parseHotelsLenient({ hotels: [{ hid: 1, rates: [] }] })).toEqual({ hotels: [{ hid: 1, rates: [] }], droppedRates: 0, droppedHotels: 0 });
    expect(parseHotelsLenient({ hotels: [] }).hotels).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  test("a broken envelope throws", () => {
    expect(() => parseHotelsLenient({ nope: 1 })).toThrow(expect.objectContaining({ code: "unexpected_response" }));
  });
});
