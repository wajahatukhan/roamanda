import { parseEnv } from "@/env";

test("rejects a missing ETG key", () => {
  expect(() => parseEnv({ ETG_BASE_URL: "https://x", ETG_MODE: "live" })).toThrow(/ETG_KEY_ID/);
});

test("fixture mode does not require ETG credentials", () => {
  const e = parseEnv({
    ETG_BASE_URL: "https://x",
    ETG_MODE: "fixture",
    SUPABASE_URL: "https://s",
    SUPABASE_SERVICE_ROLE_KEY: "k",
  });
  expect(e.ETG_MODE).toBe("fixture");
});
