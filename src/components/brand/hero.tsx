import Link from "next/link";
import type { ReactNode } from "react";

/** Quick-filter chips under the hero search. Visual for now; they scroll to the search. */
const CHIPS = ["Trending: Lisbon", "Family-friendly", "Beachfront", "Design hotels", "Pet-friendly", "All-inclusive"];

/**
 * Roamanda hero: award badge, "Where to?" headline, and the search.
 * The design shows a single free-text pill; the app needs a real structured search (destination + dates +
 * guests + residency), so the functional `SearchForm` is slotted in as `children`.
 */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="hero-heading" className="w-full bg-roam-surface px-4 py-14 sm:px-8 sm:py-16">
      <div className="mx-auto flex max-w-[860px] flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e8eef9] py-1.5 pr-3.5 pl-3 text-xs font-semibold text-[#0d47a1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/trophy.svg" alt="" width={12} height={12} className="size-3" />
          Travelers&rsquo; Choice Awards 2026 announced
        </span>

        <h1 id="hero-heading" className="text-4xl font-bold tracking-tight text-roam-ink sm:text-5xl lg:text-[56px]">
          Where to?
        </h1>
        <p className="text-base text-roam-muted sm:text-[17px]">Hotels, experiences and restaurants loved by 1.2B travelers.</p>

        <div id="search" className="w-full scroll-mt-24 text-left">
          {children}
        </div>

        <ul className="flex flex-wrap justify-center gap-2.5">
          {CHIPS.map((chip) => (
            <li key={chip}>
              <Link
                href="/#search"
                className="inline-block rounded-full border border-roam-border bg-white px-3.5 py-[9px] text-xs font-medium text-roam-ink transition-colors hover:border-roam-blue hover:text-roam-blue"
              >
                {chip}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
