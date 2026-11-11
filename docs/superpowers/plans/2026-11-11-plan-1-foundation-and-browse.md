# Plan 1: Foundation and Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A staging site where a traveler searches a destination, sees a list of hotels with realistic prices, and opens a hotel page showing every rate with its plain-English cancellation sentence, all against the RateHawk sandbox.

**Architecture:** Next.js App Router, server-rendered. A typed server-only ETG client wraps the RateHawk API. Pure functions turn ETG rate data into a selling price and a cancellation sentence. Hotel content is stored in Supabase and joined to live prices at request time; pages stream so content appears before prices.

**Tech Stack:** Next.js (latest stable, App Router), TypeScript strict, pnpm, Tailwind CSS, shadcn/ui, `motion`, Supabase (Postgres), zod, decimal.js, tz-lookup, Vitest, Playwright, @axe-core/playwright, Lighthouse CI.

**Spec:** `docs/superpowers/specs/2026-11-11-travel-portal-design.md`
**API notes:** `docs/reference/etg-api-notes.md` (items marked "verify" must be checked against the sandbox by the task that first uses them; correct the notes file when reality differs)

## Where this plan sits

The spec is split into five plans, each leaving working software:

1. **Foundation and browse (this plan):** search → list → hotel page.
2. **Booking:** prebook, checkout, payment interface, confirmation, my bookings, cancel, automatic failure handling, admin page.
3. **Worldwide content and reviews sync:** dump loading, daily refresh, storage sizing.
4. **Guided brief and AI picks:** the four-step brief, area step, three picks, map.
5. **Certification readiness:** RateHawk checklist, full accessibility and speed audit.

Plans 2 to 5 are written when the plan before them is finished, because each depends on what the sandbox turns out to do. Not in this plan: booking, payment, AI, the brief, maps, worldwide sync.

## Global Constraints

- Every price shown is for the whole stay and includes all taxes and fees charged at booking.
- Amounts payable at the hotel are shown beside the price as a separate line and are never added into it.
- Selling price = RateHawk price + markup percentage. Markup is a stored setting, changeable without a release. Net price and markup are never shown to the traveler.
- No strike-through prices. No urgency messages (no "only N left", no countdowns, no "booked N times").
- Room names and meal plans are displayed exactly as RateHawk returns them.
- Cancellation sentences are produced by code from `cancellation_penalties`, never by an AI model. Deadlines arrive in UTC and are shown converted, with the time zone named.
- `residency` (passport country) is sent on every search and hotel-page request.
- Hotel-page responses are never cached. Content endpoints are never called during search or hotel-page requests.
- `metapolicy_struct` and `metapolicy_extra_info` are displayed on the hotel page.
- All RateHawk calls run on the server; credentials never reach the browser.
- All animation uses `motion` imported from `motion/react`.
- WCAG 2.2 AA.
- Speed targets on home, list and hotel pages, mid-range phone over 4G: LCP under 2.0 s, INP under 200 ms, CLS under 0.1.
- English only. USD default currency (the sandbox supports USD only).
- Use numeric `hid` for hotels everywhere.
- Secrets live in `.env.local`, which is git-ignored. Ali fills in the RateHawk values himself.

## Review Focus

1. **A currency with no decimal places (JPY) or three (KWD):** the price is rounded and formatted to that currency's own minor units, not always two.
2. **A cancellation deadline that has already passed, or a rate with no policies at all:** the sentence states the current position ("If you cancel now you lose …" / "Non-refundable …") and never prints a past date as a future deadline.
3. **A hotel returned by search that is missing from the content store:** it is left out of the list, logged for sync, and the page does not crash.
4. **RateHawk is slow, rate-limited (429) or errors:** the traveler sees a clear "prices are taking longer than usual, try again" state with a retry control, never a blank or broken page.
5. **Invalid search input arriving by URL:** past dates, checkout before check-in, more than 30 nights, a child age of 18, 7 adults in a room, missing residency. The page shows the search form with the problem named instead of calling RateHawk.

Each is pinned by a test in the task that owns the code (Tasks 4, 5, 8, 2 and 8, 7).

## File Structure

