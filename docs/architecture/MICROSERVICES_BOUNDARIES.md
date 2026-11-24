# 3. Microservices boundaries

**Status:** proposed boundaries. Most begin as **modules in the monolith**;
the table marks what is extracted and when, and nothing is split "to satisfy a
microservices checklist" (brief §6).

For each service: business responsibility · reusable existing code · proposed
contract · data ownership · dependencies · scaling · failure modes · where it
runs first.

---

## 3.0 Summary table

| Service | First home | Extract when | Owns data |
|---|---|---|---|
| 1. BFF / API Gateway | Next.js app | stays the web tier | sessions (Redis) |
| 2. Identity & User | module → service | real accounts land (Plan 2) | users, residency prefs |
| 3. Inventory Aggregation | module | multi-provider + latency isolation (Phase 5) | none (stateless) |
| 4. Search | module in BFF | search QPS or ranking cost grows | search cache (Redis) |
| 5. Content | module → service | worldwide sync (Phase 4) | hotels, dictionaries |
| 6. Pricing | module (library) | rarely — stays a library | markup/rules (settings) |
| 7. Booking | **service early** | Plan 2, needs txn isolation | orders, offers |
| 8. Payment | **service early** | Plan 2, PCI + isolation | payments, refunds |
| 9. Notification | worker | with Booking | outbound log |
| 10. Background Jobs/Workers | **worker deployable early** | Phase 2 | job state |
| 11. Admin | module → service | operational need | — (reads others) |
| 12. Analytics/Reporting | worker + warehouse | Phase 6 | warehouse |

---

## 3.1 BFF / API Gateway
- **Responsibility:** the only tier the browser talks to — SSR, UI, request
  validation, auth/session, residency cookie, secret isolation, response
  shaping. Fans out to downstream services and composes results.
- **Reuse [Existing]:** all of `src/app`, `src/components`,
  `src/lib/search/{params,residency,stay-dates,countries,summary,initial}`,
  `proxy.ts`. These are already the web tier.
- **Contract [Proposed]:** HTTP(S) to the browser (unchanged URLs: `/`,
  `/search`, `/hotel/[hid]`, `/api/destinations`); typed calls downstream.
- **Data:** none durable except sessions (Redis).
- **Scaling:** stateless, horizontal behind a load balancer + CDN.
- **Failure:** if a downstream fails, render the existing fail-soft states
  (`PricesUnavailable`, "still adding details", 404 via `proxy.ts`).
- **Home:** stays the Next.js app permanently.

## 3.2 Identity & User Service
- **Responsibility:** accounts, authentication, profile, saved residency,
  travelers, booking history ownership. Minimal today (residency is an
  anonymous cookie, `getResidency` costs a POST per submit — follow-ups).
- **Reuse [Existing]:** `src/lib/search/residency.ts`, `countries.ts`.
- **Contract [Proposed]:** `signUp/signIn/getSession`, `getProfile`,
  `getResidency(userId)`, `setResidency`.
- **Data:** `users`, `residency_prefs`, auth tokens. Supabase Auth is a viable
  first implementation; keep the option to move to a dedicated IdP.
- **Scaling:** read-heavy, cache sessions in Redis.
- **Failure:** anonymous browse must keep working if Identity is down (today's
  cookie-only path already does).
- **Home:** module now; service when real accounts arrive (Plan 2 checkout).

## 3.3 Inventory Aggregation Service — *highest priority boundary*
- **Responsibility:** the provider-independent inventory layer — adapter
  registry, provider selection, concurrent supplier fan-out, timeouts, failure
  isolation, response normalization, hotel/offer de-duplication, offer token
  preservation. Full design in
  [INVENTORY_AGGREGATION_ARCHITECTURE.md](INVENTORY_AGGREGATION_ARCHITECTURE.md).
- **Reuse [Existing]:** `src/lib/etg/*` becomes `RateHawkAdapter`;
  `client.ts` generalizes into the adapter HTTP toolkit; `parseHotelsLenient`'s
  drop-bad-rows discipline becomes the normalization contract.
