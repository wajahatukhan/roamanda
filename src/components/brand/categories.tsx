import Link from "next/link";

/** Property-type browse tiles. Static marketing shortcuts; `tint` is the decorative circle behind each icon. */
const TYPES = [
  { label: "Hotels", count: "500+ places", icon: "/brand/prop-hotel.svg", tint: "rgba(255,142,114,0.18)" },
  { label: "Apartments", count: "500+ places", icon: "/brand/prop-apartment.svg", tint: "rgba(94,194,216,0.18)" },
  { label: "Villas", count: "500+ places", icon: "/brand/prop-villa.svg", tint: "rgba(232,197,137,0.18)" },
  { label: "Resorts", count: "500+ places", icon: "/brand/prop-resort.svg", tint: "rgba(255,107,53,0.18)" },
  { label: "Cabins", count: "500+ places", icon: "/brand/prop-cabin.svg", tint: "rgba(46,93,79,0.18)" },
  { label: "Cottages", count: "500+ places", icon: "/brand/prop-cottage.svg", tint: "rgba(255,107,53,0.18)" },
  { label: "Glamping", count: "500+ places", icon: "/brand/prop-glamping.svg", tint: "rgba(229,85,37,0.18)" },
  { label: "Boutique", count: "500+ places", icon: "/brand/prop-boutique.svg", tint: "rgba(255,107,53,0.18)" },
];

export function Categories() {
  return (
    <section aria-labelledby="categories-heading" className="w-full bg-white px-4 pt-12 pb-6 sm:px-8 lg:px-20">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        <h2 id="categories-heading" className="text-2xl font-bold text-roam-ink">Browse by property type</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {TYPES.map((t) => (
            <li key={t.label}>
              <Link
                href="/#search"
                className="flex flex-col items-center gap-3 rounded-2xl border border-roam-border bg-white px-4 py-5 outline-none transition-colors hover:border-roam-accent focus-visible:ring-2 focus-visible:ring-roam-accent"
              >
                <span
                  className="flex h-[60px] w-[60px] items-center justify-center rounded-full"
                  style={{ backgroundColor: t.tint }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.icon} alt="" width={28} height={28} className="size-7" />
                </span>
                <span className="text-sm font-semibold text-roam-ink">{t.label}</span>
                <span className="text-xs text-roam-muted">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