```
src/env.ts                              validated environment variables
src/lib/etg/client.ts                   HTTP, auth, envelope, errors, retry
src/lib/etg/errors.ts                   EtgError
src/lib/etg/schemas.ts                  zod schemas and types for rates, search, hotel page
src/lib/etg/search.ts                   multicomplete, searchRegion, hotelPage
src/lib/etg/content.ts                  fetchHotelContent
src/lib/pricing/money.ts                Money type, minor units, formatting
src/lib/pricing/price-rate.ts           StayPrice from a payment type + markup
src/lib/policy/cancellation-sentence.ts sentence builder
src/lib/policy/time-zone.ts             hotel time zone and label
src/lib/content/store.ts                Supabase reads/writes for hotels, settings
src/lib/search/params.ts                parse and validate search URL params
src/lib/search/residency.ts             residency cookie
src/app/page.tsx                        home with search form
src/app/search/page.tsx                 results list
src/app/hotel/[hid]/page.tsx            hotel page
src/app/api/destinations/route.ts       autocomplete proxy
src/components/…                        search-form, hotel-card, rate-row, price, policy-list, gallery, prices-unavailable
supabase/migrations/0001_content.sql
scripts/record-fixtures.ts              saves real sandbox responses as test fixtures
scripts/sync-content.ts                 loads content for given hids
tests/fixtures/etg/*.json
tests/e2e/*.spec.ts
```

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: project root via `pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*"`, `src/env.ts`, `.env.example`, `vitest.config.ts`, `playwright.config.ts`, `tests/unit/env.test.ts`, `tests/e2e/home.spec.ts`

**Interfaces:**
- Produces: `env` object from `src/env.ts` with `ETG_BASE_URL: string`, `ETG_KEY_ID: string`, `ETG_API_KEY: string`, `ETG_MODE: "live" | "fixture"`, `SUPABASE_URL: string`, `SUPABASE_SERVICE_ROLE_KEY: string`. Scripts: `pnpm test` (Vitest), `pnpm e2e` (Playwright), `pnpm build`, `pnpm typecheck`.

- [ ] **Step 1:** Scaffold with the command above. Add `motion`, `zod`, `decimal.js`, `tz-lookup`, `@supabase/supabase-js`, `server-only`; dev: `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`. Run `pnpm dlx shadcn@latest init`. Set `"strict": true` and `"noUncheckedIndexedAccess": true` in `tsconfig.json`.
- [ ] **Step 2:** Write `.env.example` listing the six variables with `ETG_BASE_URL=https://api-sandbox.ratehawk.com` and `ETG_MODE=fixture`; confirm `.env*.local` is in `.gitignore`.
- [ ] **Step 3: Failing test** `tests/unit/env.test.ts`:

```ts
import { parseEnv } from "@/env";
test("rejects a missing ETG key", () => {
  expect(() => parseEnv({ ETG_BASE_URL: "https://x", ETG_MODE: "live" })).toThrow(/ETG_KEY_ID/);
});
test("fixture mode does not require ETG credentials", () => {
  const e = parseEnv({ ETG_BASE_URL: "https://x", ETG_MODE: "fixture", SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" });
  expect(e.ETG_MODE).toBe("fixture");
});
```

- [ ] **Step 4:** Run `pnpm test`; expect FAIL (`parseEnv` not defined).
- [ ] **Step 5:** Implement `parseEnv(raw: Record<string, string | undefined>): Env` and `export const env = parseEnv(process.env)` in `src/env.ts` with zod; `import "server-only"` at the top.
- [ ] **Step 6:** `tests/e2e/home.spec.ts`: home page responds 200 and has exactly one `h1`. Replace the scaffold home page with a bare `h1` "Find your stay".
- [ ] **Step 7:** Run `pnpm test && pnpm typecheck && pnpm build && pnpm e2e`; expect all PASS.
- [ ] **Step 8:** Commit: `chore: scaffold Next.js app with test tooling`.

### Task 2: ETG client

**Files:**
- Create: `src/lib/etg/errors.ts`, `src/lib/etg/client.ts`, `tests/unit/etg/client.test.ts`

**Interfaces:**
- Consumes: `env`.
- Produces:
  - `class EtgError extends Error { code: string; httpStatus: number; retryable: boolean; detail?: unknown }`
  - `etgRequest<T>(opts: { method: "GET" | "POST"; path: string; body?: unknown; schema: z.ZodType<T>; timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<T>` returning the parsed `data` field.

- [ ] **Step 1: Failing tests** using an injected `fetchImpl`:

