import { resetEnvCache } from "@/env";
import {
  HOTEL_EXISTS_FALSE_TTL_MS,
  HOTEL_EXISTS_MAX_ENTRIES,
  HOTEL_EXISTS_TRUE_TTL_MS,
  hotelExists,
  resetStoreCache,
  setHotelExistsClock,
} from "@/lib/content/store";

type Result = { data: { hid: number } | null; error: { message: string } | null };
const queries: { table: string; columns: string; hid: number; signal: AbortSignal | undefined }[] = [];
let answer: (hid: number) => Promise<Result> = (hid) => Promise.resolve({ data: { hid }, error: null });

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (_c: string, hid: number) => {
          const q: (typeof queries)[number] = { table, columns, hid, signal: undefined };
          queries.push(q);
          const builder = {
            abortSignal: (s: AbortSignal) => {
              q.signal = s;
              return builder;
            },
            maybeSingle: () => answer(hid),
          };
          return builder;
        },
      }),
    }),
  }),
}));

let now = 1_000_000;

function live() {
  vi.stubEnv("ETG_MODE", "live");
  vi.stubEnv("ETG_BASE_URL", "https://etg.test");
  vi.stubEnv("ETG_KEY_ID", "id");
  vi.stubEnv("ETG_API_KEY", "key");
  vi.stubEnv("SUPABASE_URL", "https://x.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_TOPSECRET");
  resetEnvCache();
  resetStoreCache();
  setHotelExistsClock(() => now);
}

beforeEach(() => {
  queries.length = 0;
  now = 1_000_000;
  answer = (hid) => Promise.resolve({ data: { hid }, error: null });
  live();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  resetStoreCache();
});

describe("hotelExists (live)", () => {
  test("true when the row is there, asking for the hid column only", async () => {
    expect(await hotelExists(7)).toBe(true);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({ table: "hotels", columns: "hid", hid: 7 });
  });

  test("false when there is no row", async () => {
    answer = () => Promise.resolve({ data: null, error: null });
    expect(await hotelExists(7)).toBe(false);
  });

  test("null on a database error, which is not cached", async () => {
    answer = () => Promise.resolve({ data: null, error: { message: "boom" } });
    expect(await hotelExists(7)).toBeNull();
    answer = (hid) => Promise.resolve({ data: { hid }, error: null });
    expect(await hotelExists(7)).toBe(true);
    expect(queries).toHaveLength(2);
  });

  test("null when the query rejects", async () => {
    answer = () => Promise.reject(new Error("network"));
    expect(await hotelExists(7)).toBeNull();
  });

  test("null when the database never answers, within the timeout, and the query is aborted", async () => {
    answer = () => new Promise<Result>(() => {});
    const started = performance.now();
    expect(await hotelExists(7, { timeoutMs: 20 })).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
    expect(queries[0]!.signal?.aborted).toBe(true);
  });

  test("a query that fails after the timeout does not become an unhandled rejection", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    answer = () => new Promise<Result>((_, reject) => setTimeout(() => reject(new Error("late")), 40));
    expect(await hotelExists(7, { timeoutMs: 10 })).toBeNull();
    await new Promise((r) => setTimeout(r, 80));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  test("null is not cached: the next call asks again", async () => {
    answer = () => new Promise<Result>(() => {});
    expect(await hotelExists(7, { timeoutMs: 10 })).toBeNull();
    expect(await hotelExists(7, { timeoutMs: 10 })).toBeNull();
    expect(queries).toHaveLength(2);
  });

  test("a known answer is cached: a second call makes no query", async () => {
    expect(await hotelExists(7)).toBe(true);
    expect(await hotelExists(7)).toBe(true);
    answer = () => Promise.resolve({ data: null, error: null });
    expect(await hotelExists(8)).toBe(false);
    expect(await hotelExists(8)).toBe(false);
    expect(queries.map((q) => q.hid)).toEqual([7, 8]);
  });

  test("false expires after 60 s, true only after 5 minutes", async () => {
    answer = (hid) => Promise.resolve({ data: hid === 1 ? { hid } : null, error: null });
    expect(await hotelExists(1)).toBe(true);
    expect(await hotelExists(2)).toBe(false);
    expect(queries).toHaveLength(2);

    now += HOTEL_EXISTS_FALSE_TTL_MS - 1;
    await hotelExists(1);
    await hotelExists(2);
    expect(queries).toHaveLength(2);

    now += 1; // 60 s: the false answer is stale, the true one is not
    await hotelExists(1);
    expect(queries).toHaveLength(2);
    await hotelExists(2);
    expect(queries).toHaveLength(3);

    now += HOTEL_EXISTS_TRUE_TTL_MS - HOTEL_EXISTS_FALSE_TTL_MS; // 5 minutes after the true answer
    await hotelExists(1);
    expect(queries).toHaveLength(4);
  });

  test("keeps at most 1,000 entries and evicts the oldest first", async () => {
    for (let hid = 1; hid <= HOTEL_EXISTS_MAX_ENTRIES + 1; hid++) await hotelExists(hid);
    expect(queries).toHaveLength(HOTEL_EXISTS_MAX_ENTRIES + 1);
    await hotelExists(HOTEL_EXISTS_MAX_ENTRIES + 1); // newest: still cached
    await hotelExists(2); // second oldest: still cached
    expect(queries).toHaveLength(HOTEL_EXISTS_MAX_ENTRIES + 1);
    await hotelExists(1); // oldest: evicted, asks again
    expect(queries).toHaveLength(HOTEL_EXISTS_MAX_ENTRIES + 2);
  });
});

describe("hotelExists (fixture mode)", () => {
  test("answers from the recorded content and makes no network or database call", async () => {
    vi.stubEnv("ETG_MODE", "fixture");
    resetEnvCache();
    resetStoreCache();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await hotelExists(10004834)).toBe(true);
    expect(await hotelExists(99999999)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(queries).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});
