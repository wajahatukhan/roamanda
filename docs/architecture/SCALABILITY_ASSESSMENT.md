# 1. Scalability assessment

**Date:** 2026-11-17 · **Scope:** `main` at the handover commit · **Status:** assessment, no code changed.

This document establishes the baseline: what the application is today, how it
would behave under load, and — most importantly for the evolution — **which
modules are reusable as-is and which need refactoring**.

---

## 1.1 What exists today [Existing]

A single **Next.js 16** application (App Router, `cacheComponents: true`,
React 19, TypeScript strict). There is **no separate backend process**: server
components and route handlers *are* the backend, and all RateHawk and database
calls are server-only (`import "server-only"` throughout `src/lib`). ~4,800
lines of app code, ~4,200 lines of tests (356 unit, 84 browser).

Two runtime modes selected by `ETG_MODE` ([src/env.ts](../../src/env.ts)):
`fixture` replays `tests/fixtures/` and touches no network or DB; `live` calls
the RateHawk sandbox and Supabase.

### Request paths [Existing]

```
Home (/)                 search form only — static-ish, fast (LCP ~0.76s)
      │  GET /api/destinations   → multicomplete (autocomplete proxy)
      ▼
Results (/search)        connection() → cachedSearchRegion (5-min in-memory)
                         → getHotelCards (Supabase, 3s timeout)
                         → buildList/price/sort/filter → SSR   (LCP ~0.91s)
      ▼
Hotel (/hotel/[hid])     proxy.ts: hotelExists? → 404 if not
                         content renders immediately from Supabase
                         rates streamed via <Suspense>: hotelPage() live,
                         never cached                           (LCP ~2.8s ✗)
```

Key mechanics, verified in code:

- **Supplier HTTP client** [src/lib/etg/client.ts](../../src/lib/etg/client.ts):
  Basic auth, 30s timeout via `AbortController`, retry on **HTTP 5xx only**
  (300/900ms backoff), zod-validated `{data,status,error}` envelope, typed
  `EtgError` with a `retryable` flag.
- **Search cache** [src/lib/search/serp-cache.ts](../../src/lib/search/serp-cache.ts):
  a module-level `Map`, 5-min TTL, 200 entries, de-dupes concurrent identical
  searches, drops failed searches. **Process-local.**
- **Content store** [src/lib/content/store.ts](../../src/lib/content/store.ts):
  lazy Supabase client (service-role key), bounded reads (3s hotels, 300ms
  `hotelExists`), in-memory caches — markup (60s), dictionaries (10min),
  `hotelExists` LRU (1000 entries). **All process-local.**
- **Pricing** [src/lib/pricing/](../../src/lib/pricing/): decimal-string money
  (`decimal.js`), `priceRate` = net + markup, taxes split into a pay-at-hotel
  line. Pure functions.
- **Policy** [src/lib/policy/cancellation-status.ts](../../src/lib/policy/cancellation-status.ts):
  one classifier for "free cancellation" used by both list and hotel page.
- **Orchestration seam** [src/lib/search/list.ts](../../src/lib/search/list.ts):
  `buildList` joins supplier rates with stored content and prices the cheapest
  eligible rate. This is where normalization already happens for one provider.

---

## 1.2 Module reuse map [Existing + assessment]

The single most important assessment output. "Altitude" = how provider- and
transport-independent the code already is.

| Module | Lines | Provider-neutral? | Verdict | Becomes |
|---|---|---|---|---|
| `lib/pricing/money.ts`, `price-rate.ts` | ~60 | Yes (operates on a `PaymentType` shape) | **Reuse as-is** | Pricing Service core |
| `lib/policy/*` (cancellation status/sentence/lines, time-zone, instant) | ~300 | Yes (operates on `CancellationPenalties`) | **Reuse as-is** | shared policy library |
| `lib/content/map-hotel.ts`, `image-url.ts`, `types.ts` | ~210 | RateHawk-shaped input, neutral output | **Reuse, rename input** | Content Service mapper |
| `lib/content/store.ts` | 375 | Supabase-specific, caches baked in | **Refactor** (split DB access from caching; add repository interface) | Content Service repo |
| `lib/search/list.ts` (buildList/sort/filter) | 121 | Neutral once rates are normalized | **Reuse with a normalized rate type** | Search Service ranking |
| `lib/search/serp-cache.ts` | 53 | Process-local Map | **Refactor to Redis** | shared cache adapter |
| `lib/etg/client.ts` | 97 | Generic HTTP+retry, ETG auth | **Generalize** (per-adapter auth/limits) | adapter HTTP toolkit |
| `lib/etg/search.ts`, `content.ts`, `schemas.ts` | ~280 | **RateHawk-specific** | **Wrap behind adapter** (keep; this *is* `RateHawkAdapter`) | RateHawkAdapter |
| `lib/etg/errors.ts` | 17 | ETG codes | **Generalize** to a normalized error taxonomy | shared error types |
| `lib/search/*` (params, residency, stay-dates, countries, summary) | ~250 | Neutral | **Reuse** | BFF/Search helpers |
| UI (`src/app`, `src/components`) | large | Presentation | **Reuse** | BFF/web tier |

**Finding:** roughly two-thirds of the business logic is already
provider-neutral and test-covered. The RateHawk coupling is concentrated in
`src/lib/etg/*` and in the ETG `Rate`/`PaymentType` zod types that flow outward
from it. Provider independence is therefore a **boundary-introduction** task,
not a rewrite.

---

## 1.3 Scalability analysis of the current design

### What scales well [Existing]
- **Stateless request handling** for the *rendering* path — given shared state
  is externalized, the app can run many instances behind a load balancer.
