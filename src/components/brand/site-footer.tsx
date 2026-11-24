import Link from "next/link";

const COLUMNS = [
  { title: "Support", links: ["Help Center", "Cancellation options", "Safety information"] },
  { title: "Hosting", links: ["Roamanda your home", "Host resources", "Community forum"] },
  { title: "Company", links: ["Newsroom", "Careers", "Investors"] },
  { title: "Explore", links: ["Destinations", "Experiences", "Services"] },
];

export function SiteFooter() {
  return (
    <footer className="w-full bg-[#f5f5fb] px-4 pt-12 pb-8 sm:px-8 lg:px-20">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-8">
        <div className="h-px w-full bg-[#e7e7f0]" />
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3.5">
              <h2 className="text-sm font-semibold text-roam-ink">{col.title}</h2>
              {col.links.map((l) => (
                <Link key={l} href="/" className="text-[13px] text-roam-muted transition-colors hover:text-roam-blue">
                  {l}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="h-px w-full bg-[#e7e7f0]" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <p className="text-[13px] text-roam-muted">© 2026 Roamanda, Inc.</p>
          <div className="flex items-center gap-7 sm:ml-auto">
            <Link href="/" className="text-[13px] text-roam-muted transition-colors hover:text-roam-blue">Privacy</Link>
            <Link href="/" className="text-[13px] text-roam-muted transition-colors hover:text-roam-blue">Terms</Link>
            <Link href="/" className="text-[13px] text-roam-muted transition-colors hover:text-roam-blue">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
