type Mode = "live" | "fixture";

/** Cookie a test sets so its own fixture reads are counted apart from other tests running at the same time. Fixture mode only. */
export const FIXTURE_TAG_COOKIE = "etg_fixture_tag";
const MAX_TAGS = 500;

// On globalThis so the page bundle and the route handler that reports the count share one counter.
const KEY = Symbol.for("travel-portal.fixtureReads");
const store = (): Map<string, number> => ((globalThis as Record<symbol, unknown>)[KEY] ??= new Map<string, number>()) as Map<string, number>;

/** A usable tag from the cookie or query value, else "". Always "" outside fixture mode. */
export function parseFixtureTag(mode: Mode, value: string | null | undefined): string {
  return mode === "fixture" && value && /^[a-z0-9-]{1,40}$/.test(value) ? value : "";
}

/** Counts one fixture read of the hotel-page rates under `tag`. Does nothing outside fixture mode. */
export function countHotelPageFixtureRead(mode: Mode, tag = ""): void {
  if (mode !== "fixture") return;
  const counts = store();
  if (!counts.has(tag) && counts.size >= MAX_TAGS) counts.delete(counts.keys().next().value as string);
  counts.set(tag, (counts.get(tag) ?? 0) + 1);
}

/** How many hotel-page fixture reads were made under `tag`. Always 0 outside fixture mode. */
export function hotelPageFixtureReads(mode: Mode, tag = ""): number {
  return mode === "fixture" ? (store().get(tag) ?? 0) : 0;
}
