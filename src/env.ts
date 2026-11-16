import "server-only";
import { z } from "zod";

const schema = z.object({
  ETG_BASE_URL: z.string().min(1),
  ETG_KEY_ID: z.string().min(1).optional(),
  ETG_API_KEY: z.string().min(1).optional(),
  ETG_MODE: z.enum(["live", "fixture"]),
  // Required only in live mode (checked below), so an untouched fixture-mode .env.local runs
  // with no database. The content store never calls Supabase in fixture mode (see store.ts).
  SUPABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type Env = {
  ETG_BASE_URL: string;
  ETG_KEY_ID: string;
  ETG_API_KEY: string;
  ETG_MODE: "live" | "fixture";
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  const problems = result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  // Checked separately from the schema so a live-mode credential gap is reported alongside any other problem.
  // Supabase is only reached in live mode, so its variables are required only then; fixture mode needs neither.
  if (raw.ETG_MODE === "live") {
    for (const key of ["ETG_KEY_ID", "ETG_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
      if (!raw[key]) problems.push(`${key}: required when ETG_MODE is "live"`);
    }
  }
  // Fixture mode replays recorded prices, so it must never be switched on by accident in a real deployment.
  if (raw.ETG_MODE === "fixture" && raw.NODE_ENV === "production" && raw.ALLOW_FIXTURE_MODE !== "1") {
    problems.push('ETG_MODE: "fixture" is not allowed when NODE_ENV is "production" unless ALLOW_FIXTURE_MODE is exactly "1"');
  }
  if (!result.success || problems.length > 0) {
    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }
  // In fixture mode ETG and Supabase values are not required and default to empty strings.
  return {
    ...result.data,
    ETG_KEY_ID: result.data.ETG_KEY_ID ?? "",
    ETG_API_KEY: result.data.ETG_API_KEY ?? "",
    SUPABASE_URL: result.data.SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: result.data.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** True when ETG_MODE is "fixture": recorded responses replace the live suppliers. */
export const isFixtureMode = () => getEnv().ETG_MODE === "fixture";

/** Test-only: clears the memoized env so the next getEnv() re-parses process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