- **Strict server/client secret isolation** — `net`, `markupPercent`, booking
  hashes and raw supplier objects never reach the browser (enforced in tests).
  This stays valid under any topology.
- **Bounded DB reads** with abort signals — slow queries fail fast rather than
  pinning request threads.
- **Supplier failure isolation at the row level** — `parseHotelsLenient` drops
  one bad rate/hotel instead of failing the page.

### What does **not** scale as-is [Existing → must change]

1. **Process-local caches defeat horizontal scaling.**
   `serp-cache` (5-min search results), `markupCache`, `dictionariesCache`, and
   the `hotelExists` LRU all live in module memory. With N instances behind a
   load balancer each keeps its own copy: cache hit-rate drops, RateHawk's
   **10 searches/min/key** limit is hit far sooner, and concurrent-request
   de-duplication only works within one instance.
   → **Redis** (see [CACHING_AND_PERFORMANCE_STRATEGY.md](CACHING_AND_PERFORMANCE_STRATEGY.md)).

2. **Supplier rate limits are global, caching is not.**
   The whole platform shares one RateHawk key (10 region searches/min, 10 hotel
   pages/min, 30 autocomplete/min — [etg-api-notes.md](../reference/etg-api-notes.md)).
   There is **no distributed rate limiter or token bucket**; limits are only
   respected implicitly by the 5-min cache. Under real traffic this is the
   first hard ceiling. → distributed limiter + per-provider concurrency control.

3. **Single provider, single point of inventory failure.** [Existing]
   All inventory comes from `src/lib/etg`. A RateHawk outage = no results.
   Multi-provider aggregation (brief §5) both removes this and multiplies
   inventory. → [INVENTORY_AGGREGATION_ARCHITECTURE.md](INVENTORY_AGGREGATION_ARCHITECTURE.md).

4. **Supabase free plan is a capacity floor.** [Existing]
   500 MB and auto-pause on inactivity — fine for 24 sandbox hotels, far too
   small for the worldwide catalogue (handover §3, follow-ups Plan 3).
   → managed Postgres with read replicas + object storage for dumps.

5. **Hotel-page latency.** [Verified]
   LCP ~2.8s vs a 2.0s target (fails one Lighthouse assertion). Levers noted in
   follow-ups: ~156 KB framework JS, a 258 KB document duplicating the RSC
   payload, ~160 ms error-boundary chunks. Every hotel page also makes an
   **uncached, mandatory** RateHawk call — latency is supplier-bound.

6. **No booking/transaction layer exists yet.** [Existing]
   Booking, payment, refunds are **not started** (handover §9). The scaling
   discussion for transactional integrity, idempotency and outbox is therefore
   greenfield and must be designed before it is built.

7. **Two settings reads are unbounded.** [Existing]
   `readSetting` (used by `getMarkupPercent`, `getDictionaries`) lacks the 3s
   timeout the other reads have — they sit in front of every price (handover §8,
   follow-ups "first tasks"). Low effort, high value; do early.

8. **Node runtime drift.** [Existing]
   `.nvmrc` pins `26` (but is **untracked** — present on disk, not committed, so
   a fresh clone misses it) and CI uses Node 26, yet `package.json` has **no
   `engines` field**, there is **no Dockerfile**, and the assessed machine runs
   Node v24. → standardize (see [INFRASTRUCTURE_AND_DEVOPS.md](INFRASTRUCTURE_AND_DEVOPS.md)
   and [MIGRATION_ROADMAP.md](MIGRATION_ROADMAP.md) Phase 0).

### Reliability gaps for the booking era [Existing, from follow-ups]
- `etgRequest` **retries every 5xx POST** — unsafe for booking "finish" calls
  (double-booking risk). Booking calls need retries off + "unknown outcome" on
  timeout.
- **Rate identity is by list index**; the booking hash exists only during
  render. Checkout needs a server-held or signed offer (hash, displayed total,
  markup, payment type, expiry). Never re-pick a rate by index.
- `StayPrice.net` is `show_amount` (requested currency), not the contract-
  currency amount ETG charges. Bookings must store a separate supplier-cost
  field.

---

## 1.4 Capacity baseline [Assumption — must be load-tested]

No load test exists. The following are **engineering estimates to be
validated**, not claims:

- A single Next.js instance rendering cached search results (no supplier call)
  should serve on the order of hundreds of req/s for the list page; the
  **binding limit is RateHawk's 10 searches/min**, not CPU, until caching is
  distributed.
- Hotel-page throughput is **hard-capped by the supplier**: 10 hotel-page
  calls/min/key, uncacheable. This is a commercial/contract limit before it is
  an engineering one — raising it needs a RateHawk conversation and/or more
  providers.

**Action:** establish capacity targets and a load-test harness in Phase 1
(see [CACHING_AND_PERFORMANCE_STRATEGY.md](CACHING_AND_PERFORMANCE_STRATEGY.md) §"Capacity targets").

---

## 1.5 Summary of recommendations

1. Keep the code; introduce **boundaries**, not rewrites.
2. **Modular monolith first.** Extract services only on evidence (§MICROSERVICES).
3. Externalize process-local state to **Redis** to unlock horizontal scaling.
4. Add a **distributed, per-provider rate limiter** before raising traffic.
5. Introduce the **`InventoryProvider` interface + RateHawkAdapter** as the
   highest-priority structural change (brief §5).
6. Plan the move off the **Supabase free plan** before worldwide content.
7. Fix the cheap, high-value items now: bound settings reads, add `engines` +
   Dockerfile, keep Node 26 everywhere.
8. Design **booking transactional integrity** (idempotency, signed offers,
   outbox) before any booking code.
