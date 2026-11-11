import { after, connection } from "next/server";
import { cookies } from "next/headers";
import { PricesUnavailable } from "@/components/prices-unavailable";
import { HotelCard } from "@/components/hotel-card";
import { getEnv } from "@/env";
import { getDictionaries, getHotelCards, getMarkupPercent, type HotelCard as CardData } from "@/lib/content/store";
import { EtgError } from "@/lib/etg/errors";
import type { StayQuery } from "@/lib/etg/schemas";
import { buildList, filterItems, resultsCountLine, sortItems, type ListFilters, type ListItem, type SortKey } from "@/lib/search/list";
import { FIXTURE_DELAY_COOKIE, FIXTURE_FAIL_COOKIE, fixtureDelayMs, fixtureEmpty, fixtureFailure, fixtureNoContent } from "@/lib/search/fixture-failure";
import { cachedSearchRegion } from "@/lib/search/serp-cache";
import { recordMissingSafely } from "@/lib/search/record-missing";
import { nightsBetween } from "@/lib/search/summary";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ResultsProps = {
  regionId: number;
  query: Omit<StayQuery, "residency">;
  residency: string;
  sort: SortKey;
  filters: ListFilters;
  filtersActive: boolean;
  /** The same search, to try again. */
  retryHref: string;
  /** The same search without filters. */
  clearHref: string;
  /** Query string that carries dates and rooms to a hotel page. */
  hotelQuery: string;
};

/**
 * `total`: hotels listed before filters. `noContent`: the search found hotels but none has stored content yet.
 * `partial`: the supplier has more hotels than it returned.
 */
type Loaded = { items: ListItem[]; total: number; noContent: boolean; partial: boolean };
type Simulated = { failure: EtgError | null; delayMs: number; empty: boolean; noContent: boolean };

/**
 * Search-list prices. This reads request-time data and uses no `use cache`. The region search itself is held
 * for a few minutes (see serp-cache.ts) so sorting and filtering do not each spend a RateHawk request; these
 * are approximate "From" prices that the hotel page refreshes.
 */
async function load(props: ResultsProps, simulated: Simulated): Promise<Loaded> {
  if (simulated.delayMs) await new Promise((resolve) => setTimeout(resolve, simulated.delayMs));
  if (simulated.failure) throw simulated.failure;
  const [search, markupPercent, dictionaries] = await Promise.all([
    simulated.empty ? Promise.resolve({ hotels: [], totalHotels: 0 }) : cachedSearchRegion(props.regionId, { ...props.query, residency: props.residency }),
    getMarkupPercent(),
    getDictionaries(),
  ]);
  const results = search.hotels;
  // Only the columns a card shows, read within a time limit (see store.ts).
  const hotels = simulated.noContent ? new Map<number, CardData>() : await getHotelCards(results.map((r) => r.hid));
  const ctx = { markupPercent, taxNames: dictionaries.taxNames, now: new Date(), currency: props.query.currency };
  const { items: all, missing } = buildList(results, hotels, ctx);
  // Cancellation and breakfast requirements choose which rate is priced, so they go into the build, not a later filter.
  const items = props.filters.freeCancellation || props.filters.breakfast
    ? buildList(results, hotels, ctx, { freeCancellation: props.filters.freeCancellation, breakfast: props.filters.breakfast }).items
    : all;
  // Hotels without stored content are left out; note them for the next content sync, after the response.
  after(() => recordMissingSafely(missing));
  return {
    items: sortItems(filterItems(items, props.filters), props.sort),
    total: all.length,
    noContent: results.length > 0 && hotels.size === 0,
    partial: search.totalHotels !== null && search.totalHotels > results.length,
  };
}

export async function Results(props: ResultsProps) {
  // Request time only: prices and the clock must never come from a prerender.
  await connection();
  const mode = getEnv().ETG_MODE;
  const store = await cookies();
  const simulated: Simulated = {
    failure: fixtureFailure(mode, store.get(FIXTURE_FAIL_COOKIE)?.value),
    delayMs: fixtureDelayMs(mode, store.get(FIXTURE_DELAY_COOKIE)?.value),
    empty: fixtureEmpty(mode, store.get(FIXTURE_FAIL_COOKIE)?.value),
    noContent: fixtureNoContent(mode, store.get(FIXTURE_FAIL_COOKIE)?.value),
  };

  let loaded: Loaded;
  try {
    loaded = await load(props, simulated);
  } catch (e) {
    if (e !== simulated.failure) console.error("Search results failed:", e instanceof EtgError ? `${e.code} (HTTP ${e.httpStatus})` : e instanceof Error ? e.message : "unknown error");
    return <PricesUnavailable retryable={e instanceof EtgError && e.retryable} href={props.retryHref} />;
  }

  const { items, total, noContent, partial } = loaded;
  if (items.length === 0) {
    const filteredOut = props.filtersActive && total > 0;
    // Hotels were found, but we cannot show any of them yet: say so, rather than that nothing is available.
    const [heading, hint] = noContent
      ? ["We're still adding details for hotels in this destination.", "Please try another destination."]
      : filteredOut
        ? ["No hotels match these filters.", "Try loosening a filter to see more."]
        : ["No hotels are available for these dates.", "Try different dates, or another destination."];
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
        <h2 className="text-lg font-semibold tracking-[0.01em] [word-spacing:0.1em]">{heading}</h2>
        <p className="text-muted-foreground">{hint}</p>
        {filteredOut && (
          <Link href={props.clearHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-5")}>
            Clear filters
          </Link>
        )}
      </div>
    );
  }

  const nights = nightsBetween(props.query.checkin, props.query.checkout);
  return (
    <section aria-label="Hotels">
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {resultsCountLine(items.length, total, { filtersActive: props.filtersActive, partial })}
      </p>
      <ul className="flex flex-col gap-5">
        {items.map((item, i) => (
          <HotelCard key={item.hotel.hid} item={item} index={i} nights={nights} href={`/hotel/${item.hotel.hid}?${props.hotelQuery}`} />
        ))}
      </ul>
    </section>
  );
}
