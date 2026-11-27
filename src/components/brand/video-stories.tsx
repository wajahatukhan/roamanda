/** PLACEHOLDER / DEMO video stories — illustrative marketing content, not real guest reviews. */
const STORIES = [
  {
    name: "Clara M.",
    place: "Madrid, Spain",
    rating: 5,
    duration: "1:24",
    quote: "A stay that lives rent-free in my mind.",
    property: "Alfama Boutique Rooftop · Lisbon",
    thumb: "/brand/video-1.jpg",
    avatar: "/brand/avatar-1.jpg",
  },
  {
    name: "Tomás R.",
    place: "Rio de Janeiro, Brazil",
    rating: 5,
    duration: "2:08",
    quote: "Perfect base for exploring the city.",
    property: "Chiado Design Suites · Lisbon",
    thumb: "/brand/video-2.jpg",
    avatar: "/brand/avatar-2.jpg",
  },
  {
    name: "Yuki S.",
    place: "Tokyo, Japan",
    rating: 5,
    duration: "1:47",
    quote: "Boutique charm with a modern touch.",
    property: "Belém Riverside Resort · Lisbon",
    thumb: "/brand/video-3.jpg",
    avatar: "/brand/avatar-3.jpg",
  },
];

const STATS = [
  { value: "1.2M+", label: "verified reviews" },
  { value: "450k", label: "video testimonials" },
  { value: "4.8", label: "average rating" },
];

export function VideoStories() {
  return (
    <section aria-labelledby="reviews-heading" className="w-full bg-roam-surface px-4 py-14 sm:px-8 lg:px-20">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fff1ea] py-[5px] pr-3 pl-2.5 text-[11px] font-bold tracking-[0.5px] text-roam-accent">
              <span aria-hidden className="text-[9px]">▶</span>
              TRAVELER VIDEO STORIES
            </span>
            <h2 id="reviews-heading" className="text-[28px] font-bold text-roam-ink">What travelers are saying</h2>
            <p className="text-sm text-roam-muted">Honest, unfiltered video reviews from real guests</p>
          </div>
          <div aria-hidden className="ml-auto flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-roam-accent text-sm font-bold text-roam-accent">‹</span>
            <span className="flex size-9 items-center justify-center rounded-full bg-roam-accent text-sm font-bold text-white">›</span>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {STORIES.map((s) => (
            <li key={s.name} className="flex flex-col overflow-hidden rounded-2xl border border-roam-border bg-white shadow-[0px_4px_12px_0px_rgba(0,0,0,0.06)]">
              <div className="relative h-[243px] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.thumb} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/85" />
                <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-roam-accent px-2.5 py-[5px] text-[10px] font-bold tracking-[0.5px] text-white">
                  <span className="size-1.5 rounded-full bg-white" />
                  VIDEO STORY
                </span>
                <span className="absolute top-3.5 right-3.5 rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white">{s.duration}</span>
                <span className="absolute top-1/2 left-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/video-play.svg" alt="" width={28} height={28} className="size-7" />
                </span>
              </div>
              <div className="flex flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.avatar} alt="" className="size-11 rounded-full border-2 border-white object-cover" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-roam-ink">{s.name}</span>
                    <span className="text-[11px] text-roam-muted">{s.place}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-[3px]" aria-hidden>
                    {Array.from({ length: s.rating }).map((_, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src="/brand/star-filled.svg" alt="" width={14} height={14} className="size-3.5" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-roam-ink">{s.rating.toFixed(1)}</span>
                  <span className="sr-only">Rated {s.rating} out of 5</span>
                </div>
                <p className="text-[15px] leading-[22px] font-bold text-roam-ink">&ldquo;{s.quote}&rdquo;</p>
                <div className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/pin.svg" alt="" width={14} height={14} className="size-3.5" />
                  <span className="text-xs font-semibold text-roam-accent">{s.property}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-6 pt-2">
          {STATS.map((st) => (
            <div key={st.label} className="flex flex-col gap-0.5">
              <span className="text-[22px] font-bold text-roam-ink">{st.value}</span>
              <span className="text-xs text-roam-muted">{st.label}</span>
            </div>
          ))}
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-roam-accent px-[22px] py-3 text-[13px] font-bold text-white transition-colors hover:bg-roam-accent-dark focus-visible:ring-2 focus-visible:ring-roam-accent focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/share-arrow.svg" alt="" width={16} height={16} className="size-4" />
            Share your story
          </button>
        </div>
      </div>
    </section>
  );
}
