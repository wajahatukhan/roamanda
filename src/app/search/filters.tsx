import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ListFilters, SortKey } from "@/lib/search/list";
import { cn } from "@/lib/utils";

const SELECT =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * Sort and filters as a plain GET form: it works without JavaScript, and the server applies the values.
 * `search` carries the search itself (region, dates, rooms) through as hidden fields.
 */
export function Filters({ search, sort, filters, active, clearHref }: { search: Record<string, string>; sort: SortKey; filters: ListFilters; active: boolean; clearHref: string }) {
  return (
    <form method="get" action="/search" aria-label="Sort and filter hotels" className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      {Object.entries(search).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="sort" label="Sort by">
          <select id="sort" name="sort" defaultValue={sort} className={SELECT}>
            <option value="recommended">Recommended</option>
            <option value="price">Price, lowest first</option>
            <option value="rating">Guest rating, highest first</option>
          </select>
        </Field>
        <Field id="stars" label="Star rating">
          <select id="stars" name="stars" defaultValue={filters.minStars?.toString() ?? ""} className={SELECT}>
            <option value="">Any</option>
            <option value="3">3 stars and up</option>
            <option value="4">4 stars and up</option>
            <option value="5">5 stars</option>
          </select>
        </Field>
        <Field id="rating" label="Guest rating">
          <select id="rating" name="rating" defaultValue={filters.minRating?.toString() ?? ""} className={SELECT}>
            <option value="">Any</option>
            <option value="6">6 and up</option>
            <option value="7">7 and up</option>
            <option value="8">8 and up</option>
            <option value="9">9 and up</option>
          </select>
        </Field>
        <Field id="max" label="Highest total price (USD)">
          <Input id="max" name="max" type="number" min="1" step="any" inputMode="decimal" defaultValue={filters.maxPrice ?? ""} placeholder="No limit" className="h-10 md:text-sm" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="free" value="1" defaultChecked={filters.freeCancellation} className="size-4 accent-primary" />
            Free cancellation
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="breakfast" value="1" defaultChecked={filters.breakfast} className="size-4 accent-primary" />
            Breakfast available
          </label>
        </div>
        <div className="flex items-center gap-3">
          {active && (
            <Link href={clearHref} prefetch={false} className={cn(buttonVariants({ variant: "ghost" }), "h-10 px-4")}>
              Clear filters
            </Link>
          )}
          <Button type="submit" className="h-10 px-5">
            Apply
          </Button>
        </div>
      </div>
    </form>
  );
}
