# 4. Inventory aggregation architecture

**Status:** proposed. This is the **highest-priority structural change**
(brief §5). It generalizes today's single RateHawk integration
([src/lib/etg/*](../../src/lib/etg/)) into a provider-independent aggregation
layer, without discarding the working ETG code — that code *becomes* the first
adapter.

---

## 4.1 Goal

The platform must never depend on one inventory provider. Future suppliers:
RateHawk, Hotelbeds, WebBeds, DidaTravel, TBO, and later flights/activities/cars.
Everything above the adapters works on a **normalized domain model** and knows
nothing of a supplier's auth, shapes, hashes, limits or error codes.

---

## 4.2 Three layers

```
        Search / Booking services
                  │  (normalized model only)
                  ▼
   ┌──────────────────────────────────┐
   │   Inventory Orchestrator          │  select providers · fan-out ·
   │   (provider-neutral)              │  timeouts · merge · de-dupe · rank
   └──────────────┬───────────────────┘
       ┌──────────┼───────────┬───────────────┐
       ▼          ▼           ▼               ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐    ┌─────────┐
  │RateHawk │ │Hotelbeds│ │ WebBeds │ …  │  Dida   │   each: auth, requests,
  │Adapter  │ │Adapter  │ │ Adapter │    │ Adapter │   validation, error map,
  └────┬────┘ └─────────┘ └─────────┘    └─────────┘   limits, retries, refs
       │ wraps existing src/lib/etg
       ▼
   RateHawk B2B API
```

---

## 4.3 The provider contract [Proposed]

A `InventoryProvider` interface. Methods are **adapted to each provider's real
capabilities** — the brief is explicit that identical workflows must not be
forced where supplier APIs differ. Capabilities are declared, not assumed.

```ts
interface InventoryProvider {
  readonly id: ProviderId;              // "ratehawk" | "hotelbeds" | ...
  readonly capabilities: ProviderCapabilities;

  searchHotels(q: NormalizedSearchQuery): Promise<ProviderSearchResult>;
  getHotelDetails(ref: HotelRef, q: StayContext): Promise<NormalizedHotel>;
  getAvailableRates(ref: HotelRef, q: StayContext): Promise<NormalizedRate[]>;

  preBook(offer: ProviderOffer): Promise<PrebookResult>;
  createBooking(req: NormalizedBookingRequest): Promise<BookingHandle>;
  confirmBooking(handle: BookingHandle): Promise<BookingResult>;
  getBookingStatus(ref: BookingRef): Promise<NormalizedBookingStatus>;
  cancelBooking(ref: BookingRef): Promise<CancelResult>;
  getBookingDetails(ref: BookingRef): Promise<NormalizedBooking>;
}

interface ProviderCapabilities {
  search: boolean; hotelPage: boolean; prebook: boolean; booking: boolean;
  cancellation: boolean; residencyRequired: boolean;
  maxHotelsPerSearch: number;           // RateHawk: 100 (REGION_HOTELS_LIMIT)
  rateLimits: Record<Endpoint, { requests: number; perSeconds: number }>;
  supportsGeoSearch: boolean; supportsRegionSearch: boolean;
}
```

**Capability-gated orchestration:** the orchestrator checks `capabilities`
before calling a method, so a provider lacking geo-search or prebook is simply
not asked, rather than erroring. This keeps workflows honest to each supplier
(brief §5 "Do not force identical workflows").

### Normalized types [Proposed]
- `NormalizedRate`: room, meal/board (kept verbatim per the "show as returned"
  rule), amenities, cancellation penalties, a **provider-neutral `OfferToken`**
  (encapsulates the supplier's `book_hash`/`match_hash`), plus server-side
  `supplierCost` (contract currency) distinct from the shown amount.
- `NormalizedHotel`/`HotelCard`: already provider-neutral in
  [src/lib/content/types.ts](../../src/lib/content/types.ts).
- `NormalizedBookingStatus`: `ok | processing | requires_action | failed`
  (maps RateHawk `ok|processing|3ds|error`).

---

## 4.4 Provider adapters [Proposed; RateHawk = refactor of Existing]

Each adapter owns, in isolation:

| Concern | RateHawkAdapter source today |
|---|---|
| Authentication | Basic auth in [client.ts](../../src/lib/etg/client.ts) `attempt()` |
| API requests | `etgRequest`, `searchRegion`, `hotelPage`, `multicomplete`, `fetchHotelContent` |
| Response validation | zod in [schemas.ts](../../src/lib/etg/schemas.ts) + `parseHotelsLenient` (drop-bad-rows) |
| Error mapping | [errors.ts](../../src/lib/etg/errors.ts) `EtgError` → normalized taxonomy |
| Rate limits | documented in [etg-api-notes.md](../reference/etg-api-notes.md); enforce via shared limiter |
| Timeouts | 30s `AbortController` in `attempt()` |
| Retries | **5xx only** today — **must be per-operation** (reads retry, booking finish does not) |
| Booking refs / hashes | `book_hash` (24h), `match_hash`, `partner_order_id` (UUID, new per retry) |
| Cancellation rules | parsed by [policy/](../../src/lib/policy/) from `cancellation_penalties` |
| Provider business logic | residency mandatory; sandbox limits; `is_closed`/`deleted` skip |

**Refactor, do not rewrite:** `src/lib/etg` moves behind the interface. The
generic transport (timeout, envelope parsing, retry policy) is lifted into a
shared adapter toolkit parameterized by auth + limits + retry policy; the
ETG-specific paths, bodies and schemas stay in `RateHawkAdapter`.

**Critical per-operation retry fix [Existing gap]:** `etgRequest` retries every
5xx POST (follow-ups: unsafe for booking). The toolkit must take a retry policy
per call — safe for `searchHotels`/`getAvailableRates`, **off** for
`createBooking`/`confirmBooking`, where a timeout is an *unknown outcome* to be
reconciled, never blindly retried.

---

## 4.5 The orchestrator [Proposed]

Provider-neutral. Responsibilities (brief §5 "Inventory Orchestration"):

1. **Provider selection** — configurable per search/commercial rules: one,
   several, or all eligible providers. Config lives in settings (hot-reloadable
   like `markup_percent` today), keyed by market/residency/channel.
2. **Concurrent fan-out** with **per-provider timeouts** and a **global search
   deadline** — a slow provider is dropped, fast ones still return
   (`Promise.allSettled` + deadline). Extends today's row-level fail-soft to the
   provider level.
3. **Rate-limit respect** — a shared, distributed token bucket per provider per
   endpoint (Redis), replacing today's implicit "the 5-min cache keeps us under
   the limit". Mandatory before multi-provider or higher traffic.
4. **Normalization** — each adapter returns normalized types; the orchestrator
   never sees supplier JSON.
5. **Hotel mapping / de-duplication** — the same physical hotel from two
   providers must be merged. **[Assumption]** mapping keys differ per supplier;
   needs a mapping table (provider hotel id ↔ platform hotel id), seeded from
   supplier mapping dumps where available. Until a provider's mapping is proven,
   its hotels are shown un-merged rather than wrongly merged.
6. **Offer de-duplication & comparison** — identical room/board/cancellation
   offers compared by **selling price**; cheapest eligible wins
   (today's `cheapestItem` logic in [list.ts](../../src/lib/search/list.ts)
   generalizes once rates are normalized).
7. **Reference preservation** — the winning offer keeps its provider id + opaque
   `OfferToken`, so Booking calls the right adapter with the right hash.

### Request flow [Proposed]
```
search → orchestrator
  ├─ select providers (config: market/residency/channel)
  ├─ for each eligible provider, within deadline & rate budget:
  │     adapter.searchHotels(normalizedQuery)   (parallel, allSettled)
  ├─ drop providers that errored/timed out  (log, continue)
  ├─ normalize + merge hotels (mapping table) + de-dupe offers
  ├─ price each offer (Pricing lib) + cancellation status (Policy lib)
  └─ return unified, ranked NormalizedRate[] + provenance
```

---

## 4.6 Caching & provider restrictions [Verified + Assumption]

**Investigate per provider before caching or aggregating (brief §5).** Known
RateHawk rules, already honored today and binding on any design:
- **Hotel-page rates: never cached** ([rates.tsx](../../src/app/hotel/[hid]/rates.tsx)
  uses `connection()`, no `use cache`, uncached fetch).
- **Search-list prices may be cached briefly** as approximate "from" prices
  (5-min `serp-cache`). Keep this per-provider; move to Redis.
- **Content endpoints never on the request path**; copied offline into the store.
- **Residency sent on every search and hotel page** — a normalized-query
  invariant; `getAvailableRates` must refuse without it.

Other providers will have **different** caching rules, hash lifetimes
(RateHawk `book_hash` = 24h) and limits — each adapter declares them; the
orchestrator never assumes RateHawk's rules apply elsewhere.

---

## 4.7 Migration of the existing code [Proposed]

1. Define `InventoryProvider`, `ProviderCapabilities`, normalized types.
2. Implement `RateHawkAdapter` by **moving** `src/lib/etg/*` behind it (no
   behavior change; existing unit tests pin behavior).
3. Introduce the orchestrator with RateHawk as the only registered provider;
   `buildList` consumes normalized rates. Search/hotel pages unchanged
   externally — a pure internal refactor, fully covered by current tests.
4. Add the shared distributed rate limiter + per-call retry policy.
5. Only then add a second adapter (Hotelbeds is the usual next), proving the
   interface against a genuinely different API before claiming provider
   independence.

**Completion criterion for "provider-independent":** a second adapter runs in
the orchestrator and returns merged, de-duplicated, priced results, with the
existing Plan-1 tests still green and no supplier type leaking above the
adapter layer.
