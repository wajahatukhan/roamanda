import "server-only";
import { z } from "zod";

const schema = z.object({
  ETG_BASE_URL: z.string().min(1),
  ETG_KEY_ID: z.string().min(1).optional(),
  ETG_API_KEY: z.string().min(1).optional(),
  ETG_MODE: z.enum(["live", "fixture"]),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
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
  if (raw.ETG_MODE === "live") {
    for (const key of ["ETG_KEY_ID", "ETG_API_KEY"] as const) {
      if (!raw[key]) problems.push(`${key}: required when ETG_MODE is "live"`);
    }
  }
  if (!result.success || problems.length > 0) {
    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }
  // In fixture mode ETG credentials are not required and default to empty strings.
  return { ...result.data, ETG_KEY_ID: result.data.ETG_KEY_ID ?? "", ETG_API_KEY: result.data.ETG_API_KEY ?? "" };
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test-only: clears the memoized env so the next getEnv() re-parses process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
