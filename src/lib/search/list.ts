import Decimal from "decimal.js";
import type { Hotel } from "@/lib/content/types";
import type { PaymentType, Rate } from "@/lib/etg/schemas";
import { priceRate, type StayPrice } from "@/lib/pricing/price-rate";

export type ListItem = { hotel: Hotel; from: StayPrice; freeCancellation: boolean; hasBreakfast: boolean };
export type SortKey = "recommended" | "price" | "rating";
export type ListFilters = { minStars?: number; minRating?: number; freeCancellation?: boolean; breakfast?: boolean; maxPrice?: string };
export type ListContext = { markupPercent: number; taxNames: Record<string, string>; now: Date };

/** ETG sends deadlines in UTC, sometimes without a zone suffix. */
function deadlineMs(s: string | null): number | null {
  if (!s) return null;
  const ms = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function buildList(
  results: { hid: number; rates: Rate[] }[],
  hotels: Map<number, Hotel>,
  ctx: ListContext,
): { items: ListItem[]; missing: number[] } {
  const items: ListItem[] = [];
  const missing: number[] = [];
  const now = ctx.now.getTime();
  for (const { hid, rates } of results) {
    const hotel = hotels.get(hid);
    if (!hotel) {
      if (!missing.includes(hid)) missing.push(hid);
      continue;
    }
    let cheapest: { pt: PaymentType; net: Decimal } | undefined;
    let freeCancellation = false;
    let hasBreakfast = false;
    for (const rate of rates) {
      if (rate.meal_data.has_breakfast) hasBreakfast = true;
      for (const pt of rate.payment_options.payment_types) {
        const net = new Decimal(pt.show_amount);
        if (!cheapest || net.lt(cheapest.net)) cheapest = { pt, net };
        const until = deadlineMs(pt.cancellation_penalties.free_cancellation_before);
        if (until !== null && until > now) freeCancellation = true;
      }
    }
    // Markup is monotonic, so the lowest net price is also the lowest selling price.
    if (!cheapest) continue;
    items.push({ hotel, from: priceRate(cheapest.pt, ctx.markupPercent, ctx.taxNames), freeCancellation, hasBreakfast });
  }
  return { items, missing };
}

const price = (i: ListItem) => new Decimal(i.from.total.amount);

function byPrice(a: ListItem, b: ListItem): number {
  return price(a).comparedTo(price(b));
}

/** Higher first; hotels without a rating go last. */
function byRating(a: ListItem, b: ListItem): number {
  return (b.hotel.reviewRating ?? -1) - (a.hotel.reviewRating ?? -1);
}

export function sortItems(items: ListItem[], by: SortKey): ListItem[] {
  const tieBreak = (a: ListItem, b: ListItem) => a.hotel.hid - b.hotel.hid;
  const compare =
    by === "price"
      ? (a: ListItem, b: ListItem) => byPrice(a, b) || tieBreak(a, b)
      : by === "rating"
        ? (a: ListItem, b: ListItem) => byRating(a, b) || byPrice(a, b) || tieBreak(a, b)
        : (a: ListItem, b: ListItem) => byRating(a, b) || byPrice(a, b) || tieBreak(a, b);
  return [...items].sort(compare);
}

export function filterItems(items: ListItem[], f: ListFilters): ListItem[] {
  const max = f.maxPrice !== undefined && /^\d+(\.\d+)?$/.test(f.maxPrice) ? new Decimal(f.maxPrice) : null;
  return items.filter(
    (i) =>
      (f.minStars === undefined || (i.hotel.starRating !== null && i.hotel.starRating >= f.minStars)) &&
      (f.minRating === undefined || (i.hotel.reviewRating !== null && i.hotel.reviewRating >= f.minRating)) &&
      (!f.freeCancellation || i.freeCancellation) &&
      (!f.breakfast || i.hasBreakfast) &&
      (max === null || price(i).lte(max)),
  );
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Sort and filter state from the URL. Invalid values are ignored; `active` means at least one filter is set. */
export function parseListParams(sp: RawParams): { sort: SortKey; filters: ListFilters; active: boolean } {
  const sortRaw = first(sp.sort);
  const sort: SortKey = sortRaw === "price" || sortRaw === "rating" ? sortRaw : "recommended";
  const filters: ListFilters = {};
  const stars = first(sp.stars);
  if (stars && /^[1-5]$/.test(stars)) filters.minStars = Number(stars);
  const rating = first(sp.rating);
  if (rating && /^(\d(\.\d)?|10)$/.test(rating) && Number(rating) > 0) filters.minRating = Number(rating);
  if (first(sp.free) === "1") filters.freeCancellation = true;
  if (first(sp.breakfast) === "1") filters.breakfast = true;
  const max = first(sp.max);
  if (max && /^\d{1,7}(\.\d{1,2})?$/.test(max) && Number(max) > 0) filters.maxPrice = max;
  return { sort, filters, active: Object.keys(filters).length > 0 };
}
