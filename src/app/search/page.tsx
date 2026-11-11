import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ResultsSkeleton } from "@/components/results-skeleton";
import { SearchForm } from "@/components/search-form/search-form";
import { initialFormValues } from "@/lib/search/initial";
import { parseListParams } from "@/lib/search/list";
import { first, parseSearchParams, regionNameParam, type RawParams } from "@/lib/search/params";
import { getResidency } from "@/lib/search/residency";
import { describeStay } from "@/lib/search/summary";
import { Filters } from "./filters";
import { Results } from "./results";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const name = regionNameParam(await searchParams);
  return { title: name ? `Hotels in ${name}` : "Search hotels" };
}

const SEARCH_KEYS = ["region", "name", "in", "out", "rooms"] as const;
const FILTER_KEYS = ["sort", "stars", "rating", "free", "breakfast", "max"] as const;

/** The known params that are present, with their first value; anything else in the URL is dropped. */
function pick(sp: RawParams, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = first(sp[key]);
    if (v !== undefined && v !== "") out[key] = v;
  }
  return out;
}

const headingClass = "text-3xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-4xl";

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <Suspense fallback={<PageFallback />}>
        <SearchContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

/** The static shell: shown at once while the URL and cookie are read. */
function PageFallback() {
  return (
    <>
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="h-9 w-72 max-w-full rounded-md bg-muted" />
        <div className="h-4 w-64 max-w-full rounded-md bg-muted" />
      </div>
      <ResultsSkeleton />
    </>
  );
}

async function SearchContent({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  await connection(); // "today" is read below; keep it out of any prerender
  const sp = await searchParams;
  const parsed = parseSearchParams(sp, new Date());

  if (!parsed.ok) {
    return (
      <>
        <header className="flex flex-col gap-3">
          <h1 className={headingClass}>Check your search</h1>
          <p className="text-muted-foreground">Something in this search needs another look. Fix it below and search again.</p>
        </header>
        <div role="alert" className="rounded-2xl bg-destructive/5 p-5 ring-1 ring-destructive/30 sm:p-6">
          <p className="mb-2 text-sm font-medium text-foreground">We could not use this search:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
            {parsed.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <SearchForm initial={initialFormValues(sp)} />
      </>
    );
  }

  const search = pick(sp, SEARCH_KEYS);
  const residency = await getResidency();
  // Without a passport country there are no prices to show. Home asks for it, and keeps the search filled in.
  if (!residency) redirect(`/?${new URLSearchParams(search)}`);

  const { sort, filters, active } = parseListParams(sp);
  const listParams = pick(sp, FILTER_KEYS);
  const retryHref = `/search?${new URLSearchParams({ ...search, ...listParams })}`;
  const clearHref = `/search?${new URLSearchParams({ ...search, ...(sort !== "recommended" ? { sort } : {}) })}`;
  const hotelQuery = new URLSearchParams({ in: parsed.query.checkin, out: parsed.query.checkout, rooms: search.rooms ?? "" }).toString();

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className={headingClass}>{parsed.regionName ? `Hotels in ${parsed.regionName}` : "Hotels"}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <span>{describeStay({ ...parsed.query })}</span>
          <Link href={`/?${new URLSearchParams(search)}`} prefetch={false} className="text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Change search
          </Link>
        </p>
      </header>
      <Filters search={search} sort={sort} filters={filters} active={active} clearHref={clearHref} />
      {/* The key makes a change of search or filters show the skeleton again instead of the old list. */}
      <Suspense key={retryHref} fallback={<ResultsSkeleton />}>
        <Results
          regionId={parsed.regionId}
          query={parsed.query}
          residency={residency}
          sort={sort}
          filters={filters}
          filtersActive={active}
          retryHref={retryHref}
          clearHref={clearHref}
          hotelQuery={hotelQuery}
        />
      </Suspense>
    </>
  );
}