```ts
test("sends Basic auth and returns parsed data", async () => {
  const fetchImpl = vi.fn(async (_u, init) => {
    expect(new Headers(init!.headers).get("authorization")).toBe("Basic " + btoa("id:key"));
    return Response.json({ status: "ok", error: null, data: { n: 1 }, debug: {} });
  });
  expect(await etgRequest({ method: "POST", path: "/api/b2b/v3/x/", body: {}, schema: z.object({ n: z.number() }), fetchImpl })).toEqual({ n: 1 });
});
test("maps an error envelope to EtgError", async () => {
  const fetchImpl = async () => Response.json({ status: "error", error: "invalid_params", data: null, debug: { validation_error: "checkin" } }, { status: 400 });
  await expect(etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl })).rejects.toMatchObject({ code: "invalid_params", httpStatus: 400, retryable: false });
});
test("retries 5xx up to 2 more times then throws retryable", async () => {
  const fetchImpl = vi.fn(async () => new Response("", { status: 502 }));
  await expect(etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl })).rejects.toMatchObject({ retryable: true });
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});
test("429 is not retried and is marked retryable", async () => { /* code "endpoint_exceeded_limit", calls === 1, retryable true */ });
test("aborts after timeoutMs with code 'timeout'", async () => { /* fetchImpl never resolves; timeoutMs 20 */ });
test("schema mismatch throws code 'unexpected_response'", async () => { /* data {n:"a"} */ });
```

