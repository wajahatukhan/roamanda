import Link from "next/link";
import { StarRating } from "./star-rating";

/**
 * PLACEHOLDER / DEMO CONTENT — these hotels, ratings and prices are NOT live inventory.
 * The project forbids fabricated prices in production (see CLAUDE.md): before launch this must be
 * wired to real RateHawk data (e.g. a "top-rated in <city>" query) or removed. "View deal" routes
 * to the search for now.
 */
const STAYS = [
  { name: "Alfama Boutique Rooftop", location: "Alfama, Lisbon · #1 of 450", rating: 4.7, reviews: 1284, price: "$196", travelersChoice: true, image: "/brand/stay-alfama.jpg" },
  { name: "Chiado Design Suites", location: "Chiado, Lisbon · #3 of 450", rating: 4.8, reviews: 842, price: "$278", travelersChoice: true, image: "/brand/stay-chiado.jpg" },
  { name: "Príncipe Real Apartments", location: "Príncipe Real · #12 of 450", rating: 4.5, reviews: 412, price: "$154", travelersChoice: false, image: "/brand/stay-principe.jpg" },
  { name: "Belém Riverside Resort", location: "Belém, Lisbon · #6 of 450", rating: 4.6, reviews: 1672, price: "$252", travelersChoice: true, image: "/brand/stay-belem.jpg" },
];

export function StaysInLisbon() {
  return (
    <section aria-labelledby="stays-heading" className="w-full bg-white px-4 pt-12 pb-6 sm:px-8 lg:px-20">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="stays-heading" className="text-2xl font-bold text-roam-ink">Stays travelers love in Lisbon</h2>
          <p className="text-[13px] text-roam-muted">Hand-picked from top-rated properties</p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAYS.map((s) => (
            <li key={s.name} className="flex flex-col overflow-hidden rounded-2xl border border-roam-border bg-white">
              <div className="h-[180px] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt="" className="size-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                {s.travelersChoice && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#c2410c] bg-[#fff1ea] py-1.5 pr-3 pl-2.5 text-[11px] font-bold tracking-[0.3px] text-[#c2410c]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/award.svg" alt="" width={14} height={14} className="size-3.5" />
                    Travelers&rsquo; Choice
                  </span>
                )}
                <h3 className="text-sm font-bold text-roam-ink">{s.name}</h3>
                <p className="text-[11px] text-roam-muted">{s.location}</p>
                <StarRating rating={s.rating} count={s.reviews} />
                <div className="mt-auto flex items-center pt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-roam-muted">From</span>
                    <span className="text-base font-bold text-roam-ink">{s.price}</span>
                  </div>
                  <Link
                    href="/"
                    className="ml-auto rounded-full bg-roam-accent px-3.5 py-[9px] text-xs font-bold text-white transition-colors hover:bg-roam-accent-dark"
                  >
                    View deal
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
