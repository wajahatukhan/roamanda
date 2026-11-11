import "server-only";
import type { StayQuery } from "@/lib/etg/schemas";
import { searchRegion, type RegionSearch } from "@/lib/etg/search";
import { encodeRooms } from "@/lib/search/params";

type Entry = { at: number; promise: Promise<RegionSearch> };

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;

/** Insertion-ordered, so the first key is always the oldest entry. */
const cache = new Map<string, Entry>();

const keyOf = (regionId: number, q: StayQuery) =>
  JSON.stringify([regionId, q.checkin, q.checkout, encodeRooms(q.guests), q.residency, q.currency]);

/**
 * Region search results held for five minutes, so changing sort or filters does not send a new request to
 * RateHawk (which limits search requests). Only for the approximate "From" prices on the list; hotel pages
 * never use it. Concurrent identical calls share one request, and a failed search is not kept.
 */
export async function cachedSearchRegion(
  regionId: number,
  q: StayQuery,
  deps: { search?: typeof searchRegion; now?: () => number } = {},
): Promise<RegionSearch> {
  const search = deps.search ?? searchRegion;
  const now = (deps.now ?? Date.now)();
  const key = keyOf(regionId, q);

  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.promise;
  if (hit) cache.delete(key);

  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }

  const promise = search(regionId, q);
  const entry: Entry = { at: now, promise };
  cache.set(key, entry);
  promise.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return promise;
}

/** Test hook: empties the cache. */
export function clearSerpCache(): void {
  cache.clear();
}
