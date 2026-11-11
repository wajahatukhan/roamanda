import { z } from "zod";
import { hotelTimeZone } from "@/lib/policy/time-zone";
import type { AmenityGroup, DescriptionSection, DetailedRatings, Hotel, HotelImage } from "./types";

/**
 * Trust boundary for ETG hotel content. The raw hotel is validated here and never used unvalidated
 * elsewhere. Unknown fields are tolerated; nested lists are filtered item by item so one malformed
 * image or amenity group does not discard the hotel.
 */
const RawHotel = z
  .object({
    hid: z.number().int(),
    name: z.string().min(1),
    address: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    star_rating: z.number().nullish(),
    kind: z.string().nullish(),
    region: z
      .object({ id: z.number().nullish(), name: z.string().nullish(), country_code: z.string().nullish() })
      .loose()
      .nullish(),
    check_in_time: z.string().nullish(),
    check_out_time: z.string().nullish(),
    images_ext: z.array(z.unknown()).nullish(),
    amenity_groups: z.array(z.unknown()).nullish(),
    description_struct: z.array(z.unknown()).nullish(),
    metapolicy_struct: z.record(z.string(), z.unknown()).nullish(),
    metapolicy_extra_info: z.string().nullish(),
    is_closed: z.boolean().nullish(),
    deleted: z.boolean().nullish(),
  })
  .loose();

const RawImage = z.object({ url: z.string().min(1), category_slug: z.string().nullish() }).loose();
const RawAmenityGroup = z
  .object({
    group_name: z.string(),
    amenities: z.array(z.string()).nullish(),
    non_free_amenities: z.array(z.string()).nullish(),
  })
  .loose();
const RawDescription = z.object({ title: z.string().nullish(), paragraphs: z.array(z.string()).nullish() }).loose();

export type ReviewSummary = { rating: number | null; detailed_ratings: Record<string, number | null> | null };
export type ReviewSummaryWithHid = ReviewSummary & { hid: number };

function pickValid<S extends z.ZodType>(schema: S, items: unknown[] | null | undefined): z.infer<S>[] {
  const out: z.infer<S>[] = [];
  for (const item of items ?? []) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function safeTimeZone(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  try {
    return hotelTimeZone(lat, lng);
  } catch {
    return null;
  }
}

/** One decimal, as stored in numeric(3,1). */
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

function toHotel(raw: z.infer<typeof RawHotel>, syncedAt: string, review?: ReviewSummary | null): Hotel {
  const latitude = raw.latitude ?? null;
  const longitude = raw.longitude ?? null;
  // ETG sends 0 for "no star rating".
  const stars = raw.star_rating ?? 0;
  const images: HotelImage[] = pickValid(RawImage, raw.images_ext).map((i) => ({ category: i.category_slug ?? "unspecified", url: i.url }));
  const amenityGroups: AmenityGroup[] = pickValid(RawAmenityGroup, raw.amenity_groups).map((g) => ({
    groupName: g.group_name,
    amenities: g.amenities ?? [],
    nonFreeAmenities: g.non_free_amenities ?? [],
  }));
  const description: DescriptionSection[] = pickValid(RawDescription, raw.description_struct).map((d) => ({
    title: d.title ?? "",
    paragraphs: d.paragraphs ?? [],
  }));
  // An all-null breakdown (no reviews yet) carries no information.
  const rawDetailed = review?.detailed_ratings ?? null;
  const detailed: DetailedRatings | null = rawDetailed && Object.values(rawDetailed).some((v) => typeof v === "number") ? rawDetailed : null;
  return {
    hid: raw.hid,
    name: raw.name,
    address: raw.address ?? null,
    latitude,
    longitude,
    starRating: Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null,
    kind: raw.kind ?? null,
    regionId: raw.region?.id ?? null,
    regionName: raw.region?.name ?? null,
    countryCode: raw.region?.country_code ?? null,
    timeZone: safeTimeZone(latitude, longitude),
    checkInTime: raw.check_in_time ?? null,
    checkOutTime: raw.check_out_time ?? null,
    images,
    amenityGroups,
    description,
    metapolicyStruct: raw.metapolicy_struct ?? null,
    metapolicyExtraInfo: raw.metapolicy_extra_info ?? null,
    reviewRating: typeof review?.rating === "number" ? oneDecimal(review.rating) : null,
    reviewDetailed: detailed,
    syncedAt,
  };
}

/** Maps one raw ETG hotel. Throws a ZodError when the hotel does not validate. */
export function mapEtgHotel(raw: unknown, syncedAt: string = new Date().toISOString(), review?: ReviewSummary | null): Hotel {
  return toHotel(RawHotel.parse(raw), syncedAt, review);
}

export type MapResult = { hotels: Hotel[]; skippedInvalid: number; skippedClosed: number };

/**
 * Maps a batch. Hotels that fail validation are skipped and counted; hotels flagged `is_closed` or
 * `deleted` are skipped and counted separately. Never throws for a bad hotel.
 */
export function mapEtgHotels(raws: unknown[], syncedAt: string = new Date().toISOString(), reviews: ReviewSummaryWithHid[] = []): MapResult {
  const byHid = new Map(reviews.map((r) => [r.hid, r]));
  const hotels: Hotel[] = [];
  let skippedInvalid = 0;
  let skippedClosed = 0;
  for (const raw of raws) {
    const parsed = RawHotel.safeParse(raw);
    if (!parsed.success) {
      skippedInvalid++;
      continue;
    }
    if (parsed.data.is_closed === true || parsed.data.deleted === true) {
      skippedClosed++;
      continue;
    }
    hotels.push(toHotel(parsed.data, syncedAt, byHid.get(parsed.data.hid)));
  }
  return { hotels, skippedInvalid, skippedClosed };
}