- [ ] **Step 2:** Run `pnpm test tests/unit/etg/client.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement. Default `timeoutMs` 30000. Retry only on HTTP 5xx, at most 2 retries, 300 ms then 900 ms apart. `import "server-only"`. The test file sets `ETG_KEY_ID=id`, `ETG_API_KEY=key` through `vi.stubEnv`.
- [ ] **Step 4:** Run the tests; expect PASS.
- [ ] **Step 5:** Commit: `feat: ETG API client with typed errors and retry`.

### Task 3: ETG schemas, search functions and recorded fixtures

**Files:**
- Create: `src/lib/etg/schemas.ts`, `src/lib/etg/search.ts`, `scripts/record-fixtures.ts`, `tests/fixtures/etg/{multicomplete,serp-region,hp-10004834,hp-8819557,overview}.json`, `tests/unit/etg/schemas.test.ts`

**Interfaces:**
- Consumes: `etgRequest`.
- Produces (types inferred from zod schemas):
  - `Guests = { adults: number; children: number[] }[]`
  - `StayQuery = { checkin: string; checkout: string; residency: string; guests: Guests; currency: string }`
  - `PaymentType = { amount: string; currency_code: string; show_amount: string; show_currency_code: string; type: "now" | "hotel" | "deposit"; tax_data: { taxes: Tax[] }; cancellation_penalties: CancellationPenalties }`
  - `Tax = { name: string; included_by_supplier: boolean; amount: string; currency_code: string }`
  - `CancellationPenalties = { free_cancellation_before: string | null; policies: { start_at: string | null; end_at: string | null; amount_charge: string; amount_show: string }[] }`
  - `Rate = { book_hash?: string; search_hash?: string; room_name: string; room_data_trans: { main_name: string; bedding_type: string | null; misc_room_type: string | null }; meal_data: { value: string; has_breakfast: boolean }; amenities_data: string[]; payment_options: { payment_types: PaymentType[] } }`
  - `multicomplete(query: string): Promise<{ hotels: { hid: number; name: string; region_id: number }[]; regions: { id: number; name: string; type: string; country_code: string }[] }>`
  - `searchRegion(regionId: number, q: StayQuery): Promise<{ hid: number; rates: Rate[] }[]>`
  - `hotelPage(hid: number, q: StayQuery): Promise<Rate[]>`
  - In `ETG_MODE=fixture` these three return the recorded fixtures and make no network call.

- [ ] **Step 1:** Write `scripts/record-fixtures.ts`: calls `overview`, `multicomplete` ("Berlin"), `serp/region` for region 2011, and `hp` for hids 10004834 and 8819557 (check-in 30 days out, 2 nights, 2 adults, residency `gb`, currency USD), writing each raw `data` to `tests/fixtures/etg/`. Requires live credentials in `.env.local`. Run `pnpm tsx scripts/record-fixtures.ts`; expect five files written. If region 2011 returns no hotels, try 2395, 2734, 6053839 in turn and record which worked in the API notes.
- [ ] **Step 2:** Read the fixtures and settle each "verify" item in the API notes that they answer (field names in the rate tree, whether `commission_info` is present, which content endpoints are active in `overview`). Update `docs/reference/etg-api-notes.md`.
- [ ] **Step 3: Failing tests:**

```ts
test("hotel page fixture parses and every rate has a payment type", () => {
  const rates = HotelPageData.parse(hp10004834).hotels[0]!.rates;
  expect(rates.length).toBeGreaterThan(0);
  for (const r of rates) expect(r.payment_options.payment_types.length).toBeGreaterThan(0);
});
test("unknown extra fields are tolerated", () => { /* add foo: 1 to a rate; parse succeeds */ });
test("a rate missing room_name is rejected", () => { /* delete room_name; parse throws */ });
test("fixture mode returns fixture data without fetch", async () => { /* stub global fetch to throw; hotelPage(10004834, q) resolves */ });
```

- [ ] **Step 4:** Run; expect FAIL.
- [ ] **Step 5:** Implement schemas (non-strict objects; fields this plan does not use are omitted) and the three functions. `language` is always `"en"`.
- [ ] **Step 6:** Run; expect PASS. Commit: `feat: ETG search schemas, functions and sandbox fixtures`.

### Task 4: Money and stay price

**Files:**
- Create: `src/lib/pricing/money.ts`, `src/lib/pricing/price-rate.ts`, `tests/unit/pricing/*.test.ts`

**Interfaces:**
- Consumes: `PaymentType`, `Tax`.
- Produces:
  - `type Money = { amount: string; currency: string }` (decimal string, already rounded to the currency's minor units)
  - `minorUnits(currency: string): number` (from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`)
  - `roundMoney(amount: Decimal.Value, currency: string): Money` (round half up)
  - `formatMoney(m: Money, locale?: string): string`
  - `applyMarkup(base: Money, markupPercent: number): Money`
  - `type StayPrice = { total: Money; payAtHotel: { label: string; money: Money }[]; net: Money; markupPercent: number }`
  - `priceRate(pt: PaymentType, markupPercent: number, taxNames: Record<string, string>): StayPrice`

Rules: `net` = `show_amount` in `show_currency_code`. `total` = `applyMarkup(net, markupPercent)`. Taxes with `included_by_supplier: false` become `payAtHotel` lines in their own currency, unmarked-up, labelled by `taxNames[name] ?? "Tax or fee"`. Taxes with `included_by_supplier: true` are already inside `show_amount` and produce no line. `markupPercent` must be between 0 and 100 or the function throws.

- [ ] **Step 1: Failing tests:**

```ts
test("12% markup on 211.25 USD is 236.60", () => {
  expect(applyMarkup({ amount: "211.25", currency: "USD" }, 12)).toEqual({ amount: "236.60", currency: "USD" });
});
test("rounds half up", () => { expect(roundMoney("10.005", "USD").amount).toBe("10.01"); });
test("JPY has no decimals", () => { expect(applyMarkup({ amount: "15000", currency: "JPY" }, 12.5)).toEqual({ amount: "16875", currency: "JPY" }); });
test("KWD has three decimals", () => { expect(roundMoney("10.0005", "KWD").amount).toBe("10.001"); });
test("pay-at-hotel taxes are separate and not marked up", () => {
  const p = priceRate(pt({ show_amount: "100.00", taxes: [
    { name: "city_tax", included_by_supplier: false, amount: "7.00", currency_code: "EUR" },
    { name: "vat", included_by_supplier: true, amount: "9.00", currency_code: "USD" }] }), 10, { city_tax: "City tax" });
  expect(p.total).toEqual({ amount: "110.00", currency: "USD" });
  expect(p.payAtHotel).toEqual([{ label: "City tax", money: { amount: "7.00", currency: "EUR" } }]);
});
test("markup outside 0-100 throws", () => { expect(() => applyMarkup({ amount: "1", currency: "USD" }, 101)).toThrow(); });
test("formatMoney never uses floats", () => { expect(formatMoney({ amount: "1234567.10", currency: "USD" }, "en-US")).toBe("$1,234,567.10"); });
```

- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement with `decimal.js`; no `Number` arithmetic on money anywhere. **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: money maths and stay price with markup`.

### Task 5: Cancellation sentence

**Files:**
- Create: `src/lib/policy/time-zone.ts`, `src/lib/policy/cancellation-sentence.ts`, `tests/unit/policy/*.test.ts`

**Interfaces:**
- Consumes: `CancellationPenalties`, `Money`, `applyMarkup`, `formatMoney`.
- Produces:
  - `hotelTimeZone(lat: number, lng: number): string` (IANA zone via `tz-lookup`)
  - `zoneLabel(timeZone: string): string` (`"Asia/Dubai"` → `"Dubai time"`; underscores become spaces; `"UTC"` → `"UTC"`)
  - `cancellationSentence(input: { penalties: CancellationPenalties; total: Money; markupPercent: number; timeZone: string; now: Date }): string`

Rules, in order:
1. Each policy's penalty in selling terms = `applyMarkup(amount_show, markupPercent)`, capped at `total`. Policies with a zero penalty are free periods.
2. `current` = the policy whose window contains `now` (null `start_at` = from the beginning, null `end_at` = no end). `later` = policies starting after `now` with a penalty greater than zero, in time order.
3. No policies at all, or `current` penalty equals `total` and `later` is empty → `Non-refundable. If you cancel you lose {total}.`
4. `current` is free and `later` has one entry → `Free to cancel until {date}, {time} {zone}. After that you lose {amount}.`
5. `current` is free and `later` has several → `Free to cancel until {date}, {time} {zone}. After that you lose {a1}, rising to {aN} from {dateN}.`
6. `current` has a penalty above zero and below `total` → `If you cancel now you lose {amount}.` followed, if `later` is non-empty, by ` From {date}, {time} {zone} you lose {aN}.` using the last later policy.
7. Date format `27 June`, with the year added only if it differs from `now`'s year; time format `11:59 pm`; both in `timeZone`. The deadline shown is the free period's end (`free_cancellation_before` when present, else the first later `start_at`).

- [ ] **Step 1: Failing tests** (`total` = 200.00 USD, markup 10, `now` = 2026-06-01T00:00:00Z, zone `Asia/Dubai` unless stated):

```ts
test("free then full penalty", () => {
  expect(s({ free_cancellation_before: "2026-06-27T19:59:00", policies: [
    { start_at: null, end_at: "2026-06-27T19:59:00", amount_show: "0.00" },
    { start_at: "2026-06-27T19:59:00", end_at: null, amount_show: "181.82" }] }))
    .toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
});
test("non-refundable", () => {
  expect(s({ free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_show: "181.82" }] }))
    .toBe("Non-refundable. If you cancel you lose $200.00.");
});
test("no policies is treated as non-refundable", () => { /* policies: [] → same sentence */ });
test("deadline already passed never prints a past date", () => {
  /* now = 2026-06-28T00:00:00Z, same data as the first test → "Non-refundable. If you cancel you lose $200.00." */
});
test("partial penalty now, full later", () => {
  /* now inside a 50.00 window, later 181.82 from 2026-07-01T20:00:00 →
     "If you cancel now you lose $55.00. From 2 July, 12:00 am Dubai time you lose $200.00." */
});
test("several later tiers", () => {
  /* free until 2026-06-10T20:00:00, then 50.00, then 181.82 from 2026-06-20T20:00:00 →
     "Free to cancel until 11 June, 12:00 am Dubai time. After that you lose $55.00, rising to $200.00 from 21 June." */
});
test("penalty is capped at the total", () => { /* amount_show 500.00 → "$200.00" */ });
test("year shown when it differs", () => { /* deadline 2027-01-05 → "5 January 2027" */ });
test("zoneLabel", () => { expect(zoneLabel("America/New_York")).toBe("New York time"); });
```

Timestamps without an offset are UTC.

- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement with `Intl.DateTimeFormat` (`en-GB` for the date, `en-US` hour12 lower-cased for the time). **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: plain-English cancellation sentence`.

