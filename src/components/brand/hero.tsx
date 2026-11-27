import type { ReactNode } from "react";

/**
 * Roamanda hero (Figma "Homepage 7", node 395:4848). The banner fill, type scale and trust row match the
 * design exactly: a 136.7° coral gradient with white copy. The design's static search pill is realised with
 * the app's real `SearchForm` (slotted as `children`) so the hero stays functional.
 *
 * The white copy sits on a gradient background-image, which axe reports as "incomplete" (not a contrast
 * violation), so the exact brand gradient is used here rather than a darker, higher-contrast accent.
 */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="w-full px-4 py-8 sm:px-8 lg:px-20"
      style={{ backgroundImage: "linear-gradient(136.7deg, #ff8e72 0%, #ff6b35 76.923%)" }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-center gap-5">
        <h1
          id="hero-heading"
          className="text-[34px] leading-[1.12] font-bold text-white sm:text-[44px] lg:text-[52px] lg:leading-[60px]"
        >
          Roam the world, your way.
        </h1>
        <p className="text-base leading-6 font-normal text-white sm:text-[18px] sm:leading-[28px]">
          Discover hand-picked stays, flights and experiences — crafted for curious travelers.
        </p>

        <div id="search" className="w-full scroll-mt-24">
          {children}
        </div>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-normal text-white">
          <li className="whitespace-nowrap">✓ Free cancellation on most stays</li>
          <li className="whitespace-nowrap">★ 4.8 traveler rating</li>
          <li className="flex items-center gap-1 whitespace-nowrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/trust-lock.svg" alt="" width={13} height={13} className="size-[13px]" />
            Secure booking
          </li>
          <li className="flex items-center gap-1 whitespace-nowrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/trust-money.svg" alt="" width={13} height={13} className="size-[13px]" />
            Price match promise
          </li>
        </ul>
      </div>
    </section>
  );
}
