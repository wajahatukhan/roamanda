import { resetEnvCache } from "@/env";
import { mapEtgHotel } from "@/lib/content/map-hotel";
import { getDictionaries, getHotels, getMarkupPercent, hotelToRow, recordMissing, resetStoreCache, upsertHotels } from "@/lib/content/store";
import raw from "../../fixtures/etg/content-10004834.json";

const calls: { table: string; op: string; arg: unknown }[] = [];
let failWith: { message: string; code?: string } | null = null;
let settingValue: unknown = 12;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const result = (data: unknown) => ({ data, error: failWith });
      return {
        select: () => ({
          in: (_c: string, hids: number[]) => {
            calls.push({ table, op: "in", arg: hids });
            return Promise.resolve(result(hids.map((hid) => ({ ...hotelToRow(mapEtgHotel({ ...raw, hid }, "2026-11-11T00:00:00.000Z")) }))));
          },
          eq: () => ({ maybeSingle: () => Promise.resolve(result({ value: settingValue })) }),
        }),
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

test("getHotels chunks the in filter at 200 and dedupes", async () => {
  const hids = Array.from({ length: 450 }, (_, i) => i + 1);
  const map = await getHotels([...hids, 1, 2]);
  expect(calls.filter((c) => c.op === "in").map((c) => (c.arg as number[]).length)).toEqual([200, 200, 50]);
  expect(map.size).toBe(450);
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
  const err = await getHotels([1]).catch((e: Error) => e);
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
