import { StarRating } from "./star-rating";

/** PLACEHOLDER / DEMO CONTENT — activities are not part of the app's inventory. Prices are illustrative. */
const ACTIVITIES = [
  { tag: "Tours", title: "Historic walking tours", rating: 4.9, reviews: 2418, price: "from $35 per person", image: "/brand/act-tours.jpg" },
  { tag: "Food", title: "Cooking classes", rating: 4.8, reviews: 1284, price: "from $75 per person", image: "/brand/act-food.jpg" },
  { tag: "Water", title: "Day cruises", rating: 4.7, reviews: 987, price: "from $120 per person", image: "/brand/act-water.jpg" },
  { tag: "Nature", title: "Hiking adventures", rating: 4.9, reviews: 763, price: "from $90 per person", image: "/brand/act-nature.jpg" },
];

export function ThingsToDo() {
  return (
    <section aria-labelledby="todo-heading" className="w-full bg-white px-4 pt-12 pb-6 sm:px-8 lg:px-20">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-5">
        <h2 id="todo-heading" className="text-2xl font-bold text-roam-ink">Things to do</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIVITIES.map((a) => (
            <li key={a.title} className="flex flex-col overflow-hidden rounded-2xl border border-roam-border bg-white">
              <div className="h-[160px] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image} alt="" className="size-full object-cover" />
              </div>
              <div className="flex flex-col gap-1.5 p-3.5">
                <span className="w-fit rounded bg-[#fff1ea] px-2 py-[3px] text-[10px] font-bold tracking-[0.3px] text-[#c2410c]">{a.tag}</span>
                <h3 className="text-sm font-semibold text-roam-ink">{a.title}</h3>
                <StarRating rating={a.rating} count={a.reviews} />
                <p className="text-xs text-roam-muted">{a.price}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
