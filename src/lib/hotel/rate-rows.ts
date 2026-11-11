import Decimal from "decimal.js";
import type { Rate } from "@/lib/etg/schemas";
import { CANCELLATION_FALLBACK, cancellationSentence } from "@/lib/policy/cancellation-sentence";
import { policyLines } from "@/lib/policy/policy-lines";
import { isSoldAtBooking, priceRate, type StayPrice } from "@/lib/pricing/price-rate";

/**
 * One bookable option on the hotel page. Holds the selling price and the booking hash, so it is for server
 * components only: nothing that renders from it may be a client component.
 */
export type RateRow = {
  key: string;
  bookHash: string;
  roomName: string;
  bedding: string | null;
  meal: string;
  mealLabel: string;
  paymentType: "now" | "hotel" | "deposit";
  paymentLabel: string;
  price: StayPrice;
  cancellation: string;
  /** The full cancellation policy, one line per window (see policy-lines.ts); empty when there is nothing we can show. */
  policyLines: string[];
};

export type RateRowContext = {
  markupPercent: number;
  /** The hotel's IANA time zone; UTC when the hotel has none. */
  timeZone: string | null;
  now: Date;
  /** The currency that was requested. Payment types shown in any other currency get no row. */
  currency: string;
  mealNames: Record<string, string>;
  taxNames: Record<string, string>;
};

const PAYMENT_LABELS = { now: "Pay now", deposit: "Pay now", hotel: "Pay at the hotel" } as const;

/**
 * One row for each rate and each payment type that is paid at booking and priced in the requested currency,
 * lowest total first. A malformed cancellation schedule gives that row the fallback sentence (and no policy
 * lines); a row that cannot be priced is left out. Neither can break the others.
 */
export function buildRateRows(rates: Rate[], ctx: RateRowContext): RateRow[] {
  const timeZone = ctx.timeZone || "UTC";
  const rows: RateRow[] = [];
  let unpriceable = 0;
  let eligible = 0;

  rates.forEach((rate, rateIndex) => {
    // A rate without a booking hash cannot be booked, so it is not offered.
    if (!rate.book_hash) return;
    const meal = rate.meal_data.value;
    const mealLabel = (Object.hasOwn(ctx.mealNames, meal) ? ctx.mealNames[meal] : undefined) ?? meal;

    rate.payment_options.payment_types.forEach((pt, ptIndex) => {
      if (!isSoldAtBooking(pt, ctx.currency)) return;
      eligible++;
      let price: StayPrice;
      try {
        price = priceRate(pt, ctx.markupPercent, ctx.taxNames);
      } catch {
        unpriceable++;
        return;
      }
      let cancellation: string;
      try {
        cancellation = cancellationSentence({ penalties: pt.cancellation_penalties, total: price.total, markupPercent: ctx.markupPercent, timeZone, now: ctx.now });
      } catch {
        cancellation = CANCELLATION_FALLBACK;
      }
      const lines = policyLines({ penalties: pt.cancellation_penalties, total: price.total, markupPercent: ctx.markupPercent, timeZone, now: ctx.now });
      rows.push({
        // The index, not the hash, so the key (which reaches the page payload) never carries the hash.
        key: `${rateIndex}-${ptIndex}`,
        bookHash: rate.book_hash!,
        roomName: rate.room_name,
        bedding: rate.room_data_trans.bedding_type || null,
        meal,
        mealLabel,
        paymentType: pt.type,
        paymentLabel: PAYMENT_LABELS[pt.type],
        price,
        cancellation,
        policyLines: lines,
      });
    });
  });

  if (unpriceable > 0) console.warn(`Hotel rates: left out ${unpriceable} of ${eligible} rate option(s) that could not be priced`);
  // Array.prototype.sort is stable, so equal totals keep the supplier's order.
  return rows.sort((a, b) => new Decimal(a.price.total.amount).comparedTo(b.price.total.amount));
}
