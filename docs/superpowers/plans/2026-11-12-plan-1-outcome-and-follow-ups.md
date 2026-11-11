# Plan 1 outcome and follow-ups

Date: 2026-11-12. Branch `plan-1-foundation-browse`, 38 commits on top of `main`.

## What plan 1 delivered

Search form → results list → hotel page, against the RateHawk sandbox and a
Supabase content store holding 24 sandbox hotels.

- `npm run ci` (typecheck, unit tests, lint, build, browser tests) passes:
  356 unit tests, 84 browser tests.
- `npm run ci:speed` (Lighthouse, simulated phone on 4G) fails one assertion:
  hotel page LCP about 2835 ms against the 2000 ms target. Home 756 ms and
  results 908 ms pass. CLS 0 and accessibility 1.00 on all three.

## Decisions Ali still owns

1. Hotel page speed target: keep 2000 ms, or accept a higher figure for a
   photo-led page.
2. Real markup percentage (placeholder: 12).
3. Questions for RateHawk: automated price re-checks for booked stays; whether
   an in-site AI feature is a separate "Chatbot" certification; which payment
   types the contract includes; what the cancellation windows'
   `commission_info` gross (393.33) versus net (354.00) means; what an empty
   cancellation policy list means.
4. Payment provider, brand name and visual identity.
5. Grouping hotel-page rates by room (today: first 6 rows, rest behind
   "Show all N options").

## Where the built behaviour differs from the plan text

- Cancellation sentence rules were rewritten during the build; the rules as
  built are annotated in the plan under Task 5. Contradictory or incomplete
  supplier data shows "See the full cancellation policy for this rate.", and
  every rate has an expandable "Full cancellation policy".
- An empty policy list shows that neutral sentence, not "Non-refundable".
- "Free cancellation" on the list and its filter use the same classifier as
  the sentence (`src/lib/policy/cancellation-status.ts`).
- List prices are cached in server memory for 5 minutes per search; hotel-page
  rates are never cached.
- Only `deposit` and `now` payment types in the requested currency are priced.
- Region search asks for at most 100 hotels.
- A hotel missing from the content store gets a designed 404 page and is not
  recorded; only search results record missing hotels.
- Fixture mode cannot run in production without `ALLOW_FIXTURE_MODE=1`.
- npm is used, not pnpm. The reveal animation imports `motion/react-mini`.
- Lighthouse runs as `npm run ci:speed`, separate from `npm run ci`.

## Carry into Plan 2 (booking)

First tasks, before any booking code:

- Bound the settings reads (`readSetting`, used by `getMarkupPercent` and
  `getDictionaries`) with the same 3-second timeout as the other store reads.
- Make the local e2e server always start with `TZ=UTC` (do not reuse a server
  started otherwise).

Design inputs from the final review:

- Rate identity: rows are identified by index and the booking hash exists only
  during render. Give each row a server-signed or stored offer (booking hash,
  displayed total, markup, payment type, expiry). Never re-pick a rate by
  index.
- `etgRequest` retries every POST that gets a 5xx. Booking form and finish
  calls need retries off, and a timeout on finish is "unknown outcome".
- `StayPrice.net` is `show_amount` in the requested currency, not the amount
  ETG charges in the contract currency. Add a separate supplier-cost field
  before storing bookings.
- Minor-unit rounding uses CLDR digits (for example HUF 0); do not reuse it
  for payment-provider minor units.
- A hotel-page rate without a booking hash is skipped; a rate carrying both
  `now` and `deposit` would show two "Pay now" rows.
- Policy lines for a stale `free_cancellation_before` read "At any time: free"
  plus a past deadline; a closed penalty window's line omits its end.
- Add unit tests for the live request bodies (residency, currency, language),
  boundary and daylight-saving cases for the cancellation sentence, and a
  markup case that needs rounding.
- ETG client: a body-read stall after timeout is labelled
  `unexpected_response`; 5xx bodies are discarded; a 429 with a non-JSON body
  loses `retryable`.

## Carry into Plan 3 (worldwide content sync)

- Log why the mapper skips a hotel; accept only https image URLs.
- Remove or flag closed and deleted hotels already stored; clear
  `missing_hotels` once content arrives.
- Back off on 429 and report partial upserts.
- Storage: the free Supabase plan (500 MB) will not hold the worldwide
  catalogue.
- Sandbox has no review ratings and few photos; review features can only be
  proven on production data.

## Carry into Plan 4 (guided brief and AI picks)

- Search form: stale suggestions stay selectable while a new query is pending;
  a destination name over 80 characters still pre-fills the box; error routing
  matches message text; `getResidency` costs a POST per submit.
- Results: the heading comes from the `name` parameter and is not tied to the
  region; "Breakfast available" (filter) versus "Breakfast included" (card);
  pagination beyond 100 hotels and truthful empty states when results are
  partial.
- Hotel page: "Change dates" drops the current stay; rate grouping by room; a
  phone gallery (today phones see the lead photo and a count); map.
- No-residency visit to `/search` redirects by meta refresh (HTTP 200).

## Carry into Plan 5 (certification readiness)

- Hotel page speed: remaining levers are about 156 KB of framework JavaScript,
  a 258 KB document with the RSC payload duplicating the markup, and about
  160 ms from the error-boundary chunks.
- Production gate matches `NODE_ENV === "production"` exactly and runs on first
  request; invert it and parse at startup.
- Recorded fixtures under `tests/` are bundled into the server build.
- CI: pin action versions; `lhci` script is POSIX-only and needs a prior build.
- Image optimisation needs a host that runs Next's optimiser (allowed source:
  `https://cdn.worldota.net/t/**`, widths 384/640/1080).
- Accessibility coverage of open popovers and dialogs, text zoom, announced
  status regions, skeleton and error states; heading level in the
  prices-unavailable state; policy text readability; dark-theme contrast.
- Lazy-loaded date picker and residency dialog give no feedback on first open
  over a slow connection.
- If every hotel fails pricing the page reads "No hotels are available"; the
  global error page lacks the site font.
- Autocomplete has no server cache; hotel URLs with dates can be crawled,
  spending the 10-per-minute hotel-page allowance.
