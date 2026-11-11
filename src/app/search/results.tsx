import { after, connection } from "next/server";
import { cookies } from "next/headers";
import { PricesUnavailable } from "@/components/prices-unavailable";
import { HotelCard } from "@/components/hotel-card";
import { getEnv } from "@/env";
import { getDictionaries, getHotels, getMarkupPercent } from "@/lib/content/store";
import { EtgError } from "@/lib/etg/errors";
import type { StayQuery } from "@/lib/etg/schemas";
import { buildList, filterItems, sortItems, type ListFilters, type ListItem, type SortKey } from "@/lib/search/list";
import { FIXTURE_DELAY_COOKIE, FIXTURE_FAIL_COOKIE, fixtureDelayMs, fixtureEmpty, fixtureFailure } from "@/lib/search/fixture-failure";
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

type Loaded = { items: ListItem[]; total: number };

/**
 * Search-list prices. This reads request-time data and uses no `use cache`. The region search itself is held
 * for a few minutes (see serp-cache.ts) so sorting and filtering do not each spend a RateHawk request; these
 * are approximate "From" prices that the hotel page refreshes.
 */
async function load(props: ResultsProps, simulated: { failure: EtgError | null; delayMs: number; empty: boolean }): Promise<Loaded> {
  if (simulated.delayMs) await new Promise((resolve) => setTimeout(resolve, simulated.delayMs));
  if (simulated.failure) throw simulated.failure;
  const [results, markupPercent, dictionaries] = await Promise.all([
    simulated.empty ? Promise.resolve([]) : cachedSearchRegion(props.regionId, { ...props.query, residency: props.residency }),
    getMarkupPercent(),
    getDictionaries(),
  ]);
  const hotels = await getHotels(results.map((r) => r.hid));
  const ctx = { markupPercent, taxNames: dictionaries.taxNames, now: new Date(), currency: props.query.currency };
  const { items: all, missing } = buildList(results, hotels, ctx);
  // Cancellation and breakfast requirements choose which rate is priced, so they go into the build, not a later filter.
  const items = props.filters.freeCancellation || props.filters.breakfast
    ? buildList(results, hotels, ctx, { freeCancellation: props.filters.freeCancellation, breakfast: props.filters.breakfast }).items
    : all;
  // Hotels without stored content are left out; note them for the next content sync, after the response.
  after(() => recordMissingSafely(missing));
  return { items: sortItems(filterItems(items, props.filters), props.sort), total: all.length };
}

export async function Results(props: ResultsProps) {
  // Request time only: prices and the clock must never come from a prerender.
  await connection();
  const mode = getEnv().ETG_MODE;
  const store = await cookies();
  const simulated = {
    failure: fixtureFailure(mode, store.get(FIXTURE_FAIL_COOKIE)?.value),
    delayMs: fixtureDelayMs(mode, store.get(FIXTURE_DELAY_COOKIE)?.value),
    empty: fixtureEmpty(mode, store.get(FIXTURE_FAIL_COOKIE)?.value),
  };

  let loaded: Loaded;
  try {
    loaded = await load(props, simulated);
  } catch (e) {
    if (e !== simulated.failure) console.error("Search results failed:", e instanceof EtgError ? `${e.code} (HTTP ${e.httpStatus})` : e instanceof Error ? e.message : "unknown error");
    return <PricesUnavailable retryable={e instanceof EtgError && e.retryable} href={props.retryHref} />;
  }

  const { items, total } = loaded;
  if (items.length === 0) {
    const filteredOut = props.filtersActive && total > 0;
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
        <h2 className="text-lg font-semibold tracking-[0.01em] [word-spacing:0.1em]">
          {filteredOut ? "No hotels match these filters." : "No hotels are available for these dates."}
        </h2>
        <p className="text-muted-foreground">{filteredOut ? "Try loosening a filter to see more." : "Try different dates, or another destination."}</p>
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
        {props.filtersActive ? `${items.length} of ${total} hotels match` : `${items.length} ${items.length === 1 ? "hotel" : "hotels"}`}
      </p>
      <ul className="flex flex-col gap-5">
        {items.map((item, i) => (
          <HotelCard key={item.hotel.hid} item={item} index={i} nights={nights} href={`/hotel/${item.hotel.hid}?${props.hotelQuery}`} />
        ))}
      </ul>
    </section>
  );
}
