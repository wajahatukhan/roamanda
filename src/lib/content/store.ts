import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEnv } from "@/env";
import { chunk } from "./chunk";
import { mapEtgHotels } from "./map-hotel";
import type { Dictionaries, Hotel, HotelCard } from "./types";

export { imageUrl } from "./image-url";
export { mapEtgHotel } from "./map-hotel";
export type { Hotel, HotelCard } from "./types";

/** Rows per `in` filter (reads) and per write batch. */
export const STORE_CHUNK_SIZE = 200;
const MARKUP_TTL_MS = 60_000;
const DICTIONARIES_TTL_MS = 10 * 60_000;
const FIXTURE_MARKUP_PERCENT = 12;
const FIXTURE_SYNCED_AT = "2026-11-11T00:00:00.000Z";

const isFixtureMode = () => getEnv().ETG_MODE === "fixture";

// ---------------------------------------------------------------------------------------------
// Supabase client (lazy)
// ---------------------------------------------------------------------------------------------

let client: SupabaseClient | undefined;

function db(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return client;
}

/** Throws a clear error that names the operation and carries the database's message, never key material. */
function check(op: string, error: { message: string; code?: string } | null): void {
  if (error) throw new Error(`Content store: ${op} failed${error.code ? ` (${error.code})` : ""}: ${error.message}`);
}

// ---------------------------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------------------------

type HotelRow = {
  hid: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  star_rating: number | null;
  kind: string | null;
  region_id: number | null;
  region_name: string | null;
  country_code: string | null;
  time_zone: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  images: Hotel["images"];
  amenity_groups: Hotel["amenityGroups"];
  description: Hotel["description"];
  metapolicy_struct: Hotel["metapolicyStruct"];
  metapolicy_extra_info: string | null;
  review_rating: number | string | null;
  review_detailed: Hotel["reviewDetailed"];
  synced_at: string;
};

export function hotelToRow(h: Hotel): HotelRow {
  return {
    hid: h.hid,
    name: h.name,
    address: h.address,
    latitude: h.latitude,
    longitude: h.longitude,
    star_rating: h.starRating,
    kind: h.kind,
    region_id: h.regionId,
    region_name: h.regionName,
    country_code: h.countryCode,
    time_zone: h.timeZone,
    check_in_time: h.checkInTime,
    check_out_time: h.checkOutTime,
    images: h.images,
    amenity_groups: h.amenityGroups,
    description: h.description,
    metapolicy_struct: h.metapolicyStruct,
    metapolicy_extra_info: h.metapolicyExtraInfo,
    review_rating: h.reviewRating,
    review_detailed: h.reviewDetailed,
    synced_at: h.syncedAt,
  };
}

export function rowToHotel(r: HotelRow): Hotel {
  return {
    hid: Number(r.hid),
    name: r.name,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    starRating: r.star_rating,
    kind: r.kind,
    regionId: r.region_id === null ? null : Number(r.region_id),
    regionName: r.region_name,
    countryCode: r.country_code,
    timeZone: r.time_zone,
    checkInTime: r.check_in_time,
    checkOutTime: r.check_out_time,
    images: r.images ?? [],
    amenityGroups: r.amenity_groups ?? [],
    description: r.description ?? [],
    metapolicyStruct: r.metapolicy_struct,
    metapolicyExtraInfo: r.metapolicy_extra_info,
    reviewRating: r.review_rating === null ? null : Number(r.review_rating),
    reviewDetailed: r.review_detailed,
    syncedAt: r.synced_at,
  };
}

// ---------------------------------------------------------------------------------------------
// Fixture mode: no network, no database
// ---------------------------------------------------------------------------------------------

let fixtureHotels: Promise<Map<number, Hotel>> | undefined;

function loadFixtureHotels(): Promise<Map<number, Hotel>> {
  fixtureHotels ??= import("../../../tests/fixtures/etg/content-hotels.json").then((m) => {
    const data = m.default as { hotels: unknown[]; reviews: { hid: number; rating: number | null; detailed_ratings: Record<string, number | null> | null }[] };
    const mapped = mapEtgHotels(data.hotels, FIXTURE_SYNCED_AT, data.reviews);
    return new Map(mapped.hotels.map((h) => [h.hid, h]));
  });
  return fixtureHotels;
}

// ---------------------------------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------------------------------

/** Page reads of hotel content give up after this long, so a slow database fails the page instead of hanging it. */
export const CONTENT_READ_TIMEOUT_MS = 3000;

/**
 * Runs a read with an abort signal and a time limit, like `hotelExists` does, but throws a clear error when the time
 * runs out (a page cannot do without the answer). The query is aborted on timeout; a late failure is swallowed.
 */
