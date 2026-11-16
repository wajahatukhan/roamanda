import { resetEnvCache } from "@/env";
import { mapEtgHotel } from "@/lib/content/map-hotel";
import { CONTENT_READ_TIMEOUT_MS, getDictionaries, getHotel, getHotelCards, getMarkupPercent, hotelToRow, recordMissing, resetStoreCache, upsertHotels } from "@/lib/content/store";
import raw from "../../fixtures/etg/content-10004834.json";

const calls: { table: string; op: string; arg: unknown }[] = [];
let failWith: { message: string; code?: string } | null = null;
let settingValue: unknown = 12;
/** When true, hotel reads never answer (to test the time limit). */
let hang = false;
const signals: AbortSignal[] = [];

const hotelRow = (hid: number) => hotelToRow(mapEtgHotel({ ...raw, hid }, "2026-11-11T00:00:00.000Z"));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const result = (data: unknown) => ({ data, error: failWith });
      const answer = <T,>(value: T) => (hang ? new Promise<never>(() => {}) : Promise.resolve(value));
      return {
        select: (columns: string) => {
          const builder = {
            abortSignal: (s: AbortSignal) => {
              signals.push(s);
              return builder;
            },
            in: (_c: string, hids: number[]) => {
              calls.push({ table, op: "in", arg: hids });
              calls.push({ table, op: "columns", arg: columns });
              // What PostgREST returns for the card's columns: images reduced to the first entry.
              return answer(result(hids.map((hid) => {
                const row = hotelRow(hid);
                return { hid: row.hid, name: row.name, address: row.address, star_rating: row.star_rating, review_rating: row.review_rating, first_image: row.images[0] ?? null };
              })));
            },
            eq: (_c: string, value: unknown) => {
              const single = {
                abortSignal: (s: AbortSignal) => {
                  signals.push(s);
                  return single;
                },
                maybeSingle: () => (table === "hotels" ? answer(result(hotelRow(Number(value)))) : answer(result({ value: settingValue }))),
              };
              return single;
            },
          };
          return builder;
        },
        upsert: (rows: unknown[], opts: unknown) => {
          calls.push({ table, op: "upsert", arg: { n: rows.length, opts } });
          return Promise.resolve({ error: failWith });
        },
      };
    },
  }),
}));

beforeEach(() => {
  calls.length = 0;
  signals.length = 0;
  hang = false;
  failWith = null;
  settingValue = 12;
  vi.stubEnv("ETG_MODE", "live");
  vi.stubEnv("ETG_BASE_URL", "https://etg.test");
  vi.stubEnv("ETG_KEY_ID", "id");
  vi.stubEnv("ETG_API_KEY", "key");
  vi.stubEnv("SUPABASE_URL", "https://x.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_TOPSECRET");
  resetEnvCache();
  resetStoreCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  resetStoreCache();
});

test("getHotelCards chunks the in filter at 200 and dedupes", async () => {
  const hids = Array.from({ length: 450 }, (_, i) => i + 1);
  const map = await getHotelCards([...hids, 1, 2]);
  expect(calls.filter((c) => c.op === "in").map((c) => (c.arg as number[]).length)).toEqual([200, 200, 50]);
  expect(map.size).toBe(450);
});

test("getHotelCards asks only for the card's columns, with images reduced to the first, and maps them", async () => {
  const map = await getHotelCards([10004834]);
  expect(calls.find((c) => c.op === "columns")?.arg).toBe("hid,name,address,star_rating,review_rating,first_image:images->0");
  const card = map.get(10004834)!;
  const full = hotelRow(10004834);
  expect(card).toEqual({ hid: 10004834, name: full.name, address: full.address, starRating: full.star_rating, reviewRating: null, images: full.images.slice(0, 1) });
});

