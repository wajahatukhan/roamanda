import { resetEnvCache } from "@/env";
import { GET, MAX_QUERY_LENGTH } from "@/app/api/destinations/route";

const multicomplete = vi.fn();
vi.mock("@/lib/etg/search", () => ({ multicomplete: (...a: unknown[]) => multicomplete(...a) }));

beforeEach(() => {
  multicomplete.mockReset();
  multicomplete.mockResolvedValue({ regions: [{ id: 1, name: "Paris", type: "RT_CITY", country_code: "FR" }], hotels: [] });
  for (const [k, v] of Object.entries({ ETG_MODE: "live", ETG_BASE_URL: "https://etg.test", ETG_KEY_ID: "id", ETG_API_KEY: "key", SUPABASE_URL: "https://x.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "k" })) vi.stubEnv(k, v);
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const get = (q: string) => GET(new Request(`http://localhost/api/destinations?q=${encodeURIComponent(q)}`));

describe("GET /api/destinations", () => {
  test("a query of up to 80 characters (after trimming) is looked up", async () => {
    expect(MAX_QUERY_LENGTH).toBe(80);
    const res = await get(`  ${"p".repeat(80)}  `);
    expect(res.status).toBe(200);
    expect(multicomplete).toHaveBeenCalledWith("p".repeat(80));
  });

  test("a longer query gets an empty result without calling the supplier", async () => {
    const res = await get("p".repeat(81));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ regions: [], hotels: [] });
    expect(multicomplete).not.toHaveBeenCalled();
  });
});
