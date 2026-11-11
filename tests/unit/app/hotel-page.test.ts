import { resetEnvCache } from "@/env";
import HotelPage from "@/app/hotel/[hid]/page";

vi.mock("@/lib/hotel/content", () => ({ getHotelContent: async () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/hotel/[hid]/rates", () => ({ RatesSection: () => null }));

test("requesting an unknown hotel answers not-found", async () => {
  for (const [k, v] of Object.entries({ ETG_MODE: "fixture", ETG_BASE_URL: "https://etg.test", ETG_KEY_ID: "id", ETG_API_KEY: "key", SUPABASE_URL: "https://x.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "k" })) vi.stubEnv(k, v);
  resetEnvCache();
  const props = { params: Promise.resolve({ hid: "99999999" }), searchParams: Promise.resolve({}) } as Parameters<typeof HotelPage>[0];
  await expect(HotelPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
  vi.unstubAllEnvs();
  resetEnvCache();
});
