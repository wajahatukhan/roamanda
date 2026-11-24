/** PLACEHOLDER / DEMO testimonials — illustrative content, not real guest reviews. */
const REVIEWS = [
  {
    name: "Clara M.",
    meta: "Spain · Stayed Nov 2026",
    rating: 5,
    title: "A stay that lives rent-free in my mind.",
    body: "The rooftop breakfast with that tram view — I could have stayed a month. Staff anticipated our every need.",
    property: "Alfama Boutique Rooftop",
    avatar: "/brand/avatar-clara.jpg",
  },
  {
    name: "Tomás R.",
    meta: "Brazil · Stayed Oct 2026",
    rating: 5,
    title: "Perfect base for exploring the city.",
    body: "Steps from everything, incredible design, and the rooftop pool was the surprise of the trip. Already booking again.",
    property: "Chiado Design Suites",
    avatar: "/brand/avatar-tomas.jpg",
  },
  {
    name: "Yuki S.",
    meta: "Japan · Stayed Sep 2026",
    rating: 4,
    title: "Boutique charm with a modern touch.",
    body: "Beautiful apartment with everything we needed for a week. Loved the local recommendations from the host.",
    property: "Príncipe Real Apartments",
    avatar: "/brand/avatar-yuki.jpg",
  },
];

export function Testimonials() {
  return (
    <section aria-labelledby="reviews-heading" className="w-full bg-roam-surface px-4 py-14 sm:px-8 lg:px-20">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-6">
        <h2 id="reviews-heading" className="text-2xl font-bold text-roam-ink">What travelers are saying</h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <li key={r.name} className="flex flex-col gap-3 rounded-2xl border border-roam-border bg-white p-5">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.avatar} alt="" className="size-11 rounded-full object-cover" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-roam-ink">{r.name}</span>
                  <span className="text-[11px] text-roam-muted">{r.meta}</span>
                </div>
              </div>
              <div className="flex items-center gap-[3px]" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={i < r.rating ? "/brand/star-filled.svg" : "/brand/star-empty.svg"} alt="" width={12} height={12} className="size-3" />
                ))}
              </div>
              <span className="sr-only">Rated {r.rating} out of 5</span>
              <p className="text-[15px] leading-[22px] font-bold text-roam-ink">{r.title}</p>
              <p className="text-[13px] leading-5 text-roam-muted">{r.body}</p>
              <div className="flex items-center gap-1.5 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/pin.svg" alt="" width={14} height={14} className="size-3.5" />
                <span className="text-xs font-semibold text-roam-blue">{r.property}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
