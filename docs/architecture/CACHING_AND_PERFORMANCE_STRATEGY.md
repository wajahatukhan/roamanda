# 6. Caching and performance strategy

**Status:** proposed. Caching here is constrained by **honesty and supplier
rules**, not only speed: prices must be truthful, hotel-page rates must never be
cached, and no pressure/scarcity mechanics may be introduced (`CLAUDE.md`,
handover §6). Those rules bound every recommendation below.

---

## 6.1 What may and may not be cached [Verified — binding]

| Data | Cacheable? | Why | Today |
|---|---|---|---|
| Hotel-page rates | **No** | RateHawk rule; price shown is price paid | `connection()`, no `use cache`, uncached fetch ([rates.tsx](../../src/app/hotel/[hid]/rates.tsx)) |
| Search-list "from" prices | Briefly (≈5 min) | approximate, refreshed on hotel page | in-memory `serp-cache` (TTL 5 min) |
| Hotel **content** (names, photos, policies) | Yes, long | changes rarely, synced offline | Supabase + in-proc card cache |
| Dictionaries (tax/meal names) | Yes (10 min) | static-ish | in-proc cache |
| Markup percent | Yes, short (60 s) | operational setting | in-proc cache |
| `hotelExists` | Yes (5 min true / 60 s false) | cheap guard for `proxy.ts` | in-proc LRU |
| Autocomplete | **Not cached today** | 30/min supplier limit | gap — add a short shared cache |

---

## 6.2 The core problem: process-local caches [Existing → fix]

Every cache above lives in **module memory** (`serp-cache.ts` Map;
`markupCache`, `dictionariesCache`, `existsCache` in `store.ts`). With one
instance this is fine. With N instances behind a load balancer it means N cold
caches, N× supplier calls, and no cross-instance de-duplication — so the
**5-min search cache no longer protects the 10-searches/min RateHawk limit**.

**Recommendation: move shared, cross-request state to Redis** (Phase 2),
keeping a tiny in-process L1 (sub-second) in front of it to cut Redis round
trips. A cache adapter interface lets each cache choose L1-only, L1+Redis, or
Redis-only:

```
request → L1 (in-proc, ms TTL) → L2 (Redis, shared) → origin (supplier/DB)
                                   ▲ single-flight lock dedupes concurrent misses
```

- **Search results (L2 Redis):** key = `regionId|checkin|checkout|rooms|
  residency|currency|provider` (today's `serp-cache` key, plus provider).
  Single-flight lock replaces today's per-instance promise de-dup so a cache
  miss triggers **one** supplier call platform-wide.
- **Markup / dictionaries / hotelExists (L1+L2):** short L1, Redis L2 shared.
- **Autocomplete (L2 Redis, short TTL):** new; protects the 30/min limit
  (follow-ups note autocomplete has no server cache today).

**Invariant preserved:** no hotel-page rate cache, L1 or L2. The hotel page
stays request-time only.

---

## 6.3 Distributed rate limiting [Proposed — prerequisite for scale]

Supplier limits are **global per key** (RateHawk: 10 search/min, 10 hp/min,
30 autocomplete/min, 100 static/day). Today nothing enforces them except the
implicit cache. Introduce a **Redis token bucket per provider per endpoint**;
the orchestrator acquires a token before each supplier call and sheds load (or
serves slightly stale list prices) when exhausted, rather than getting a 429.
This is the single most important change to raise traffic safely.

---

## 6.4 Application performance [Proposed]

- **CDN** in front of the BFF for static assets and the home page; SSR pages
  with request-time data (search, hotel) are not CDN-cached but their assets
  are. Images already go through Next's optimizer from the supplier CDN
  (avif/webp, widths 384/640/1080 — [next.config.ts](../../next.config.ts)).
- **Horizontal scaling + load balancing** — possible once §6.2 lands; until
  then a single instance is the safe default.
- **Hotel-page LCP (2.8 s vs 2.0 s target) [Verified]** — levers from
  follow-ups Plan 5: ~156 KB framework JS, a 258 KB document whose RSC payload
  duplicates the markup, ~160 ms error-boundary chunks. The rates are already
  streamed behind a skeleton (`<Suspense>`), so the supplier latency is off the
  critical path for first paint; the LCP cost is document/JS weight. Whether the
  2.0 s target holds for a photo-led page is **Ali's open decision** (handover
  §8) — do not optimize blindly against a target that may move.
- **SSR performance** — keep the minimal-column card reads; keep heavy
  popover/dialog code lazy (already done: residency dialog, date picker,
  stay-picker are `*-lazy`).

---

## 6.5 Inventory & search performance [Proposed]

Covered in [INVENTORY_AGGREGATION_ARCHITECTURE.md](INVENTORY_AGGREGATION_ARCHITECTURE.md):
parallel provider requests with per-provider timeouts and a global deadline,
controlled concurrency under the token bucket, response normalization and hotel
mapping, and provider failure isolation (partial results, never a failed page).

---

## 6.6 Background processing & reliability [Proposed]

- **Queues** (SQS) for sync, reconciliation, notifications, analytics; **retries
  with backoff**; **dead-letter queues** for poison messages; scheduled jobs via
  cron/EventBridge. See [EVENT_DRIVEN_ARCHITECTURE.md](EVENT_DRIVEN_ARCHITECTURE.md).
- **Circuit breakers** per provider/downstream — open after sustained failure,
  serve degraded results, half-open to probe recovery.
- **Idempotency** — booking finish, payment capture/refund, webhook handlers
  keyed by idempotency key / event id (Redis + DB uniqueness).
- **Distributed tracing** — OpenTelemetry across BFF → services → providers, so
  a slow search is attributable to a specific supplier call.
- **Request timeouts & graceful degradation** — every supplier/DB call has a
  deadline (already true for DB reads and the 30 s supplier timeout); the search
  path returns partial results rather than hanging.

---

## 6.7 Capacity targets & load testing [Proposed — replace assumptions with data]

No load test exists; the brief requires realistic targets, not claims. Establish
in Phase 1–2:

1. **Define SLOs** (proposed starting points, to ratify): search list p95 < 1.5 s
   warm-cache; hotel page p95 bounded by supplier + < 0.5 s platform overhead;
   availability 99.9% for browse.
2. **Load-test harness** (k6/Gatling) against fixture mode first (no supplier
   limit) to find the *platform* ceiling, then a rate-limited live profile to
   find the *supplier* ceiling.
3. **Publish the real numbers** — instances needed per 1k concurrent browsers,
   Redis hit-rate, DB pool headroom — and set autoscaling thresholds from them.

**Known hard ceiling [Verified]:** hotel-page throughput is capped by RateHawk
at 10 calls/min/key and is uncacheable. Beyond that, scaling requires more
providers or a commercial limit increase — an architecture doc cannot remove a
supplier contract limit, and this must be stated plainly to stakeholders.
