import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { PricesUnavailable } from "@/components/prices-unavailable";
import { RateRowView, RATE_SHELL } from "@/components/rate-row";
import { ResidencyPrompt } from "@/components/residency-prompt-lazy";
import { StayPicker } from "@/components/stay-picker-lazy";
import { getEnv } from "@/env";
import { getDictionaries, getMarkupPercent } from "@/lib/content/store";
import type { Hotel } from "@/lib/content/types";
import { EtgError } from "@/lib/etg/errors";
import { FIXTURE_TAG_COOKIE, parseFixtureTag } from "@/lib/etg/fixture-reads";
import type { Rate, StayQuery } from "@/lib/etg/schemas";
import { hotelPage } from "@/lib/etg/search";
import { buildRateRows } from "@/lib/hotel/rate-rows";
import { FIXTURE_DELAY_COOKIE, FIXTURE_FAIL_COOKIE, fixtureDelayMs, hotelPageEmpty, hotelPageFailure } from "@/lib/search/fixture-failure";
import { initialFormValues } from "@/lib/search/initial";
import { parseStayParams } from "@/lib/search/params";
import { getResidency } from "@/lib/search/residency";
import { nightsBetween, describeStay } from "@/lib/search/summary";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Rows shown before the rest are folded into a "Show all" control. Also the number of rows the skeleton reserves. */
const RATES_SHOWN_FIRST = 6;

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const panel = "flex flex-col items-start gap-5 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8";
const h3 = "text-lg font-semibold tracking-[0.01em] [word-spacing:0.1em]";

