import { describe, expect, test } from "vitest";
import type { PaymentType, Tax } from "@/lib/etg/types";
import { priceRate } from "@/lib/pricing/price-rate";

function pt({ show_amount, taxes = [] }: { show_amount: string; taxes?: Tax[] }): PaymentType {
  return {
    amount: show_amount,
    currency_code: "USD",
    show_amount,
    show_currency_code: "USD",
    type: "now",
    tax_data: { taxes },
    cancellation_penalties: { free_cancellation_before: null, policies: [] },
  };
}

describe("priceRate", () => {
  test("pay-at-hotel taxes are separate and not marked up", () => {
    const p = priceRate(
      pt({
        show_amount: "100.00",
        taxes: [
          { name: "city_tax", included_by_supplier: false, amount: "7.00", currency_code: "EUR" },
          { name: "vat", included_by_supplier: true, amount: "9.00", currency_code: "USD" },
        ],
      }),
      10,
      { city_tax: "City tax" },
    );
    expect(p.total).toEqual({ amount: "110.00", currency: "USD" });
    expect(p.net).toEqual({ amount: "100.00", currency: "USD" });
    expect(p.markupPercent).toBe(10);
    expect(p.payAtHotel).toEqual([{ label: "City tax", money: { amount: "7.00", currency: "EUR" } }]);
  });

  test("unknown tax names fall back to 'Tax or fee'", () => {
    const p = priceRate(
      pt({ show_amount: "50.00", taxes: [{ name: "mystery", included_by_supplier: false, amount: "3.5", currency_code: "USD" }] }),
      0,
      {},
    );
    expect(p.payAtHotel).toEqual([{ label: "Tax or fee", money: { amount: "3.50", currency: "USD" } }]);
  });

  test("zero-decimal tax currency keeps its minor units", () => {
    const p = priceRate(
      pt({ show_amount: "100.00", taxes: [{ name: "resort_fee", included_by_supplier: false, amount: "500.4", currency_code: "JPY" }] }),
      0,
      { resort_fee: "Resort fee" },
    );
    expect(p.payAtHotel).toEqual([{ label: "Resort fee", money: { amount: "500", currency: "JPY" } }]);
  });

  test("markup 0 leaves total equal to net", () => {
    const p = priceRate(pt({ show_amount: "211.25" }), 0, {});
    expect(p.total).toEqual(p.net);
    expect(p.payAtHotel).toEqual([]);
  });

  test("invalid markup throws", () => {
    expect(() => priceRate(pt({ show_amount: "1.00" }), 101, {})).toThrow();
    expect(() => priceRate(pt({ show_amount: "1.00" }), -5, {})).toThrow();
  });

  test("non-numeric show_amount throws", () => {
    expect(() => priceRate(pt({ show_amount: "NaN" }), 10, {})).toThrow();
  });
});
