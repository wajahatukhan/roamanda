# Handover: travel portal

Written 2026-11-12 for the development team taking this over from Ali.
Everything below describes `main` at the commit this file was added in.

## 1. What this is, in one minute

A hotel booking website for premium travelers, built on the RateHawk
(Emerging Travel Group, "ETG") B2B API. The company is Zaviamo Private Limited.

The product idea: replace "scroll through 300 hotels" with a confident short
recommendation and honest, all-in prices. The AI part of that idea is **not
designed in detail and not built**. It is yours to shape (section 7).

What exists today is the plain booking-site foundation, **browse only**:

| Works | Does not exist yet |
|---|---|
| Home page search form (destination, dates, guests, passport country) | Booking, checkout, payment |
| Results list with all-in prices, sort and filter | Any AI feature |
| Hotel page: photos, rates, cancellation terms, policies | More than 24 hotels of stored content |
| RateHawk sandbox integration and a Supabase content store | A visual identity (the UI is deliberately plain) |
| 356 unit tests, 84 browser tests, CI on GitHub | RateHawk certification, production credentials |

Rough progress: one of five planned parts.

## 2. Run it in ten minutes

Requirements: Node 26, npm. Do not put the project in an iCloud-synced or
otherwise file-synced folder; sync clients create duplicate files that break
the build.

```bash
git clone https://github.com/aleeahsan/travel-portal.git
cd travel-portal
npm ci
cp .env.example .env.local
npm run dev
```

With the untouched `.env.local` the site runs in **fixture mode**: it replays
recorded RateHawk responses and needs no credentials or database. That is
enough to work on UI.

For live sandbox data, fill in `.env.local` (get the values from Ali, section
3) and set `ETG_MODE=live`.

Things to try at `http://localhost:3000`:

- Search "Paris" in fixture mode. Whatever you search, fixture mode replays
  one recorded search (22 Los Angeles hotels).
- `/hotel/10004834?in=<future date>&out=<later date>&rooms=2` is the richest
  hotel page (photos, 18 rates, taxes payable at the hotel).
- In live mode only the Los Angeles sandbox region (id 2011) has stored hotel
  content. Other hotels show "We don't have details for this hotel yet."

Commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run ci` | Type check, unit tests, lint, build, browser tests. Must pass before merging. |
| `npm run ci:speed` | Lighthouse on a simulated phone. Currently fails one assertion (section 8). |
| `npm run test` / `npm run e2e` | Unit tests (Vitest) / browser tests (Playwright) on their own |
| `npm run sync:content -- --hids 10004834,8819557` | Load hotel content from RateHawk into Supabase (live credentials needed) |
| `npx tsx scripts/record-fixtures.ts` | Re-record the sandbox search and hotel-page fixtures |

## 3. Access you need from Ali

| Thing | What to ask for |
|---|---|
| GitHub | Collaborator access to `aleeahsan/travel-portal` (private) |
| RateHawk sandbox | API key ID and token. Also ask to be copied on the integration thread `APIR-59299` with Denis Botanov, RateHawk's integration specialist. |
| Supabase | Membership of the organisation holding the project `travel-portal` (id `rgxwykodxjptirpvpryg`, region ap-southeast-2). Each developer should create their own secret key in the dashboard; do not pass one key around. |

Secrets live only in `.env.local`, which is git-ignored. Share them through a
password manager, never by chat or email. `SUPABASE_SERVICE_ROLE_KEY` must be
a **secret** key (`sb_secret_…`), not the publishable one.

The Supabase project is on the free plan: 500 MB, and it pauses after a period
of inactivity. That is fine for the sandbox and too small for the worldwide
hotel catalogue.

## 4. Read these, in this order

1. `README.md`: setup and commands.
2. `docs/superpowers/specs/2026-11-11-travel-portal-design.md`: the product
   design Ali approved. Lines marked "(Ali)" are his decisions; lines marked
   "(my call)" were defaults chosen by the AI assistant and are open to
   change.
3. `docs/superpowers/plans/2026-11-12-plan-1-outcome-and-follow-ups.md`: what
   was built, where it differs from the plan, and a per-area list of known
   follow-ups. **This is the backlog.**
4. `docs/reference/etg-api-notes.md`: working notes on the RateHawk API,
   corrected against real sandbox responses.
5. `CLAUDE.md`: the rules an AI coding assistant must follow in this repo.
   Useful for humans too.

`docs/superpowers/plans/2026-11-11-plan-1-foundation-and-browse.md` is the
original build plan. It is history; the cancellation rules in it were
superseded (the annotation inside says how).

RateHawk's own documentation: https://docs.emergingtravel.com/docs/integration-guide/
and the integration requirements page linked from it. Certification reviews
the site against those requirements.

## 5. How the code is organised

Next.js 16 (App Router, `cacheComponents: true`), TypeScript strict, Tailwind
4, shadcn/ui, `motion` for animation, Supabase (Postgres), zod, decimal.js.
About 4,800 lines of application code and 4,200 lines of tests.

```
src/app/                 pages and route handlers
  page.tsx               home (search form)
  search/                results list
  hotel/[hid]/           hotel page (content + streamed live rates)
  api/destinations/      autocomplete proxy
  error.tsx, global-error.tsx, not-found.tsx
