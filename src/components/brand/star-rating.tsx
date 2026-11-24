import { cn } from "@/lib/utils";

/** A 5-star rating row (rounded down to the nearest half star) with the numeric score and optional review count. */
export function StarRating({ rating, count, className }: { rating: number; count?: number; className?: string }) {
  const half = Math.floor(rating * 2) / 2;
  const full = Math.floor(half);
  const hasHalf = half - full === 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: full }).map((_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`f${i}`} src="/brand/star-filled.svg" alt="" width={12} height={12} className="size-3" />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hasHalf && <img src="/brand/star-half.svg" alt="" width={12} height={12} className="size-3" />}
        {Array.from({ length: empty }).map((_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`e${i}`} src="/brand/star-empty.svg" alt="" width={12} height={12} className="size-3" />
        ))}
      </div>
      <span className="text-xs font-bold text-roam-ink">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-roam-muted">({count.toLocaleString()})</span>}
    </div>
  );
}
