import { reviewModel } from "@/lib/hotel/review";
import type { Hotel } from "@/lib/content/types";

/** Overall guest score and category scores. Renders nothing at all when the hotel has no rating. */
export function ReviewSummary({ hotel }: { hotel: Pick<Hotel, "reviewRating" | "reviewDetailed"> }) {
  const model = reviewModel(hotel);
  if (!model) return null;
  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-5">
      <h2 id="reviews-heading" className="text-2xl font-semibold tracking-[0.01em] [word-spacing:0.1em]">Guest reviews</h2>
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums">{model.score}</span>
        <span className="text-muted-foreground">out of 10</span>
      </p>
      {model.categories.length > 0 && (
        <dl className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {model.categories.map((c) => (
            <div key={c.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-4 text-sm">
                <dt>{c.label}</dt>
                <dd className="tabular-nums">{c.score}</dd>
              </div>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.round(c.fraction * 100)}%` }} />
              </div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
