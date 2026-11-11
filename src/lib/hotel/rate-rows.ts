import Decimal from "decimal.js";
import type { Rate } from "@/lib/etg/schemas";
import { CANCELLATION_FALLBACK, cancellationSentence } from "@/lib/policy/cancellation-sentence";
import { priceRate, type StayPrice } from "@/lib/pricing/price-rate";

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
/** Only payments taken at booking are sold in this release; "hotel" payments get no row. */
const SOLD_TYPES = new Set(["now", "deposit"]);

/**
 * One row for each rate and each payment type that is paid at booking and priced in the requested currency,
 * lowest total first. A malformed cancellation schedule gives that row the fallback sentence; a row that
 * cannot be priced is left out. Neither can break the others.
 */
export function buildRateRows(rates: Rate[], ctx: RateRowContext): RateRow[] {
  const timeZone = ctx.timeZone || "UTC";
  const rows: RateRow[] = [];

  rates.forEach((rate, rateIndex) => {
    // A rate without a booking hash cannot be booked, so it is not offered.
    if (!rate.book_hash) return;
    const meal = rate.meal_data.value;
    const mealLabel = (Object.hasOwn(ctx.mealNames, meal) ? ctx.mealNames[meal] : undefined) ?? meal;

    rate.payment_options.payment_types.forEach((pt, ptIndex) => {
      if (!SOLD_TYPES.has(pt.type) || pt.show_currency_code !== ctx.currency) return;
      let price: StayPrice;
      try {
        price = priceRate(pt, ctx.markupPercent, ctx.taxNames);
      } catch {
        return;
      }
      let cancellation: string;
      try {
        cancellation = cancellationSentence({ penalties: pt.cancellation_penalties, total: price.total, markupPercent: ctx.markupPercent, timeZone, now: ctx.now });
      } catch {
        cancellation = CANCELLATION_FALLBACK;
      }
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
      });
    });
  });

  // Array.prototype.sort is stable, so equal totals keep the supplier's order.
  return rows.sort((a, b) => new Decimal(a.price.total.amount).comparedTo(b.price.total.amount));
}
