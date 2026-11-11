import { CARD_BODY, CARD_IMAGE, CARD_SHELL } from "./hotel-card";

const bar = "rounded-md bg-muted";

/** Same shell and minimum heights as a real card, so results replace it without moving the page. */
export function ResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div data-testid="results-skeleton" aria-busy="true">
      <p role="status" className="sr-only">
        Loading prices for your stay
      </p>
      <ul aria-hidden className="flex flex-col gap-5">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={CARD_SHELL}>
            <div className={`${CARD_IMAGE}`} />
            <div className={CARD_BODY}>
              <div className="flex flex-col gap-3">
                <div className={`${bar} h-5 w-56 max-w-full`} />
                <div className={`${bar} h-3.5 w-24`} />
                <div className={`${bar} h-3.5 w-44 max-w-full`} />
              </div>
              <div className="flex flex-col justify-end gap-2 sm:items-end">
                <div className={`${bar} h-7 w-28`} />
                <div className={`${bar} h-3.5 w-44 max-w-full`} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