### Task 6: Content store

**Files:**
- Create: `supabase/migrations/0001_content.sql`, `src/lib/content/store.ts`, `src/lib/etg/content.ts`, `scripts/sync-content.ts`, `tests/unit/content/map-hotel.test.ts`, `tests/fixtures/etg/content-10004834.json`

**Interfaces:**
- Consumes: `etgRequest`.
- Produces:
  - Tables: `hotels(hid bigint primary key, name text not null, address text, latitude double precision, longitude double precision, star_rating smallint, kind text, region_id bigint, region_name text, country_code text, time_zone text, check_in_time text, check_out_time text, images jsonb not null default '[]', amenity_groups jsonb not null default '[]', description jsonb not null default '[]', metapolicy_struct jsonb, metapolicy_extra_info text, review_rating numeric(3,1), review_detailed jsonb, synced_at timestamptz not null)`; `settings(key text primary key, value jsonb not null)` seeded with `('markup_percent', '12')`; `missing_hotels(hid bigint primary key, first_seen timestamptz not null default now())`. Row-level security on, no public policies (server uses the service role).
  - `type Hotel` matching the `hotels` row in camelCase, with `images: { category: string; url: string }[]`.
  - `mapEtgHotel(raw: unknown): Hotel` (pure; sets `timeZone` with `hotelTimeZone` when coordinates exist)
  - `getHotels(hids: number[]): Promise<Map<number, Hotel>>`, `getHotel(hid: number): Promise<Hotel | null>`
  - `upsertHotels(hotels: Hotel[]): Promise<void>`, `recordMissing(hids: number[]): Promise<void>`
  - `getMarkupPercent(): Promise<number>` (cached in memory for 60 s)
  - `getDictionaries(): Promise<{ taxNames: Record<string, string>; mealNames: Record<string, string> }>` (read from `settings` key `dictionaries`, cached in memory for 10 minutes; the sync script fills it from `GET /api/b2b/v3/hotel/static/` using the English names of `taxes` and `meals`; empty objects if not yet synced)
  - `imageUrl(url: string, size: "640x350" | "1024x768" | "x220"): string` (replaces `{size}`)
  - `fetchHotelContent(hids: number[]): Promise<unknown[]>` in `src/lib/etg/content.ts`, using whichever content endpoint Task 3 found active.

