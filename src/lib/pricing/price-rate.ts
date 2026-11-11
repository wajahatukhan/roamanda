import type { PaymentType } from "@/lib/etg/schemas";
import { applyMarkup, roundMoney, type Money } from "./money";

export type StayPrice = {
  total: Money;
  payAtHotel: { label: string; money: Money }[];
  net: Money;
  markupPercent: number;
};

/** Whether the payment is taken at booking ("deposit" or "now") in the requested currency. "hotel" payments are not sold. */
export function isSoldAtBooking(pt: PaymentType, currency: string): boolean {
  return (pt.type === "deposit" || pt.type === "now") && pt.show_currency_code === currency;
}

export function priceRate(pt: PaymentType, markupPercent: number, taxNames: Record<string, string>): StayPrice {
  const net = roundMoney(pt.show_amount, pt.show_currency_code);
  const total = applyMarkup(net, markupPercent);
  const payAtHotel = pt.tax_data.taxes
    .filter((t) => !t.included_by_supplier)
    .map((t) => ({ label: (Object.hasOwn(taxNames, t.name) ? taxNames[t.name] : undefined) ?? "Tax or fee", money: roundMoney(t.amount, t.currency_code) }));
  return { total, payAtHotel, net, markupPercent };
}
