import Decimal from "decimal.js";
import type { HotelCard } from "@/lib/content/types";
import type { Rate } from "@/lib/etg/schemas";
import { cancellationStatus, isFreeCancellation } from "@/lib/policy/cancellation-status";
import { priceRate, type StayPrice } from "@/lib/pricing/price-rate";
import { first, type RawParams } from "./params";

export type ListItem = { hotel: HotelCard; from: StayPrice; freeCancellation: boolean; hasBreakfast: boolean };
export type SortKey = "recommended" | "price" | "rating";
export type ListFilters = { minStars?: number; minRating?: number; freeCancellation?: boolean; breakfast?: boolean; maxPrice?: string };
/** What the priced rate must offer. Applied while choosing it, so a card describes the rate it shows. */
export type ListRequirements = { freeCancellation?: boolean; breakfast?: boolean };
export type ListContext = { markupPercent: number; taxNames: Record<string, string>; now: Date; currency: string };

export function buildList(
  results: { hid: number; rates: Rate[] }[],
  hotels: Map<number, HotelCard>,
  ctx: ListContext,
  require: ListRequirements = {},
): { items: ListItem[]; missing: number[] } {
  const items: ListItem[] = [];
  const missing: number[] = [];
  let unpriceable = 0;
  for (const { hid, rates } of results) {
    const hotel = hotels.get(hid);
    if (!hotel) {
      if (!missing.includes(hid)) missing.push(hid);
      continue;
    }
    // A hotel whose rates cannot be priced is left out; it must not take the rest of the list with it.
    let item: ListItem | null;
    try {
      item = cheapestItem(hotel, rates, ctx, require);
    } catch {
      unpriceable++;
      continue;
    }
    if (item) items.push(item);
  }
  if (unpriceable > 0) console.warn(`Search list: left out ${unpriceable} of ${results.length} hotel(s) whose rates could not be priced`);
  return { items, missing };
}

/** The hotel's cheapest rate that meets the requirements, or null. Throws if a rate cannot be priced. */
function cheapestItem(hotel: HotelCard, rates: Rate[], ctx: ListContext, require: ListRequirements): ListItem | null {
  let cheapest: { from: StayPrice; net: Decimal; freeCancellation: boolean; hasBreakfast: boolean } | undefined;
  for (const rate of rates) {
    const hasBreakfast = rate.meal_data.has_breakfast;
    if (require.breakfast && !hasBreakfast) continue;
    for (const pt of rate.payment_options.payment_types) {
      // Only amounts charged at booking, in the requested currency, are comparable as a "from" price.
      if ((pt.type !== "deposit" && pt.type !== "now") || pt.show_currency_code !== ctx.currency) continue;
      const from = priceRate(pt, ctx.markupPercent, ctx.taxNames);
      // The same classification as the hotel page's sentence, so the label and the sentence always agree.
      const freeCancellation = isFreeCancellation(cancellationStatus(pt.cancellation_penalties, from.total, ctx.markupPercent, ctx.now));
      if (require.freeCancellation && !freeCancellation) continue;
      const net = new Decimal(pt.show_amount);
      // Markup is monotonic, so the lowest net price is also the lowest selling price.
      if (!cheapest || net.lt(cheapest.net)) cheapest = { from, net, freeCancellation, hasBreakfast };
    }
  }
  return cheapest ? { hotel, from: cheapest.from, freeCancellation: cheapest.freeCancellation, hasBreakfast: cheapest.hasBreakfast } : null;
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

/** Stars, rating and price. Free cancellation and breakfast are applied in `buildList`, where the priced rate is chosen. */
export function filterItems(items: ListItem[], f: ListFilters): ListItem[] {
  const max = f.maxPrice !== undefined && /^\d+(\.\d+)?$/.test(f.maxPrice) ? new Decimal(f.maxPrice) : null;
  return items.filter(
    (i) =>
      (f.minStars === undefined || (i.hotel.starRating !== null && i.hotel.starRating >= f.minStars)) &&
      (f.minRating === undefined || (i.hotel.reviewRating !== null && i.hotel.reviewRating >= f.minRating)) &&
      (max === null || price(i).lte(max)),
  );
}

const hotelsWord = (n: number) => (n === 1 ? "hotel" : "hotels");

/**
 * The count above the list. `partial`: the supplier has more hotels than it returned (the search asks for at most
 * 100), so the count says "Showing" and never reads as the destination's total.
 */
export function resultsCountLine(shown: number, total: number, o: { filtersActive: boolean; partial: boolean }): string {
  if (o.partial) return o.filtersActive ? `Showing ${shown} matching ${hotelsWord(shown)}` : `Showing ${shown} ${hotelsWord(shown)}`;
  return o.filtersActive ? `${shown} of ${total} hotels match` : `${shown} ${hotelsWord(shown)}`;
}

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