The starting markup of 12 is a placeholder until Ali sets the real figure (spec section 13, item 6).

- [ ] **Step 1:** Ask Ali to confirm before creating a hosted Supabase project (it may carry a cost); otherwise run against local Supabase (`supabase start`). Write and apply the migration.
- [ ] **Step 2:** Record `content-10004834.json` with a one-off call through `fetchHotelContent`. Settle the content "verify" items in the API notes (star rating, coordinates, `is_closed`, `deleted`).
- [ ] **Step 3: Failing tests:** `mapEtgHotel(fixture)` gives a non-empty `name`, numeric `latitude`/`longitude`, a `timeZone` matching `/^[A-Za-z_]+\/[A-Za-z_]+/`, and `images[0].url` containing `{size}`; `imageUrl("https://h/{size}/a.jpg", "640x350")` is `"https://h/640x350/a.jpg"`; a raw hotel with no coordinates maps with `timeZone: null`; `star_rating: 0` maps to `starRating: null`.
- [ ] **Step 4:** Run; expect FAIL. **Step 5:** Implement mapper, store and `scripts/sync-content.ts` (`pnpm tsx scripts/sync-content.ts --hids 10004834,8819557` or `--from-fixture serp-region` to sync every hid in the recorded search, 100 per request, including review rating and detailed ratings when the reviews endpoint is active). **Step 6:** Run tests; expect PASS. Run the sync for the fixture region; expect a row count printed equal to the number of hids.
- [ ] **Step 7:** Commit: `feat: hotel content store and sync script`.

### Task 7: Search form, residency and URL parameters

