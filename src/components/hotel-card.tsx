import { Building2, Check, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/content/image-url";
import type { ListItem } from "@/lib/search/list";
import { Price } from "./price";
import { Reveal } from "./reveal";

/** Both the card and its loading skeleton use these, so the swap does not move the page. */
export const CARD_SHELL = "relative flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 sm:flex-row";
export const CARD_IMAGE = "relative aspect-[640/350] w-full shrink-0 bg-muted sm:aspect-auto sm:w-72";
export const CARD_BODY = "flex min-h-52 flex-1 flex-col gap-5 p-5 sm:min-h-56 sm:flex-row sm:justify-between sm:p-6";

/** Images load eagerly for the first cards (likely above the fold) and lazily after that. */
const EAGER_CARDS = 2;

export function HotelCard({ item, index, nights, href }: { item: ListItem; index: number; nights: number; href: string }) {
  const { hotel, from } = item;
  const photo = hotel.images[0];
  return (
    <Reveal index={index}>
      <article className={`${CARD_SHELL} has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring`}>
        <div className={CARD_IMAGE}>
          {photo ? (
            <Image
              src={imageUrl(photo.url, "640x350")}
              alt={hotel.name}
              fill
              unoptimized
              sizes="(min-width: 640px) 288px, 100vw"
              loading={index < EAGER_CARDS ? "eager" : "lazy"}
              fetchPriority={index < EAGER_CARDS ? "high" : "auto"}
              className="object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Building2 aria-hidden className="size-8" strokeWidth={1.25} />
              <span className="text-xs">Photo not available</span>
            </div>
          )}
        </div>
        <div className={CARD_BODY}>
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="text-lg leading-snug font-semibold tracking-[0.01em] [word-spacing:0.1em]">
              {/* The link's pseudo-element stretches over the whole card, so the card is one target and one tab stop. */}
              <Link href={href} prefetch={false} className="line-clamp-2 outline-none after:absolute after:inset-0">
                {hotel.name}
              </Link>
            </h2>
            {hotel.starRating !== null && (
              <p className="flex items-center gap-0.5 text-foreground">
                {Array.from({ length: hotel.starRating }, (_, i) => (
                  <Star key={i} aria-hidden className="size-3.5 fill-current" />
                ))}
                <span className="sr-only">{hotel.starRating}-star hotel</span>
              </p>
            )}
            {hotel.reviewRating !== null && (
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{hotel.reviewRating.toFixed(1)}</span>
                <span className="text-muted-foreground"> guest rating</span>
                <span className="sr-only"> out of 10</span>
              </p>
            )}
            {hotel.address && <p className="line-clamp-1 text-sm text-muted-foreground">{hotel.address}</p>}
            {(item.freeCancellation || item.hasBreakfast) && (
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {item.freeCancellation && (
                  <li className="flex items-center gap-1.5">
                    <Check aria-hidden className="size-3.5 text-muted-foreground" />
                    Free cancellation available
                  </li>
                )}
                {item.hasBreakfast && (
                  <li className="flex items-center gap-1.5">
                    <Check aria-hidden className="size-3.5 text-muted-foreground" />
                    Breakfast available
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="flex flex-col justify-end gap-1 sm:w-52 sm:shrink-0 sm:text-right">
            <p className="text-sm text-muted-foreground">From</p>
            <Price price={from} nights={nights} />
          </div>
        </div>
      </article>
    </Reveal>
  );
}