- **Contract [Proposed]:** the `InventoryProvider` interface — `searchHotels`,
  `getHotelDetails`, `getAvailableRates`, `preBook`, `createBooking`,
  `confirmBooking`, `getBookingStatus`, `cancelBooking`, `getBookingDetails`
  (adapted to each provider's real capabilities).
- **Data:** none durable (stateless); uses Redis for per-provider rate-limit
  tokens and short result caches.
- **Scaling:** CPU/IO bound on fan-out; scale independently of the web tier —
  the main reason to extract it (latency isolation).
- **Failure:** a provider timing out returns partial results; a provider error
  is mapped to the normalized taxonomy and isolated.
- **Home:** module in Phase 1; extracted in Phase 5 when provider count and
  latency justify independent scaling.

## 3.4 Search Service
- **Responsibility:** turn a destination query into a ranked, filtered,
  content-joined, priced list. Orchestrates Inventory + Content + Pricing.
- **Reuse [Existing]:** `src/lib/search/list.ts` (buildList/sort/filter/count),
  `serp-cache.ts` (→ Redis).
- **Contract [Proposed]:** `search(destination, stay, residency, filters, sort,
  providerPolicy) → { items, total, partial }`.
- **Data:** search cache in Redis (shared across instances).
- **Scaling:** horizontal; bounded by supplier limits until caching is
  distributed and providers multiply.
- **Failure:** returns `partial`/empty with truthful messaging (already built).
- **Home:** module inside the BFF; separate only if search QPS or ranking cost
  (e.g. AI re-ranking) grows.

## 3.5 Content Service
- **Responsibility:** own hotel content (names, photos, policies, amenities,
  reviews, dictionaries); serve reads to Search/Hotel; run the sync pipeline
  from supplier dumps/content endpoints. Content endpoints must **never** be
  called on the request path (RateHawk rule, enforced today).
- **Reuse [Existing]:** `src/lib/content/*` (store, map-hotel, image-url,
  types, chunk), `src/lib/etg/content.ts`, `scripts/sync-content.ts`.
- **Contract [Proposed]:** `getHotel(hid)`, `getHotelCards(hids)`,
  `hotelExists(hid)`, `getDictionaries()`, `getMarkup()`; write side:
  `upsertHotels`, `recordMissing`, `saveDictionaries` (sync/admin only).
- **Data:** **owner** of `hotels`, `settings`, `missing_hotels` (schema in
  [supabase/migrations/0001_content.sql](../../supabase/migrations/0001_content.sql)).
- **Scaling:** read-heavy; read replicas + Redis card cache; write path is the
  batch sync (off request path).
- **Failure:** bounded reads already fail fast; a content miss degrades to the
  existing 404 / "still adding details" states.
- **Home:** module now; extract in Phase 4 with worldwide sync (storage +
  throughput force the split).

## 3.6 Pricing Service
- **Responsibility:** selling price from supplier net + markup, tax/pay-at-hotel
  split, currency rounding, markup-rule resolution. **The money invariants
  live here.**
- **Reuse [Existing]:** `src/lib/pricing/*` verbatim; markup source is the
  `settings` table via Content.
- **Contract [Proposed]:** `priceRate(normalizedPayment, markupRule, taxNames)`,
  `applyMarkup`, `roundMoney`. Likely stays an **in-process library**, not a
  network service, to avoid a hop on every priced rate.
- **Data:** markup rules (today one `markup_percent` setting; future:
  per-market/provider/channel rules).
- **Scaling:** pure functions, negligible cost.
- **Failure:** a rate that cannot be priced is dropped (already: `buildList`
  `unpriceable` path).
- **Home:** shared library; never a separate deployable unless rules get an
  independent admin lifecycle.

## 3.7 Booking Service — *extract early*
- **Responsibility:** the order lifecycle — hold a signed/stored **Offer**,
  prebook, booking form, finish, status polling, cancellation, order info;
  orchestrate Payment; emit booking events via outbox. Transactional integrity
  is paramount.
- **Reuse [Existing]:** none built (Plan 2). Reuses Inventory adapters'
  `preBook/createBooking/confirmBooking/cancelBooking` and the ETG booking
  notes in [etg-api-notes.md](../reference/etg-api-notes.md) §Booking.
- **Contract [Proposed]:** `createOffer`, `prebook(offer)`, `startBooking`,
  `finishBooking(idempotencyKey)`, `getStatus`, `cancel`.
- **Data:** **owner** of `offers`, `orders`, `order_items`, `booking_events`
  (outbox). Stores supplier cost in contract currency **and** the displayed
  selling price (follow-ups).
- **Scaling:** write-heavy, transactional; isolate from browse load — the
  reason to extract early. Retries **off** on finish; timeout = "unknown
  outcome" reconciled by a worker.
- **Failure:** failed booking → automatic refund + notify (no support team —
  handover §10). Idempotent finish; outbox guarantees the event.
- **Home:** **new service from Plan 2**, though it may physically ship inside
  the monolith process first behind a hard module boundary.

## 3.8 Payment Service — *extract early*
- **Responsibility:** charge/capture/refund via the payment provider (TBD —
  handover §10), store payment records, handle provider webhooks, reconcile.
  Under RateHawk "deposit" the platform charges the traveler itself.
- **Reuse [Existing]:** none; `money.ts` for amounts (but **not** its CLDR
  minor-unit rounding for provider minor units — follow-ups).
- **Contract [Proposed]:** `authorize`, `capture`, `refund(idempotencyKey)`,
  `getPayment`, `handleWebhook(signed)`.
- **Data:** **owner** of `payments`, `refunds`, `payment_events`. PCI scope
  isolated here; prefer a provider that keeps card data off our servers
  (tokenization) — consistent with the "never enter card data" rule.
- **Scaling:** modest volume, high integrity; isolate for PCI and blast-radius.
- **Failure:** every capture/refund idempotent; webhook signature verified
  (HMAC-SHA256, per ETG notes for supplier webhooks).
- **Home:** **new service from Plan 2.**

## 3.9 Notification Service
- **Responsibility:** transactional email/SMS (booking confirmation, failure +
  automatic-refund notice, cancellation). Consumes booking/payment events.
- **Reuse [Existing]:** none.
- **Contract [Proposed]:** event consumer + `send(template, to, data)`.
- **Data:** outbound message log (idempotent by event id).
- **Scaling:** async worker; retries with dead-letter queue.
- **Failure:** at-least-once delivery, deduped by event id.
- **Home:** a worker consumer, introduced with Booking.

## 3.10 Background Jobs / Workers — *separate deployable early*
- **Responsibility:** content sync, dump ingestion, reconciliation of unknown-
  outcome bookings, price-drop checks (if permitted), scheduled refresh,
  analytics event shipping, `missing_hotels` clearing.
- **Reuse [Existing]:** `scripts/sync-content.ts`, `record-*-fixtures.ts`.
- **Contract [Proposed]:** queue consumers + cron-triggered jobs.
- **Data:** job/run state; writes through owning services.
- **Scaling:** independent of web; scale per queue depth.
- **Failure:** retries, DLQ, idempotent handlers.
- **Home:** a **second deployable in Phase 2** (the first real split), because
  sync and reconciliation must not run inside request handlers.

## 3.11 Admin Service
- **Responsibility:** operational console — markup management, content sync
  triggers, booking/refund inspection, supplier toggles, missing-hotel review.
- **Reuse [Existing]:** reads/writes through Content/Booking/Pricing contracts.
- **Contract [Proposed]:** authenticated admin APIs + UI.
- **Data:** none of its own; audited writes to others.
- **Scaling:** low traffic.
- **Failure:** least-privilege; all writes audited.
- **Home:** module/route group first; separate app if access control warrants.

## 3.12 Analytics & Reporting Service
- **Responsibility:** business intelligence — search/booking funnels, provider
  win rates, margin, conversion. Consumes events; never queries operational DBs
  directly for heavy reporting.
- **Reuse [Existing]:** none.
- **Contract [Proposed]:** event ingestion → warehouse; read-only reporting API.
- **Data:** **owns** the analytics warehouse (separate store).
- **Scaling:** independent; batch/stream.
- **Failure:** lossy-tolerant; never on the booking critical path.
- **Home:** Phase 6, warehouse + worker.

---

## 3.13 Extraction sequence (evidence-driven)

```
Phase 1  Monolith modules + hard boundaries   (no new deployables)
Phase 2  + Workers deployable + Redis          (async off request path)
Phase 3  + Booking + Payment services          (transactional isolation, PCI)
Phase 4  + Content Service + sync pipeline      (worldwide storage/throughput)
Phase 5  + Inventory Aggregation Service        (provider fan-out, latency)
Phase 6  + Analytics + AI planning              (new capability)
```

A service is extracted only when at least one holds: (a) it needs to scale on a
different axis than the web tier, (b) it needs failure/PCI isolation, (c) it has
a distinct write-ownership and deploy lifecycle, or (d) it has a different team
owner. Until then it is a module with a typed contract — cheap to extract later,
cheap to keep in now.