**Files:**
- Create: `src/lib/search/params.ts`, `src/lib/search/residency.ts`, `src/app/api/destinations/route.ts`, `src/components/search-form/*`, `tests/unit/search/params.test.ts`, `tests/e2e/search-form.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `multicomplete`, `StayQuery`, `Guests`.
- Produces:
  - `parseSearchParams(sp: Record<string, string | string[] | undefined>, today: Date): { ok: true; regionId: number; regionName: string; query: Omit<StayQuery, "residency"> } | { ok: false; problems: string[] }`
  - URL shape: `/search?region=2011&name=Berlin&in=2026-12-10&out=2026-12-12&rooms=2-5.9,1` (rooms separated by commas; each is adults, then `-` and child ages separated by dots).
  - `encodeRooms(g: Guests): string`, `decodeRooms(s: string): Guests | null`
  - `getResidency(): Promise<string | null>` and `setResidency(code: string)` server action (cookie `residency`, ISO alpha-2 lower case, one year).
  - `GET /api/destinations?q=` → `{ regions: { id, name, type, countryCode }[]; hotels: { hid, name }[] }`; queries shorter than 2 characters return empty lists without calling ETG.

- [ ] **Step 1: Failing unit tests** (`today` = 2026-11-11): a valid URL parses to the expected object; `in` in the past → problem "Check-in is in the past."; `out` not after `in` → "Check-out must be after check-in."; 31 nights → "Stays can be up to 30 nights."; `rooms=7` → "Up to 6 adults per room."; `rooms=2-18` → "Children are aged 17 or under."; five children → "Up to 4 children per room."; ten rooms → "Up to 9 rooms."; missing `region` → "Choose a destination."; `decodeRooms(encodeRooms(g))` round-trips `[{adults:2,children:[5,9]},{adults:1,children:[]}]`.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement `params.ts` and `residency.ts`. **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Build the search form on the home page: destination combobox (ARIA combobox pattern, debounced 250 ms against `/api/destinations`), date range, guests and rooms popover with child-age selects, submit → `/search?...`. If no residency cookie exists, the first submit opens a one-question dialog "Which country issued your passport?" (searchable country list) that stores the cookie and continues. Selecting a hotel in the combobox goes to `/hotel/{hid}?in=…&out=…&rooms=…`.
- [ ] **Step 6:** `tests/e2e/search-form.spec.ts` (fixture mode): typing "Ber" lists Berlin; the form is completable by keyboard alone; first submit asks for passport country and the second visit does not; axe reports no violations on the home page with the popover open.
- [ ] **Step 7:** Run `pnpm e2e`; expect PASS. Commit: `feat: search form with residency and validated URL params`.

### Task 8: Results list

**Files:**
- Create: `src/app/search/page.tsx`, `src/app/search/results.tsx`, `src/lib/search/list.ts`, `src/components/{hotel-card,price,prices-unavailable}.tsx`, `tests/unit/search/list.test.ts`, `tests/e2e/search.spec.ts`

**Interfaces:**
- Consumes: `parseSearchParams`, `getResidency`, `searchRegion`, `getHotels`, `recordMissing`, `getMarkupPercent`, `priceRate`, `cancellationSentence`, `formatMoney`.
- Produces:
  - `type ListItem = { hotel: Hotel; from: StayPrice; freeCancellation: boolean; hasBreakfast: boolean }`
  - `buildList(results: { hid: number; rates: Rate[] }[], hotels: Map<number, Hotel>, ctx: { markupPercent: number; taxNames: Record<string, string> }): { items: ListItem[]; missing: number[] }` (`ctx` comes from `getMarkupPercent` and `getDictionaries`) (per hotel, `from` is the lowest `total` among its rates; hotels with no rates or no content are left out, and hids with no content are returned in `missing`)
  - `sortItems(items: ListItem[], by: "recommended" | "price" | "rating"): ListItem[]` (`recommended` = review rating descending, then price ascending)
  - `filterItems(items, f: { minStars?: number; minRating?: number; freeCancellation?: boolean; breakfast?: boolean; maxPrice?: string }): ListItem[]`
  - `<Price price={StayPrice} nights={number} />` renders the total, "for N nights, taxes and fees included", and one line per `payAtHotel` entry ("+ €7.00 City tax at the hotel").

- [ ] **Step 1: Failing unit tests:** `buildList` picks the lowest total as `from`; a hid absent from `hotels` appears in `missing` and not in `items`; a hotel with `rates: []` is omitted; `sortItems(..., "price")` orders by decimal value so `"99.00"` precedes `"100.00"`; `filterItems` with `freeCancellation: true` keeps only hotels with at least one rate whose `free_cancellation_before` is in the future; `maxPrice` compares decimals.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement `list.ts`. **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Build the page. Invalid params → the search form pre-filled, with the `problems` listed in an alert region, and no ETG call. No residency cookie → redirect to home with the form pre-filled. Valid → the header, search summary and filter controls render immediately; `results.tsx` is an async server component inside `<Suspense>` with fixed-height skeleton cards. Sort and filter are URL params (`sort`, `stars`, `rating`, `free`, `breakfast`, `max`) applied on the server. Call `recordMissing(missing)`. On `EtgError` with `retryable: true` render `<PricesUnavailable>` ("Prices are taking longer than usual.") with a "Try again" link to the same URL; other errors render "We could not load prices for this search." with the same control. Cards link to `/hotel/{hid}` carrying the dates and rooms. Card reveal uses `motion`.
- [ ] **Step 6:** `tests/e2e/search.spec.ts` (fixture mode): the list shows at least one card with a price containing "taxes and fees included"; no element contains "left" or a strike-through (`s`, `del`, `line-through`); an invalid URL shows the named problem; a simulated retryable error (env `ETG_FIXTURE_FAIL=serp`) shows the try-again state; axe reports no violations.
- [ ] **Step 7:** Run `pnpm test && pnpm e2e`; expect PASS. Commit: `feat: search results list with real prices`.

### Task 9: Hotel page

**Files:**
- Create: `src/app/hotel/[hid]/page.tsx`, `src/app/hotel/[hid]/rates.tsx`, `src/lib/hotel/rate-rows.ts`, `src/components/{rate-row,policy-list,gallery,review-summary}.tsx`, `tests/unit/hotel/rate-rows.test.ts`, `tests/e2e/hotel.spec.ts`

**Interfaces:**
- Consumes: `getHotel`, `hotelPage`, `getMarkupPercent`, `priceRate`, `cancellationSentence`, `imageUrl`, `parseSearchParams` (dates and rooms part), `getResidency`.
- Produces:
  - `type RateRow = { key: string; bookHash: string; roomName: string; bedding: string | null; meal: string; mealLabel: string; paymentType: "now" | "hotel" | "deposit"; paymentLabel: string; price: StayPrice; cancellation: string }`
  - `buildRateRows(rates: Rate[], ctx: { markupPercent: number; timeZone: string; now: Date; mealNames: Record<string, string>; taxNames: Record<string, string> }): RateRow[]` (names from `getDictionaries`) (one row per rate per payment type, sorted by `price.total` ascending; `roomName` is `room_name` unchanged; `mealLabel` is `mealNames[meal_data.value]`, falling back to the raw value and never to a better meal; `paymentLabel`: now → "Pay now", deposit → "Pay now", hotel → "Pay at the hotel"; `timeZone` falls back to `"UTC"` when the hotel has none)
  - Plan 2 will link each row's "Reserve" control to checkout using `bookHash`. In this plan the control is present but disabled with the text "Booking opens soon".

- [ ] **Step 1: Failing unit tests** against `hp-10004834.json`: every row's `roomName` equals a `room_name` in the fixture; rows are ascending by total; a rate with `meal_data.value: "nomeal"` and `mealNames: { nomeal: "Room only" }` gives `mealLabel: "Room only"`, and an unknown value gives the raw value; a rate with two payment types yields two rows; each `cancellation` is a non-empty string ending in ".".
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement. **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Build the page. Unknown hid → 404. Content (gallery with the first image eager and sized `1024x768`, the rest lazy; name, stars, address; description; amenity groups; review rating with the eight category scores; `<PolicyList>` rendering every populated `metapolicy_struct` group plus `metapolicy_extra_info` verbatim; check-in and check-out times) renders from the store with no ETG call and is cacheable. `rates.tsx` is an async server component in `<Suspense>` that calls `hotelPage` with `cache: "no-store"` semantics and renders `<RateRow>`s; without dates in the URL it shows the date and guest picker instead. No rates → "No rooms are available for these dates." with the picker. Errors use the same two states as Task 8.
- [ ] **Step 6:** `tests/e2e/hotel.spec.ts` (fixture mode): the page shows the hotel name as `h1`, at least one rate row with a price and a cancellation sentence, the policies section, and no urgency or strike-through text; the rates request is not served from cache (two loads make two fixture reads, counted by a test-only header); axe reports no violations.
- [ ] **Step 7:** Run `pnpm test && pnpm e2e`; expect PASS. Commit: `feat: hotel page with rates, policies and cancellation sentences`.

### Task 10: Speed and accessibility gates

**Files:**
- Create: `lighthouserc.json`, `tests/e2e/a11y.spec.ts`, `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm lhci` and `pnpm ci` (`typecheck`, `test`, `build`, `e2e`, `lhci` in that order).

- [ ] **Step 1:** `lighthouserc.json`: run against the production build in fixture mode on `/`, the fixture `/search?...` URL and `/hotel/10004834?...`; mobile preset with default 4G throttling; assertions as errors: `largest-contentful-paint` ≤ 2000, `cumulative-layout-shift` ≤ 0.1, `total-blocking-time` ≤ 200 (the lab stand-in for INP), `categories:accessibility` ≥ 0.95.
- [ ] **Step 2:** Run `pnpm lhci`; expect it to report each assertion. Fix whatever fails (image sizes and priority, font loading with `next/font`, client JavaScript on the list page) until all pass.
- [ ] **Step 3:** `tests/e2e/a11y.spec.ts`: on each of the three pages, tab order reaches every interactive control, focus is always visible, and the page works at 200% zoom and 320 px width without horizontal scrolling.
- [ ] **Step 4:** Add the CI workflow running `pnpm ci` in fixture mode on every push.
- [ ] **Step 5:** Run `pnpm ci`; expect PASS. Commit: `chore: speed and accessibility gates in CI`.

---

## Done when

- `pnpm ci` passes.
- With `ETG_MODE=live` and sandbox credentials, searching a sandbox region lists hotels with prices, and the page for hotel 10004834 shows its rates, taxes payable at the hotel as separate lines, and a cancellation sentence on every rate.
- `docs/reference/etg-api-notes.md` has no remaining "verify" marks for search, hotel page or content.
