import { resetEnvCache } from "@/env";
import { mapEtgHotel } from "@/lib/content/map-hotel";
import { getHotels, getMarkupPercent, hotelToRow, recordMissing, resetStoreCache, upsertHotels } from "@/lib/content/store";
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

test("getMarkupPercent rejects a bad setting", async () => {
  settingValue = "abc";
  await expect(getMarkupPercent()).rejects.toThrow(/markup_percent/);
});
