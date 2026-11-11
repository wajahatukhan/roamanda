import { BedDouble, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RateRow } from "@/lib/hotel/rate-rows";
import { POLICY_LINES_FALLBACK } from "@/lib/policy/policy-lines";
import { Price } from "./price";
import { Reveal } from "./reveal";

/** Shared with the skeleton, so the swap does not move the page. */
export const RATE_SHELL = "flex min-h-44 flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:flex-row sm:justify-between sm:p-6";

/**
 * One bookable option. A server component: the row carries the selling price and the booking hash, and only
 * formatted text is rendered, so neither the hash nor any net price or markup reaches the browser.
 */
export function RateRowView({ row, index, nights }: { row: RateRow; index: number; nights: number }) {
  return (
    <Reveal index={index}>
      <div className={RATE_SHELL}>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="text-lg leading-snug font-semibold tracking-[0.01em] [word-spacing:0.1em]">{row.roomName}</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {row.bedding && (
              <li className="flex items-center gap-2">
                <BedDouble aria-hidden className="size-4 text-muted-foreground" />
                <span><span className="sr-only">Bedding: </span>{row.bedding}</span>
              </li>
            )}
            <li className="flex items-center gap-2">
              <Utensils aria-hidden className="size-4 text-muted-foreground" />
              <span><span className="sr-only">Meals: </span>{row.mealLabel}</span>
            </li>
          </ul>
          <p className="max-w-prose text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Cancellation: </span>
            {row.cancellation}
          </p>
          {/* The full structured policy, one tap away. Native <details>: keyboard and screen readers work without script. */}
          <details className="text-sm">
            <summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              Full cancellation policy
            </summary>
            {row.policyLines.length > 0 ? (
              <ul className="mt-2 flex max-w-prose flex-col gap-1 text-muted-foreground">
                {row.policyLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 max-w-prose text-muted-foreground">{POLICY_LINES_FALLBACK}</p>
            )}
          </details>
        </div>
        <div className="flex flex-col justify-between gap-4 sm:w-60 sm:shrink-0 sm:items-end sm:text-right">
          <div className="flex flex-col gap-1 sm:items-end">
            <Price price={row.price} nights={nights} />
            <p className="text-sm text-muted-foreground">{row.paymentLabel}</p>
          </div>
          {/* Plan 2 wires this to checkout, server-side. It carries no booking data in this release. */}
          <Button type="button" disabled size="lg" className="h-11 w-full px-5 sm:w-auto">
            Booking opens soon
          </Button>
        </div>
      </div>
    </Reveal>
  );
}
