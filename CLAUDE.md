# Rules for AI coding assistants in this repository

Read `docs/HANDOVER.md` first. `AGENTS.md` (written by Next.js) also applies:
this is Next.js 16 with cache components, so check
`node_modules/next/dist/docs/` before using a Next API from memory.

## Before you finish any change

- `npm run ci` must pass (type check, unit tests, lint, build, browser tests).
- New behaviour gets a test. Money and cancellation logic get exact-value
  tests.
- Report what you verified and what you did not.

## Never

- Do floating-point arithmetic on money. Money is a decimal string; use
  `src/lib/pricing/money.ts` and decimal.js.
- Send `net`, `markupPercent`, booking or search hashes, or raw RateHawk
  objects to the browser. `StayPrice` and `RateRow` are server-only; do not
  pass them to client components.
- Cache hotel-page rates, or call RateHawk content endpoints during a search
  or hotel-page request.
- Call RateHawk search or hotel page without the traveler's residency.
- Let an AI model produce a price, room name, meal plan or cancellation term.
- Write cancellation wording that could state a smaller penalty or a later
  deadline than RateHawk's data. Unsure data shows the neutral fallback.
- Add strike-through prices, countdowns, scarcity or other pressure messages.
- Pass `Date` objects for stay dates between server and client. Use
  `YYYY-MM-DD` strings and `src/lib/search/stay-dates.ts`.
- Render supplier text with `dangerouslySetInnerHTML`.
- Read, print, log or commit `.env.local` or any credential.
- Make fixture-mode code reachable in live mode. Every fixture switch checks
  `isFixtureMode()` from `src/env.ts`.

## Always

- Validate supplier data with zod at the boundary; one bad rate or hotel is
  dropped, not allowed to break the page.
- Use the single definitions: `isSoldAtBooking` (which payment types are
  sold), `cancellationStatus` (free cancellation), `priceRate` (selling
  price), the `HID` pattern in `src/lib/hotel/hotel-id.ts`.
- Show room names and meal plans exactly as RateHawk returns them.
- Use the `motion` package for animation.
- Keep pages server-rendered; add client components only where interaction
  needs them, and lazy-load heavy popover or dialog code.
- Meet WCAG 2.2 AA: labelled controls, keyboard operation, visible focus.

## Useful facts

- `ETG_MODE=fixture` replays `tests/fixtures/`; `live` calls the sandbox.
- Sandbox limits: 10 region searches and 10 hotel-page calls per minute.
- The backlog is `docs/superpowers/plans/2026-11-12-plan-1-outcome-and-follow-ups.md`.
- RateHawk API notes: `docs/reference/etg-api-notes.md`.
