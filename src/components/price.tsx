import { formatMoney } from "@/lib/pricing/money";
import type { StayPrice } from "@/lib/pricing/price-rate";

/** The line under the total. When some charges are payable at the hotel, it says which taxes and fees the total covers. */
export function priceCaption(nights: number, hasPayAtHotel: boolean): string {
  return `for ${nights} ${nights === 1 ? "night" : "nights"}, taxes and fees ${hasPayAtHotel ? "charged at booking " : ""}included`;
}

/**
 * The all-in price for the whole stay, with anything payable at the hotel on its own lines underneath.
 * Server component on purpose: it receives a StayPrice (which carries net price and markup) and renders
 * only formatted text, so neither value can reach the browser.
 */
export function Price({ price, nights }: { price: Pick<StayPrice, "total" | "payAtHotel">; nights: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-2xl font-semibold tracking-[0.01em] tabular-nums">{formatMoney(price.total)}</p>
      <p className="text-sm text-muted-foreground">
        {priceCaption(nights, price.payAtHotel.length > 0)}
      </p>
      {price.payAtHotel.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
          {price.payAtHotel.map((line, i) => (
            <li key={`${line.label}-${i}`}>
              + {formatMoney(line.money)} {line.label} at the hotel
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