src/proxy.ts             returns a real 404 for hotels not in the content store
src/components/          UI; components/ui is generated shadcn code
src/lib/etg/             RateHawk client, zod schemas, search and hotel-page calls
src/lib/pricing/         money maths and the selling price (markup, taxes)
src/lib/policy/          cancellation status, sentence and full policy lines
src/lib/content/         Supabase content store and the RateHawk content mapper
src/lib/search/          URL parameters, residency cookie, list building, search cache
src/lib/hotel/           rate rows, gallery, policies for the hotel page
supabase/migrations/     database schema
scripts/                 content sync, fixture recording, Lighthouse helpers
tests/unit, tests/e2e    Vitest and Playwright; tests/fixtures holds recorded responses
```

How a page view works:

1. **Results** (`/search`): validate the URL → read the passport-country
   cookie → RateHawk region search (held in server memory for 5 minutes per
   search) → join with stored hotel content → price each hotel's cheapest
   eligible rate → render on the server.
2. **Hotel** (`/hotel/[hid]`): stored content renders at once; rates are
   fetched from RateHawk on every request, never cached, and streamed in.

Two modes, set by `ETG_MODE`: `live` calls RateHawk and Supabase; `fixture`
replays `tests/fixtures/` and touches neither. Browser tests and Lighthouse
run in fixture mode. Fixture mode refuses to start in production unless
`ALLOW_FIXTURE_MODE=1`.

## 6. Rules that must not be broken

These come from RateHawk's requirements, from Ali's brief, or from bugs
already found once. `CLAUDE.md` has the same list in terse form.

Money and honesty:

- The first price a traveler sees is the price they pay: whole stay, taxes
  and fees charged at booking included. Amounts payable at the hotel are shown
  beside it on their own line and never added in.
- Selling price = RateHawk's price + markup. The markup is a row in the
  Supabase `settings` table (`markup_percent`, currently a placeholder of 12).
  Net cost, markup and booking hashes must never reach the browser: keep them
  in server components and check the page payload in tests.
- No strike-through prices, countdowns, "only N left" or similar pressure.
- All money is decimal strings handled with decimal.js. No floating-point
  arithmetic on money.
- Cancellation text is produced by code from RateHawk's data, never by an AI
  model, and must never state a smaller penalty or a later deadline than the
  data. When the data is contradictory the site shows a neutral sentence plus
  the full policy.
- One function decides "free cancellation" for every screen:
  `src/lib/policy/cancellation-status.ts`.

RateHawk rules:

- Hotel-page rates are never cached. Search-list prices may be cached briefly
  as approximate "from" prices.
- Hotel content and reviews are copied into our database on a schedule. The
  content endpoints must not be called during a search or hotel-page request.
- Passport country (residency) is sent on every search and hotel-page call.
- Room names and meal plans are shown as RateHawk returns them. Hotel policies
  (`metapolicy_struct`, `metapolicy_extra_info`) are displayed.
- Sandbox limits on our key: 10 region searches and 10 hotel-page calls per
  minute, 30 autocomplete calls per minute.

Engineering:

- Stay dates cross between server and browser only as `YYYY-MM-DD` strings.
  Passing `Date` objects shifted bookings by a day for some time zones.
- Supplier data is untrusted: it is validated by zod at the boundary, one bad
  rate must not break a page, and supplier text is rendered as text only.
- All RateHawk and database calls stay on the server.
- Animation uses the `motion` package (Ali's standing rule).
- This is Next.js 16 with cache components. Its APIs differ from older
  versions; check `node_modules/next/dist/docs/` before relying on memory, as
  `AGENTS.md` says.

## 7. The AI part: open, and yours to design

Ali's intent, in his words: easy travel planning with AI assistance, rather
than searching through endless lists of hotels. He has asked that the team
work out what that should be.

What exists as input, none of it binding:

- **Six ideas** discussed with Ali, all of which he liked:
  1. Three picks, not 300: describe the trip, get three hotels each with a
     reason and one honest trade-off.
  2. Plain-English fine print (the non-AI version of this is built).
  3. Price-drop watch after booking a refundable rate.
  4. Location-first: choose the neighbourhood before the hotel.
  5. Ask the hotel anything, answered from guest reviews.
  6. Group shortlist: share picks and vote.
- **A direction Ali chose** from three options: a short guided brief (trip
  type, where, when and who, what matters most, plus a free-text box) leading
  to three picks, with the normal list one click away. The alternatives were
  chat-first, and a classic search with AI picks on top. Section 6 and 7 of
  the design document describe this.
- **Audience:** premium buyers; family holidays, escapes, personal getaways,
  business travel.

Constraints that will apply whatever you design:

- RateHawk certifies each product separately and lists "Chatbot" as a product
  type. Whether an AI feature inside the website counts is an unanswered
  question for Denis. A chat-first design carries the most risk here.
- An AI model must not be the source of any price, room name, meal plan or
  cancellation term. Those come from RateHawk data, rendered by code.
- RateHawk's review data may be stored and used offline, not queried live.
  The sandbox contains no reviews and few photos, so review-based features
  can only be proven on production data.
- Automated price re-checks for booked stays (idea 3) may not be allowed;
  that is another open question for Denis.
- The existing pages must keep working without the AI. The design expects the
  plain flow to be certifiable on its own, with AI features behind a switch.

## 8. Known problems

- **The UI is plain.** It is accurate and accessible and does not look
  premium. No brand, palette, typography or photography direction exists.
- **Hotel page speed.** Largest Contentful Paint is about 2.8 s on a simulated
  mid-range phone over 4G, against a 2.0 s target. Home (0.76 s) and results
  (0.91 s) pass. `npm run ci:speed` and the GitHub `speed` job fail on this
  one assertion; the `checks` job passes. Whether the target stays at 2.0 s is
  Ali's decision.
- **Hotel page length.** Rates are a flat list (first six shown, the rest
  behind "Show all N options"). Some rows differ only by an attribute that is
  not displayed. Grouping by room is an open design question.
- **Phones see one photo** and a count; there is no gallery view.
- **Two database reads have no timeout** (markup and tax/meal names). Fix
  this first; they sit in front of every price.
- Everything else known is listed by area in the follow-ups document.

## 9. What is left, as originally planned

The design split the work into five parts. Only the first is done. You are
free to re-plan.

| Part | Scope | State |
|---|---|---|
| 1. Foundation and browse | Search, results, hotel page | Done |
| 2. Booking | Prebook, checkout, payment, confirmation, my bookings, cancel, automatic refunds on failure, admin page | Not started |
| 3. Worldwide content | Load and refresh every RateHawk hotel and its reviews | Not started |
| 4. AI planning | Section 7 | Not designed |
| 5. Certification readiness | RateHawk checklist, speed and accessibility audit, production hardening | Not started |

Before writing booking code, read "Carry into Plan 2" in the follow-ups
document. In short: rates are currently identified by list position, which is
not stable between requests, so checkout needs a server-held or signed offer;
the HTTP client retries failed POSTs, which is unsafe for booking calls; and
the stored price should record what RateHawk charges in the contract currency
as well as what the traveler saw.

## 10. Decisions and answers still outstanding

With RateHawk (Denis), none yet asked as far as the repository knows:

1. Are automated price re-checks for an already-booked stay allowed, and
   through which endpoint?
2. Does an AI feature inside the website need a separate "Chatbot"
   certification?
3. Which payment types does the contract include: deposit only, or also "now"
   and "pay at hotel"? Under "deposit" we charge the traveler ourselves.
4. In the sandbox, cancellation windows carry a `commission_info` gross of
   393.33 against a net of 354.00 while the rate itself shows no commission.
   What does that gross represent, and are there limits on how we set selling
   prices?
5. What does an empty cancellation policy list mean?

With Ali:

- The real markup percentage.
- A payment provider the company can open an account with.
- Brand name and visual identity.
- Whether the hotel page keeps the 2.0 s target.
- Launch coverage. He chose "worldwide from day one"; the sandbox cannot test
  that, and it needs a paid database plan.
- Customer support. He said there is no support team yet, so failed bookings
  must refund and notify automatically.

## 11. Testing and CI

- Unit tests are plain Vitest with no network. Money, cancellation and
  parsing logic have exact-value tests; keep that standard.
- Browser tests run a production build in fixture mode on port 3100, with the
  server in UTC and some tests in other browser time zones. Failure states are
  simulated with cookies that only work in fixture mode
  (`src/lib/search/fixture-failure.ts`).
- GitHub Actions runs two independent jobs on every push: `checks`
  (`npm run ci`) and `speed` (`npm run ci:speed`). Treat `checks` as the gate.
- Recorded fixtures contain absolute dates in December 2026. Tests are written
  not to depend on today's date, but re-record them if the sandbox data shape
  changes.

## 12. How this code was produced

It was built over two days by AI coding agents directed by an AI assistant,
with a separate reviewing agent for every task and a whole-branch review at
the end. Ali made the product decisions; the assistant made many technical
ones, each recorded as "my call" in the design or as a difference in the
follow-ups document. Nothing here has been reviewed by a human engineer, used
by real travelers, or run against RateHawk's production API. Read it with
that in mind, and change what you disagree with.
