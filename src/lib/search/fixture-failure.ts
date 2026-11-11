import { EtgError } from "@/lib/etg/errors";

type Mode = "live" | "fixture";

/** Cookie that simulates a failed search. Honoured only in fixture mode; live mode ignores it. */
export const FIXTURE_FAIL_COOKIE = "etg_fixture_fail";
/** Cookie that slows the fixture search by this many milliseconds, so the loading state can be seen. */
export const FIXTURE_DELAY_COOKIE = "etg_fixture_delay";
const MAX_DELAY_MS = 5000;

export function fixtureFailure(mode: Mode, value: string | undefined): EtgError | null {
  if (mode !== "fixture") return null;
  if (value === "serp") return new EtgError({ code: "timeout", httpStatus: 504, retryable: true, message: "Simulated search timeout (fixture mode)" });
  if (value === "serp-fatal") return new EtgError({ code: "unexpected_response", httpStatus: 200, retryable: false, message: "Simulated search failure (fixture mode)" });
  return null;
}

export function fixtureDelayMs(mode: Mode, value: string | undefined): number {
  if (mode !== "fixture" || !value || !/^\d{1,6}$/.test(value)) return 0;
  return Math.min(Number(value), MAX_DELAY_MS);
}

/** `etg_fixture_fail=serp-empty` makes the fixture search return no hotels at all. */
export function fixtureEmpty(mode: Mode, value: string | undefined): boolean {
  return mode === "fixture" && value === "serp-empty";
}
