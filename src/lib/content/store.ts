import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEnv } from "@/env";
import { chunk } from "./chunk";
import { mapEtgHotels } from "./map-hotel";
import type { Dictionaries, Hotel } from "./types";

export { imageUrl } from "./image-url";
export { mapEtgHotel } from "./map-hotel";
export type { Hotel } from "./types";

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

/** Hotels by hid. Unknown hids are simply absent from the map. */
export async function getHotels(hids: number[]): Promise<Map<number, Hotel>> {
  const out = new Map<number, Hotel>();
  if (hids.length === 0) return out;
  if (isFixtureMode()) {
    const all = await loadFixtureHotels();
    for (const hid of hids) {
      const h = all.get(hid);
      if (h) out.set(hid, h);
    }
    return out;
  }
  for (const part of chunk([...new Set(hids)], STORE_CHUNK_SIZE)) {
    const { data, error } = await db().from("hotels").select("*").in("hid", part);
    check("reading hotels", error);
    for (const row of (data ?? []) as HotelRow[]) {
      const h = rowToHotel(row);
      out.set(h.hid, h);
    }
  }
  return out;
}

export async function getHotel(hid: number): Promise<Hotel | null> {
  return (await getHotels([hid])).get(hid) ?? null;
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

let markupCache: { value: number; at: number } | undefined;

/** Markup percent applied on top of ETG prices; cached for 60 s. */
export async function getMarkupPercent(): Promise<number> {
  if (isFixtureMode()) return FIXTURE_MARKUP_PERCENT;
  const now = Date.now();
  if (markupCache && now - markupCache.at < MARKUP_TTL_MS) return markupCache.value;
  const raw = await readSetting("markup_percent");
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Content store: setting markup_percent is missing or not a non-negative number");
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
  const parsed = DictionariesSchema.safeParse(raw ?? {});
  const value: Dictionaries = parsed.success ? parsed.data : { taxNames: {}, mealNames: {} };
  dictionariesCache = { value, at: now };
  return value;
}

/** Stores the dictionaries (sync script only). */
export async function saveDictionaries(dictionaries: Dictionaries): Promise<void> {
  const { error } = await db().from("settings").upsert({ key: "dictionaries", value: dictionaries }, { onConflict: "key" });
  check("writing dictionaries", error);
  dictionariesCache = undefined;
}

/** Test-only: clears in-memory caches and the lazy clients. */
export function resetStoreCache(): void {
  markupCache = undefined;
  dictionariesCache = undefined;
  fixtureHotels = undefined;
  client = undefined;
}