async function bounded<T>(op: string, run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Content store: ${op} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  const work = run(controller.signal);
  work.catch(() => {}); // Handled by the race below; a failure after the timeout must not become an unhandled rejection.
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/** One hotel's full content, or null when the store has none. Throws on a database error or after 3 seconds. */
export async function getHotel(hid: number, opts: { timeoutMs?: number } = {}): Promise<Hotel | null> {
  if (isFixtureMode()) return (await loadFixtureHotels()).get(hid) ?? null;
  return bounded(
    "reading hotel",
    async (signal) => {
      const { data, error } = await db().from("hotels").select("*").eq("hid", hid).abortSignal(signal).maybeSingle();
      check("reading hotel", error);
      return data ? rowToHotel(data as HotelRow) : null;
    },
    opts.timeoutMs ?? CONTENT_READ_TIMEOUT_MS,
  );
}

/** The columns a search-result card shows; `images` is reduced to its first entry by the database. */
const CARD_COLUMNS = "hid,name,address,star_rating,review_rating,first_image:images->0";
type CardRow = Pick<HotelRow, "hid" | "name" | "address" | "star_rating" | "review_rating"> & { first_image: Hotel["images"][number] | null };

function toCard(h: Hotel): HotelCard {
  return { hid: h.hid, name: h.name, address: h.address, starRating: h.starRating, reviewRating: h.reviewRating, images: h.images.slice(0, 1) };
}

/**
 * Card data for the search list, by hid: only the card's columns, 200 hids per request, all within 3 seconds.
 * Unknown hids are simply absent from the map. Throws on a database error or on timeout.
 */
export async function getHotelCards(hids: number[], opts: { timeoutMs?: number } = {}): Promise<Map<number, HotelCard>> {
  const out = new Map<number, HotelCard>();
  if (hids.length === 0) return out;
  if (isFixtureMode()) {
    const all = await loadFixtureHotels();
    for (const hid of hids) {
      const h = all.get(hid);
      if (h) out.set(hid, toCard(h));
    }
    return out;
  }
  return bounded(
    "reading hotels",
    async (signal) => {
      for (const part of chunk([...new Set(hids)], STORE_CHUNK_SIZE)) {
        const { data, error } = await db().from("hotels").select(CARD_COLUMNS).abortSignal(signal).in("hid", part);
        check("reading hotels", error);
        for (const r of (data ?? []) as unknown as CardRow[]) {
          const hid = Number(r.hid);
          out.set(hid, {
            hid,
            name: r.name,
            address: r.address,
            starRating: r.star_rating,
            reviewRating: r.review_rating === null ? null : Number(r.review_rating),
            images: r.first_image ? [r.first_image] : [],
          });
        }
      }
      return out;
    },
    opts.timeoutMs ?? CONTENT_READ_TIMEOUT_MS,
  );
}

// Existence check (used by proxy.ts on every hotel page request)

export const HOTEL_EXISTS_TIMEOUT_MS = 300;
export const HOTEL_EXISTS_TRUE_TTL_MS = 5 * 60_000;
export const HOTEL_EXISTS_FALSE_TTL_MS = 60_000;
export const HOTEL_EXISTS_MAX_ENTRIES = 1000;

// Insertion order is eviction order: a refreshed entry is deleted and set again, so the oldest is always first.
const existsCache = new Map<number, { exists: boolean; expiresAt: number }>();
let existsClock: () => number = Date.now;

function rememberExists(hid: number, exists: boolean): void {
  existsCache.delete(hid);
  existsCache.set(hid, { exists, expiresAt: existsClock() + (exists ? HOTEL_EXISTS_TRUE_TTL_MS : HOTEL_EXISTS_FALSE_TTL_MS) });
  while (existsCache.size > HOTEL_EXISTS_MAX_ENTRIES) existsCache.delete(existsCache.keys().next().value as number);
}

/**
 * Whether the store has content for this hotel, asking for the `hid` column only. true / false, or null when the
 * answer is unknown (database error or no answer within the timeout). Known answers are cached in memory (true for
 * 5 minutes, false for 60 seconds, at most 1,000 entries); null is never cached. Never throws.
 */
export async function hotelExists(hid: number, opts: { timeoutMs?: number } = {}): Promise<boolean | null> {
  if (isFixtureMode()) return (await loadFixtureHotels()).has(hid);
  const now = existsClock();
  const hit = existsCache.get(hid);
  if (hit) {
    if (hit.expiresAt > now) return hit.exists;
    existsCache.delete(hid);
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, opts.timeoutMs ?? HOTEL_EXISTS_TIMEOUT_MS);
  });
  const query = (async (): Promise<boolean | null> => {
    const { data, error } = await db().from("hotels").select("hid").eq("hid", hid).abortSignal(controller.signal).maybeSingle();
    return error ? null : data !== null;
  })().catch(() => null); // Handled here, so a query that fails after the timeout cannot become an unhandled rejection.
  try {
    const exists = await Promise.race([query, timedOut]);
    if (exists !== null) rememberExists(hid, exists);
    return exists;
  } finally {
    clearTimeout(timer);
  }
}

