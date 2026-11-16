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

test("fixture mode does not require Supabase credentials (an untouched .env.example runs)", () => {
  const e = parseEnv({ ETG_BASE_URL: "https://x", ETG_MODE: "fixture" });
  expect(e.ETG_MODE).toBe("fixture");
  expect(e.SUPABASE_URL).toBe("");
  expect(e.SUPABASE_SERVICE_ROLE_KEY).toBe("");
});

test("live mode requires Supabase credentials, naming both variables", () => {
  const run = () => parseEnv({ ETG_BASE_URL: "https://x", ETG_MODE: "live", ETG_KEY_ID: "a", ETG_API_KEY: "b" });
  expect(run).toThrow(/SUPABASE_URL/);
  expect(run).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
});

describe("production safety gate for fixture mode", () => {
  const base = { ETG_BASE_URL: "https://x", SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" };

  test("production + fixture without the flag throws, naming both variables", () => {
    const run = () => parseEnv({ ...base, ETG_MODE: "fixture", NODE_ENV: "production" });
    expect(run).toThrow(/ETG_MODE/);
    expect(run).toThrow(/ALLOW_FIXTURE_MODE/);
  });
  test("production + fixture with a flag other than exactly 1 throws", () => {
    expect(() => parseEnv({ ...base, ETG_MODE: "fixture", NODE_ENV: "production", ALLOW_FIXTURE_MODE: "true" })).toThrow(/ALLOW_FIXTURE_MODE/);
  });
  test("production + fixture with ALLOW_FIXTURE_MODE=1 passes", () => {
    expect(parseEnv({ ...base, ETG_MODE: "fixture", NODE_ENV: "production", ALLOW_FIXTURE_MODE: "1" }).ETG_MODE).toBe("fixture");
  });
  test("development + fixture passes without the flag", () => {
    expect(parseEnv({ ...base, ETG_MODE: "fixture", NODE_ENV: "development" }).ETG_MODE).toBe("fixture");
  });
  test("live mode in production is unaffected", () => {
    const e = parseEnv({ ...base, ETG_MODE: "live", ETG_KEY_ID: "a", ETG_API_KEY: "b", NODE_ENV: "production" });
    expect(e.ETG_MODE).toBe("live");
  });
});
