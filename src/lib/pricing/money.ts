import Decimal from "decimal.js";

/** `amount` is a decimal string already rounded to the currency's minor units. */
export type Money = { amount: string; currency: string };

export function minorUnits(currency: string): number {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

function toDecimal(value: Decimal.Value): Decimal {
  let d: Decimal;
  try {
    d = new Decimal(value);
  } catch {
    throw new Error(`Invalid money amount: ${String(value)}`);
  }
  if (!d.isFinite()) throw new Error(`Invalid money amount: ${String(value)}`);
  return d;
}

/** Rounds half up to the currency's minor units. */
export function roundMoney(amount: Decimal.Value, currency: string): Money {
  const rounded = toDecimal(amount).toDecimalPlaces(minorUnits(currency), Decimal.ROUND_HALF_UP);
  return { amount: rounded.toFixed(minorUnits(currency)), currency };
}

export function formatMoney(m: Money, locale = "en-US"): string {
  // Intl.NumberFormat formats decimal strings exactly (no float conversion).
  return new Intl.NumberFormat(locale, { style: "currency", currency: m.currency }).format(toDecimal(m.amount).toFixed() as `${number}`);
}

export function applyMarkup(base: Money, markupPercent: number): Money {
  if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 100) {
    throw new Error(`markupPercent must be between 0 and 100, got ${markupPercent}`);
  }
  const factor = new Decimal(100).plus(new Decimal(markupPercent)).div(100);
  return roundMoney(toDecimal(base.amount).times(factor), base.currency);
}
