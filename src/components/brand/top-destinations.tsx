import Link from "next/link";
import { StarRating } from "./star-rating";

/** Editorial "Travelers' Choice" list — static marketing content, not live inventory. */
const DESTINATIONS = [
  { rank: 1, category: "Islands", name: "Santorini, Greece", rating: 4.8, reviews: 32418, image: "/brand/dest-santorini.jpg" },
  { rank: 2, category: "Beaches", name: "Bali, Indonesia", rating: 4.7, reviews: 48239, image: "/brand/dest-bali.jpg" },
  { rank: 3, category: "Culture", name: "Kyoto, Japan", rating: 4.9, reviews: 28702, image: "/brand/dest-kyoto.jpg" },
  { rank: 4, category: "Mountains", name: "Swiss Alps", rating: 4.8, reviews: 19183, image: "/brand/dest-swiss.jpg" },
];

export function TopDestinations() {
  return (
    <section aria-labelledby="dest-heading" className="w-full bg-white px-4 pt-16 pb-6 sm:px-8 lg:px-20">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#e8eef9] py-[5px] pr-3 pl-2.5 text-[11px] font-bold tracking-[0.5px] text-[#0d47a1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/trophy.svg" alt="" width={12} height={12} className="size-3" />
              TRAVELERS&rsquo; CHOICE 2026
            </span>
            <h2 id="dest-heading" className="text-[28px] font-bold text-roam-ink">Top destinations travelers love</h2>
            <p className="text-sm text-roam-muted">Based on 1.2M+ reviews from Roamanda travelers worldwide</p>
          </div>
          <Link
            href="/"
            className="ml-auto rounded-full border border-roam-ink px-4 py-[9px] text-[13px] font-semibold text-roam-ink transition-colors hover:bg-roam-ink hover:text-white"
          >
            See full list ›
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DESTINATIONS.map((d) => (
            <li key={d.rank} className="overflow-hidden rounded-2xl border border-roam-border bg-white">
              <div className="h-[220px] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.image} alt="" className="size-full object-cover" />
              </div>
              <div className="flex flex-col gap-2 px-4 pt-4 pb-[18px]">
                <div className="flex items-center">
                  <span className="rounded-full bg-roam-blue px-2.5 py-[3px] text-[11px] font-bold text-white">#{d.rank}</span>
                  <span className="ml-auto text-[11px] font-semibold text-roam-muted">{d.category}</span>
                </div>
                <h3 className="text-[17px] font-bold text-roam-ink">{d.name}</h3>
                <StarRating rating={d.rating} count={d.reviews} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
