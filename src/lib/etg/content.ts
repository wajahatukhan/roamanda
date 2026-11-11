import "server-only";
import { z } from "zod";
import { chunk } from "@/lib/content/chunk";
import { etgRequest } from "./client";
import { EtgError } from "./errors";

const LANGUAGE = "en";
/** Documented maximum hids per content request. */
export const CONTENT_BATCH_SIZE = 100;

const RawHotels = z.array(z.unknown());

/** Raw hotel content for the given hids, 100 per request. Hotels the API does not know are omitted. */
export async function fetchHotelContent(hids: number[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const batch of chunk(hids, CONTENT_BATCH_SIZE)) {
    const data = await etgRequest({
      method: "POST",
      path: "/api/content/v1/hotel_content_by_ids/",
      body: { hids: batch, language: LANGUAGE },
      schema: RawHotels,
    });
    out.push(...data);
  }
  return out;
}

export type RawReview = { hid: number; rating: number | null; detailed_ratings: Record<string, number | null> | null };

const ReviewRow = z
  .object({
    hid: z.number(),
    rating: z.number().nullable().optional(),
    detailed_ratings: z.record(z.string(), z.number().nullable()).nullable().optional(),
  })
  .loose();

/**
 * Review summaries (rating and detailed ratings, no review text) for the given hids.
 * `no_hotel_reviews` means none of them has reviews and returns an empty list. Rows that
 * fail validation are dropped.
 */
export async function fetchHotelReviewSummaries(hids: number[]): Promise<RawReview[]> {
  const out: RawReview[] = [];
  for (const batch of chunk(hids, CONTENT_BATCH_SIZE)) {
    let rows: unknown[];
    try {
      rows = await etgRequest({
        method: "POST",
        path: "/api/content/v1/hotel_reviews_by_ids/",
        body: { hids: batch, language: LANGUAGE },
        schema: RawHotels,
      });
    } catch (e) {
      if (e instanceof EtgError && e.code === "no_hotel_reviews") continue;
      throw e;
    }
    for (const row of rows) {
      const parsed = ReviewRow.safeParse(row);
      if (parsed.success) {
        out.push({ hid: parsed.data.hid, rating: parsed.data.rating ?? null, detailed_ratings: parsed.data.detailed_ratings ?? null });
      }
    }
  }
  return out;
}

const Named = z.array(z.object({ name: z.string(), locale: z.record(z.string(), z.string()).optional() }).loose());
const StaticData = z.object({ taxes: Named.optional(), meals: Named.optional() }).loose();

export type StaticDictionaries = { taxNames: Record<string, string>; mealNames: Record<string, string> };

function englishNames(items: z.infer<typeof Named> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items ?? []) {
    const en = item.locale?.en;
    if (en) out[item.name] = en;
  }
  return out;
}

/** English tax and meal names from `GET /api/b2b/v3/hotel/static/` (100 calls per day: use sparingly). */
export async function fetchStaticDictionaries(): Promise<StaticDictionaries> {
  const data = await etgRequest({ method: "GET", path: "/api/b2b/v3/hotel/static/", schema: StaticData });
  return { taxNames: englishNames(data.taxes), mealNames: englishNames(data.meals) };
}