/** Inserts or updates hotels by hid, 200 rows per request. */
export async function upsertHotels(hotels: Hotel[]): Promise<void> {
  for (const part of chunk(hotels, STORE_CHUNK_SIZE)) {
    const { error } = await db().from("hotels").upsert(part.map(hotelToRow), { onConflict: "hid" });
    check("writing hotels", error);
  }
}

/** Remembers hids that search returned but the store has no content for. Existing entries keep their first_seen. */
export async function recordMissing(hids: number[]): Promise<void> {
  if (hids.length === 0 || isFixtureMode()) return;
  for (const part of chunk([...new Set(hids)], STORE_CHUNK_SIZE)) {
    const { error } = await db()
      .from("missing_hotels")
      .upsert(part.map((hid) => ({ hid })), { onConflict: "hid", ignoreDuplicates: true });
    check("recording missing hotels", error);
  }
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

async function readSetting(key: string): Promise<unknown> {
  const { data, error } = await db().from("settings").select("value").eq("key", key).maybeSingle();
  check(`reading setting ${key}`, error);
  return (data as { value: unknown } | null)?.value;
}

const MAX_MARKUP_PERCENT = 100;

/** A finite number 0..100, from a JSON number or a plain decimal string. Anything else is null. */
function parseMarkup(raw: unknown): number | null {
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim())) n = Number(raw.trim());
  else return null;
  return Number.isFinite(n) && n >= 0 && n <= MAX_MARKUP_PERCENT ? n : null;
}

let markupCache: { value: number; at: number } | undefined;

/** Markup percent applied on top of ETG prices; cached for 60 s. */
export async function getMarkupPercent(): Promise<number> {
  if (isFixtureMode()) return FIXTURE_MARKUP_PERCENT;
  const now = Date.now();
  if (markupCache && now - markupCache.at < MARKUP_TTL_MS) return markupCache.value;
  const raw = await readSetting("markup_percent");
  const value = parseMarkup(raw);
  if (value === null) {
    throw new Error("Content store: setting markup_percent must be a number from 0 to 100");
  }
  markupCache = { value, at: now };
  return value;
}

const DictionariesSchema = z.object({
  taxNames: z.record(z.string(), z.string()).default({}),
  mealNames: z.record(z.string(), z.string()).default({}),
});

let dictionariesCache: { value: Dictionaries; at: number } | undefined;

/** English tax and meal names (empty objects until the sync script has run); cached for 10 minutes. */
export async function getDictionaries(): Promise<Dictionaries> {
  if (isFixtureMode()) {
    return DictionariesSchema.parse((await import("../../../tests/fixtures/etg/static.json")).default);
  }
  const now = Date.now();
  if (dictionariesCache && now - dictionariesCache.at < DICTIONARIES_TTL_MS) return dictionariesCache.value;
  const raw = await readSetting("dictionaries");
  if (raw === undefined || raw === null) {
    dictionariesCache = { value: { taxNames: {}, mealNames: {} }, at: now };
    return dictionariesCache.value;
  }
  const parsed = DictionariesSchema.safeParse(raw);
  if (!parsed.success) {
    // Not cached, so a corrected setting is picked up on the next call. Message only, no payload.
    console.error("Content store: setting dictionaries is malformed; using empty dictionaries");
    return { taxNames: {}, mealNames: {} };
  }
  dictionariesCache = { value: parsed.data, at: now };
  return parsed.data;
}

/** Stores the dictionaries (sync script only). */
export async function saveDictionaries(dictionaries: Dictionaries): Promise<void> {
  const { error } = await db().from("settings").upsert({ key: "dictionaries", value: dictionaries }, { onConflict: "key" });
  check("writing dictionaries", error);
  dictionariesCache = undefined;
}

/** Test-only: replaces the clock the existence cache uses (pass nothing to restore the real one) and clears that cache. */
export function setHotelExistsClock(clock?: () => number): void {
  existsClock = clock ?? Date.now;
  existsCache.clear();
}

/** Test-only: clears in-memory caches and the lazy clients. */
export function resetStoreCache(): void {
  existsCache.clear();
  existsClock = Date.now;
  markupCache = undefined;
  dictionariesCache = undefined;
  fixtureHotels = undefined;
  client = undefined;
}