/** Placeholder rows with the same shell and minimum height as real ones, so rates arrive without moving the page. */
export function RatesSkeleton({ count = RATES_SHOWN_FIRST }: { count?: number }) {
  const bar = "rounded-md bg-muted";
  return (
    <div data-testid="rates-skeleton" aria-busy="true">
      <p role="status" className="sr-only">Loading prices for your stay</p>
      <ul aria-hidden className="flex flex-col gap-4">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={RATE_SHELL}>
            <div className="flex flex-col gap-3">
              <div className={`${bar} h-5 w-64 max-w-full`} />
              <div className={`${bar} h-3.5 w-32`} />
              <div className={`${bar} h-3.5 w-44`} />
              <div className={`${bar} h-3.5 w-72 max-w-full`} />
            </div>
            <div className="flex flex-col justify-between gap-4 sm:w-60 sm:items-end">
              <div className="flex flex-col gap-2 sm:items-end">
                <div className={`${bar} h-7 w-28`} />
                <div className={`${bar} h-3.5 w-44 max-w-full`} />
              </div>
              <div className={`${bar} h-11 w-full sm:w-44`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Simulated = { failure: EtgError | null; delayMs: number; empty: boolean };

async function load(hid: number, query: StayQuery, hotel: Hotel, simulated: Simulated, now: Date, fixtureTag: string) {
  if (simulated.delayMs) await new Promise((resolve) => setTimeout(resolve, simulated.delayMs));
  if (simulated.failure) throw simulated.failure;
  const [rates, markupPercent, dictionaries] = await Promise.all([
    simulated.empty ? Promise.resolve([] as Rate[]) : hotelPage(hid, query, { fixtureTag }),
    getMarkupPercent(),
    getDictionaries(),
  ]);
  return buildRateRows(rates, {
    markupPercent,
    timeZone: hotel.timeZone,
    now,
    currency: query.currency,
    mealNames: dictionaries.mealNames,
    taxNames: dictionaries.taxNames,
  });
}

/**
 * The live rates. Request time only: `connection()` keeps it out of any prerender, there is no `use cache`
 * anywhere on this path, and RateHawk is called with an uncached fetch, so every load asks RateHawk again.
 */
export async function Rates({ hid, hotel, sp }: { hid: number; hotel: Hotel; sp: RawParams }) {
  await connection();
  const initial = initialFormValues(sp);

  // No dates at all: ask for them.
  if (!first(sp.in) && !first(sp.out)) {
    return (
      <div className={panel}>
        <div className="flex flex-col gap-1">
          <h3 className={h3}>Choose your dates to see prices</h3>
          <p className="text-muted-foreground">Prices and rooms depend on when you stay and who is travelling.</p>
        </div>
        <div className="w-full"><StayPicker hid={hid} initial={{ rooms: initial.rooms }} /></div>
      </div>
    );
  }

  const parsed = parseStayParams(sp, new Date());
  if (!parsed.ok) {
    return (
      <div className={panel}>
        <div role="alert" className="w-full rounded-xl bg-destructive/5 p-4 ring-1 ring-destructive/30">
          <p className="mb-2 text-sm font-medium">We could not use these dates or guests:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {parsed.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="w-full"><StayPicker hid={hid} initial={{ range: initial.range, rooms: initial.rooms }} /></div>
      </div>
    );
  }

  const residency = await getResidency();
  if (!residency) {
    return (
      <div role="status" className={panel}>
        <div className="flex flex-col gap-1">
          <h3 className={h3}>Tell us your passport country to see prices.</h3>
          <p className="text-muted-foreground">Rates and availability can depend on it. We will remember your answer.</p>
        </div>
        <ResidencyPrompt />
      </div>
    );
  }

  const store = await cookies();
  const mode = getEnv().ETG_MODE;
  const failCookie = store.get(FIXTURE_FAIL_COOKIE)?.value;
  const simulated: Simulated = {
    failure: hotelPageFailure(mode, failCookie),
    delayMs: fixtureDelayMs(mode, store.get(FIXTURE_DELAY_COOKIE)?.value),
    empty: hotelPageEmpty(mode, failCookie),
  };

  const stayQs = new URLSearchParams({ in: parsed.query.checkin, out: parsed.query.checkout, rooms: first(sp.rooms) ?? "" });
  const retryHref = `/hotel/${hid}?${stayQs}`;

  let rows;
  try {
    rows = await load(hid, { ...parsed.query, residency }, hotel, simulated, new Date(), parseFixtureTag(mode, store.get(FIXTURE_TAG_COOKIE)?.value));
  } catch (e) {
    if (e !== simulated.failure) console.error("Hotel rates failed:", e instanceof EtgError ? `${e.code} (HTTP ${e.httpStatus})` : e instanceof Error ? e.message : "unknown error");
    return <PricesUnavailable retryable={e instanceof EtgError && e.retryable} href={retryHref} subject="hotel" />;
  }

  if (rows.length === 0) {
    return (
      <div role="status" className={panel}>
        <div className="flex flex-col gap-1">
          <h3 className={h3}>No rooms are available for these dates.</h3>
          <p className="text-muted-foreground">Try different dates, or change how many guests are travelling.</p>
        </div>
        <div className="w-full"><StayPicker hid={hid} initial={{ range: initial.range, rooms: initial.rooms }} /></div>
      </div>
    );
  }

  const nights = nightsBetween(parsed.query.checkin, parsed.query.checkout);
  return (
    <div className="flex flex-col gap-5">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span>{describeStay(parsed.query)}</span>
        <Link href={`/hotel/${hid}`} prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 text-foreground underline")}>
          Change dates
        </Link>
      </p>
      <p role="status" className="sr-only">{rows.length} {rows.length === 1 ? "option" : "options"} found, lowest price first</p>
      <ul aria-label="Rooms and prices, lowest price first" className="flex flex-col gap-4">
        {rows.slice(0, RATES_SHOWN_FIRST).map((row, i) => (
          <RateRowView key={row.key} row={row} index={i} nights={nights} />
        ))}
      </ul>
      {rows.length > RATES_SHOWN_FIRST && (
        <details className="group flex flex-col gap-4">
          <summary className="flex min-h-11 w-full cursor-pointer list-none items-center justify-center rounded-lg px-5 text-base font-medium text-foreground ring-1 ring-foreground/20 outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Show all {rows.length} options
          </summary>
          <ul aria-label="More rooms and prices, lowest price first" className="mt-4 flex flex-col gap-4">
            {rows.slice(RATES_SHOWN_FIRST).map((row, i) => (
              <RateRowView key={row.key} row={row} index={i} nights={nights} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The rates area: a heading, and the live rates streamed in behind a skeleton. */
export function RatesSection({ hid, hotel, sp }: { hid: number; hotel: Hotel; sp: RawParams }) {
  // A change of dates or guests shows the skeleton again instead of the old rows.
  const suspenseKey = ["in", "out", "rooms"].map((k) => first(sp[k]) ?? "").join("|");
  return (
    <section aria-labelledby="rates-heading" className="flex flex-col gap-5">
      <h2 id="rates-heading" className="text-2xl font-semibold tracking-[0.01em] [word-spacing:0.1em]">Rooms and prices</h2>
      <Suspense key={suspenseKey} fallback={<RatesSkeleton />}>
        <Rates hid={hid} hotel={hotel} sp={sp} />
      </Suspense>
    </section>
  );
}
