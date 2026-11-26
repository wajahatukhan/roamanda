import type { ReactNode } from "react";
import { Check, Star, Lock, DollarSign } from "lucide-react";

const TRUST = [
  { icon: Check, text: "Free cancellation on most stays" },
  { icon: Star, text: "4.8 traveler rating" },
  { icon: Lock, text: "Secure booking" },
  { icon: DollarSign, text: "Price match promise" },
];

/**
 * Roamanda hero: a full-width orange banner with the headline and the structured search.
 * The design's single search pill is realised with the app's real `SearchForm` (slotted as `children`).
 * The gradient uses the accessible accent oranges so the white text meets WCAG AA (the brighter
 * brand orange fails white-text contrast).
 */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="w-full bg-gradient-to-br from-roam-accent to-roam-accent-dark px-4 py-12 sm:px-8 sm:py-14 lg:px-20"
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        <h1 id="hero-heading" className="max-w-3xl text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-[52px]">
          Roam the world, your way.
        </h1>
        <p className="max-w-2xl text-base text-white sm:text-lg">
          Discover hand-picked stays, flights and experiences — crafted for curious travelers.
        </p>

        <div id="search" className="w-full scroll-mt-24">
          {children}
        </div>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-center gap-1.5">
              <t.icon className="size-3.5" aria-hidden />
              {t.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