describe("time limit on page reads", () => {
  test("is 3 seconds", () => {
    expect(CONTENT_READ_TIMEOUT_MS).toBe(3000);
  });

  test("getHotelCards throws a clear error and aborts the query when the database does not answer in time", async () => {
    hang = true;
    await expect(getHotelCards([1, 2], { timeoutMs: 20 })).rejects.toThrow("Content store: reading hotels timed out after 20 ms");
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  test("getHotel throws a clear error and aborts the query when the database does not answer in time", async () => {
    hang = true;
    await expect(getHotel(10004834, { timeoutMs: 20 })).rejects.toThrow("Content store: reading hotel timed out after 20 ms");
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(true);
  });

  test("an answer within the limit is returned and nothing is aborted", async () => {
    expect((await getHotel(10004834, { timeoutMs: 1000 }))?.hid).toBe(10004834);
    expect(signals.every((s) => !s.aborted)).toBe(true);
  });

  test("getHotel reports a database error clearly", async () => {
    failWith = { message: "permission denied", code: "42501" };
    await expect(getHotel(1)).rejects.toThrow(/reading hotel failed \(42501\): permission denied/);
  });
});

test("upsertHotels chunks writes at 200", async () => {
  const h = mapEtgHotel(raw, "2026-11-11T00:00:00.000Z");
  await upsertHotels(Array.from({ length: 401 }, (_, i) => ({ ...h, hid: i + 1 })));
  expect(calls.filter((c) => c.op === "upsert").map((c) => (c.arg as { n: number }).n)).toEqual([200, 200, 1]);
});

test("recordMissing ignores duplicates", async () => {
  await recordMissing([5, 5, 6]);
  expect(calls[0]?.arg).toEqual({ n: 2, opts: { onConflict: "hid", ignoreDuplicates: true } });
});

test("database errors throw a clear message without key material", async () => {
  failWith = { message: "permission denied", code: "42501" };
  const err = await getHotelCards([1]).catch((e: Error) => e);
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).message).toContain("reading hotels");
  expect((err as Error).message).toContain("permission denied");
  expect((err as Error).message).not.toContain("TOPSECRET");
  await expect(upsertHotels([mapEtgHotel(raw)])).rejects.toThrow(/writing hotels/);
});

test("getMarkupPercent reads the setting and caches it for 60 s", async () => {
  settingValue = 15;
  expect(await getMarkupPercent()).toBe(15);
  settingValue = 20;
  expect(await getMarkupPercent()).toBe(15);
  vi.useFakeTimers({ now: Date.now() + 61_000, toFake: ["Date"] });
  try {
    expect(await getMarkupPercent()).toBe(20);
  } finally {
    vi.useRealTimers();
  }
});

test.each([["empty", ""], ["blank", "  "], ["over", "1200"], ["101", 101], ["negative", -1], ["boolean", true], ["null", null], ["object", {}], ["text", "abc"], ["negative string", "-1"]])(
  "getMarkupPercent rejects %s and does not cache it",
  async (_n, bad) => {
    settingValue = bad;
    await expect(getMarkupPercent()).rejects.toThrow(/markup_percent/);
    settingValue = 12;
    expect(await getMarkupPercent()).toBe(12);
  },
);

test.each([[12, 12], ["12.5", 12.5], [0, 0], [100, 100], [" 7 ", 7]])("getMarkupPercent accepts %s", async (v, want) => {
  settingValue = v;
  expect(await getMarkupPercent()).toBe(want);
});

describe("time limit on settings reads", () => {
  test("getMarkupPercent throws a clear error and aborts the query when the database does not answer in time", async () => {
    hang = true;
    await expect(getMarkupPercent({ timeoutMs: 20 })).rejects.toThrow("Content store: reading setting markup_percent timed out after 20 ms");
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  test("getDictionaries throws a clear error and aborts the query when the database does not answer in time", async () => {
    hang = true;
    await expect(getDictionaries({ timeoutMs: 20 })).rejects.toThrow("Content store: reading setting dictionaries timed out after 20 ms");
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  test("defaults to the same 3-second limit as the other store reads", async () => {
    settingValue = 15;
    expect(await getMarkupPercent()).toBe(15);
    // The read passed a real AbortSignal (the bound), and it was not aborted within the limit.
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => !s.aborted)).toBe(true);
  });
});

describe("getDictionaries", () => {
  test("a missing row is silent and empty", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    settingValue = undefined;
    expect(await getDictionaries()).toEqual({ taxNames: {}, mealNames: {} });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("a malformed value logs once, returns empty and is not cached", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    settingValue = { taxNames: "nope" };
    expect(await getDictionaries()).toEqual({ taxNames: {}, mealNames: {} });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("nope");
    settingValue = { taxNames: { city_tax: "City tax" }, mealNames: {} };
    expect((await getDictionaries()).taxNames.city_tax).toBe("City tax");
    spy.mockRestore();
  });
});
