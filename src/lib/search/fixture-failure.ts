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

/** `etg_fixture_fail=hp` (retryable) or `hp-fatal` (not retryable) makes the hotel-page rates request fail. */
export function hotelPageFailure(mode: Mode, value: string | undefined): EtgError | null {
  if (mode !== "fixture") return null;
  if (value === "hp") return new EtgError({ code: "timeout", httpStatus: 504, retryable: true, message: "Simulated hotel page timeout (fixture mode)" });
  if (value === "hp-fatal") return new EtgError({ code: "unexpected_response", httpStatus: 200, retryable: false, message: "Simulated hotel page failure (fixture mode)" });
  return null;
}

/** `etg_fixture_fail=hp-empty` makes the hotel page return no rates at all. */
export function hotelPageEmpty(mode: Mode, value: string | undefined): boolean {
  return mode === "fixture" && value === "hp-empty";
}

/** Cookie that gives the hotel page a fixed review score and category scores, so a rated hotel can be tested. Fixture mode only. */
export const FIXTURE_RATED_COOKIE = "etg_fixture_rated";

export const FIXTURE_RATED_REVIEW = {
  reviewRating: 8.6,
  reviewDetailed: { cleanness: 9.1, location: 8.4, price: 7.9, services: 8.8, wifi: 8.2 },
};

/** `etg_fixture_rated=1` overlays a fixed rating onto the hotel content for that request. Null otherwise, and always null in live mode. */
export function fixtureRated(mode: Mode, value: string | undefined): typeof FIXTURE_RATED_REVIEW | null {
  return mode === "fixture" && value === "1" ? FIXTURE_RATED_REVIEW : null;
}

/** `etg_fixture_fail=content` makes the hotel page's content read fail, as a database error would. Fixture mode only. */
export function hotelContentFailure(mode: Mode, value: string | undefined): Error | null {
  return mode === "fixture" && value === "content" ? new Error("Content store: reading hotel failed (simulated, fixture mode)") : null;
}

/** `etg_fixture_fail=serp-no-content` makes the search find hotels of which none has stored content. Fixture mode only. */
export function fixtureNoContent(mode: Mode, value: string | undefined): boolean {
  return mode === "fixture" && value === "serp-no-content";
}
