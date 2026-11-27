/** Editorial trip inspiration — static marketing content. */
const TRIPS = [
  { label: "CURATED", title: "7 days in Portugal", places: "Lisbon · Sintra · Porto", image: "/brand/trip-portugal.jpg" },
  { label: "TRENDING", title: "Japan in autumn", places: "Kyoto · Nara · Osaka", image: "/brand/trip-japan.jpg" },
  { label: "FEATURED", title: "Mediterranean sailing", places: "Barcelona · Mallorca · Nice", image: "/brand/trip-med.jpg" },
];

export function TripIdeas() {
  return (
    <section aria-labelledby="trips-heading" className="w-full bg-white px-4 pt-12 pb-6 sm:px-8 lg:px-20">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-5">
        <h2 id="trips-heading" className="text-2xl font-bold text-roam-ink">Trip ideas for your next adventure</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {TRIPS.map((t) => (
            <li key={t.title} className="relative h-[230px] overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.image} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/75" />
              <div className="absolute inset-0 flex flex-col items-start justify-end gap-1 p-[22px]">
                <span className="rounded-full bg-roam-accent px-2 py-[3px] text-[10px] font-bold tracking-[0.8px] text-white">{t.label}</span>
                <h3 className="text-[22px] font-bold text-white">{t.title}</h3>
                <p className="text-[13px] text-white">{t.places}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
