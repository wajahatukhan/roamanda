import Link from "next/link";

/** Top-level categories in the Roamanda nav. Only Hotels is implemented; the rest are placeholders. */
type Category = { label: string; icon: string; href: string; active?: boolean };
const CATEGORIES: Category[] = [
  { label: "Hotels", icon: "/brand/cat-hotel.svg", href: "/", active: true },
  { label: "Things to Do", icon: "/brand/cat-sparkle.svg", href: "/" },
  { label: "Restaurants", icon: "/brand/cat-plate.svg", href: "/" },
  { label: "Flights", icon: "/brand/cat-plane.svg", href: "/" },
  { label: "Vacation Rentals", icon: "/brand/cat-house.svg", href: "/" },
  { label: "Cruises", icon: "/brand/cat-ship.svg", href: "/" },
  { label: "Rental Cars", icon: "/brand/cat-car.svg", href: "/" },
];

// The gutter lives on a full-width wrapper and the max-width on the inner row, exactly like the Hero and the
// page sections — so the header, banner and every section share one left/right edge at any viewport width.
const gutter = "w-full px-4 sm:px-8 lg:px-20";
const row = "mx-auto w-full max-w-[1440px]";

/** Global Roamanda header: brand, a search affordance that jumps to the hero search, account links, and category tabs. */
export function SiteHeader() {
  return (
    <header className="w-full border-b border-roam-border bg-white">
      <div className={gutter}>
      <div className={`${row} flex items-center gap-4 pt-[18px] pb-3.5 sm:gap-8`}>
        <Link
          href="/"
          aria-label="Roamanda home"
          className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-roam-accent focus-visible:ring-offset-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="Roamanda" width={153} height={29} className="h-[29px] w-auto" />
        </Link>

        <Link
          href="/#search"
          className="hidden min-w-0 flex-1 items-center gap-2.5 rounded-full bg-roam-surface py-1.5 pr-1.5 pl-[18px] text-roam-muted transition-colors hover:bg-[#f1f3f5] focus-visible:ring-2 focus-visible:ring-roam-accent focus-visible:outline-none md:flex"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/search.svg" alt="" width={18} height={18} className="size-[18px] shrink-0" />
          <span className="truncate text-sm">Hotels, places, experiences</span>
          <span className="ml-auto shrink-0 rounded-full bg-roam-accent px-[22px] py-2.5 text-[13px] font-bold text-white">Search</span>
        </Link>

        <nav aria-label="Account" className="ml-auto flex shrink-0 items-center gap-5 md:ml-0">
          <Link href="/#trips" className="hidden text-[13px] font-semibold text-roam-ink hover:text-roam-accent sm:block">
            Trips
          </Link>
          <Link href="/#reviews" className="hidden text-[13px] font-semibold text-roam-ink hover:text-roam-accent sm:block">
            Reviews
          </Link>
          <Link
            href="/#signin"
            className="rounded-full border border-roam-ink px-4 py-[9px] text-[13px] font-semibold text-roam-ink transition-colors hover:bg-roam-ink hover:text-white"
          >
            Sign in
          </Link>
        </nav>
      </div>
      </div>

      <div className={gutter}>
      <div className={row}>
        <nav
          aria-label="Browse categories"
          className="-mx-4 flex gap-0.5 overflow-x-auto px-4 pb-3.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              aria-current={c.active ? "page" : undefined}
              className={[
                "flex shrink-0 items-center gap-2 border-b-[3px] px-[18px] py-3.5 text-[13px] whitespace-nowrap transition-colors",
                c.active
                  ? // Brand coral per Figma Homepage 7. #ff6b35 on white is below WCAG AA (2.84:1);
                    // this is a deliberate design choice and is exempted from the contrast scan in
                    // tests/e2e/search-form.spec.ts via its aria-current="page".
                    "border-[#ff6b35] font-bold text-[#ff6b35]"
                  : "border-transparent font-medium text-roam-ink hover:text-roam-accent",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.icon} alt="" width={16} height={16} className="size-4 shrink-0" />
              {c.label}
            </Link>
          ))}
        </nav>
      </div>
      </div>
    </header>
  );
}
