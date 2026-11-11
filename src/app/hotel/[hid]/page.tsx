import { Clock, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/env";
import { Gallery } from "@/components/gallery";
import { PolicyList } from "@/components/policy-list";
import { ReviewSummary } from "@/components/review-summary";
import type { AmenityGroup } from "@/lib/content/types";
import { getHotelContent } from "@/lib/hotel/content";
import { formatClock, humanize } from "@/lib/hotel/format";
import { HID } from "@/lib/hotel/hotel-id";
import { FIXTURE_FAIL_COOKIE, FIXTURE_RATED_COOKIE, fixtureRated, hotelContentFailure } from "@/lib/search/fixture-failure";
import { RatesSection } from "./rates";

// Reads the route parameter and the stored content before streaming, so an unknown hotel gets a real 404 status.
export const instant = false;

const h2 = "text-2xl font-semibold tracking-[0.01em] [word-spacing:0.1em]";

/** Each amenity once; those that also appear in the group's non-free list are marked, not listed twice. */
function amenityItems(g: AmenityGroup): { name: string; extra: boolean }[] {
  const extra = new Set(g.nonFreeAmenities);
  const names = [...new Set([...g.amenities, ...g.nonFreeAmenities])];
  return names.map((name) => ({ name, extra: extra.has(name) }));
}

async function load(hidParam: string) {
  if (!HID.test(hidParam)) return null;
  const hid = Number(hidParam);
  // Fixture mode only: a cookie can make the content read fail, so the error page can be tested.
  const failure = hotelContentFailure(getEnv().ETG_MODE, (await cookies()).get(FIXTURE_FAIL_COOKIE)?.value);
  if (failure) throw failure;
  return { hid, hotel: await getHotelContent(hid) };
}

export async function generateMetadata({ params }: PageProps<"/hotel/[hid]">): Promise<Metadata> {
  const found = await load((await params).hid);
  return { title: found?.hotel ? found.hotel.name : "Hotel not found" };
}

export default async function HotelPage({ params, searchParams }: PageProps<"/hotel/[hid]">) {
  const found = await load((await params).hid);
  if (!found) notFound();
  const { hid } = found;
  // Fixture mode only: a cookie can overlay a review rating, since the recorded hotels have none.
  const rated = fixtureRated(getEnv().ETG_MODE, (await cookies()).get(FIXTURE_RATED_COOKIE)?.value);
  const hotel = found.hotel && rated ? { ...found.hotel, ...rated } : found.hotel;
  // The proxy answers 404 for an unknown hotel first; this is the fallback. Neither records the visit anywhere.
  if (!hotel) notFound();

  const sp = await searchParams;
  const checkIn = formatClock(hotel.checkInTime);
  const checkOut = formatClock(hotel.checkOutTime);
  const about = hotel.description.filter((s) => s.paragraphs.length > 0);
  const amenities = hotel.amenityGroups.filter((g) => g.amenities.length > 0 || g.nonFreeAmenities.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-3">
        {(hotel.kind || hotel.regionName) && (
          <p className="text-sm text-muted-foreground">{[hotel.kind ? humanize(hotel.kind) : null, hotel.regionName].filter(Boolean).join(" · ")}</p>
        )}
        <h1 className="text-3xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-5xl">{hotel.name}</h1>
        {hotel.starRating !== null && (
          <p className="flex items-center gap-0.5">
            {Array.from({ length: hotel.starRating }, (_, i) => (
              <Star key={i} aria-hidden className="size-4 fill-current" />
            ))}
            <span className="sr-only">{hotel.starRating}-star hotel</span>
          </p>
        )}
        {hotel.address && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin aria-hidden className="mt-1 size-4 shrink-0" />
            <span>{hotel.address}</span>
          </p>
        )}
      </header>

      <Gallery images={hotel.images} />

      <RatesSection hid={hid} hotel={hotel} sp={sp} />

      {about.length > 0 && (
        <section aria-labelledby="about-heading" className="flex flex-col gap-4">
          <h2 id="about-heading" className={h2}>About this hotel</h2>
          <div className="flex max-w-prose flex-col gap-4">
            {about.map((s, i) => (
              <div key={i} className="flex flex-col gap-2">
                {s.title && <h3 className="text-base font-semibold tracking-[0.01em] [word-spacing:0.1em]">{s.title}</h3>}
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-muted-foreground">{p}</p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {amenities.length > 0 && (
        <section aria-labelledby="amenities-heading" className="flex flex-col gap-5">
          <h2 id="amenities-heading" className={h2}>Amenities</h2>
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((g, i) => (
              <div key={`${g.groupName}-${i}`} className="flex flex-col gap-2">
                <h3 className="text-base font-semibold tracking-[0.01em] [word-spacing:0.1em]">{g.groupName}</h3>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {amenityItems(g).map((a) => (
                    <li key={a.name}>
                      {a.name}
                      {a.extra && <span className="text-muted-foreground"> (may cost extra)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <ReviewSummary hotel={hotel} />

      <section aria-labelledby="policies-heading" className="flex flex-col gap-6">
        <h2 id="policies-heading" className={h2}>Policies</h2>
        {(checkIn || checkOut) && (
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            {checkIn && (
              <div className="flex items-center gap-3">
                <Clock aria-hidden className="size-4 text-muted-foreground" />
                <dt className="text-muted-foreground">Check-in from</dt>
                <dd className="font-medium">{checkIn}</dd>
              </div>
            )}
            {checkOut && (
              <div className="flex items-center gap-3">
                <Clock aria-hidden className="size-4 text-muted-foreground" />
                <dt className="text-muted-foreground">Check-out until</dt>
                <dd className="font-medium">{checkOut}</dd>
              </div>
            )}
          </dl>
        )}
        <PolicyList struct={hotel.metapolicyStruct} extraInfo={hotel.metapolicyExtraInfo} />
      </section>
    </main>
  );
}
